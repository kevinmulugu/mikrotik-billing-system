#!/usr/bin/env ts-node
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import clientPromise from '@/lib/mongodb';
import { MikroTikService } from '@/lib/services/mikrotik';
import { getRouterConnectionConfig } from '@/lib/services/router-connection';

async function run() {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

  const now = new Date();

  console.log('[ExpireVouchers] Starting expiry check at', now.toISOString());

  // Find vouchers that should be expired due to activation expiry
  const activationCursor = db.collection('vouchers').find({
    'expiry.expiresAt': { $ne: null, $lte: now },
    status: { $ne: 'expired' },
  });

  // Find vouchers expired due to purchase expiry
  const purchaseCursor = db.collection('vouchers').find({
    'usage.purchaseExpiresAt': { $ne: null, $lte: now },
    status: { $ne: 'expired' },
  });

  // Find vouchers whose active usage period has ended
  const usageCursor = db.collection('vouchers').find({
    'usage.expectedEndTime': { $ne: null, $lte: now },
    'usage.startTime': { $ne: null },
    status: { $ne: 'expired' },
  });

  const toExpireMap = new Map<string, any>();

  for await (const v of activationCursor) {
    toExpireMap.set(v._id.toString(), { voucher: v, reason: 'activationExpiry' });
  }
  for await (const v of purchaseCursor) {
    toExpireMap.set(v._id.toString(), { voucher: v, reason: 'purchaseExpiry' });
  }
  for await (const v of usageCursor) {
    toExpireMap.set(v._id.toString(), { voucher: v, reason: 'usageEnded' });
  }

  if (toExpireMap.size === 0) {
    console.log('[ExpireVouchers] No vouchers to expire');
    return process.exit(0);
  }

  console.log('[ExpireVouchers] Vouchers to process:', toExpireMap.size);

  let processed = 0;
  let deletedOnRouter = 0;

  for (const [id, item] of toExpireMap) {
    const v = item.voucher;
    const reason = item.reason;

    try {
      // Attempt to remove hotspot user on router if synced
      if (v.mikrotikUserId || (v.voucherInfo && v.voucherInfo.code)) {
        try {
          const router = await db.collection('routers').findOne({ _id: v.routerId });
          if (router) {
            try {
              const conn = getRouterConnectionConfig(router, { forceVPN: true });
              const username = v.voucherInfo?.code || v.voucherInfo?.name || null;
              if (username) {
                const removed = await MikroTikService.deleteHotspotUser(conn, username);
                if (removed) deletedOnRouter++;
              }
            } catch (err) {
              console.warn(`[ExpireVouchers] Failed to remove hotspot user for voucher ${v._id}:`, err instanceof Error ? err.message : String(err));
            }
          }
        } catch (err) {
          console.warn(`[ExpireVouchers] Router lookup or removal failed for voucher ${v._id}:`, err instanceof Error ? err.message : String(err));
        }
      }

      // Update voucher status to expired
      await db.collection('vouchers').updateOne(
        { _id: v._id },
        {
          $set: {
            status: 'expired',
            'usage.endTime': v.usage?.endTime ?? new Date(),
            updatedAt: new Date(),
            'expiry.expiredBy': reason,
          },
        }
      );

      // Log audit
      await db.collection('audit_logs').insertOne({
        user: { userId: v.batch?.generatedBy || null },
        action: {
          type: 'expire',
          resource: 'voucher',
          resourceId: v._id,
          description: `Voucher expired by cron (${reason})`,
        },
        timestamp: new Date(),
        metadata: { voucherCode: v.voucherInfo?.code, routerId: v.routerId },
      });

      processed++;
    } catch (err) {
      console.error(`[ExpireVouchers] Failed to expire voucher ${id}:`, err instanceof Error ? err.message : String(err));
    }
  }

  console.log(`[ExpireVouchers] Completed. Processed: ${processed}, removedOnRouter: ${deletedOnRouter}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('[ExpireVouchers] Fatal error:', err);
  process.exit(1);
});
