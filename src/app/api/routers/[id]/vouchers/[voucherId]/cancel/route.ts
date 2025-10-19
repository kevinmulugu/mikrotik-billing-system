// src/app/api/routers/[id]/vouchers/[voucherId]/cancel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { MikroTikService } from '@/lib/services/mikrotik';

interface RouteContext {
  params: Promise<{
    id: string;
    voucherId: string;
  }>;
}

// POST /api/routers/[id]/vouchers/[voucherId]/cancel
export async function POST(
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
  const { id: routerId, voucherId } = await context.params;

    // Validate IDs
    if (!ObjectId.isValid(routerId) || !ObjectId.isValid(voucherId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
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

    // Get router
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

    // Get voucher
    const voucher = await db
      .collection('vouchers')
      .findOne({
        _id: new ObjectId(voucherId),
        routerId: new ObjectId(routerId),
        customerId: customer._id,
      });

    if (!voucher) {
      return NextResponse.json(
        { error: 'Voucher not found' },
        { status: 404 }
      );
    }

    // Check if voucher can be cancelled
    if (voucher.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Voucher is already cancelled' },
        { status: 400 }
      );
    }

    if (voucher.usage.used) {
      return NextResponse.json(
        { error: 'Cannot cancel a used voucher' },
        { status: 400 }
      );
    }

    // Delete from MikroTik router if online
    let mikrotikDeleted = false;
    let mikrotikError = null;

    if (router.health?.status === 'online') {
      try {
        const routerConfig = {
          ipAddress: router.connection.ipAddress,
          port: router.connection.port || 8728,
          username: router.connection.apiUser || 'admin',
          password: MikroTikService.decryptPassword(router.connection.apiPassword),
        };

        mikrotikDeleted = await MikroTikService.deleteHotspotUser(
          routerConfig,
          voucher.voucherInfo.code
        );
      } catch (error) {
        console.error('Failed to delete voucher from MikroTik:', error);
        mikrotikError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Update voucher status in database
    const updateResult = await db.collection('vouchers').updateOne(
      { _id: new ObjectId(voucherId) },
      {
        $set: {
          status: 'cancelled',
          updatedAt: new Date(),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to cancel voucher' },
        { status: 500 }
      );
    }

    // Update router statistics
    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $inc: {
          'statistics.totalUsers': -1,
        },
        $set: {
          updatedAt: new Date(),
        },
      }
    );

    // Log audit trail
    await db.collection('audit_logs').insertOne({
      user: {
        userId: new ObjectId(userId),
        email: session.user.email || '',
        role: session.user.role || 'homeowner',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
      action: {
        type: 'delete',
        resource: 'voucher',
        resourceId: new ObjectId(voucherId),
        description: `Cancelled voucher ${voucher.voucherInfo.code}`,
      },
      changes: {
        before: { status: voucher.status },
        after: { status: 'cancelled' },
        fields: ['status'],
      },
      metadata: {
        source: 'web',
        severity: 'info',
        mikrotikDeleted,
        mikrotikError,
      },
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Voucher cancelled successfully',
      voucher: {
        id: voucherId,
        code: voucher.voucherInfo.code,
        status: 'cancelled',
      },
      mikrotikSync: {
        deleted: mikrotikDeleted,
        error: mikrotikError,
        routerStatus: router.health?.status || 'unknown',
      },
    });
  } catch (error) {
    console.error('Error cancelling voucher:', error);
    return NextResponse.json(
      {
        error: 'Failed to cancel voucher',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}