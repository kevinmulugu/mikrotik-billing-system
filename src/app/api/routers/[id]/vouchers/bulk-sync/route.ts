// src/app/api/routers/[id]/vouchers/bulk-sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { MikroTikService } from '@/lib/services/mikrotik';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// Convert duration in minutes to MikroTik format
function convertMinutesToMikroTikFormat(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h${remainingMinutes}m` : `${hours}h`;
  } else if (minutes < 10080) {
    const days = Math.floor(minutes / 1440);
    const remainingHours = Math.floor((minutes % 1440) / 60);
    return remainingHours > 0 ? `${days}d${remainingHours}h` : `${days}d`;
  } else {
    const weeks = Math.floor(minutes / 10080);
    const remainingDays = Math.floor((minutes % 10080) / 1440);
    return remainingDays > 0 ? `${weeks}w${remainingDays}d` : `${weeks}w`;
  }
}

// POST /api/routers/[id]/vouchers/bulk-sync
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

    // Check if router is online
    if (router.health?.status !== 'online') {
      return NextResponse.json(
        {
          error: 'Router is offline',
          message: 'Cannot sync vouchers when router is offline',
        },
        { status: 400 }
      );
    }

    // Get all active vouchers for this router
    const activeVouchers = await db
      .collection('vouchers')
      .find({
        routerId: new ObjectId(routerId),
        customerId: customer._id,
        status: 'active',
        'usage.used': false,
      })
      .toArray();

    if (activeVouchers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No vouchers to sync',
        results: {
          total: 0,
          synced: 0,
          failed: 0,
          alreadyExists: 0,
        },
      });
    }

    // Prepare router config
    const routerConfig = {
      ipAddress: router.connection.ipAddress,
      port: router.connection.port || 8728,
      username: router.connection.apiUser || 'admin',
      password: MikroTikService.decryptPassword(router.connection.apiPassword),
    };

    // Get all existing users from MikroTik
    let existingUsers: string[] = [];
    try {
      const users = await MikroTikService.makeRequest(
        routerConfig,
        '/rest/ip/hotspot/user',
        'GET'
      );
      existingUsers = Array.isArray(users) ? users.map((u: any) => u.name) : [];
    } catch (error) {
      console.error('Failed to fetch existing users from MikroTik:', error);
    }

    // Sync results
    const results = {
      total: activeVouchers.length,
      synced: 0,
      failed: 0,
      alreadyExists: 0,
      details: [] as any[],
    };

    // Process each voucher
    for (const voucher of activeVouchers) {
      const voucherCode = voucher.voucherInfo.code;

      // Check if voucher already exists on router
      if (existingUsers.includes(voucherCode)) {
        results.alreadyExists++;
        results.details.push({
          code: voucherCode,
          status: 'exists',
          message: 'Voucher already exists on router',
        });
        continue;
      }

      // Create voucher on MikroTik
      try {
        const limitUptime = convertMinutesToMikroTikFormat(voucher.voucherInfo.duration);

        await MikroTikService.createHotspotUser(routerConfig, {
          name: voucherCode,
          password: voucher.voucherInfo.password,
          profile: voucher.voucherInfo.packageType,
          limitUptime: limitUptime,
          server: 'hotspot1',
          comment: `${voucher.voucherInfo.packageDisplayName || voucher.voucherInfo.packageType} - Synced automatically`,
        });

        results.synced++;
        results.details.push({
          code: voucherCode,
          status: 'synced',
          message: 'Successfully synced to router',
        });
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.details.push({
          code: voucherCode,
          status: 'failed',
          message: errorMessage,
        });
        console.error(`Failed to sync voucher ${voucherCode}:`, error);
      }
    }

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
        type: 'update',
        resource: 'voucher',
        resourceId: new ObjectId(routerId),
        description: `Bulk synced ${results.synced} vouchers to router`,
      },
      changes: {
        before: null,
        after: results,
        fields: ['vouchers'],
      },
      metadata: {
        source: 'web',
        severity: 'info',
        syncResults: results,
      },
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: `Synced ${results.synced} of ${results.total} vouchers`,
      results,
    });
  } catch (error) {
    console.error('Error syncing vouchers:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync vouchers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}