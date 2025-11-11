// scripts/migrate-to-multi-router.ts
/**
 * Database Migration Script: Multi-Router Support
 * 
 * This script migrates existing MikroTik-only routers and vouchers
 * to support multiple router types (MikroTik, UniFi) and service types
 * (Hotspot, PPPoE)
 * 
 * Run once before Phase 1 deployment:
 * pnpm db:migrate:multi-router
 */

import { MongoClient, Db, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'mikrotik_billing';

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in .env.local');
}

// ============================================
// MIGRATION FUNCTIONS
// ============================================

/**
 * Migrate routers collection to multi-router schema
 */
async function migrateRoutersCollection(db: Db) {
  console.log('📡 Migrating routers collection...\n');

  const routersCollection = db.collection('routers');
  
  // Get all routers that need migration
  const routers = await routersCollection.find({
    routerType: { $exists: false },
  }).toArray();

  console.log(`Found ${routers.length} routers to migrate\n`);

  let migratedCount = 0;
  let errorCount = 0;

  for (const router of routers) {
    try {
      // Determine enabled services from existing configuration
      const enabledServices: string[] = [];
      if (router.configuration?.hotspotEnabled !== false) {
        enabledServices.push('hotspot'); // Default to enabled
      }
      if (router.configuration?.pppoeEnabled === true) {
        enabledServices.push('pppoe');
      }

      // Build service-specific configuration
      const services: any = {
        hotspot: {
          enabled: router.configuration?.hotspotEnabled !== false,
          ssid: router.configuration?.ssid || null,
          packages: router.packages?.hotspot || [],
          lastSynced: router.packages?.lastSynced || null,
          captivePortalDeployed: true, // Assume deployed for existing routers
        },
      };

      // Add PPPoE service if enabled
      if (router.configuration?.pppoeEnabled === true) {
        services.pppoe = {
          enabled: true,
          interface: router.configuration?.pppoeInterface || 'all',
          packages: router.packages?.pppoe || [],
          lastSynced: null,
        };
      }

      // Build capabilities object
      const capabilities = {
        supportsVPN: true, // All existing routers are MikroTik
        supportsMultipleSites: false,
        supportedServices: enabledServices.length > 0 ? enabledServices : ['hotspot'],
        captivePortalMethod: 'http_upload',
        voucherFormat: 'username_password',
      };

      // Build vendor config
      const vendorConfig: any = {
        mikrotik: {
          firmwareVersion: router.firmwareVersion || 'unknown',
          identity: router.identity || router.routerInfo?.name || 'unknown',
          architecture: router.architecture || 'unknown',
        },
      };

      // Update router
      const updateResult = await routersCollection.updateOne(
        { _id: router._id },
        {
          $set: {
            routerType: 'mikrotik',
            services,
            capabilities,
            vendorConfig,
            updatedAt: new Date(),
          },
          // Keep old fields for backward compatibility (can be removed later)
          // $unset: {
          //   packages: '',
          //   firmwareVersion: '',
          //   identity: '',
          //   architecture: '',
          // },
        }
      );

      if (updateResult.modifiedCount > 0) {
        migratedCount++;
        console.log(`  ✓ Migrated router: ${router.routerInfo?.name || router._id}`);
      }
    } catch (error) {
      errorCount++;
      console.error(`  ✗ Failed to migrate router ${router._id}:`, error);
    }
  }

  console.log(`\n✅ Routers migration complete:`);
  console.log(`   - Migrated: ${migratedCount}`);
  console.log(`   - Errors: ${errorCount}`);
  console.log(`   - Total: ${routers.length}\n`);

  // Create new indexes
  console.log('Creating new indexes for routers...');
  await routersCollection.createIndex({ routerType: 1 });
  console.log('  ✓ routerType');
  await routersCollection.createIndex({ 'capabilities.supportedServices': 1 });
  console.log('  ✓ capabilities.supportedServices');
  await routersCollection.createIndex({ 'capabilities.supportsVPN': 1 });
  console.log('  ✓ capabilities.supportsVPN');
  await routersCollection.createIndex({ 'vendorConfig.unifi.selectedSite': 1 });
  console.log('  ✓ vendorConfig.unifi.selectedSite');
  console.log('');
}

/**
 * Migrate vouchers collection to support multiple router types and service types
 */
