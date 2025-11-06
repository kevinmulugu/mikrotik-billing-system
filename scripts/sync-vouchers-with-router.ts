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

        // Get all ACTIVE sessions on router (not user definitions)
        const activeSessions = await MikroTikService.getActiveHotspotUsers(conn);
        console.log(`[SyncVouchers]   Active sessions on router: ${activeSessions.length}`);

        // Create map of active usernames for quick lookup
        const activeUsernames = new Set(
          activeSessions.map((session: any) => session.user || session.name)
        );

        // Find vouchers for this router that claim to be active/in-use OR have been synced to router
        // We check any voucher that has mikrotikUserId (synced to router) and is not yet expired
        // This catches vouchers in states: 'active', 'assigned', 'paid' that have been added to router
        const vouchers = await db.collection('vouchers').find({
          routerId: router._id,
          status: { $ne: 'expired' }, // Not already expired
          $or: [
            { 'usage.used': true }, // Marked as used in DB
            { mikrotikUserId: { $ne: null } }, // Has been added to router (any status)
            { 'usage.startTime': { $ne: null } }, // Has a login timestamp
          ],
        }).toArray();

        console.log(`[SyncVouchers]   Vouchers to check: ${vouchers.length}`);

        for (const voucher of vouchers) {
          stats.vouchersChecked++;
          const voucherCode = voucher.voucherInfo?.code || voucher.voucherInfo?.name;

          if (!voucherCode) {
            console.warn(`[SyncVouchers]     Voucher ${voucher._id} has no code, skipping`);
            continue;
          }

          // Check if voucher's session is active on router
          const isActive = activeUsernames.has(voucherCode);

          if (isActive) {
            // Voucher is genuinely active - all good
            stats.vouchersStillActive++;
            console.log(`[SyncVouchers]     ✓ ${voucherCode} is active on router`);

            // Optional: Get session details to update usage stats
            const session = activeSessions.find(
              (s: any) => (s.user || s.name) === voucherCode
            );

            if (session && session.uptime) {
              // Update last seen and current uptime
              await db.collection('vouchers').updateOne(
                { _id: voucher._id },
                {
                  $set: {
                    'usage.lastSeen': new Date(),
                    'usage.currentUptime': session.uptime,
                    updatedAt: new Date(),
                  },
                }
              );
            }
          } else {
            // Voucher claims to be synced to router but NO active session exists
            // This means the session expired/ended but DB wasn't updated
            console.log(`[SyncVouchers]     ✗ ${voucherCode} NOT active on router - marking expired`);

            // Calculate actual end time and backfill missing timestamps
            let startTime = voucher.usage?.startTime;
            let endTime = voucher.usage?.expectedEndTime;

            // If startTime is missing, estimate it from payment date or creation date
            if (!startTime) {
              const estimatedStart = voucher.payment?.paymentDate || voucher.createdAt;
              startTime = estimatedStart;
              console.log(`[SyncVouchers]       Backfilling startTime from ${voucher.payment?.paymentDate ? 'payment' : 'creation'} date`);
            }

            // If expectedEndTime is missing, calculate it from duration
            if (!endTime && startTime) {
              const durationMs = (voucher.usage?.maxDurationMinutes || voucher.voucherInfo?.duration || 60) * 60 * 1000;
              endTime = new Date(new Date(startTime).getTime() + durationMs);
              console.log(`[SyncVouchers]       Calculated expectedEndTime: ${endTime.toISOString()}`);
            }

            // If still no endTime, use current time as best guess
            if (!endTime) {
              endTime = new Date();
            }

            // Mark voucher as expired
            await db.collection('vouchers').updateOne(
              { _id: voucher._id },
              {
                $set: {
                  status: 'expired',
                  'usage.used': true, // Was definitely used (had mikrotikUserId)
                  'usage.startTime': startTime, // Backfill if missing
                  'usage.endTime': endTime,
                  'usage.expectedEndTime': endTime, // Backfill if missing
                  'expiry.expiredBy': 'routerSync',
                  updatedAt: new Date(),
                },
              }
            );

            // Try to remove from router user list (cleanup)
            try {
              await MikroTikService.deleteHotspotUser(conn, voucherCode);
              console.log(`[SyncVouchers]       Removed user from router`);
            } catch (err) {
              // Non-critical - user might already be gone
              console.log(`[SyncVouchers]       User removal: ${err instanceof Error ? err.message : 'already removed'}`);
            }

            // Log audit
            await db.collection('audit_logs').insertOne({
              user: { userId: null },
              action: {
                type: 'expire',
                resource: 'voucher',
                resourceId: voucher._id,
                description: `Voucher expired by router sync - session no longer active`,
              },
              timestamp: new Date(),
              metadata: {
                voucherCode,
                routerId: router._id,
                routerName: router.name,
                syncReason: 'sessionEnded',
              },
            });

            stats.vouchersExpired++;
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
