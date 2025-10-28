// src/app/api/routers/[id]/vouchers/bulk-sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { MikroTikService } from '@/lib/services/mikrotik';
import { getRouterConnectionConfig } from '@/lib/services/router-connection';

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
          updated: 0,
        },
      });
    }

    console.log(`[Bulk Sync] Found ${activeVouchers.length} active vouchers to sync`);

    // Prepare router config
    const routerConfig = getRouterConnectionConfig(router, {
      forceLocal: false,
      forceVPN: true,
    });

    // Get all existing users from MikroTik (WITH .id field)
    let existingUsersMap = new Map<string, string>(); // Map<username, mikrotikId>
    try {
      const users = await MikroTikService.makeRequest(
        routerConfig,
        '/rest/ip/hotspot/user',
        'GET'
      );
      
      if (Array.isArray(users)) {
        // CRITICAL: Build map of username -> .id
        users.forEach((user: any) => {
          if (user.name && user['.id']) {
            existingUsersMap.set(user.name, user['.id']);
          }
        });
        console.log(`[Bulk Sync] Found ${existingUsersMap.size} existing users on router`);
      }
    } catch (error) {
      console.error('[Bulk Sync] Failed to fetch existing users from MikroTik:', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch users from router',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Sync results
    const results = {
      total: activeVouchers.length,
      synced: 0,
      failed: 0,
      alreadyExists: 0,
      updated: 0, // Vouchers that got mikrotikUserId updated in DB
      details: [] as any[],
    };

    // Track database updates needed
    const dbUpdates: Array<{ voucherId: ObjectId; mikrotikUserId: string }> = [];

    // Process each voucher
    for (const voucher of activeVouchers) {
      const voucherCode = voucher.voucherInfo.code;
      const voucherId = voucher._id;

      // Check if voucher already exists on router
      const existingMikrotikId = existingUsersMap.get(voucherCode);

      if (existingMikrotikId) {
        // Voucher exists on router
        results.alreadyExists++;

        // Check if we need to update database with mikrotikUserId
        if (!voucher.mikrotikUserId || voucher.mikrotikUserId !== existingMikrotikId) {
          // CRITICAL: Save mikrotikUserId to database (backfill or update)
          dbUpdates.push({
            voucherId: voucherId,
            mikrotikUserId: existingMikrotikId,
          });
          results.updated++;

          console.log(`[Voucher ${voucherCode}] Backfilling mikrotikUserId: ${existingMikrotikId}`);

          results.details.push({
            code: voucherCode,
            status: 'exists',
            message: 'Voucher already exists on router. MikroTik ID saved to database.',
            mikrotikUserId: existingMikrotikId,
            action: 'backfilled',
          });
        } else {
          results.details.push({
            code: voucherCode,
            status: 'exists',
            message: 'Voucher already exists on router. Database already has MikroTik ID.',
            mikrotikUserId: existingMikrotikId,
            action: 'skipped',
          });
        }
        continue;
      }

      // Voucher does not exist on router - create it
      try {
        const limitUptime = convertMinutesToMikroTikFormat(voucher.voucherInfo.duration);

        console.log(`[Voucher ${voucherCode}] Creating on router...`);

        const createResult = await MikroTikService.createHotspotUser(routerConfig, {
          name: voucherCode,
          password: voucher.voucherInfo.password,
          profile: voucher.voucherInfo.packageType,
          limitUptime: limitUptime,
          server: 'hotspot1',
          comment: `${voucher.voucherInfo.packageDisplayName || voucher.voucherInfo.packageType} - Synced automatically`,
        });

        // CRITICAL: Extract .id from creation response
        const mikrotikUserId = createResult?.['.id'] || null;

        if (mikrotikUserId) {
          // Save mikrotikUserId to database
          dbUpdates.push({
            voucherId: voucherId,
            mikrotikUserId: mikrotikUserId,
          });

          console.log(`[Voucher ${voucherCode}] Created successfully. MikroTik ID: ${mikrotikUserId}`);

          results.synced++;
          results.updated++;
          results.details.push({
            code: voucherCode,
            status: 'synced',
            message: 'Successfully created on router and saved MikroTik ID',
            mikrotikUserId: mikrotikUserId,
            action: 'created',
          });
        } else {
          // Created but no .id returned (shouldn't happen, but handle gracefully)
          console.warn(`[Voucher ${voucherCode}] Created but no MikroTik ID returned`);

          results.synced++;
          results.details.push({
            code: voucherCode,
            status: 'synced',
            message: 'Created on router but MikroTik ID not available',
            mikrotikUserId: null,
            action: 'created',
          });
        }
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        console.error(`[Voucher ${voucherCode}] Failed to sync:`, error);

        results.details.push({
          code: voucherCode,
          status: 'failed',
          message: errorMessage,
          mikrotikUserId: null,
          action: 'failed',
        });
      }
    }

    // Bulk update database with mikrotikUserId values
    if (dbUpdates.length > 0) {
      console.log(`[Bulk Sync] Updating ${dbUpdates.length} vouchers in database with mikrotikUserId`);

      try {
        // Use bulk write for efficiency
        const bulkOps = dbUpdates.map(update => ({
          updateOne: {
            filter: { _id: update.voucherId },
            update: {
              $set: {
                mikrotikUserId: update.mikrotikUserId,
                updatedAt: new Date(),
              },
            },
          },
        }));

        const bulkResult = await db.collection('vouchers').bulkWrite(bulkOps);
        
        console.log(`[Bulk Sync] Database update complete. Modified: ${bulkResult.modifiedCount}`);
      } catch (dbError) {
        console.error('[Bulk Sync] Failed to update database:', dbError);
        // Don't fail the entire operation - vouchers are synced to router
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
        description: `Bulk synced vouchers: ${results.synced} created, ${results.alreadyExists} existing, ${results.updated} updated in DB`,
      },
      changes: {
        before: {
          totalVouchers: activeVouchers.length,
          vouchersWithMikrotikId: activeVouchers.filter(v => v.mikrotikUserId).length,
        },
        after: results,
        fields: ['vouchers', 'mikrotikUserId'],
      },
      metadata: {
        source: 'web',
        severity: 'info',
        syncResults: results,
      },
      timestamp: new Date(),
    });

    console.log(`[Bulk Sync] Complete. Synced: ${results.synced}, Existing: ${results.alreadyExists}, Failed: ${results.failed}, DB Updated: ${results.updated}`);

    return NextResponse.json({
      success: true,
      message: `Bulk sync complete: ${results.synced} created, ${results.alreadyExists} already existed, ${results.failed} failed. Updated ${results.updated} vouchers in database.`,
      results,
    });
  } catch (error) {
    console.error('[Bulk Sync] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync vouchers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}