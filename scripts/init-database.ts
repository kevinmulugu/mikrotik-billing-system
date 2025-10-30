// scripts/init-database.ts
/**
 * Comprehensive Database Initialization Script
 * 
 * This script initializes the entire MongoDB database including:
 * - All collections
 * - All indexes (including ticket-specific indexes)
 * - VPN infrastructure (tunnels, IP pool, server config)
 * - Validation rules
 * - Default system configuration
 * 
 * Usage: pnpm db:init
 * Command: npx tsx scripts/init-database.ts
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
// HELPER FUNCTIONS
// ============================================

/**
 * Get SLA times based on ticket priority
 */
function getSLATimes(priority: string) {
  const slaMapping: Record<string, { responseTime: number; resolutionTime: number }> = {
    urgent: { responseTime: 1, resolutionTime: 4 },
    high: { responseTime: 2, resolutionTime: 24 },
    medium: { responseTime: 4, resolutionTime: 48 },
    low: { responseTime: 24, resolutionTime: 72 },
  };
  return slaMapping[priority] || slaMapping.medium;
}

/**
 * Create ticket-specific indexes
 */
async function createTicketIndexes(db: Db) {
  const collection = db.collection('tickets');

  console.log('  📋 Creating ticket indexes...');

  // Single field indexes
  await collection.createIndex({ customerId: 1 });
  console.log('    ✓ customerId');

  await collection.createIndex({ userId: 1 });
  console.log('    ✓ userId');

  await collection.createIndex({ routerId: 1 });
  console.log('    ✓ routerId');

  await collection.createIndex({ status: 1 });
  console.log('    ✓ status');

  await collection.createIndex({ createdAt: -1 });
  console.log('    ✓ createdAt (desc)');

  await collection.createIndex({ 'sla.breachedSla': 1 });
  console.log('    ✓ sla.breachedSla');

  // Compound indexes for common queries
  await collection.createIndex({ customerId: 1, status: 1 });
  console.log('    ✓ customerId + status (compound)');

  await collection.createIndex({ status: 1, 'ticket.priority': 1 });
  console.log('    ✓ status + ticket.priority (compound)');

  // Text search index for ticket content
  await collection.createIndex(
    { 'ticket.title': 'text', 'ticket.description': 'text' },
    { name: 'ticket_text_search' }
  );
  console.log('    ✓ ticket.title + ticket.description (text search)');
}

/**
 * Get ticket statistics helper function
 */
async function getTicketStatistics(db: Db, customerId: string) {
  const collection = db.collection('tickets');

  const stats = await collection.aggregate([
    {
      $match: { customerId: new ObjectId(customerId) }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        open: {
          $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
        },
        inProgress: {
          $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
        },
        resolved: {
          $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
        },
        breachedSla: {
          $sum: { $cond: ['$sla.breachedSla', 1, 0] }
        },
        avgResponseTime: {
          $avg: {
            $cond: [
              { $ne: ['$sla.firstResponseAt', null] },
              {
                $divide: [
                  { $subtract: ['$sla.firstResponseAt', '$createdAt'] },
                  3600000 // Convert to hours
                ]
              },
              null
            ]
          }
        }
      }
    }
  ]).toArray();

  return stats[0] || {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    breachedSla: 0,
    avgResponseTime: 0
  };
}

// ============================================
// MAIN INITIALIZATION FUNCTION
// ============================================

