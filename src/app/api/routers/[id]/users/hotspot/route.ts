// app/api/routers/[id]/users/hotspot/route.ts
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

    const resolvedParams = await params;
    const routerId = resolvedParams.id;

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

    // Fetch vouchers (hotspot users)
    const vouchers = await db
      .collection('vouchers')
      .find({ 
        routerId: new ObjectId(routerId),
      })
      .toArray();

    // Format vouchers as hotspot users
    const users = vouchers.map((voucher) => ({
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
        isOnline: voucher.status === 'used' && voucher.usage?.used === true,
        lastLogin: voucher.usage?.startTime || null,
        sessionTime: voucher.usage?.timeUsed || 0,
        ipAddress: '',
        macAddress: voucher.usage?.deviceMac || '',
      },
      status: voucher.status === 'active' ? 'active' : voucher.status === 'used' ? 'active' : 'suspended',
      type: 'hotspot' as const,
      createdAt: voucher.createdAt || new Date(),
      updatedAt: voucher.updatedAt || new Date(),
    }));

    const stats = {
      total: users.length,
      online: users.filter(u => u.connection.isOnline).length,
      active: users.filter(u => u.status === 'active').length,
      suspended: users.filter(u => u.status !== 'active').length,
      totalDataUsage: users.reduce((sum, u) => sum + u.usage.currentMonth.dataUsed, 0),
      totalRevenue: users.reduce((sum, u) => sum + u.service.price, 0),
    };

    return NextResponse.json({ users, stats });
  } catch (error) {
    console.error('Error fetching hotspot users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}