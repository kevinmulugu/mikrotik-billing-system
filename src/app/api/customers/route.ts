import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET /api/customers
 *
 * Query params:
 *   page      – page number (default: 1)
 *   limit     – items per page (default: 25, max: 100)
 *   search    – text search on name / phone / email
 *   routerId  – filter to a single router (omit for all routers)
 *   sortBy    – field to sort by (default: lastPurchaseDate)
 *   sortOrder – asc | desc (default: desc)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const sp = req.nextUrl.searchParams;

    const page = Math.max(1, parseInt(sp.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '25')));
    const search = sp.get('search')?.trim() || '';
    const routerIdParam = sp.get('routerId') || '';
    const sortBy = sp.get('sortBy') || 'lastPurchaseDate';
    const sortOrder = sp.get('sortOrder') === 'asc' ? 1 : -1;

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Fetch all routers owned by this user (used for filter options + ownership check)
    const routers = await db
      .collection('routers')
      .find({ userId: new ObjectId(userId) })
      .project({ _id: 1, 'routerInfo.name': 1 })
      .toArray();

    const routerIds = routers.map((r) => r._id);

    // Resolve which router IDs to query against
    let targetRouterIds = routerIds;
    if (routerIdParam) {
      // Validate the requested routerId actually belongs to this user
      const owned = routers.find((r) => r._id.toString() === routerIdParam);
      if (!owned) {
        return NextResponse.json({ error: 'Router not found' }, { status: 404 });
      }
      targetRouterIds = [new ObjectId(routerIdParam)];
    }

    // Build the customer query
    const query: Record<string, unknown> = {
      routerId: { $in: targetRouterIds },
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // --- Stats (always across ALL user routers, unaffected by router filter) ---
    const [statsResult, recentCount] = await Promise.all([
      db
        .collection('customers')
        .aggregate([
          { $match: { routerId: { $in: routerIds } } },
          {
            $group: {
              _id: null,
              totalCustomers: { $sum: 1 },
              totalSpent: { $sum: '$totalSpent' },
              totalPurchases: { $sum: '$totalPurchases' },
            },
          },
        ])
        .toArray(),
      db.collection('customers').countDocuments({
        routerId: { $in: routerIds },
        lastPurchaseDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    const stats = {
      totalCustomers: statsResult[0]?.totalCustomers ?? 0,
      totalSpent: statsResult[0]?.totalSpent ?? 0,
      totalPurchases: statsResult[0]?.totalPurchases ?? 0,
      recentCustomers: recentCount,
    };

    // --- Paginated customer list ---
    const [total, customers] = await Promise.all([
      db.collection('customers').countDocuments(query),
      db
        .collection('customers')
        .find(query)
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    // Attach router name to each customer
    const routerMap = new Map(routers.map((r) => [r._id.toString(), r.routerInfo?.name || 'Unknown Router']));

    const formattedCustomers = customers.map((c) => ({
      id: c._id.toString(),
      phone: c.phone ?? null,
      name: c.name ?? null,
      email: c.email ?? null,
      routerId: c.routerId.toString(),
      routerName: routerMap.get(c.routerId.toString()) ?? 'Unknown Router',
      createdAt: c.createdAt,
      lastPurchaseDate: c.lastPurchaseDate,
      totalPurchases: c.totalPurchases ?? 0,
      totalSpent: c.totalSpent ?? 0,
    }));

    return NextResponse.json({
      customers: formattedCustomers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats,
      routers: routers.map((r) => ({
        id: r._id.toString(),
        name: r.routerInfo?.name || 'Unnamed Router',
      })),
    });
  } catch (error) {
    console.error('Customers API error:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}
