// app/api/routers/[id]/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';


export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  const { id: routerId } = await params;

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Verify router ownership
    const router = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        userId: new ObjectId(session.user.id),
      });

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    // Fetch PPPoE users
    const pppoeUsers = await db
      .collection('pppoe_users')
      .find({ routerId: new ObjectId(routerId) })
      .toArray();

    // Fetch vouchers (hotspot users)
    const vouchers = await db
      .collection('vouchers')
      .find({ 
        routerId: new ObjectId(routerId),
        status: { $in: ['active', 'used'] }
      })
      .toArray();

    // Format PPPoE users
    const formattedPppoeUsers = pppoeUsers.map((user) => ({
      _id: user._id.toString(),
      userInfo: {
        username: user.userInfo?.username || 'unknown',
        fullName: user.userInfo?.fullName || '',
        email: user.userInfo?.email || '',
        phone: user.userInfo?.phone || '',
        address: user.userInfo?.address || '',
        idNumber: user.userInfo?.idNumber || '',
      },
      service: {
        profile: user.service?.profile || 'default',
        ipAddress: user.service?.ipAddress || '',
        packageType: user.service?.packageType || 'unknown',
        bandwidth: {
          upload: user.service?.bandwidth?.upload || 0,
          download: user.service?.bandwidth?.download || 0,
        },
        dataLimit: user.service?.dataLimit || 0,
        price: user.service?.price || 0,
        currency: user.service?.currency || 'KES',
      },
      billing: {
        billingCycle: user.billing?.billingCycle || 'monthly',
        nextBillingDate: user.billing?.nextBillingDate || new Date(),
        lastPaymentDate: user.billing?.lastPaymentDate || null,
        outstandingAmount: user.billing?.outstandingAmount || 0,
        gracePeriod: user.billing?.gracePeriod || 0,
        autoDisconnect: user.billing?.autoDisconnect || false,
      },
      usage: {
        currentMonth: {
          dataUsed: user.usage?.currentMonth?.dataUsed || 0,
          timeUsed: user.usage?.currentMonth?.timeUsed || 0,
          lastSession: user.usage?.currentMonth?.lastSession || null,
        },
        history: user.usage?.history || [],
      },
      connection: {
        isOnline: user.connection?.isOnline || false,
        lastLogin: user.connection?.lastLogin || null,
        sessionTime: user.connection?.sessionTime || 0,
        ipAddress: user.connection?.ipAddress || '',
        macAddress: user.connection?.macAddress || '',
      },
      status: user.status || 'active',
      type: 'pppoe' as const,
      createdAt: user.createdAt || new Date(),
      updatedAt: user.updatedAt || new Date(),
    }));

    // Format vouchers as hotspot users
    const formattedVouchers = vouchers.map((voucher) => ({
      _id: voucher._id.toString(),
      userInfo: {
        username: voucher.voucherInfo?.code || 'unknown',
        fullName: voucher.usage?.userId || '',
        email: '',
        phone: '',
        address: '',
        idNumber: '',
      },
      service: {
        profile: 'hotspot',
        ipAddress: '',
        packageType: voucher.voucherInfo?.packageType || 'unknown',
        bandwidth: {
          upload: voucher.voucherInfo?.bandwidth?.upload || 0,
          download: voucher.voucherInfo?.bandwidth?.download || 0,
        },
        dataLimit: voucher.voucherInfo?.dataLimit || 0,
        price: voucher.voucherInfo?.price || 0,
        currency: voucher.voucherInfo?.currency || 'KES',
      },
      billing: {
        billingCycle: 'prepaid',
        nextBillingDate: voucher.expiry?.expiresAt || new Date(),
        lastPaymentDate: voucher.payment?.paymentDate || null,
        outstandingAmount: 0,
        gracePeriod: 0,
        autoDisconnect: false,
      },
      usage: {
        currentMonth: {
          dataUsed: voucher.usage?.dataUsed || 0,
          timeUsed: voucher.usage?.timeUsed || 0,
          lastSession: voucher.usage?.endTime || null,
        },
        history: [],
      },
      connection: {
        isOnline: voucher.status === 'used' && voucher.usage?.endTime && new Date(voucher.usage.endTime) > new Date(),
        lastLogin: voucher.usage?.startTime || null,
        sessionTime: voucher.usage?.timeUsed || 0,
        ipAddress: '',
        macAddress: voucher.usage?.deviceMac || '',
      },
      status: voucher.status === 'used' ? 'active' : 'suspended',
      type: 'hotspot' as const,
      createdAt: voucher.createdAt || new Date(),
      updatedAt: voucher.updatedAt || new Date(),
    }));

    // Combine all users
    const allUsers = [...formattedPppoeUsers, ...formattedVouchers];

    // Calculate statistics
    const stats = {
      total: allUsers.length,
      online: allUsers.filter(u => u.connection.isOnline).length,
      active: allUsers.filter(u => u.status === 'active').length,
      suspended: allUsers.filter(u => u.status === 'suspended').length,
      totalDataUsage: allUsers.reduce((sum, u) => sum + u.usage.currentMonth.dataUsed, 0),
      totalRevenue: allUsers.reduce((sum, u) => sum + u.service.price, 0),
    };

    return NextResponse.json({
      users: allUsers,
      stats,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}