// src/app/api/payouts/balance/route.ts
/**
 * Commission Balance API
 * 
 * Get user's available commission balance for payouts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET /api/payouts/balance
 * Get user's available commission balance
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
