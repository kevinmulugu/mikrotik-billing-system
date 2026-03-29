// src/app/api/payments/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    const userId = new ObjectId(session.user.id);

    // Get user for plan info
    const user = await db.collection('users').findOne({ _id: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userPlan = user.subscription?.plan || user.businessInfo?.type || 'individual';
    const isISP = userPlan === 'isp' || userPlan === 'isp_pro';
    const commissionRate = isISP ? 0 : 20; // 20% taken by system for individuals

    // Date ranges
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalStats, monthlyStats, todayStats, pendingCount, recentPayments, revenueBreakdown, totalCount] =
      await Promise.all([
        db
          .collection('payments')
          .aggregate([
            { $match: { userId, status: 'completed' } },
            { $group: { _id: null, totalRevenue: { $sum: '$transaction.amount' }, totalTransactions: { $sum: 1 } } },
          ])
          .toArray(),

        db
          .collection('payments')
          .aggregate([
            { $match: { userId, status: 'completed', createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, monthlyRevenue: { $sum: '$transaction.amount' }, monthlyTransactions: { $sum: 1 } } },
          ])
          .toArray(),

        db
          .collection('payments')
          .aggregate([
            { $match: { userId, status: 'completed', createdAt: { $gte: startOfToday } } },
            { $group: { _id: null, todayRevenue: { $sum: '$transaction.amount' } } },
          ])
          .toArray(),

        db.collection('payments').countDocuments({ userId, status: 'pending' }),

        db.collection('payments').find({ userId }).sort({ createdAt: -1 }).limit(10).toArray(),

        db
          .collection('payments')
          .aggregate([
            { $match: { userId, status: 'completed' } },
            {
              $group: {
                _id: {
                  $cond: [
                    { $eq: [{ $arrayElemAt: ['$linkedItems.type', 0] }, 'voucher'] },
                    'voucher',
                    'other',
                  ],
                },
                revenue: { $sum: '$transaction.amount' },
                count: { $sum: 1 },
              },
            },
          ])
          .toArray(),

        db.collection('payments').countDocuments({ userId }),
      ]);

    const completedCount = totalStats[0]?.totalTransactions ?? 0;
    const successRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 10000) / 100 : 0;

    // Get router names for recent transactions
    const routerIds = [...new Set(recentPayments.map((p) => p.routerId?.toString()).filter(Boolean))];
    const routers = routerIds.length
      ? await db
          .collection('routers')
          .find({ _id: { $in: routerIds.map((id) => new ObjectId(id as string)) } })
          .project({ _id: 1, 'routerInfo.name': 1 })
          .toArray()
      : [];
    const routerMap = new Map(routers.map((r) => [r._id.toString(), r.routerInfo?.name ?? 'Unknown']));

    const formattedTransactions = recentPayments.map((p) => ({
      id: p._id.toString(),
      date: p.createdAt,
      type: p.transaction?.type ?? 'unknown',
      amount: p.transaction?.amount ?? 0,
      status: p.status,
      mpesaRef: p.mpesa?.transactionId ?? p.mpesa?.checkoutRequestId ?? null,
      phoneNumber: p.mpesa?.phoneNumber ?? null,
      routerName: routerMap.get(p.routerId?.toString() ?? '') ?? 'Unknown',
      commission: 0,
    }));

    const totalRevenue = totalStats[0]?.totalRevenue ?? 0;
    const monthlyRevenue = monthlyStats[0]?.monthlyRevenue ?? 0;

    const voucherRevenue = revenueBreakdown.find((r) => r._id === 'voucher');
    const otherRevenue = revenueBreakdown.find((r) => r._id === 'other');

    return NextResponse.json({
      success: true,
      stats: {
        totalRevenue,
        monthlyRevenue,
        todayRevenue: todayStats[0]?.todayRevenue ?? 0,
        totalCommission: isISP ? 0 : Math.round(totalRevenue * (commissionRate / 100)),
        monthlyCommission: isISP ? 0 : Math.round(monthlyRevenue * (commissionRate / 100)),
        pendingPayments: pendingCount,
        totalTransactions: totalCount,
        monthlyTransactions: monthlyStats[0]?.monthlyTransactions ?? 0,
        successRate,
        userPlan,
        commissionRate,
      },
      breakdown: {
        voucherSales: {
          revenue: voucherRevenue?.revenue ?? 0,
          count: voucherRevenue?.count ?? 0,
          commission: isISP ? 0 : Math.round((voucherRevenue?.revenue ?? 0) * (commissionRate / 100)),
        },
        otherSales: {
          revenue: otherRevenue?.revenue ?? 0,
          count: otherRevenue?.count ?? 0,
          commission: isISP ? 0 : Math.round((otherRevenue?.revenue ?? 0) * (commissionRate / 100)),
        },
      },
      recentTransactions: formattedTransactions,
    });
  } catch (error) {
    console.error('[Payment Stats] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch payment statistics' }, { status: 500 });
  }
}
