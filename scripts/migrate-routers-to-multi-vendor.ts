/**
 * Migration Script: Add Multi-Router Support to Existing Routers
 * 
 * This script migrates existing router documents to the new multi-router schema:
 * - Adds routerType field (defaults to 'mikrotik')
 * - Creates services structure from legacy configuration
 * - Adds capabilities object based on router type
 * - Creates vendorConfig.mikrotik from existing data
 * - Maintains backward compatibility with legacy fields
 * 
 * Run: npx tsx scripts/migrate-routers-to-multi-vendor.ts
 */

import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || '';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI or DATABASE_URL environment variable is required');
  process.exit(1);
}

interface LegacyRouter {
  _id: ObjectId;
  customerId: string;
  routerInfo: {
    name: string;
    model: string;
    serialNumber?: string;
    macAddress?: string;
    firmwareVersion?: string;
    location: any;
  };
  configuration: {
    hotspot?: {
      enabled: boolean;
      ssid?: string;
      interface?: string;
      ipPool?: string;
      maxUsers?: number;
    };
    pppoe?: {
      enabled: boolean;
      interface?: string;
      ipPool?: string;
      defaultProfile?: string;
    };
    vpn?: any;
  };
  packages?: {
    hotspot?: any[];
  };
  connection?: {
    ipAddress: string;
    port: number;
    identity?: string;
    architecture?: string;
  };
}

async function migrateRouters() {
  const client = new MongoClient(MONGODB_URI);

  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db();
    const routersCollection = db.collection('routers');

    // Find all routers that don't have routerType field (legacy routers)
    const legacyRouters = await routersCollection.find({
      routerType: { $exists: false }
    }).toArray() as unknown as LegacyRouter[];

    if (legacyRouters.length === 0) {
      console.log('✅ No routers need migration. All routers already have multi-router schema.');
      return;
    }

    console.log(`📊 Found ${legacyRouters.length} router(s) to migrate\n`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const router of legacyRouters) {
      try {
        console.log(`🔄 Migrating: ${router.routerInfo.name} (${router._id})`);

        // Determine if this is MikroTik (all existing routers are MikroTik)
        const routerType = 'mikrotik';

        // Build services structure from legacy configuration
        const services: any = {};

        // Hotspot service
        if (router.configuration?.hotspot) {
          services.hotspot = {
            enabled: router.configuration.hotspot.enabled || false,
            ssid: router.configuration.hotspot.ssid || '',
            interface: router.configuration.hotspot.interface || 'bridge',
            ipPool: router.configuration.hotspot.ipPool || '192.168.100.2-192.168.100.254',
            maxUsers: router.configuration.hotspot.maxUsers || 50,
            packages: router.packages?.hotspot || [],
            lastSynced: new Date(),
          };
        }

        // PPPoE service (if enabled)
        if (router.configuration?.pppoe?.enabled) {
          services.pppoe = {
            enabled: true,
            interface: router.configuration.pppoe.interface || 'ether1',
            ipPool: router.configuration.pppoe.ipPool || '192.168.200.2-192.168.200.254',
            defaultProfile: router.configuration.pppoe.defaultProfile || 'default',
            packages: [],
            lastSynced: new Date(),
          };
        }

        // Build capabilities object
        const capabilities = {
          supportsVPN: true, // All MikroTik routers support VPN
          supportedServices: ['hotspot'] as string[],
          captivePortalMethod: 'http_upload' as const,
          voucherFormat: 'username_password' as const,
        };

        // Add PPPoE to supported services if enabled
        if (services.pppoe) {
          capabilities.supportedServices.push('pppoe');
        }

        // Build vendorConfig.mikrotik from existing data
        const vendorConfig = {
          mikrotik: {
            firmwareVersion: router.routerInfo.firmwareVersion || 'unknown',
            identity: router.connection?.identity || router.routerInfo.name,
            architecture: router.connection?.architecture || 'unknown',
          }
        };

        // Build update document
        const updateDoc = {
          $set: {
            routerType,
            services,
            capabilities,
            vendorConfig,
            updatedAt: new Date(),
          }
        };

        // Perform update
        const result = await routersCollection.updateOne(
          { _id: router._id },
          updateDoc
        );

        if (result.modifiedCount > 0) {
          console.log(`  ✅ Successfully migrated`);
          console.log(`     - Router Type: ${routerType}`);
          console.log(`     - Services: ${Object.keys(services).join(', ')}`);
          console.log(`     - Supported Services: ${capabilities.supportedServices.join(', ')}`);
          migratedCount++;
        } else {
          console.log(`  ⚠️  No changes made (already up to date?)`);
        }

      } catch (error) {
        console.error(`  ❌ Error migrating router ${router._id}:`, error);
        errorCount++;
      }

      console.log('');
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 Migration Summary');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total routers found:      ${legacyRouters.length}`);
    console.log(`Successfully migrated:    ${migratedCount}`);
    console.log(`Errors:                   ${errorCount}`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (migratedCount > 0) {
      console.log('✅ Migration completed successfully!');
      console.log('\n📝 Next Steps:');
      console.log('   1. Verify router data in database');
      console.log('   2. Test router dashboard displays correctly');
      console.log('   3. Test package sync and voucher generation');
      console.log('   4. Test with actual MikroTik router connection\n');
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
migrateRouters().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
