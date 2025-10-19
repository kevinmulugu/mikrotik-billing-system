// src/app/api/routers/[id]/vouchers/route.ts
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

// GET /api/routers/[id]/vouchers - List vouchers with filters
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const packageType = searchParams.get('packageType') || 'all';
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '100');
    const skip = parseInt(searchParams.get('skip') || '0');

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

    // Build query filters
    const query: any = {
      routerId: new ObjectId(routerId),
      customerId: customer._id,
    };

    // Status filter
    if (status !== 'all') {
      query.status = status;
    }

    // Package type filter
    if (packageType !== 'all') {
      query['voucherInfo.packageType'] = packageType;
    }

    // Search filter (code, phone, transaction ID)
    if (search) {
      query.$or = [
        { 'voucherInfo.code': { $regex: search, $options: 'i' } },
        { 'payment.phoneNumber': { $regex: search, $options: 'i' } },
        { 'payment.transactionId': { $regex: search, $options: 'i' } },
      ];
    }

    // Fetch vouchers
    const vouchers = await db
      .collection('vouchers')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count
    const totalCount = await db
      .collection('vouchers')
      .countDocuments(query);

    // Transform vouchers for response
    const transformedVouchers = vouchers.map((v) => ({
      _id: v._id.toString(),
      voucherInfo: {
        code: v.voucherInfo.code,
        password: v.voucherInfo.password,
        packageType: v.voucherInfo.packageType,
        packageDisplayName: v.voucherInfo.packageDisplayName || v.voucherInfo.packageType,
        duration: v.voucherInfo.duration,
        dataLimit: v.voucherInfo.dataLimit,
        bandwidth: v.voucherInfo.bandwidth,
        price: v.voucherInfo.price,
        currency: v.voucherInfo.currency,
      },
      usage: v.usage,
      payment: v.payment,
      batch: v.batch,
      expiry: {
        expiresAt: v.expiry.expiresAt,
        autoDelete: v.expiry.autoDelete,
      },
      status: v.status,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      vouchers: transformedVouchers,
      pagination: {
        total: totalCount,
        limit,
        skip,
        hasMore: skip + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('Error fetching vouchers:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch vouchers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}