async function migrateVouchersCollection(db: Db) {
  console.log('🎫 Migrating vouchers collection...\n');

  const vouchersCollection = db.collection('vouchers');

  // Get all vouchers that need migration
  const vouchers = await vouchersCollection.find({
    routerType: { $exists: false },
  }).toArray();

  console.log(`Found ${vouchers.length} vouchers to migrate\n`);

  let migratedCount = 0;
  let errorCount = 0;

  // Batch update for performance
  const bulkOps = [];

  for (const voucher of vouchers) {
    try {
      // Determine service type (default to hotspot for existing vouchers)
      const serviceType = 'hotspot';

      // Build vendor-specific data
      const vendorSpecific = {
        mikrotik: {
          username: voucher.voucherInfo?.code || 'unknown',
          password: voucher.voucherInfo?.code || 'unknown', // MikroTik uses code as password
          profile: voucher.voucherInfo?.packageType || 'default',
          service: serviceType,
        },
      };

      bulkOps.push({
        updateOne: {
          filter: { _id: voucher._id },
          update: {
            $set: {
              routerType: 'mikrotik',
              serviceType,
              vendorSpecific,
              updatedAt: new Date(),
            },
          },
        },
      });

      if (bulkOps.length >= 1000) {
        // Execute batch
        const result = await vouchersCollection.bulkWrite(bulkOps);
        migratedCount += result.modifiedCount;
        console.log(`  ✓ Migrated ${result.modifiedCount} vouchers (batch)`);
        bulkOps.length = 0; // Clear array
      }
    } catch (error) {
      errorCount++;
      console.error(`  ✗ Failed to prepare migration for voucher ${voucher._id}:`, error);
    }
  }

  // Execute remaining batch
  if (bulkOps.length > 0) {
    const result = await vouchersCollection.bulkWrite(bulkOps);
    migratedCount += result.modifiedCount;
    console.log(`  ✓ Migrated ${result.modifiedCount} vouchers (final batch)`);
  }

  console.log(`\n✅ Vouchers migration complete:`);
  console.log(`   - Migrated: ${migratedCount}`);
  console.log(`   - Errors: ${errorCount}`);
  console.log(`   - Total: ${vouchers.length}\n`);

  // Create new indexes
  console.log('Creating new indexes for vouchers...');
  await vouchersCollection.createIndex({ routerType: 1 });
  console.log('  ✓ routerType');
  await vouchersCollection.createIndex({ serviceType: 1 });
  console.log('  ✓ serviceType');
  await vouchersCollection.createIndex({ 'vendorSpecific.mikrotik.username': 1 });
  console.log('  ✓ vendorSpecific.mikrotik.username');
  await vouchersCollection.createIndex({ 'vendorSpecific.unifi.createTime': 1 });
  console.log('  ✓ vendorSpecific.unifi.createTime');
  console.log('');
}

/**
 * Update users collection for multi-payment provider support
 */
async function migrateUsersCollection(db: Db) {
  console.log('👤 Migrating users collection...\n');

  const usersCollection = db.collection('users');

  // Get users with old payment settings structure
  const users = await usersCollection.find({
    'paymentSettings.paybillNumber': { $exists: true },
    'paymentSettings.providers': { $exists: false },
  }).toArray();

  console.log(`Found ${users.length} users to migrate payment settings\n`);

  let migratedCount = 0;

  for (const user of users) {
    try {
      // Build providers array from existing paymentSettings
      const providers = [];

      if (user.paymentSettings?.paybillNumber) {
        providers.push({
          type: 'mpesa',
          paybillNumber: user.paymentSettings.paybillNumber,
          accountNumber: user.paymentSettings.accountNumber || '',
          enabled: true,
        });
      }

      // Update user with new structure
      await usersCollection.updateOne(
        { _id: user._id },
        {
          $set: {
            'paymentSettings.providers': providers,
            'paymentSettings.defaultProvider': 'mpesa',
            updatedAt: new Date(),
          },
        }
      );

      migratedCount++;
      console.log(`  ✓ Migrated user: ${user.email || user._id}`);
    } catch (error) {
      console.error(`  ✗ Failed to migrate user ${user._id}:`, error);
    }
  }

  console.log(`\n✅ Users migration complete:`);
  console.log(`   - Migrated: ${migratedCount}`);
  console.log(`   - Total: ${users.length}\n`);

  // Create new index
  console.log('Creating new indexes for users...');
  await usersCollection.createIndex({ 'paymentSettings.providers.type': 1 });
  console.log('  ✓ paymentSettings.providers.type');
  console.log('');
}

/**
 * Verify migration results
 */
async function verifyMigration(db: Db) {
  console.log('🔍 Verifying migration...\n');

  // Check routers
  const routersWithType = await db.collection('routers').countDocuments({
    routerType: { $exists: true },
  });
  const routersWithCapabilities = await db.collection('routers').countDocuments({
    'capabilities.supportedServices': { $exists: true },
  });
  console.log(`Routers with routerType: ${routersWithType}`);
  console.log(`Routers with capabilities: ${routersWithCapabilities}`);

  // Check vouchers
  const vouchersWithType = await db.collection('vouchers').countDocuments({
    routerType: { $exists: true },
  });
  const vouchersWithService = await db.collection('vouchers').countDocuments({
    serviceType: { $exists: true },
  });
  console.log(`Vouchers with routerType: ${vouchersWithType}`);
  console.log(`Vouchers with serviceType: ${vouchersWithService}`);

  // Check users
  const usersWithProviders = await db.collection('users').countDocuments({
    'paymentSettings.providers': { $exists: true },
  });
  console.log(`Users with payment providers array: ${usersWithProviders}`);

  console.log('\n✅ Verification complete\n');
}

// ============================================
// MAIN MIGRATION FUNCTION
// ============================================

async function runMigration() {
  console.log('🚀 Starting multi-router migration...\n');
  console.log(`Database: ${MONGODB_DB_NAME}`);
  console.log(`URI: ${MONGODB_URI?.substring(0, 30)}...\n`);

  const client = new MongoClient(MONGODB_URI as string);

  try {
    // Connect to MongoDB
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(MONGODB_DB_NAME);

    // Run migrations
    await migrateRoutersCollection(db);
    await migrateVouchersCollection(db);
    await migrateUsersCollection(db);

    // Verify results
    await verifyMigration(db);

    console.log('🎉 Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('  1. Review migrated data in MongoDB');
    console.log('  2. Test router connections');
    console.log('  3. Proceed with Phase 1 implementation\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Connection closed\n');
  }
}

// Run migration
runMigration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
