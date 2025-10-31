// src/app/api/settings/payouts/route.ts
/**
 * Payout Settings API
 * 
 * Manages user's payout preferences for commission payouts:
 * - Minimum payout amount
 * - Auto payout schedule
 * - Bank account details
 * - M-Pesa number
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET /api/settings/payouts
 * Fetch user's payout settings
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

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const payoutSettings = user.payoutSettings || {
      minAmount: 1000,
      autoPayouts: true,
      schedule: 'monthly',
      bankAccount: {
        accountName: null,
        accountNumber: null,
        bankName: null,
        branchCode: null,
      },
      mpesaNumber: null,
    };

    return NextResponse.json({
      payoutSettings,
      currentCommissionRate: user.paymentSettings?.commissionRate || 20,
    });
  } catch (error) {
    console.error('Error fetching payout settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payout settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings/payouts
 * Update payout settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();

    const {
      minAmount,
      autoPayouts,
      schedule,
      bankAccount,
      mpesaNumber,
    } = body;

    // Validate inputs
    const errors: any = {};

    if (minAmount !== undefined) {
      if (typeof minAmount !== 'number' || minAmount < 100) {
        errors.minAmount = 'Minimum amount must be at least KES 100';
      }
      if (minAmount > 1000000) {
        errors.minAmount = 'Minimum amount cannot exceed KES 1,000,000';
      }
    }

    if (schedule && !['monthly', 'weekly', 'manual'].includes(schedule)) {
      errors.schedule = 'Invalid schedule. Must be monthly, weekly, or manual';
    }

    if (mpesaNumber) {
      // Validate Kenyan phone number
      const cleanedPhone = mpesaNumber.replace(/\D/g, '');
      if (!/^254[71]\d{8}$/.test(cleanedPhone)) {
        errors.mpesaNumber = 'Invalid M-Pesa number format. Use 254XXXXXXXXX';
      }
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Build update object
    const updateFields: any = {
      updatedAt: new Date(),
    };

    if (minAmount !== undefined) {
      updateFields['payoutSettings.minAmount'] = minAmount;
    }
    if (autoPayouts !== undefined) {
      updateFields['payoutSettings.autoPayouts'] = autoPayouts;
    }
    if (schedule) {
      updateFields['payoutSettings.schedule'] = schedule;
    }
    if (bankAccount) {
      if (bankAccount.accountName !== undefined) {
        updateFields['payoutSettings.bankAccount.accountName'] = bankAccount.accountName;
      }
      if (bankAccount.accountNumber !== undefined) {
        updateFields['payoutSettings.bankAccount.accountNumber'] = bankAccount.accountNumber;
      }
      if (bankAccount.bankName !== undefined) {
        updateFields['payoutSettings.bankAccount.bankName'] = bankAccount.bankName;
      }
      if (bankAccount.branchCode !== undefined) {
        updateFields['payoutSettings.bankAccount.branchCode'] = bankAccount.branchCode;
      }
    }
    if (mpesaNumber !== undefined) {
      updateFields['payoutSettings.mpesaNumber'] = mpesaNumber;
    }

    // Update user
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateFields }
    );

    // Log audit trail
    await db.collection('audit_logs').insertOne({
      userId: new ObjectId(userId),
      action: {
        type: 'payout_settings_updated',
        description: 'Updated payout settings',
      },
      resourceType: 'user',
      resourceId: new ObjectId(userId),
      metadata: {
        updatedFields: Object.keys(updateFields).filter(k => k !== 'updatedAt'),
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Payout settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating payout settings:', error);
    return NextResponse.json(
      { error: 'Failed to update payout settings' },
      { status: 500 }
    );
  }
}
