// scripts/init-database.ts
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'mikrotik_billing';

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in .env.local');
}

async function initializeDatabase() {
  console.log('🚀 Starting database initialization...\n');

  const client = new MongoClient(MONGODB_URI as string);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(MONGODB_DB_NAME);

    // ==========================================
    // 1. CREATE COLLECTIONS
    // ==========================================
    console.log('📦 Creating collections...');

    const collections = [
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

    for (const collectionName of collections) {
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
    // 2. CREATE INDEXES
    // ==========================================
    console.log('🔍 Creating indexes...\n');

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

    // Vouchers collection indexes
    console.log('\n  Vouchers indexes:');
    await db.collection('vouchers').createIndex(
      { 'voucherInfo.code': 1 },
      { unique: true }
    );
    console.log('    ✓ voucherInfo.code (unique)');
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

    // Tickets collection indexes
    console.log('\n  Tickets indexes:');
    await db.collection('tickets').createIndex({ customerId: 1 });
    console.log('    ✓ customerId');
    await db.collection('tickets').createIndex({ userId: 1 });
    console.log('    ✓ userId');
    await db.collection('tickets').createIndex({ 'assignment.assignedTo': 1 });
    console.log('    ✓ assignment.assignedTo');
    await db.collection('tickets').createIndex({ status: 1 });
    console.log('    ✓ status');
    await db.collection('tickets').createIndex({ 'ticket.priority': 1 });
    console.log('    ✓ ticket.priority');
    await db.collection('tickets').createIndex({ createdAt: -1 });
    console.log('    ✓ createdAt (desc)');

    // Audit logs collection indexes
    console.log('\n  Audit Logs indexes:');
    await db.collection('audit_logs').createIndex({ 'user.userId': 1 });
    console.log('    ✓ user.userId');
    await db.collection('audit_logs').createIndex({ 'action.type': 1 });
    console.log('    ✓ action.type');
    await db.collection('audit_logs').createIndex({ 'action.resource': 1 });
    console.log('    ✓ action.resource');
    await db.collection('audit_logs').createIndex({ timestamp: -1 });
    console.log('    ✓ timestamp (desc)');
    await db.collection('audit_logs').createIndex({ 'metadata.correlationId': 1 });
    console.log('    ✓ metadata.correlationId');
    await db.collection('audit_logs').createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: 63072000 } // 2 years
    );
    console.log('    ✓ timestamp (TTL - 2 years)');

    // Notifications collection indexes
    console.log('\n  Notifications indexes:');
    await db.collection('notifications').createIndex({ 'recipient.userId': 1 });
    console.log('    ✓ recipient.userId');
    await db.collection('notifications').createIndex({ 'recipient.customerId': 1 });
    console.log('    ✓ recipient.customerId');
    await db.collection('notifications').createIndex({ 'notification.type': 1 });
    console.log('    ✓ notification.type');
    await db.collection('notifications').createIndex({ status: 1 });
    console.log('    ✓ status');
    await db.collection('notifications').createIndex({ createdAt: -1 });
    console.log('    ✓ createdAt (desc)');

    // Router health collection indexes
    console.log('\n  Router Health indexes:');
    await db.collection('router_health').createIndex({ routerId: 1 });
    console.log('    ✓ routerId');
    await db.collection('router_health').createIndex({ timestamp: -1 });
    console.log('    ✓ timestamp (desc)');
    await db.collection('router_health').createIndex({ 'metrics.status': 1 });
    console.log('    ✓ metrics.status');
    await db.collection('router_health').createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: 7776000 } // 90 days
    );
    console.log('    ✓ timestamp (TTL - 90 days)');

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
    // 3. INSERT DEFAULT SYSTEM CONFIGURATION
    // ==========================================
    console.log('⚙️  Inserting default system configuration...\n');

    const configExists = await db.collection('system_config').countDocuments();
    
    if (configExists === 0) {
      await db.collection('system_config').insertMany([
        {
          category: 'general',
          key: 'commission_rates',
          value: {
            homeowner: 15.0,
            isp: 10.0,
            enterprise: 5.0,
          },
          encrypted: false,
          description: 'Default commission rates by customer type',
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
      ]);

      console.log('  ✓ Commission rates');
      console.log('  ✓ Default voucher packages');
      console.log('  ✓ M-Pesa settings');
    } else {
      console.log('  ⊙ System configuration already exists');
    }

    console.log('\n');

    // ==========================================
    // 4. VALIDATION RULES
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

    console.log('\n✅ Database initialization completed successfully!\n');

    // Show summary
    console.log('📊 Summary:');
    console.log(`  Database: ${MONGODB_DB_NAME}`);
    console.log(`  Collections: ${collections.length}`);
    console.log(`  Indexes: Created with TTL where applicable`);
    console.log(`  Configuration: Default settings inserted`);
    console.log('\n🎉 Your MikroTik Billing database is ready!\n');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the initialization
initializeDatabase();