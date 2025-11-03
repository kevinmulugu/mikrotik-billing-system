import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = new ObjectId(session.user.id);
    const db = await getDatabase();

    // Get user data for plan and commission rate
    const user = await db.collection('users').findOne({ _id: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userPlan = user.businessInfo?.type || 'individual';
    const isISP = userPlan === 'isp' || userPlan === 'isp_pro';
    // Commission: 80% for individuals, 0% for ISPs
    const commissionRate = isISP ? 0 : 80;

    // Get all routers for this user
    const routers = await db
      .collection('routers')
      .find({ userId })
      .project({ _id: 1 })
      .toArray();
    
    const routerIds = routers.map(r => r._id);

    // Date ranges for queries
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Aggregate payment statistics
    const [
      totalStats,
      monthlyStats,
      todayStats,
      pendingCount,
      recentTransactions,
      revenueBreakdown,
    ] = await Promise.all([
      // Total revenue and transactions
      db.collection('payments').aggregate([
        {
          $match: {
            routerId: { $in: routerIds },
            status: 'completed',
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$transaction.amount' },
            totalCommission: { $sum: '$commission.amount' },
            totalTransactions: { $sum: 1 },
            successfulTransactions: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
          },
        },
      ]).toArray(),

      // Monthly stats
      db.collection('payments').aggregate([
        {
          $match: {
            routerId: { $in: routerIds },
            status: 'completed',
            createdAt: { $gte: startOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            monthlyRevenue: { $sum: '$transaction.amount' },
            monthlyCommission: { $sum: '$commission.amount' },
            monthlyTransactions: { $sum: 1 },
          },
        },
      ]).toArray(),

      // Today's stats
      db.collection('payments').aggregate([
        {
          $match: {
            routerId: { $in: routerIds },
            status: 'completed',
            createdAt: { $gte: startOfToday },
          },
        },
        {
          $group: {
            _id: null,
            todayRevenue: { $sum: '$transaction.amount' },
            todayTransactions: { $sum: 1 },
          },
        },
      ]).toArray(),

      // Pending payments count
      db.collection('payments').countDocuments({
        routerId: { $in: routerIds },
        status: 'pending',
      }),

      // Recent transactions (last 10)
      db.collection('payments')
        .find({ routerId: { $in: routerIds } })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),

      // Revenue breakdown by type
      db.collection('payments').aggregate([
        {
          $match: {
            routerId: { $in: routerIds },
            status: 'completed',
          },
        },
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
      ]).toArray(),
    ]);

    // Calculate success rate
    const totalCount = await db.collection('payments').countDocuments({
      routerId: { $in: routerIds },
    });
    
    const completedCount = totalStats[0]?.totalTransactions || 0;
    const successRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    // Check payment method (company paybill vs own paybill)
    const ownPaybill = await db.collection('paybills').findOne({
      userId,
      status: 'active',
    });

    let paymentMethod: 'own_paybill' | 'company_paybill' = 'company_paybill';
    let paybillInfo = null;

    if (ownPaybill) {
      paymentMethod = 'own_paybill';
      paybillInfo = {
        number: ownPaybill.paybillInfo?.number,
        name: ownPaybill.paybillInfo?.name,
        type: ownPaybill.paybillInfo?.type,
      };
    } else {
      // Get company paybill
      const companyPaybillNumber = process.env.MPESA_DEFAULT_PAYBILL;
      const companyPaybill = await db.collection('paybills').findOne({
        'paybillInfo.number': companyPaybillNumber,
        userId: null,
        status: 'active',
      });

      if (companyPaybill) {
        paybillInfo = {
          number: companyPaybill.paybillInfo?.number,
          name: companyPaybill.paybillInfo?.name,
          type: companyPaybill.paybillInfo?.type,
        };
      }
    }

    // Format revenue breakdown
    const voucherRevenue = revenueBreakdown.find(r => r._id === 'voucher');
    const otherRevenue = revenueBreakdown.find(r => r._id === 'other');

    // Format recent transactions with router names
    const routersMap = new Map();
    for (const router of routers) {
      const routerData = await db.collection('routers').findOne({ _id: router._id });
      if (routerData) {
        routersMap.set(router._id.toString(), routerData.name);
      }
    }

    const formattedTransactions = recentTransactions.map(payment => ({
      id: payment._id.toString(),
      date: payment.createdAt,
      type: payment.linkedItems?.[0]?.type || 'unknown',
      amount: payment.transaction.amount,
      status: payment.status,
      mpesaRef: payment.mpesa?.transactionId || payment.mpesa?.checkoutRequestId,
      phoneNumber: payment.mpesa?.phoneNumber,
      routerName: routersMap.get(payment.routerId?.toString()) || 'Unknown',
      commission: payment.commission?.amount || 0,
      customerPhone: payment.metadata?.customer_phone,
    }));

    // Build response
    const stats = {
      totalRevenue: totalStats[0]?.totalRevenue || 0,
      monthlyRevenue: monthlyStats[0]?.monthlyRevenue || 0,
      todayRevenue: todayStats[0]?.todayRevenue || 0,
      totalCommission: isISP ? 0 : (totalStats[0]?.totalCommission || 0),
      monthlyCommission: isISP ? 0 : (monthlyStats[0]?.monthlyCommission || 0),
      pendingPayments: pendingCount,
      totalTransactions: totalStats[0]?.totalTransactions || 0,
      monthlyTransactions: monthlyStats[0]?.monthlyTransactions || 0,
      successRate: Math.round(successRate * 100) / 100,
      paymentMethod,
      paybillInfo,
      userPlan,
      commissionRate,
    };

    const breakdown = {
      voucherSales: {
        revenue: voucherRevenue?.revenue || 0,
        count: voucherRevenue?.count || 0,
        commission: isISP ? 0 : ((voucherRevenue?.revenue || 0) * (commissionRate / 100)),
      },
      otherSales: {
        revenue: otherRevenue?.revenue || 0,
        count: otherRevenue?.count || 0,
        commission: isISP ? 0 : ((otherRevenue?.revenue || 0) * (commissionRate / 100)),
      },
    };

    return NextResponse.json({
      success: true,
      stats,
      breakdown,
      recentTransactions: formattedTransactions,
    });
  } catch (error) {
    console.error('[Payment Stats API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch payment statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
