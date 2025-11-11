/**
 * Migration Script: Add Multi-Router Support to Existing Vouchers
 * 
 * This script migrates existing voucher documents to support multi-router schema:
 * - Adds routerType field (defaults to 'mikrotik')
 * - Adds serviceType field (defaults to 'hotspot')
 * - Creates vendorSpecific.mikrotik structure from existing fields
 * - Maintains backward compatibility with legacy fields
 * 
 * Run: npx tsx scripts/migrate-vouchers-to-multi-vendor.ts
 */

import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || '';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI or DATABASE_URL environment variable is required');
  process.exit(1);
}

interface LegacyVoucher {
  _id: ObjectId;
  routerId: string;
  voucherInfo: {
    username?: string;
    password?: string;
    code?: string;
    packageType: string;
    packageDisplayName: string;
    profile?: string;
  };
  status: string;
  createdAt: Date;
}

async function migrateVouchers() {
  const client = new MongoClient(MONGODB_URI);

  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db();
    const vouchersCollection = db.collection('vouchers');
    const routersCollection = db.collection('routers');

    // Find all vouchers that don't have routerType field (legacy vouchers)
    const legacyVouchers = await vouchersCollection.find({
      routerType: { $exists: false }
    }).toArray() as unknown as LegacyVoucher[];

    if (legacyVouchers.length === 0) {
      console.log('✅ No vouchers need migration. All vouchers already have multi-router schema.');
      return;
    }

    console.log(`📊 Found ${legacyVouchers.length} voucher(s) to migrate\n`);

    let migratedCount = 0;
    let errorCount = 0;

    // Group vouchers by routerId for efficiency
    const vouchersByRouter = new Map<string, LegacyVoucher[]>();
    for (const voucher of legacyVouchers) {
      const routerId = voucher.routerId;
      if (!vouchersByRouter.has(routerId)) {
        vouchersByRouter.set(routerId, []);
      }
      vouchersByRouter.get(routerId)!.push(voucher);
    }

    console.log(`📦 Processing vouchers from ${vouchersByRouter.size} router(s)...\n`);

    for (const [routerId, vouchers] of vouchersByRouter) {
      try {
        // Get router info to determine type and service
        const router = await routersCollection.findOne({ _id: new ObjectId(routerId) });
        
        if (!router) {
          console.log(`⚠️  Router ${routerId} not found. Skipping ${vouchers.length} voucher(s)`);
          errorCount += vouchers.length;
          continue;
        }

        const routerType = router.routerType || 'mikrotik';
        console.log(`🔄 Migrating ${vouchers.length} voucher(s) for router: ${router.routerInfo?.name || routerId}`);

        for (const voucher of vouchers) {
          try {
            // Determine service type (hotspot by default, pppoe if profile contains 'pppoe')
            const serviceType = voucher.voucherInfo.profile?.toLowerCase().includes('pppoe') 
              ? 'pppoe' 
              : 'hotspot';

            // Build vendorSpecific structure based on router type
            const vendorSpecific: any = {};

            if (routerType === 'mikrotik') {
              vendorSpecific.mikrotik = {
                username: voucher.voucherInfo.username || voucher.voucherInfo.code || '',
                password: voucher.voucherInfo.password || '',
                profile: voucher.voucherInfo.profile || voucher.voucherInfo.packageType,
                service: serviceType,
              };
            } else if (routerType === 'unifi') {
              // UniFi vouchers (shouldn't exist in legacy data, but handle it)
              vendorSpecific.unifi = {
                code: voucher.voucherInfo.code || voucher.voucherInfo.username || '',
                createTime: voucher.createdAt,
                quota: 0, // Unknown from legacy data
              };
            }

            // Build update document
            const updateDoc = {
              $set: {
                routerType,
                serviceType,
                vendorSpecific,
                updatedAt: new Date(),
              }
            };

            // Perform update
            const result = await vouchersCollection.updateOne(
              { _id: voucher._id },
              updateDoc
            );

            if (result.modifiedCount > 0) {
              migratedCount++;
            }

          } catch (error) {
            console.error(`  ❌ Error migrating voucher ${voucher._id}:`, error);
            errorCount++;
          }
        }

        console.log(`  ✅ Completed migration for router ${router.routerInfo?.name || routerId}\n`);

      } catch (error) {
        console.error(`  ❌ Error processing router ${routerId}:`, error);
        errorCount += vouchers.length;
      }
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 Migration Summary');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total vouchers found:     ${legacyVouchers.length}`);
    console.log(`Successfully migrated:    ${migratedCount}`);
    console.log(`Errors:                   ${errorCount}`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (migratedCount > 0) {
      console.log('✅ Migration completed successfully!');
      console.log('\n📝 Next Steps:');
      console.log('   1. Verify voucher data in database');
      console.log('   2. Test voucher display in dashboard');
      console.log('   3. Test voucher generation with new schema');
      console.log('   4. Test voucher activation and redemption\n');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Database connection closed');
  }
}

// Run migration
migrateVouchers().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
