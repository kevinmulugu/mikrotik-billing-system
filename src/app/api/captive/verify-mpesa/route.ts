// src/app/api/captive/verify-mpesa/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper function: Validate M-Pesa transaction code format
function validateMpesaCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  
  // Remove whitespace and convert to uppercase
  const cleaned = code.trim().toUpperCase();
  
  // M-Pesa codes are typically 10 characters, alphanumeric
  // Examples: RBK123456, RCK7A2B3C4, RDK9X8Y7Z6
  if (cleaned.length < 8 || cleaned.length > 12) return false;
  
  // Must be alphanumeric only
  if (!/^[A-Z0-9]+$/.test(cleaned)) return false;
  
  return true;
}

// Helper function: Normalize MAC address format
function normalizeMacAddress(mac: string): string {
  if (!mac) return '';
  
  // Remove all non-alphanumeric characters
  const cleaned = mac.replace(/[^a-fA-F0-9]/g, '');
  
  // Convert to uppercase
  const upper = cleaned.toUpperCase();
  
  // Format as AA:BB:CC:DD:EE:FF
  const formatted = upper.match(/.{1,2}/g)?.join(':');
  
  return formatted || mac;
}

// Helper function: Format duration to human-readable string
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return minutes === 1 ? '1 Minute' : `${minutes} Minutes`;
  }
  
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? '1 Hour' : `${hours} Hours`;
  }
  
  if (minutes < 10080) {
    const days = Math.floor(minutes / 1440);
    return days === 1 ? '1 Day' : `${days} Days`;
  }
  
  const weeks = Math.floor(minutes / 10080);
  return weeks === 1 ? '1 Week' : `${weeks} Weeks`;
}

// Helper function: Format bandwidth
function formatBandwidth(bandwidth: { upload: number; download: number }): string {
  const formatSpeed = (kbps: number): string => {
    if (kbps >= 1024) {
      return `${Math.floor(kbps / 1024)}Mbps`;
    }
    return `${kbps}kbps`;
  };
  
  return `${formatSpeed(bandwidth.upload)}/${formatSpeed(bandwidth.download)}`;
}

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