async function initializeDatabase() {
  console.log('🚀 Starting comprehensive database initialization...\n');

  const client = new MongoClient(MONGODB_URI as string);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(MONGODB_DB_NAME);

    // ==========================================
    // 1. CREATE CORE COLLECTIONS
    // ==========================================
    console.log('📦 Creating core collections...');

    const coreCollections = [
      'users',
      'accounts',
      'sessions',
      'verification_tokens',
      'customers',
      'routers',
      'vouchers',
      'pppoe_users',
      'payments',
      'commissions',
      'paybills',
      'tickets',
      'audit_logs',
      'notifications',
      'router_health',
      'usage_analytics',
      'revenue_analytics',
      'system_config',
    ];

    for (const collectionName of coreCollections) {
      const exists = await db.listCollections({ name: collectionName }).hasNext();
      if (!exists) {
        await db.createCollection(collectionName);
        console.log(`  ✓ Created collection: ${collectionName}`);
      } else {
        console.log(`  ⊙ Collection already exists: ${collectionName}`);
      }
    }

    console.log('\n');

    // ==========================================
    // 2. CREATE VPN COLLECTIONS
    // ==========================================
    console.log('🔐 Creating VPN collections...\n');

    // VPN Tunnels Collection with validation
    const vpnTunnelsExists = await db.listCollections({ name: 'vpn_tunnels' }).hasNext();
    if (!vpnTunnelsExists) {
      await db.createCollection('vpn_tunnels', {
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['routerId', 'customerId', 'vpnConfig', 'connection'],
            properties: {
              routerId: { bsonType: 'objectId', description: 'Reference to routers collection' },
              customerId: { bsonType: 'objectId', description: 'Reference to customers collection' },
              vpnConfig: {
                bsonType: 'object',
                required: ['clientPublicKey', 'assignedIP', 'endpoint'],
                properties: {
                  clientPrivateKey: { bsonType: 'string' },
                  clientPublicKey: { bsonType: 'string' },
                  serverPublicKey: { bsonType: 'string' },
                  assignedIP: { bsonType: 'string' },
                  endpoint: { bsonType: 'string' },
                  allowedIPs: { bsonType: 'string' },
                  persistentKeepalive: { bsonType: 'int' }
                }
              },
              connection: {
                bsonType: 'object',
                properties: {
                  status: { enum: ['connected', 'disconnected', 'setup', 'failed'] },
                  lastHandshake: { bsonType: 'date' },
                  bytesReceived: { bsonType: 'long' },
                  bytesSent: { bsonType: 'long' },
                  lastSeen: { bsonType: 'date' }
                }
              },
              createdAt: { bsonType: 'date' },
              updatedAt: { bsonType: 'date' }
            }
          }
        }
      });
      console.log('  ✓ Created vpn_tunnels collection with validation');
    } else {
      console.log('  ⊙ vpn_tunnels collection already exists');
    }

    // VPN Setup Tokens Collection
    const vpnSetupTokensExists = await db.listCollections({ name: 'vpn_setup_tokens' }).hasNext();
    if (!vpnSetupTokensExists) {
      await db.createCollection('vpn_setup_tokens');
      console.log('  ✓ Created vpn_setup_tokens collection');
    } else {
      console.log('  ⊙ vpn_setup_tokens collection already exists');
    }

    // VPN IP Pool Collection
    const vpnIpPoolExists = await db.listCollections({ name: 'vpn_ip_pool' }).hasNext();
    if (!vpnIpPoolExists) {
      await db.createCollection('vpn_ip_pool');
      console.log('  ✓ Created vpn_ip_pool collection');

      // Initialize VPN IP pool
      await db.collection('vpn_ip_pool').insertOne({
        network: '10.99.0.0/16',
        reserved: {
          '10.99.0.1': 'VPN Server',
          '10.99.0.2': 'Reserved',
          '10.99.0.255': 'Reserved',
          '10.99.255.255': 'Broadcast'
        },
        assigned: {},
        nextAvailable: '10.99.1.1',
        totalCapacity: 65534,
        usedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('  ✓ Initialized VPN IP pool (10.99.0.0/16)');
    } else {
      console.log('  ⊙ vpn_ip_pool collection already exists');
    }

    console.log('\n');

    // ==========================================
    // 3. CREATE CORE INDEXES
    // ==========================================
    console.log('🔑 Creating core indexes...\n');

    // Users collection indexes
    console.log('  Users indexes:');
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    console.log('    ✓ email (unique)');
    await db.collection('users').createIndex({ role: 1 });
    console.log('    ✓ role');
    await db.collection('users').createIndex({ customerId: 1 });
    console.log('    ✓ customerId');
    await db.collection('users').createIndex({ status: 1 });
    console.log('    ✓ status');

    // Accounts collection indexes (NextAuth)
    console.log('\n  Accounts indexes:');
    await db.collection('accounts').createIndex({ userId: 1 });
    console.log('    ✓ userId');
    await db.collection('accounts').createIndex(
      { provider: 1, providerAccountId: 1 },
      { unique: true }
    );
    console.log('    ✓ provider + providerAccountId (unique)');

    // Sessions collection indexes (NextAuth)
    console.log('\n  Sessions indexes:');
    await db.collection('sessions').createIndex({ sessionToken: 1 }, { unique: true });
    console.log('    ✓ sessionToken (unique)');
    await db.collection('sessions').createIndex({ userId: 1 });
    console.log('    ✓ userId');
    await db.collection('sessions').createIndex(
      { expires: 1 },
      { expireAfterSeconds: 0 }
    );
    console.log('    ✓ expires (TTL)');

    // Verification tokens indexes (NextAuth)
    console.log('\n  Verification Tokens indexes:');
    await db.collection('verification_tokens').createIndex(
      { identifier: 1, token: 1 },
      { unique: true }
    );
    console.log('    ✓ identifier + token (unique)');
    await db.collection('verification_tokens').createIndex(
      { expires: 1 },
      { expireAfterSeconds: 0 }
    );
    console.log('    ✓ expires (TTL)');

    // Customers collection indexes
    console.log('\n  Customers indexes:');
    await db.collection('customers').createIndex({ userId: 1 }, { unique: true });
    console.log('    ✓ userId (unique)');
    await db.collection('customers').createIndex({ 'businessInfo.type': 1 });
    console.log('    ✓ businessInfo.type');
    await db.collection('customers').createIndex({ status: 1 });
    console.log('    ✓ status');
    await db.collection('customers').createIndex({ 'paymentSettings.paybillNumber': 1 });
    console.log('    ✓ paymentSettings.paybillNumber');

    // Routers collection indexes
    console.log('\n  Routers indexes:');
    await db.collection('routers').createIndex({ customerId: 1 });
    console.log('    ✓ customerId');
    await db.collection('routers').createIndex(
      { 'routerInfo.serialNumber': 1 },
      { unique: true, sparse: true }
    );
    console.log('    ✓ routerInfo.serialNumber (unique)');
    await db.collection('routers').createIndex({ 'health.status': 1 });
    console.log('    ✓ health.status');
    await db.collection('routers').createIndex({ status: 1 });
    console.log('    ✓ status');
    await db.collection('routers').createIndex({ 'connection.ipAddress': 1 });
    console.log('    ✓ connection.ipAddress');
    await db.collection('routers').createIndex({ 'vpnTunnel.assignedVPNIP': 1 });
    console.log('    ✓ vpnTunnel.assignedVPNIP');
    await db.collection('routers').createIndex({ 'vpnTunnel.status': 1 });
    console.log('    ✓ vpnTunnel.status');
    await db.collection('routers').createIndex({ 'vpnTunnel.enabled': 1 });
    console.log('    ✓ vpnTunnel.enabled');
    await db.collection('routers').createIndex({ 'connection.preferVPN': 1 });
    console.log('    ✓ connection.preferVPN');

    // Vouchers collection indexes
    console.log('\n  Vouchers indexes:');
    await db.collection('vouchers').createIndex(
      { 'voucherInfo.code': 1 },
      { unique: true }
    );
    console.log('    ✓ voucherInfo.code (unique)');
    await db.collection('vouchers').createIndex(
      { reference: 1 },
      { unique: true }
    );
    console.log('    ✓ reference (unique)');
    await db.collection('vouchers').createIndex({ routerId: 1 });
    console.log('    ✓ routerId');
    await db.collection('vouchers').createIndex({ customerId: 1 });
    console.log('    ✓ customerId');
    await db.collection('vouchers').createIndex({ status: 1 });
    console.log('    ✓ status');
    await db.collection('vouchers').createIndex({ 'batch.batchId': 1 });
    console.log('    ✓ batch.batchId');
    await db.collection('vouchers').createIndex({ 'expiry.expiresAt': 1 });
    console.log('    ✓ expiry.expiresAt');
    await db.collection('vouchers').createIndex({ 'usage.purchaseExpiresAt': 1 });
    console.log('    ✓ usage.purchaseExpiresAt');
    await db.collection('vouchers').createIndex({ 'payment.transactionId': 1 });
    console.log('    ✓ payment.transactionId');

    // PPPoE users collection indexes
    console.log('\n  PPPoE Users indexes:');
    await db.collection('pppoe_users').createIndex(
      { routerId: 1, 'userInfo.username': 1 },
      { unique: true }
    );
    console.log('    ✓ routerId + userInfo.username (unique)');
    await db.collection('pppoe_users').createIndex({ customerId: 1 });
    console.log('    ✓ customerId');
    await db.collection('pppoe_users').createIndex({ 'userInfo.phone': 1 });
    console.log('    ✓ userInfo.phone');
    await db.collection('pppoe_users').createIndex({ status: 1 });
    console.log('    ✓ status');
    await db.collection('pppoe_users').createIndex({ 'billing.nextBillingDate': 1 });
    console.log('    ✓ billing.nextBillingDate');

    // Payments collection indexes
    console.log('\n  Payments indexes:');
    await db.collection('payments').createIndex({ customerId: 1 });
    console.log('    ✓ customerId');
    await db.collection('payments').createIndex({ 'mpesa.transactionId': 1 });
    console.log('    ✓ mpesa.transactionId');
    await db.collection('payments').createIndex({ 'transaction.reference': 1 });
    console.log('    ✓ transaction.reference');
    await db.collection('payments').createIndex({ status: 1 });
    console.log('    ✓ status');
    await db.collection('payments').createIndex({ 'reconciliation.isReconciled': 1 });
    console.log('    ✓ reconciliation.isReconciled');
    await db.collection('payments').createIndex({ 'paybill.paybillNumber': 1 });
    console.log('    ✓ paybill.paybillNumber');
    await db.collection('payments').createIndex({ createdAt: -1 });
    console.log('    ✓ createdAt (desc)');

    // Commissions collection indexes
    console.log('\n  Commissions indexes:');
    await db.collection('commissions').createIndex({ customerId: 1 });
    console.log('    ✓ customerId');
    await db.collection('commissions').createIndex({ 'period.month': 1 });
    console.log('    ✓ period.month');
    await db.collection('commissions').createIndex({ 'payout.status': 1 });
    console.log('    ✓ payout.status');

    // Paybills collection indexes
    console.log('\n  Paybills indexes:');
    await db.collection('paybills').createIndex(
      { 'paybillInfo.number': 1 },
      { unique: true }
    );
    console.log('    ✓ paybillInfo.number (unique)');
    await db.collection('paybills').createIndex({ customerId: 1 });
    console.log('    ✓ customerId');
    await db.collection('paybills').createIndex({ 'paybillInfo.type': 1 });
    console.log('    ✓ paybillInfo.type');
    await db.collection('paybills').createIndex({ status: 1 });
    console.log('    ✓ status');

    // Create ticket indexes using helper function
    console.log('\n');
    await createTicketIndexes(db);

    // Audit logs collection indexes
    console.log('\n  Audit Logs indexes:');
    await db.collection('audit_logs').createIndex({ userId: 1 });
    console.log('    ✓ userId');
    await db.collection('audit_logs').createIndex({ customerId: 1 });
    console.log('    ✓ customerId');
    await db.collection('audit_logs').createIndex({ 'action.type': 1 });
    console.log('    ✓ action.type');
    await db.collection('audit_logs').createIndex({ timestamp: -1 });
    console.log('    ✓ timestamp (desc)');
    await db.collection('audit_logs').createIndex({ 'metadata.ipAddress': 1 });
    console.log('    ✓ metadata.ipAddress');

    // Notifications collection indexes
    console.log('\n  Notifications indexes:');
    await db.collection('notifications').createIndex({ userId: 1 });
    console.log('    ✓ userId');
    await db.collection('notifications').createIndex({ customerId: 1 });
    console.log('    ✓ customerId');
    await db.collection('notifications').createIndex({ 'notification.type': 1 });
    console.log('    ✓ notification.type');
    await db.collection('notifications').createIndex({ 'status.read': 1 });
    console.log('    ✓ status.read');
    await db.collection('notifications').createIndex({ createdAt: -1 });
    console.log('    ✓ createdAt (desc)');

    // Router health collection indexes
    console.log('\n  Router Health indexes:');
    await db.collection('router_health').createIndex({ routerId: 1 });
    console.log('    ✓ routerId');
    await db.collection('router_health').createIndex({ timestamp: -1 });
    console.log('    ✓ timestamp (desc)');
    await db.collection('router_health').createIndex({ 'health.isOnline': 1 });
    console.log('    ✓ health.isOnline');
    await db.collection('router_health').createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: 2592000 } // 30 days
    );
    console.log('    ✓ timestamp (TTL - 30 days)');

    // Usage analytics collection indexes
    console.log('\n  Usage Analytics indexes:');
    await db.collection('usage_analytics').createIndex({ customerId: 1 });
    console.log('    ✓ customerId');
    await db.collection('usage_analytics').createIndex({ routerId: 1 });
    console.log('    ✓ routerId');
    await db.collection('usage_analytics').createIndex({
      'period.type': 1,
      'period.date': -1,
    });
    console.log('    ✓ period.type + period.date (desc)');
    await db.collection('usage_analytics').createIndex({
      'period.year': 1,
      'period.month': 1,
    });
    console.log('    ✓ period.year + period.month');

    // Revenue analytics collection indexes
    console.log('\n  Revenue Analytics indexes:');
    await db.collection('revenue_analytics').createIndex({ customerId: 1 });
    console.log('    ✓ customerId');
    await db.collection('revenue_analytics').createIndex({
      'period.type': 1,
      'period.date': -1,
    });
    console.log('    ✓ period.type + period.date (desc)');
    await db.collection('revenue_analytics').createIndex({
      'period.year': 1,
      'period.month': 1,
    });
    console.log('    ✓ period.year + period.month');

    // System config collection indexes
    console.log('\n  System Config indexes:');
    await db.collection('system_config').createIndex(
      { category: 1, key: 1 },
      { unique: true }
    );
    console.log('    ✓ category + key (unique)');
    await db.collection('system_config').createIndex({ 'metadata.environment': 1 });
    console.log('    ✓ metadata.environment');

    console.log('\n');

    // ==========================================
    // 4. CREATE VPN INDEXES
    // ==========================================
    console.log('🔐 Creating VPN indexes...\n');

    // VPN tunnels indexes
    console.log('  VPN Tunnels indexes:');
    await db.collection('vpn_tunnels').createIndex({ routerId: 1 }, { unique: true });
    console.log('    ✓ routerId (unique)');
    await db.collection('vpn_tunnels').createIndex({ 'vpnConfig.assignedIP': 1 }, { unique: true });
    console.log('    ✓ vpnConfig.assignedIP (unique)');
    await db.collection('vpn_tunnels').createIndex({ 'vpnConfig.clientPublicKey': 1 }, { unique: true });
    console.log('    ✓ vpnConfig.clientPublicKey (unique)');
    await db.collection('vpn_tunnels').createIndex({ 'connection.status': 1 });
    console.log('    ✓ connection.status');
    await db.collection('vpn_tunnels').createIndex({ customerId: 1 });
    console.log('    ✓ customerId');
    await db.collection('vpn_tunnels').createIndex({ 'connection.lastSeen': 1 });
    console.log('    ✓ connection.lastSeen');

    // VPN setup tokens indexes
    console.log('\n  VPN Setup Tokens indexes:');
    await db.collection('vpn_setup_tokens').createIndex({ token: 1 }, { unique: true });
    console.log('    ✓ token (unique)');
    await db.collection('vpn_setup_tokens').createIndex({ 'vpnConfig.vpnIP': 1 }, { unique: true });
    console.log('    ✓ vpnConfig.vpnIP (unique)');
    await db.collection('vpn_setup_tokens').createIndex({ status: 1 });
    console.log('    ✓ status');
    await db.collection('vpn_setup_tokens').createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 3600 } // 1 hour TTL
    );
    console.log('    ✓ createdAt (TTL - 1 hour)');

    // VPN IP pool indexes
    console.log('\n  VPN IP Pool indexes:');
    await db.collection('vpn_ip_pool').createIndex({ network: 1 }, { unique: true });
    console.log('    ✓ network (unique)');

    console.log('\n');

    // ==========================================
    // 5. INSERT DEFAULT SYSTEM CONFIGURATION
    // ==========================================
    console.log('⚙️  Inserting default system configuration...\n');

    const configExists = await db.collection('system_config').countDocuments();

    if (configExists === 0) {
      await db.collection('system_config').insertMany([
        {
          category: 'general',
          key: 'commission_rates',
          value: {
            homeowner: 20.0,  // 20% commission per voucher sale for individuals
            personal: 20.0,   // Same as homeowner
            isp: 0.0,         // No commission - ISPs pay subscription fees instead
            enterprise: 0.0,  // No commission - enterprises pay subscription fees
          },
          encrypted: false,
          description: 'Commission rates by customer type. Individuals pay 20% per sale, ISPs pay subscription fees.',
          validation: {
            type: 'object',
            required: true,
          },
          metadata: {
            lastModified: new Date(),
            version: 1,
            environment: 'production',
          },
        },
        {
          category: 'general',
          key: 'subscription_fees',
          value: {
            personal: 0,        // No subscription fee for individuals (pay commission)
            isp_5_routers: 2500,   // KES 2,500/month for ISPs with up to 5 routers
            isp_unlimited: 3900,   // KES 3,900/month for ISPs with unlimited routers
          },
          encrypted: false,
          description: 'Monthly subscription fees. Individuals: 0 (pay 20% commission). ISPs: 2500 for ≤5 routers, 3900 for unlimited.',
          validation: {
            type: 'object',
            required: true,
          },
          metadata: {
            lastModified: new Date(),
            version: 1,
            environment: 'production',
          },
        },
        {
          category: 'mikrotik',
          key: 'default_packages',
          value: [
            {
              type: '1hour',
              duration: 60,
              price: 10,
              bandwidth: { upload: 512, download: 1024 },
            },
            {
              type: '3hours',
              duration: 180,
              price: 25,
              bandwidth: { upload: 512, download: 1024 },
            },
            {
              type: '5hours',
              duration: 300,
              price: 40,
              bandwidth: { upload: 512, download: 1024 },
            },
            {
              type: '12hours',
              duration: 720,
              price: 70,
              bandwidth: { upload: 512, download: 1024 },
            },
            {
              type: '1day',
              duration: 1440,
              price: 100,
              bandwidth: { upload: 512, download: 1024 },
            },
            {
              type: '3days',
              duration: 4320,
              price: 250,
              bandwidth: { upload: 512, download: 1024 },
            },
            {
              type: '1week',
              duration: 10080,
              price: 400,
              bandwidth: { upload: 512, download: 1024 },
            },
            {
              type: '1month',
              duration: 43200,
              price: 1200,
              bandwidth: { upload: 512, download: 1024 },
            },
          ],
          encrypted: false,
          description: 'Default voucher packages for Kenya market',
          validation: {
            type: 'array',
            required: true,
          },
          metadata: {
            lastModified: new Date(),
            version: 1,
            environment: 'production',
          },
        },
        {
          category: 'payment',
          key: 'mpesa_settings',
          value: {
            enabled: true,
            timeout: 45,
            retryAttempts: 3,
          },
          encrypted: false,
          description: 'M-Pesa payment gateway settings',
          validation: {
            type: 'object',
            required: true,
          },
          metadata: {
            lastModified: new Date(),
            version: 1,
            environment: 'production',
          },
        },
        {
          category: 'vpn',
          key: 'wireguard_server',
          value: {
            serverPublicKey: process.env.VPN_SERVER_PUBLIC_KEY || 'YOUR_SERVER_PUBLIC_KEY_HERE',
            endpoint: process.env.VPN_SERVER_ENDPOINT || 'vpn.yourdomain.com:51820',
            ipPool: {
              network: '10.99.0.0/16',
              serverIP: '10.99.0.1',
              clientRangeStart: '10.99.1.1',
              clientRangeEnd: '10.99.255.254'
            },
            settings: {
              persistentKeepalive: 25,
              allowedIPs: '10.99.0.0/16',
              mtu: 1420,
              listenPort: 51820
            }
          },
          encrypted: false,
          description: 'WireGuard VPN server configuration for router management',
          metadata: {
            lastModified: new Date(),
            modifiedBy: null,
            version: 1,
            environment: 'production'
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
      ]);

      console.log('  ✓ Commission rates');
      console.log('  ✓ Default voucher packages');
      console.log('  ✓ M-Pesa settings');
      console.log('  ✓ VPN server configuration');
    } else {
      console.log('  ⊙ System configuration already exists');
    }

    console.log('\n');

    // ==========================================
    // 6. VALIDATION RULES
    // ==========================================
    console.log('✔️  Setting up validation rules...\n');

    // Users collection validation
    await db.command({
      collMod: 'users',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['email'],
          properties: {
            email: {
              bsonType: 'string',
              pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
            },
            role: {
              enum: ['system_admin', 'homeowner', 'isp', 'end_user'],
            },
            status: {
              enum: ['active', 'suspended', 'pending'],
            },
          },
        },
      },
    });
    console.log('  ✓ Users validation');

    // Payments collection validation
    await db.command({
      collMod: 'payments',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['customerId', 'transaction', 'status'],
          properties: {
            'transaction.amount': {
              bsonType: 'number',
              minimum: 0,
            },
            'transaction.currency': {
              enum: ['KES', 'USD'],
            },
            status: {
              enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded'],
            },
          },
        },
      },
    });
    console.log('  ✓ Payments validation');

    // Update routers collection schema with VPN fields
    await db.command({
      collMod: 'routers',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['customerId', 'routerInfo', 'connection', 'configuration', 'health'],
          properties: {
            customerId: { bsonType: 'objectId' },
            routerInfo: { bsonType: 'object' },
            connection: {
              bsonType: 'object',
              properties: {
                localIP: { bsonType: 'string' },
                vpnIP: { bsonType: ['string', 'null'] },
                preferVPN: { bsonType: 'bool' },
                ipAddress: { bsonType: 'string' },
                port: { bsonType: 'int' },
                apiUser: { bsonType: 'string' },
                apiPassword: { bsonType: 'string' },
                restApiEnabled: { bsonType: 'bool' },
                sshEnabled: { bsonType: 'bool' }
              }
            },
            vpnTunnel: {
              bsonType: 'object',
              properties: {
                enabled: { bsonType: 'bool' },
                clientPublicKey: { bsonType: ['string', 'null'] },
                serverPublicKey: { bsonType: ['string', 'null'] },
                assignedVPNIP: { bsonType: ['string', 'null'] },
                status: { enum: ['connected', 'disconnected', 'setup', 'failed', 'pending'] },
                lastHandshake: { bsonType: ['date', 'null'] },
                provisionedAt: { bsonType: ['date', 'null'] },
                error: { bsonType: ['string', 'null'] },
                lastAttempt: { bsonType: ['date', 'null'] }
              }
            },
            configuration: { bsonType: 'object' },
            health: { bsonType: 'object' },
            statistics: { bsonType: 'object' },
            status: { bsonType: 'string' }
          }
        }
      }
    });
    console.log('  ✓ Routers validation (with VPN support)');

    console.log('\n✅ Database initialization completed successfully!\n');

    // ==========================================
    // 7. SHOW SUMMARY
    // ==========================================
    console.log('📊 Summary:');
    console.log(`  Database: ${MONGODB_DB_NAME}`);
    console.log(`  Core Collections: ${coreCollections.length}`);
    console.log(`  VPN Collections: 3 (vpn_tunnels, vpn_setup_tokens, vpn_ip_pool)`);
    console.log(`  Total Collections: ${coreCollections.length + 3}`);
    console.log(`  Indexes: Created with TTL where applicable`);
    console.log(`  Configuration: Default settings + VPN config inserted`);
    console.log(`  Ticket System: Full-text search enabled`);
    console.log(`  VPN Infrastructure: WireGuard ready`);

    console.log('\n� Pricing Configuration:');
    console.log('  Individuals/Homeowners: 20% commission per voucher sale');
    console.log('  ISPs (≤5 routers): KES 2,500/month subscription');
    console.log('  ISPs (unlimited): KES 3,900/month subscription');

    console.log('\n�📋 Next Steps:');
    console.log('  1. Update VPN_SERVER_PUBLIC_KEY in .env.local');
    console.log('  2. Update VPN_SERVER_ENDPOINT in .env.local');
    console.log('  3. Configure WireGuard on your VPN server');
    console.log('  4. Run `pnpm db:seed` to populate demo data');
    console.log('  5. Test router onboarding with VPN');
    console.log('  6. Monitor VPN tunnels in admin dashboard');

    console.log('\n🎉 Your MikroTik Billing database is fully initialized!\n');

    // ==========================================
    // 8. HELPER FUNCTIONS FOR LATER USE
    // ==========================================
    console.log('💡 Available helper functions in mongodb-helpers.ts:');
    console.log('  - TicketHelpers.getStatistics(customerId)');
    console.log('  - TicketHelpers.checkSLABreach(ticket)');
    console.log('  - TicketHelpers.getSLATimes(priority)');
    console.log('  - UserHelpers.findById(userId)');
    console.log('  - RouterHelpers.findByIdAndCustomer(routerId, customerId)');
    console.log('  - CustomerHelpers.findById(customerId)');

    console.log('\n🔍 VPN Management Functions:');
    console.log('  Run these in MongoDB shell for VPN monitoring:');
    console.log('  - db.vpn_tunnels.find({ "connection.status": "connected" }).count()');
    console.log('  - db.vpn_tunnels.find({ "connection.status": "failed" })');
    console.log('  - db.vpn_ip_pool.findOne() // Check IP pool usage');
    console.log('  - db.routers.find({ "vpnTunnel.enabled": true }).count()');

  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the initialization
initializeDatabase();