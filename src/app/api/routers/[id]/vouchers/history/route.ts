// src/app/api/routers/[id]/vouchers/history/route.ts
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

// GET /api/routers/[id]/vouchers/history - Get voucher history with statistics
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
    const dateRange = searchParams.get('dateRange') || 'all';
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '1000');
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

    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateRange) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case '3months':
          filterDate.setMonth(now.getMonth() - 3);
          break;
      }
      
      query.createdAt = { $gte: filterDate };
    }

    // Search filter (code, phone, transaction ID, user ID)
    if (search) {
      query.$or = [
        { 'voucherInfo.code': { $regex: search, $options: 'i' } },
        { 'payment.phoneNumber': { $regex: search, $options: 'i' } },
        { 'payment.transactionId': { $regex: search, $options: 'i' } },
        { 'usage.userId': { $regex: search, $options: 'i' } },
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

    // Calculate statistics for all vouchers (not just filtered)
    const statsQuery: any = {
      routerId: new ObjectId(routerId),
      customerId: customer._id,
    };

    const allVouchers = await db
      .collection('vouchers')
      .find(statsQuery)
      .toArray();

    // Calculate stats
    const stats = {
      total: allVouchers.length,
      active: allVouchers.filter((v) => v.status === 'active').length,
      paid: allVouchers.filter((v) => v.status === 'paid').length,
      used: allVouchers.filter((v) => v.status === 'used').length,
      expired: allVouchers.filter((v) => v.status === 'expired').length,
      cancelled: allVouchers.filter((v) => v.status === 'cancelled').length,
      totalRevenue: allVouchers.reduce((sum, v) => {
        // Only count paid, used, and active vouchers that have been purchased
        if (['paid', 'used'].includes(v.status) || 
            (v.status === 'active' && v.payment?.method !== 'manual')) {
          return sum + (v.payment?.amount || v.voucherInfo.price || 0);
        }
        return sum;
      }, 0),
      totalCommission: allVouchers.reduce((sum, v) => {
        if (['paid', 'used'].includes(v.status)) {
          return sum + (v.payment?.commission || 0);
        }
        return sum;
      }, 0),
    };

    // Transform vouchers for response
    const transformedVouchers = vouchers.map((v) => ({
      _id: v._id.toString(),
      voucherInfo: {
        code: v.voucherInfo.code,
        password: v.voucherInfo.password,
        packageType: v.voucherInfo.packageType,
        packageDisplayName: v.voucherInfo.packageDisplayName || v.voucherInfo.packageType,
        duration: v.voucherInfo.duration,
        dataLimit: v.voucherInfo.dataLimit || 0,
        bandwidth: {
          upload: v.voucherInfo.bandwidth?.upload || 0,
          download: v.voucherInfo.bandwidth?.download || 0,
        },
        price: v.voucherInfo.price || 0,
        currency: v.voucherInfo.currency || 'KES',
      },
      usage: {
        used: v.usage?.used || false,
        userId: v.usage?.userId,
        deviceMac: v.usage?.deviceMac,
        startTime: v.usage?.startTime,
        endTime: v.usage?.endTime,
        dataUsed: v.usage?.dataUsed || 0,
        timeUsed: v.usage?.timeUsed || 0,
        maxDurationMinutes: v.usage?.maxDurationMinutes,
        expectedEndTime: v.usage?.expectedEndTime,
        timedOnPurchase: v.usage?.timedOnPurchase || false,
        purchaseExpiresAt: v.usage?.purchaseExpiresAt,
      },
      payment: {
        method: v.payment?.method || 'manual',
        transactionId: v.payment?.transactionId,
        phoneNumber: v.payment?.phoneNumber,
        amount: v.payment?.amount || v.voucherInfo.price || 0,
        commission: v.payment?.commission || 0,
        paymentDate: v.payment?.paymentDate || v.createdAt,
      },
      batch: v.batch ? {
        batchId: v.batch.batchId,
        batchSize: v.batch.batchSize,
      } : undefined,
      status: v.status,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      vouchers: transformedVouchers,
      stats,
      pagination: {
        total: vouchers.length,
        limit,
        skip,
      },
    });
  } catch (error) {
    console.error('Error fetching voucher history:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch voucher history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