// POST /api/captive/verify-mpesa - Verify M-Pesa transaction and get voucher
export async function POST(request: NextRequest) {
  let attemptLogId: ObjectId | null = null;
  
  try {
    // Parse request body
    const body = await request.json();
    const {
      transaction_code,
      router_id,
      mac_address,
    } = body;

    // Validate required fields
    const errors: any = {};

    if (!transaction_code) {
      errors.transaction_code = 'M-Pesa transaction code is required';
    } else if (!validateMpesaCode(transaction_code)) {
      errors.transaction_code = 'Invalid M-Pesa transaction code format';
    }

    if (!router_id) {
      errors.router_id = 'Router ID is required';
    } else if (!ObjectId.isValid(router_id)) {
      errors.router_id = 'Invalid router identifier format';
    }

    if (!mac_address) {
      errors.mac_address = 'MAC address is required';
    }

    // Return validation errors
    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_input',
          message: 'Invalid request parameters. Please check your input.',
          details: errors,
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Normalize inputs
    const transactionCode = transaction_code.trim().toUpperCase();
    const normalizedMac = normalizeMacAddress(mac_address);

    // Connect to database
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Check rate limiting - max 5 attempts per MAC per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttempts = await db.collection('verification_attempts').countDocuments({
      mac_address: normalizedMac,
      timestamp: { $gte: oneHourAgo },
    });

    if (recentAttempts >= 5) {
      console.warn(`Rate limit exceeded for MAC: ${normalizedMac}`);
      
      return NextResponse.json(
        {
          success: false,
          error: 'rate_limit_exceeded',
          message: 'Too many verification attempts. Please wait 1 hour before trying again.',
          retry_after: 3600,
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'Retry-After': '3600',
          },
        }
      );
    }

    // Log verification attempt
    const attemptLog = await db.collection('verification_attempts').insertOne({
      mac_address: normalizedMac,
      router_id: new ObjectId(router_id),
      transaction_code: transactionCode,
      success: false,
      error_code: null,
      timestamp: new Date(),
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
    });

    attemptLogId = attemptLog.insertedId;

    // Find router
    const router = await db.collection('routers').findOne({
      _id: new ObjectId(router_id),
    });

    if (!router) {
      await db.collection('verification_attempts').updateOne(
        { _id: attemptLogId },
        { $set: { error_code: 'router_not_found' } }
      );

      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'transaction_not_found',
          message: 'M-Pesa transaction code not recognized. Please check and try again.',
        },
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': String(5 - recentAttempts - 1),
          },
        }
      );
    }

    // Find payment by M-Pesa transaction ID
    const payment = await db.collection('payments').findOne({
      'mpesa.transactionId': transactionCode,
      userId: router.userId,
    });

    // Payment not found or doesn't belong to this router owner
    if (!payment) {
      await db.collection('verification_attempts').updateOne(
        { _id: attemptLogId },
        { $set: { error_code: 'payment_not_found' } }
      );

      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'transaction_not_found',
          message: 'M-Pesa transaction code not recognized. Please check and try again.',
        },
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': String(5 - recentAttempts - 1),
          },
        }
      );
    }

    // Check payment status
    if (payment.status === 'pending') {
      await db.collection('verification_attempts').updateOne(
        { _id: attemptLogId },
        { $set: { error_code: 'payment_pending' } }
      );

      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'payment_pending',
          message: 'Payment is still being processed. Please wait a few moments and try again.',
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    if (payment.status !== 'completed') {
      await db.collection('verification_attempts').updateOne(
        { _id: attemptLogId },
        { $set: { error_code: 'payment_failed' } }
      );

      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'payment_failed',
          message: 'Payment was not successful. Please make a new purchase.',
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Check if payment is reconciled
    if (!payment.reconciliation?.isReconciled) {
      await db.collection('verification_attempts').updateOne(
        { _id: attemptLogId },
        { $set: { error_code: 'payment_not_reconciled' } }
      );

      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'payment_pending',
          message: 'Payment verification in progress. Please wait a few moments.',
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Find linked voucher
    const voucherLink = payment.linkedItems?.find(
      (item: any) => item.type === 'voucher'
    );

    if (!voucherLink || !voucherLink.itemId) {
      await db.collection('verification_attempts').updateOne(
        { _id: attemptLogId },
        { $set: { error_code: 'no_voucher_linked' } }
      );

      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'transaction_not_found',
          message: 'No voucher found for this transaction. Please contact support.',
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Get voucher details
    const voucher = await db.collection('vouchers').findOne({
      _id: voucherLink.itemId,
    });

    if (!voucher) {
      await db.collection('verification_attempts').updateOne(
        { _id: attemptLogId },
        { $set: { error_code: 'voucher_not_found' } }
      );

      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'transaction_not_found',
          message: 'Voucher not found. Please contact support.',
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Verify voucher belongs to this router
    if (voucher.routerId.toString() !== router._id.toString()) {
      await db.collection('verification_attempts').updateOne(
        { _id: attemptLogId },
        { $set: { error_code: 'wrong_router' } }
      );

      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'wrong_router',
          message: 'This voucher is for a different WiFi hotspot.',
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Check if voucher is already used
    if (voucher.usage?.used === true) {
      await db.collection('verification_attempts').updateOne(
        { _id: attemptLogId },
        { $set: { error_code: 'voucher_used' } }
      );

      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'voucher_used',
          message: 'This voucher has already been used. Purchase a new package to continue.',
          used_details: {
            used_at: voucher.usage.startTime,
            device_mac: voucher.usage.userId,
          },
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Check if voucher is expired
    const now = new Date();
    const expiresAt = new Date(voucher.expiry.expiresAt);
    
    if (expiresAt < now) {
      await db.collection('verification_attempts').updateOne(
        { _id: attemptLogId },
        { $set: { error_code: 'voucher_expired' } }
      );

      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'voucher_expired',
          message: 'This voucher has expired. Please purchase a new package.',
          expired_at: expiresAt.toISOString(),
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Check voucher status
    if (voucher.status !== 'active') {
      await db.collection('verification_attempts').updateOne(
        { _id: attemptLogId },
        { $set: { error_code: 'voucher_inactive' } }
      );

      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'voucher_expired',
          message: 'This voucher is no longer active. Please purchase a new package.',
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // SUCCESS - Update attempt log
    await db.collection('verification_attempts').updateOne(
      { _id: attemptLogId },
      {
        $set: {
          success: true,
          voucher_id: voucher._id,
          payment_id: payment._id,
        },
      }
    );

    // Build successful response
    const response = {
      success: true,
      valid: true,
      voucher: {
        code: voucher.voucherInfo.code,
        password: voucher.voucherInfo.password,
        package_name: voucher.voucherInfo.packageDisplayName || voucher.voucherInfo.packageType,
        duration: voucher.voucherInfo.duration,
        duration_display: formatDuration(voucher.voucherInfo.duration),
        bandwidth: formatBandwidth(voucher.voucherInfo.bandwidth),
        price: voucher.voucherInfo.price,
        currency: voucher.voucherInfo.currency || 'KSh',
        expires_at: voucher.expiry.expiresAt,
      },
      payment: {
        transaction_id: payment.mpesa.transactionId,
        amount: payment.transaction.amount,
        payment_date: payment.createdAt,
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        ...corsHeaders,
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': String(5 - recentAttempts - 1),
      },
    });
  } catch (error) {
    console.error('Error verifying M-Pesa transaction:', error);

    // Update attempt log if it exists
    if (attemptLogId) {
      try {
        const client = await clientPromise;
        const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');
        
        await db.collection('verification_attempts').updateOne(
          { _id: attemptLogId },
          { $set: { error_code: 'server_error' } }
        );
      } catch (logError) {
        console.error('Failed to update attempt log:', logError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'server_error',
        message: 'Unable to verify transaction. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}