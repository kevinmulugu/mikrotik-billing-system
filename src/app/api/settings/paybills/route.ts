// src/app/api/settings/paybills/route.ts
/**
 * Customer Paybill Management API
 * 
 * Allows users to add their own M-Pesa paybills to receive voucher payments directly.
 * When a customer adds their paybill, it:
 * 1. Creates entry in paybills collection
 * 2. Updates user's paymentSettings.paybillNumber
 * 3. Validates credentials (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET /api/settings/paybills
 * Fetch user's paybills
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get all paybills for this user
    const paybills = await db
      .collection('paybills')
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray();

    // Get user's current payment settings
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    const response = {
      paybills: paybills.map((p: any) => ({
        id: p._id.toString(),
        paybillNumber: p.paybillInfo.number,
        paybillName: p.paybillInfo.name,
        type: p.paybillInfo.type,
        status: p.status,
        isDefault: user?.paymentSettings?.paybillNumber === p.paybillInfo.number,
        createdAt: p.createdAt,
        statistics: p.statistics,
      })),
      currentDefault: user?.paymentSettings?.paybillNumber || null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching paybills:', error);
    return NextResponse.json(
      { error: 'Failed to fetch paybills' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/paybills
 * Add new customer paybill
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();

    const {
      paybillNumber,
      paybillName,
      type = 'paybill', // 'paybill' or 'till'
      consumerKey,
      consumerSecret,
      passKey,
      setAsDefault = true,
    } = body;

    // Validate required fields
    if (!paybillNumber || !paybillName || !consumerKey || !consumerSecret || !passKey) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate paybill number format
    if (!/^\d{5,10}$/.test(paybillNumber)) {
      return NextResponse.json(
        { error: 'Invalid paybill number format' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Check if paybill already exists
    const existingPaybill = await db.collection('paybills').findOne({
      'paybillInfo.number': paybillNumber,
    });

    if (existingPaybill) {
      return NextResponse.json(
        { error: 'Paybill number already registered' },
        { status: 409 }
      );
    }

    // Create paybill record
    const paybillDoc = {
      userId: new ObjectId(userId),
      paybillInfo: {
        number: paybillNumber,
        name: paybillName,
        type: type, // 'paybill' or 'till'
        provider: 'safaricom',
      },
      credentials: {
        consumerKey: consumerKey,
        consumerSecret: consumerSecret,
        passKey: passKey,
        accessToken: null,
        tokenExpiresAt: null,
        lastTokenRefresh: null,
      },
      config: {
        environment: process.env.MPESA_ENV || 'sandbox',
        webhookUrl: `${process.env.NEXT_PUBLIC_API_URL}/api/webhooks/mpesa/callback`,
        confirmationUrl: `${process.env.NEXT_PUBLIC_API_URL}/api/webhooks/mpesa`,
      },
      statistics: {
        totalTransactions: 0,
        totalAmount: 0,
        successRate: 0,
        lastTransaction: null,
      },
      status: 'pending', // pending, active, inactive
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('paybills').insertOne(paybillDoc);

    // If setAsDefault, update user's paymentSettings
    if (setAsDefault) {
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            'paymentSettings.paybillNumber': paybillNumber,
            'paymentSettings.preferredMethod': 'customer_paybill',
            updatedAt: new Date(),
          },
        }
      );
    }

    // Log audit trail
    await db.collection('audit_logs').insertOne({
      userId: new ObjectId(userId),
      action: {
        type: 'paybill_added',
        description: `Added paybill ${paybillNumber}`,
      },
      resourceType: 'paybill',
      resourceId: result.insertedId,
      metadata: {
        paybillNumber,
        paybillName,
        type,
        setAsDefault,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Paybill added successfully. Verification pending.',
      paybill: {
        id: result.insertedId.toString(),
        paybillNumber,
        status: 'pending',
      },
    });
  } catch (error) {
    console.error('Error adding paybill:', error);
    return NextResponse.json(
      { error: 'Failed to add paybill' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings/paybills
 * Update paybill (set as default, activate/deactivate)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();

    const { paybillId, action, status } = body;

    if (!paybillId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Verify paybill belongs to user
    const paybill = await db.collection('paybills').findOne({
      _id: new ObjectId(paybillId),
      userId: new ObjectId(userId),
    });

    if (!paybill) {
      return NextResponse.json(
        { error: 'Paybill not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'set_default':
        // Update user's payment settings
        await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          {
            $set: {
              'paymentSettings.paybillNumber': paybill.paybillInfo.number,
              'paymentSettings.preferredMethod': 'customer_paybill',
              updatedAt: new Date(),
            },
          }
        );

        return NextResponse.json({
          success: true,
          message: 'Default paybill updated',
        });

      case 'update_status':
        if (!status || !['active', 'inactive', 'pending'].includes(status)) {
          return NextResponse.json(
            { error: 'Invalid status' },
            { status: 400 }
          );
        }

        await db.collection('paybills').updateOne(
          { _id: new ObjectId(paybillId) },
          {
            $set: {
              status: status,
              updatedAt: new Date(),
            },
          }
        );

        return NextResponse.json({
          success: true,
          message: `Paybill status updated to ${status}`,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error updating paybill:', error);
    return NextResponse.json(
      { error: 'Failed to update paybill' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/paybills
 * Remove customer paybill
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const paybillId = searchParams.get('id');

    if (!paybillId) {
      return NextResponse.json(
        { error: 'Paybill ID required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Verify paybill belongs to user
    const paybill = await db.collection('paybills').findOne({
      _id: new ObjectId(paybillId),
      userId: new ObjectId(userId),
    });

    if (!paybill) {
      return NextResponse.json(
        { error: 'Paybill not found' },
        { status: 404 }
      );
    }

    // Check if it's the current default
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    const isDefault = user?.paymentSettings?.paybillNumber === paybill.paybillInfo.number;

    // Delete paybill
    await db.collection('paybills').deleteOne({ _id: new ObjectId(paybillId) });

    // If it was default, reset to company paybill
    if (isDefault) {
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            'paymentSettings.paybillNumber': null,
            'paymentSettings.preferredMethod': 'company_paybill',
            updatedAt: new Date(),
          },
        }
      );
    }

    // Log audit trail
    await db.collection('audit_logs').insertOne({
      userId: new ObjectId(userId),
      action: {
        type: 'paybill_removed',
        description: `Removed paybill ${paybill.paybillInfo.number}`,
      },
      resourceType: 'paybill',
      resourceId: new ObjectId(paybillId),
      metadata: {
        paybillNumber: paybill.paybillInfo.number,
        wasDefault: isDefault,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Paybill removed successfully',
    });
  } catch (error) {
    console.error('Error removing paybill:', error);
    return NextResponse.json(
      { error: 'Failed to remove paybill' },
      { status: 500 }
    );
  }
}
