// src/app/api/captive/login-callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * Login Callback Endpoint
 * 
 * Called after successful MikroTik login to track usage.startTime
 * This is called from the captive portal after user logs in successfully.
 * 
 * Flow:
 * 1. User verifies M-Pesa code → Gets voucher credentials
 * 2. Auto-login submits to MikroTik → User is authenticated
 * 3. Success page calls this endpoint → Sets startTime and expectedEndTime
 * 4. Voucher is now actively being used
 */

// CORS headers for captive portal access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST /api/captive/login-callback - Track successful login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      voucher_code,
      router_id,
      mac_address,
      ip_address,
    } = body;

    // Validate required fields
    if (!voucher_code || !router_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Validate router ID
    if (!ObjectId.isValid(router_id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid router ID',
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Connect to database
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Find voucher
    const voucher = await db.collection('vouchers').findOne({
      'voucherInfo.code': voucher_code,
      routerId: new ObjectId(router_id),
    });

    if (!voucher) {
      return NextResponse.json(
        {
          success: false,
          error: 'Voucher not found',
        },
        {
          status: 404,
          headers: corsHeaders,
        }
      );
    }

    // Check if already started (prevent duplicate calls)
    if (voucher.usage?.startTime) {
      console.log(`[Login Callback] Voucher ${voucher_code} already has startTime, skipping update`);
      return NextResponse.json(
        {
          success: true,
          message: 'Login already tracked',
          already_started: true,
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Calculate expected end time
    const startTime = new Date();
    const durationMinutes = voucher.usage?.maxDurationMinutes || voucher.voucherInfo?.duration || 60;
    const expectedEndTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    // Update voucher with usage start time
    const updateResult = await db.collection('vouchers').updateOne(
      {
        _id: voucher._id,
        'usage.startTime': null, // Only update if not already set (race condition protection)
      },
      {
        $set: {
          'usage.used': true,
          'usage.startTime': startTime,
          'usage.expectedEndTime': expectedEndTime,
          ...(mac_address && { 'usage.deviceMac': mac_address }),
          ...(ip_address && { 'usage.deviceIp': ip_address }),
          status: 'active', // Change from 'paid' to 'active'
          updatedAt: startTime,
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      // Another request already set startTime
      console.log(`[Login Callback] Race condition: Another request already set startTime for ${voucher_code}`);
      return NextResponse.json(
        {
          success: true,
          message: 'Login already tracked',
          already_started: true,
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    console.log(`[Login Callback] ✓ Tracked login for voucher ${voucher_code}`, {
      startTime: startTime.toISOString(),
      expectedEndTime: expectedEndTime.toISOString(),
      durationMinutes,
      mac_address,
      ip_address,
    });

    // Log audit entry
    await db.collection('audit_logs').insertOne({
      user: {
        userId: voucher.customerId || null,
      },
      action: {
        type: 'login',
        resource: 'voucher',
        resourceId: voucher._id,
        description: `Voucher ${voucher_code} activated`,
      },
      timestamp: startTime,
      metadata: {
        voucherCode: voucher_code,
        routerId: router_id,
        macAddress: mac_address,
        ipAddress: ip_address,
        expectedEndTime: expectedEndTime.toISOString(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Login tracked successfully',
        start_time: startTime.toISOString(),
        expected_end_time: expectedEndTime.toISOString(),
        duration_minutes: durationMinutes,
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error('[Login Callback] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to track login',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
