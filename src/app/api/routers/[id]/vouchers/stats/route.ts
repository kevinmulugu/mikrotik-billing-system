// src/app/api/routers/[id]/vouchers/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/routers/[id]/vouchers/stats - Get voucher statistics
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

  const userId = session.user.id;
  const { id: routerId } = await context.params;

    // Validate router ID
    if (!ObjectId.isValid(routerId)) {
      return NextResponse.json(
        { error: 'Invalid router ID' },
        { status: 400 }
      );
    }

    // Connect to database
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get customer
    const customer = await db
      .collection('customers')
      .findOne({ userId: new ObjectId(userId) });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Verify router ownership
    const router = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        customerId: customer._id,
      });

    if (!router) {
      return NextResponse.json(
        { error: 'Router not found or access denied' },
        { status: 404 }
      );
    }

    // Calculate date boundaries
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Aggregation pipeline for comprehensive stats
    const stats = await db.collection('vouchers').aggregate([
      {
        $match: {
          routerId: new ObjectId(routerId),
          customerId: customer._id,
        }
      },
      {
        $facet: {
          // Status counts
          statusCounts: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
          
          // Revenue calculations
          revenue: [
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: '$voucherInfo.price' },
                totalCommission: { $sum: '$payment.commission' },
                todayRevenue: {
                  $sum: {
                    $cond: [
                      { $gte: ['$createdAt', startOfToday] },
                      '$voucherInfo.price',
                      0
                    ]
                  }
                },
                weekRevenue: {
                  $sum: {
                    $cond: [
                      { $gte: ['$createdAt', startOfWeek] },
                      '$voucherInfo.price',
                      0
                    ]
                  }
                },
                monthRevenue: {
                  $sum: {
                    $cond: [
                      { $gte: ['$createdAt', startOfMonth] },
                      '$voucherInfo.price',
                      0
                    ]
                  }
                }
              }
            }
          ],

          // Package type breakdown
          packageBreakdown: [
            {
              $group: {
                _id: '$voucherInfo.packageType',
                count: { $sum: 1 },
                revenue: { $sum: '$voucherInfo.price' },
                used: {
                  $sum: {
                    $cond: [{ $eq: ['$usage.used', true] }, 1, 0]
                  }
                }
              }
            },
            { $sort: { revenue: -1 } }
          ],

          // Usage statistics
          usageStats: [
            {
              $group: {
                _id: null,
                totalUsed: {
                  $sum: {
                    $cond: [{ $eq: ['$usage.used', true] }, 1, 0]
                  }
                },
                totalUnused: {
                  $sum: {
                    $cond: [{ $eq: ['$usage.used', false] }, 1, 0]
                  }
                },
                totalDataUsed: { $sum: '$usage.dataUsed' }
              }
            }
          ],

          // Recent vouchers
          recentVouchers: [
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
              $project: {
                code: '$voucherInfo.code',
                packageType: '$voucherInfo.packageType',
                price: '$voucherInfo.price',
                status: '$status',
                createdAt: '$createdAt'
              }
            }
          ]
        }
      }
    ]).toArray();

    const result = stats[0];

    // Format status counts
    const statusCounts = {
      total: 0,
      active: 0,
      used: 0,
      expired: 0,
      cancelled: 0,
    };

    result.statusCounts.forEach((item: any) => {
      statusCounts[item._id as keyof typeof statusCounts] = item.count;
      statusCounts.total += item.count;
    });

    // Format revenue data
    const revenueData = result.revenue[0] || {
      totalRevenue: 0,
      totalCommission: 0,
      todayRevenue: 0,
      weekRevenue: 0,
      monthRevenue: 0,
    };

    // Format usage stats
    const usageData = result.usageStats[0] || {
      totalUsed: 0,
      totalUnused: 0,
      totalDataUsed: 0,
    };

    // Calculate usage percentage
    const usagePercentage = statusCounts.total > 0
      ? Math.round((usageData.totalUsed / statusCounts.total) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      stats: {
        vouchers: statusCounts,
        revenue: {
          total: revenueData.totalRevenue,
          commission: revenueData.totalCommission,
          net: revenueData.totalRevenue - revenueData.totalCommission,
          today: revenueData.todayRevenue,
          week: revenueData.weekRevenue,
          month: revenueData.monthRevenue,
        },
        usage: {
          used: usageData.totalUsed,
          unused: usageData.totalUnused,
          percentage: usagePercentage,
          totalDataUsed: usageData.totalDataUsed,
        },
        packageBreakdown: result.packageBreakdown,
        recentVouchers: result.recentVouchers,
      },
    });
  } catch (error) {
    console.error('Error fetching voucher stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}