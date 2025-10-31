// src/app/api/routers/[id]/customers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/routers/[id]/customers
 * Get all WiFi customers who purchased vouchers from this router
 */
export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: routerId } = await params;
    const userId = session.user.id;

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Verify router ownership
    const router = await db.collection('routers').findOne({
      _id: new ObjectId(routerId),
      userId: new ObjectId(userId),
    });

    if (!router) {
      return NextResponse.json(
        { error: 'Router not found or access denied' },
        { status: 404 }
      );
    }

    // Get query parameters for filtering/pagination
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'lastPurchaseDate';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;

    // Build query
    const query: any = { routerId: new ObjectId(routerId) };
    
    // Add search filter if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count
    const total = await db.collection('customers').countDocuments(query);

    // Get customers with pagination
    const customers = await db
      .collection('customers')
      .find(query)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // For each customer, get their voucher purchase history
    const customersWithStats = await Promise.all(
      customers.map(async (customer) => {
        const vouchers = await db
          .collection('vouchers')
          .find({
            routerId: new ObjectId(routerId),
            customerId: customer._id,
          })
          .sort({ 'payment.paymentDate': -1 })
          .toArray();

        const totalPurchases = vouchers.length;
        const totalSpent = vouchers.reduce(
          (sum, v) => sum + (v.payment?.amount || 0),
          0
        );
        const lastPurchase = vouchers[0];

        return {
          id: customer._id.toString(),
          phone: customer.phone,
          name: customer.name,
          email: customer.email,
          createdAt: customer.createdAt,
          lastPurchaseDate: customer.lastPurchaseDate,
          statistics: {
            totalPurchases,
            totalSpent,
            lastPurchase: lastPurchase
              ? {
                  packageType: lastPurchase.voucherInfo?.packageType,
                  amount: lastPurchase.payment?.amount,
                  date: lastPurchase.payment?.paymentDate,
                }
              : null,
          },
        };
      })
    );

    return NextResponse.json({
      customers: customersWithStats,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get router customers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}
