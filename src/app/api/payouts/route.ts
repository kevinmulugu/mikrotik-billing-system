// src/app/api/payouts/route.ts
/**
 * Commission Payouts API
 * 
 * Manages commission payouts for router owners.
 * System retains 20% commission on voucher sales for individual plan users.
 * 
 * Payout calculation:
 * - Individual Plan: User gets 80%, System keeps 20%
 * - ISP Plans: User gets 100% (pays monthly subscription instead)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET /api/payouts
 * Fetch user's commission payouts
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending, processing, completed, failed
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Build query
    const query: any = { userId: new ObjectId(userId) };
    if (status) {
      query.status = status;
    }

    // Fetch payouts
    const payouts = await db
      .collection('commission_payouts')
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const total = await db.collection('commission_payouts').countDocuments(query);

    // Calculate summary stats
    const stats = await db
      .collection('commission_payouts')
      .aggregate([
        { $match: { userId: new ObjectId(userId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
      ])
      .toArray();

    const summary = {
      pending: { count: 0, amount: 0 },
      processing: { count: 0, amount: 0 },
      completed: { count: 0, amount: 0 },
      failed: { count: 0, amount: 0 },
    };

    stats.forEach((stat: any) => {
      summary[stat._id as keyof typeof summary] = {
        count: stat.count,
        amount: stat.totalAmount,
      };
    });

    return NextResponse.json({
      payouts: payouts.map((p: any) => ({
        id: p._id.toString(),
        amount: p.amount,
        period: p.period,
        status: p.status,
        method: p.payout?.method || 'mpesa',
        transactionId: p.payout?.transactionId || null,
        createdAt: p.createdAt,
        processedAt: p.payout?.processedAt || null,
        failureReason: p.payout?.failureReason || null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary,
    });
  } catch (error) {
    console.error('Error fetching payouts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payouts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payouts
 * Request a manual payout (for users with manual payout schedule)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { amount, method = 'mpesa' } = body;

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get user settings
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const payoutSettings = user.payoutSettings || {};
    const minAmount = payoutSettings.minAmount || 1000;

    // Validate amount
    if (!amount || amount < minAmount) {
      return NextResponse.json(
        { error: `Minimum payout amount is KES ${minAmount}` },
        { status: 400 }
      );
    }

    // Calculate available balance from commissions collection
    const availableBalance = await db
      .collection('commissions')
      .aggregate([
        { $match: { userId: new ObjectId(userId) } },
        {
          $group: {
            _id: null,
            earned: { $sum: '$earnings.totalCommission' },
            paid: { $sum: '$payout.amount' },
          },
        },
      ])
      .toArray();

    const balance = availableBalance[0]
      ? availableBalance[0].earned - availableBalance[0].paid
      : 0;

    if (amount > balance) {
      return NextResponse.json(
        {
          error: `Insufficient balance. Available: KES ${balance.toFixed(2)}`,
          availableBalance: balance,
        },
        { status: 400 }
      );
    }

    // Validate payout method details
    if (method === 'mpesa' && !payoutSettings.mpesaNumber) {
      return NextResponse.json(
        { error: 'M-Pesa number not configured. Please update payout settings.' },
        { status: 400 }
      );
    }

    if (method === 'bank' && !payoutSettings.bankAccount?.accountNumber) {
      return NextResponse.json(
        { error: 'Bank account not configured. Please update payout settings.' },
        { status: 400 }
      );
    }

    // Create payout request
    const now = new Date();
    const currentMonth = now.toLocaleString('default', { month: 'long', year: 'numeric' });

    const payoutDoc = {
      userId: new ObjectId(userId),
      amount: amount,
      period: {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        label: currentMonth,
      },
      payout: {
        method: method,
        destination:
          method === 'mpesa'
            ? payoutSettings.mpesaNumber
            : payoutSettings.bankAccount?.accountNumber,
        transactionId: null,
        processedAt: null,
        failureReason: null,
      },
      status: 'pending', // pending, processing, completed, failed
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('commission_payouts').insertOne(payoutDoc);

    // Log audit trail
    await db.collection('audit_logs').insertOne({
      userId: new ObjectId(userId),
      action: {
        type: 'payout_requested',
        description: `Requested payout of KES ${amount}`,
      },
      resourceType: 'payout',
      resourceId: result.insertedId,
      metadata: {
        amount,
        method,
        availableBalance: balance,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: now,
    });

    return NextResponse.json({
      success: true,
      message: 'Payout request submitted successfully',
      payout: {
        id: result.insertedId.toString(),
        amount,
        status: 'pending',
        createdAt: now,
      },
    });
  } catch (error) {
    console.error('Error requesting payout:', error);
    return NextResponse.json(
      { error: 'Failed to request payout' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payouts/balance
 * Get user's available commission balance
 */
export async function GET_BALANCE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Calculate from commissions
    const commissionData = await db
      .collection('commissions')
      .aggregate([
        { $match: { userId: new ObjectId(userId) } },
        {
          $group: {
            _id: null,
            totalEarned: { $sum: '$earnings.totalCommission' },
            totalPaid: { $sum: '$payout.amount' },
          },
        },
      ])
      .toArray();

    const earned = commissionData[0]?.totalEarned || 0;
    const paid = commissionData[0]?.totalPaid || 0;
    const available = earned - paid;

    // Get pending payouts
    const pendingPayouts = await db
      .collection('commission_payouts')
      .aggregate([
        {
          $match: {
            userId: new ObjectId(userId),
            status: { $in: ['pending', 'processing'] },
          },
        },
        {
          $group: {
            _id: null,
            totalPending: { $sum: '$amount' },
          },
        },
      ])
      .toArray();

    const pending = pendingPayouts[0]?.totalPending || 0;

    return NextResponse.json({
      totalEarned: earned,
      totalPaid: paid,
      availableBalance: available,
      pendingPayouts: pending,
      withdrawable: Math.max(0, available - pending),
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}
