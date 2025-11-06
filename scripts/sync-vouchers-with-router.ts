#!/usr/bin/env ts-node
/**
 * Sync Vouchers with MikroTik Router State
 * 
 * Purpose: Detect and fix database/router inconsistencies
 * 
 * Scenarios handled:
 * 1. Voucher marked as active in DB but session ended on router
 * 2. Voucher marked as used but not found in active sessions
 * 3. Voucher has mikrotikUserId but session doesn't exist
 * 
 * This script queries the router's ACTIVE sessions (not user definitions)
 * to determine if a voucher is truly active or should be marked expired.
 * 
 * Run frequency: Hourly or on-demand
 * Complementary to: expire-vouchers.ts (time-based expiry)
 */

// Load environment variables FIRST before any other imports
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Only import what's needed
import { MongoClient, ObjectId } from 'mongodb';
import { MikroTikService } from '@/lib/services/mikrotik';
import { getRouterConnectionConfig } from '@/lib/services/router-connection';

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'mikrotik_billing';

if (!MONGODB_URI) {
  console.error('[SyncVouchers] Error: MONGODB_URI is not set in environment variables');
  process.exit(1);
}

interface SyncStats {
  routers: number;
  vouchersChecked: number;
  vouchersExpired: number;
  vouchersStillActive: number;
  errors: number;
}

async function run() {
  // Create own MongoDB connection
  const client = await MongoClient.connect(MONGODB_URI!);
  const db = client.db(MONGODB_DB_NAME);

  const stats: SyncStats = {
    routers: 0,
    vouchersChecked: 0,
    vouchersExpired: 0,
    vouchersStillActive: 0,
    errors: 0,
  };

  try {
    const now = new Date();
    console.log('[SyncVouchers] Starting router sync at', now.toISOString());

    // Find all active routers
    const routers = await db.collection('routers').find({
      status: 'active',
    }).toArray();

    console.log(`[SyncVouchers] Found ${routers.length} active routers`);

    for (const router of routers) {
      stats.routers++;
      console.log(`\n[SyncVouchers] Processing router: ${router.name || router._id}`);

      try {
        // Get router connection config
        const conn = getRouterConnectionConfig(router, { forceVPN: true });

        // Find vouchers for this router that have been synced to router and are not yet expired
        // We check any voucher that has mikrotikUserId (synced to router) and is not yet expired
        // This catches vouchers in states: 'active', 'assigned', 'paid' that have been added to router
        const vouchers = await db.collection('vouchers').find({
          routerId: router._id,
          status: { $ne: 'expired' }, // Not already expired
          mikrotikUserId: { $ne: null }, // Has been added to router
        }).toArray();

        console.log(`[SyncVouchers]   Vouchers to check: ${vouchers.length}`);

        for (const voucher of vouchers) {
          stats.vouchersChecked++;
          const voucherCode = voucher.voucherInfo?.code || voucher.voucherInfo?.name;

          if (!voucherCode) {
            console.warn(`[SyncVouchers]     Voucher ${voucher._id} has no code, skipping`);
            continue;
          }

          // Check if user still exists on router and get uptime info
          const routerUser = await MikroTikService.getHotspotUser(conn, voucherCode);

          if (!routerUser) {
            // User has been removed from router (manually or by router itself)
            console.log(`[SyncVouchers]     ✗ ${voucherCode} - User removed from router, marking expired`);
            
            // Mark as expired since router removed it
            await db.collection('vouchers').updateOne(
              { _id: voucher._id },
              {
                $set: {
                  status: 'expired',
                  'usage.used': true,
                  'usage.endTime': new Date(),
                  'expiry.expiredBy': 'routerSync-removed',
                  updatedAt: new Date(),
                },
              }
            );

            stats.vouchersExpired++;
            continue;
          }

          // User exists on router - check limit-uptime
          const limitUptime = routerUser['limit-uptime'];
          const uptime = routerUser.uptime;

          console.log(`[SyncVouchers]     → ${voucherCode} - limit: ${limitUptime || 'none'}, used: ${uptime || 'none'}`);

          // Simple check: if limit-uptime exists and has been used up
          if (limitUptime && uptime) {
            const limitSeconds = MikroTikService.parseUptimeToSeconds(limitUptime);
            const usedSeconds = MikroTikService.parseUptimeToSeconds(uptime);

            if (usedSeconds >= limitSeconds) {
              // SIMPLE: Limit used up → Mark as used in DB → Delete from router
              console.log(`[SyncVouchers]     ✗ ${voucherCode} - Limit exhausted (${uptime}/${limitUptime}) - marking used & deleting`);

              // Mark as used and expired in DB
              await db.collection('vouchers').updateOne(
                { _id: voucher._id },
                {
                  $set: {
                    status: 'expired',
                    'usage.used': true,
                    'usage.endTime': new Date(),
                    'expiry.expiredBy': 'routerSync-uptimeExhausted',
                    updatedAt: new Date(),
                  },
                }
              );

              // Delete from router
              await MikroTikService.deleteHotspotUser(conn, voucherCode);
              console.log(`[SyncVouchers]       ✓ Deleted from router`);

              stats.vouchersExpired++;
            } else {
              // Still has time - keep it
              const remainingSeconds = limitSeconds - usedSeconds;
              const remainingMinutes = Math.floor(remainingSeconds / 60);
              console.log(`[SyncVouchers]     ✓ ${voucherCode} - Active (${remainingMinutes}m remaining)`);
              
              stats.vouchersStillActive++;
              
              // Update current uptime in DB
              await db.collection('vouchers').updateOne(
                { _id: voucher._id },
                {
                  $set: {
                    'usage.lastSeen': new Date(),
                    'usage.currentUptime': uptime,
                    updatedAt: new Date(),
                  },
                }
              );
            }
          } else {
            // No limit-uptime or no usage yet - keep it
            console.log(`[SyncVouchers]     ○ ${voucherCode} - No usage yet or no limit set`);
            stats.vouchersStillActive++;
          }
        }

        console.log(`[SyncVouchers]   Router ${router.name || router._id} complete`);
      } catch (routerError) {
        stats.errors++;
        console.error(
          `[SyncVouchers]   Router ${router.name || router._id} failed:`,
          routerError instanceof Error ? routerError.message : String(routerError)
        );
        // Continue with next router
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('[SyncVouchers] SYNC COMPLETE');
    console.log('='.repeat(60));
    console.log(`Routers processed:    ${stats.routers}`);
    console.log(`Vouchers checked:     ${stats.vouchersChecked}`);
    console.log(`Still active:         ${stats.vouchersStillActive}`);
    console.log(`Expired (synced):     ${stats.vouchersExpired}`);
    console.log(`Errors:               ${stats.errors}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('[SyncVouchers] Fatal error:', error);
    throw error;
  } finally {
    // Close MongoDB connection
    await client.close();
    console.log('[SyncVouchers] MongoDB connection closed');
  }
}

run()
  .then(() => {
    console.log('[SyncVouchers] Script completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[SyncVouchers] Script failed:', err);
    process.exit(1);
  });
