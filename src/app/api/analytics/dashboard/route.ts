import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(req: NextRequest) {
  try {
    // Get authenticated session
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Extract user and customer IDs
    const customerId = session.user.id;

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer profile not found' },
        { status: 404 }
      );
    }

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get customer data
    const customer = await db
      .collection('customers')
      .findOne({ userId: new ObjectId(customerId) });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found ' },
        { status: 404 }
      );
    }

    // ==========================================
    // 1. OVERVIEW STATISTICS
    // ==========================================
    
    // Total routers
    const totalRouters = await db
      .collection('routers')
      .countDocuments({ 
        customerId: new ObjectId(customerId),
        status: 'active'
      });

    // Online routers
    const onlineRouters = await db
      .collection('routers')
      .countDocuments({
        customerId: new ObjectId(customerId),
        'health.status': 'online',
        status: 'active'
      });

    // Total active users (hotspot + pppoe)
    const activeVouchers = await db
      .collection('vouchers')
      .countDocuments({
        customerId: new ObjectId(customerId),
        status: 'used',
        'usage.endTime': { $gte: new Date() }
      });

    const activePppoeUsers = await db
      .collection('pppoe_users')
      .countDocuments({
        customerId: new ObjectId(customerId),
        status: 'active',
        'connection.isOnline': true
      });

    const totalActiveUsers = activeVouchers + activePppoeUsers;

    // Revenue statistics
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const revenueStats = await db
      .collection('payments')
      .aggregate([
        {
          $match: {
            customerId: new ObjectId(customerId),
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$transaction.amount' },
            totalCommission: { $sum: '$commission.amount' },
            monthlyRevenue: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', thirtyDaysAgo] },
                  '$transaction.amount',
                  0
                ]
              }
            },
            todayRevenue: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', todayStart] },
                  '$transaction.amount',
                  0
                ]
              }
            },
            transactionCount: { $sum: 1 }
          }
        }
      ])
      .toArray();

    const revenue = revenueStats[0] || {
      totalRevenue: 0,
      totalCommission: 0,
      monthlyRevenue: 0,
      todayRevenue: 0,
      transactionCount: 0
    };

    // ==========================================
    // 2. RECENT ACTIVITY
    // ==========================================
    
    const recentPayments = await db
      .collection('payments')
      .find({
        customerId: new ObjectId(customerId),
        status: 'completed'
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    const recentActivity = recentPayments.map((payment) => ({
      id: payment._id.toString(),
      type: payment.transaction.type,
      amount: payment.transaction.amount,
      description: payment.transaction.description,
      timestamp: payment.createdAt,
      status: payment.status,
    }));

    // ==========================================
    // 3. ROUTER STATUS
    // ==========================================
    
    const routers = await db
      .collection('routers')
      .find({ customerId: new ObjectId(customerId) })
      .project({
        _id: 1,
        'routerInfo.name': 1,
        'health.status': 1,
        'health.connectedUsers': 1,
        'health.cpuUsage': 1,
        'health.memoryUsage': 1,
        'statistics.revenue.daily': 1
      })
      .toArray();

    const routerStats = routers.map((router) => ({
      id: router._id.toString(),
      name: router.routerInfo?.name || 'Unnamed Router',
      status: router.health?.status || 'offline',
      connectedUsers: router.health?.connectedUsers || 0,
      cpuUsage: router.health?.cpuUsage || 0,
      memoryUsage: router.health?.memoryUsage || 0,
      dailyRevenue: router.statistics?.revenue?.daily || 0,
    }));

    // ==========================================
    // 4. REVENUE CHART DATA (Last 7 days)
    // ==========================================
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const dailyRevenue = await db
      .collection('payments')
      .aggregate([
        {
          $match: {
            customerId: new ObjectId(customerId),
            status: 'completed',
            createdAt: { $gte: sevenDaysAgo }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            revenue: { $sum: '$transaction.amount' },
            transactions: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ])
      .toArray();

    const revenueChartData = dailyRevenue.map((day) => ({
      date: day._id,
      revenue: day.revenue,
      transactions: day.transactions,
    }));

    // ==========================================
    // 5. VOUCHER STATISTICS
    // ==========================================
    
    const voucherStats = await db
      .collection('vouchers')
      .aggregate([
        {
          $match: {
            customerId: new ObjectId(customerId)
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
      .toArray();

    const vouchers = {
      total: voucherStats.reduce((sum, stat) => sum + stat.count, 0),
      active: voucherStats.find(s => s._id === 'active')?.count || 0,
      used: voucherStats.find(s => s._id === 'used')?.count || 0,
      expired: voucherStats.find(s => s._id === 'expired')?.count || 0,
    };

    // ==========================================
    // 6. PPPOE USER STATISTICS
    // ==========================================
    
    const pppoeStats = await db
      .collection('pppoe_users')
      .aggregate([
        {
          $match: {
            customerId: new ObjectId(customerId)
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
      .toArray();

    const pppoeUsers = {
      total: pppoeStats.reduce((sum, stat) => sum + stat.count, 0),
      active: pppoeStats.find(s => s._id === 'active')?.count || 0,
      suspended: pppoeStats.find(s => s._id === 'suspended')?.count || 0,
      gracePeriod: pppoeStats.find(s => s._id === 'grace_period')?.count || 0,
    };

    // ==========================================
    // 7. TOP SELLING PACKAGES
    // ==========================================
    
    const topPackages = await db
      .collection('vouchers')
      .aggregate([
        {
          $match: {
            customerId: new ObjectId(customerId),
            status: { $in: ['used', 'active'] },
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: '$voucherInfo.packageType',
            count: { $sum: 1 },
            revenue: { $sum: '$voucherInfo.price' }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 5
        }
      ])
      .toArray();

    const topSellingPackages = topPackages.map((pkg) => ({
      package: pkg._id,
      sold: pkg.count,
      revenue: pkg.revenue,
    }));

    // ==========================================
    // 8. ALERTS & NOTIFICATIONS
    // ==========================================
    
    const alerts = [];

    // Router offline alerts
    const offlineRouters = routers.filter(r => r.health?.status === 'offline');
    if (offlineRouters.length > 0) {
      alerts.push({
        type: 'warning',
        title: 'Routers Offline',
        message: `${offlineRouters.length} router(s) are currently offline`,
        timestamp: new Date(),
      });
    }

    // High CPU usage alerts
    const highCpuRouters = routers.filter(r => (r.health?.cpuUsage || 0) > 80);
    if (highCpuRouters.length > 0) {
      alerts.push({
        type: 'warning',
        title: 'High CPU Usage',
        message: `${highCpuRouters.length} router(s) have high CPU usage`,
        timestamp: new Date(),
      });
    }

    // Pending commissions
    if (revenue.totalCommission > 0) {
      alerts.push({
        type: 'info',
        title: 'Commission Available',
        message: `KES ${revenue.totalCommission.toFixed(2)} commission pending payout`,
        timestamp: new Date(),
      });
    }

    // ==========================================
    // RESPONSE
    // ==========================================

    const dashboardData = {
      overview: {
        totalRouters,
        onlineRouters,
        totalActiveUsers,
        totalRevenue: revenue.totalRevenue,
        monthlyRevenue: revenue.monthlyRevenue,
        todayRevenue: revenue.todayRevenue,
        totalCommission: revenue.totalCommission,
        transactionCount: revenue.transactionCount,
      },
      routers: routerStats,
      recentActivity,
      revenueChart: revenueChartData,
      vouchers,
      pppoeUsers,
      topSellingPackages,
      alerts,
      customer: {
        id: customer._id.toString(),
        name: customer.businessInfo?.name,
        type: customer.businessInfo?.type,
        plan: customer.subscription?.plan,
        commissionRate: customer.paymentSettings?.commissionRate,
      },
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}