// scripts/seed-database.ts
import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'mikrotik_billing';

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in .env.local');
}

async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n');

  const client = new MongoClient(MONGODB_URI as string);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(MONGODB_DB_NAME);

    // ==========================================
    // 1. SEED SYSTEM ADMIN USER
    // ==========================================
    console.log('👤 Creating system admin user...');

    const adminUserId = new ObjectId();
    const adminExists = await db
      .collection('users')
      .findOne({ email: 'admin@mikrotikbilling.com' });

    if (!adminExists) {
      await db.collection('users').insertOne({
        _id: adminUserId,
        name: 'System Administrator',
        email: 'admin@mikrotikbilling.com',
        emailVerified: new Date(),
        role: 'system_admin',
        status: 'active',
        permissions: ['*'], // All permissions
        smsCredits: {
          balance: 500, // System admin starts with 500 SMS credits
          totalPurchased: 500,
          totalUsed: 0,
          lastPurchaseDate: new Date(),
          lastPurchaseAmount: 500,
        },
        preferences: {
          language: 'en',
          notifications: {
            email: true,
            sms: false,
            push: true,
          },
          theme: 'system',
        },
        metadata: {
          loginCount: 0,
          lastLogin: null,
          ipAddress: null,
          userAgent: null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('  ✓ System admin user created');
      console.log('    Email: admin@mikrotikbilling.com');
    } else {
      console.log('  ⊙ System admin already exists');
    }

    // ==========================================
    // 2. SEED DEMO CUSTOMER (HOMEOWNER)
    // ==========================================
    console.log('\n👥 Creating demo homeowner...');

    const homeownerUserId = new ObjectId();

    const homeownerExists = await db
      .collection('users')
      .findOne({ email: 'homeowner@demo.com' });

    if (!homeownerExists) {
      // Create user with business info
      await db.collection('users').insertOne({
        _id: homeownerUserId,
        name: 'John Homeowner',
        email: 'homeowner@demo.com',
        emailVerified: new Date(),
        role: 'homeowner',
        status: 'active',
        businessInfo: {
          name: 'John Homeowner WiFi',
          type: 'homeowner',
          address: {
            street: '123 Nairobi Street',
            city: 'Nairobi',
            county: 'Nairobi',
            country: 'Kenya',
            postalCode: '00100',
          },
          contact: {
            phone: '+254712345678',
            email: 'homeowner@demo.com',
          },
        },
        paymentSettings: {
          preferredMethod: 'company_paybill',
          paybillNumber: null,
          accountNumber: null,
          commissionRate: 20.0,
          autoPayouts: true,
        },
        payoutSettings: {
          minAmount: 1000, // Minimum KES 1000 for payout
          autoPayouts: true,
          schedule: 'monthly', // monthly, weekly, manual
          bankAccount: {
            accountName: null,
            accountNumber: null,
            bankName: null,
            branchCode: null,
          },
          mpesaNumber: null,
        },
        subscription: {
          plan: 'individual',
          status: 'active',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          features: ['single_router', 'basic_analytics', 'email_support'],
        },
        statistics: {
          totalRouters: 0,
          activeUsers: 0,
          totalRevenue: 0,
          monthlyRevenue: 0,
        },
        smsCredits: {
          balance: 100, // Demo homeowner starts with 100 SMS credits
          totalPurchased: 100,
          totalUsed: 0,
          lastPurchaseDate: new Date(),
          lastPurchaseAmount: 100,
        },
        preferences: {
          language: 'en',
          notifications: {
            email: true,
            sms: true,
            push: true,
          },
          theme: 'light',
        },
        metadata: {
          loginCount: 0,
          lastLogin: null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log('  ✓ Demo homeowner created');
      console.log('    Email: homeowner@demo.com');
      console.log('    Login: Use email magic link or OAuth');
    } else {
      console.log('  ⊙ Demo homeowner already exists');
    }

    // ==========================================
    // 3. SEED DEMO ROUTER FOR HOMEOWNER
    // ==========================================
    console.log('\n🔌 Creating demo router...');

    const routerId = new ObjectId();
    const routerExists = await db
      .collection('routers')
      .findOne({ 'routerInfo.serialNumber': 'DEMO-ROUTER-001' });

    if (!routerExists) {
      await db.collection('routers').insertOne({
        _id: routerId,
        userId: homeownerUserId,
        routerInfo: {
          name: 'Main House WiFi',
          model: 'MikroTik hAP ac²',
          serialNumber: 'DEMO-ROUTER-001',
          macAddress: '00:11:22:33:44:55',
          firmwareVersion: '7.11',
          location: {
            name: 'Nairobi Home',
            coordinates: {
              latitude: -1.286389,
              longitude: 36.817223,
            },
            address: '123 Nairobi Street, Nairobi',
          },
        },
        connection: {
          ipAddress: '192.168.88.1',
          port: 8728,
          apiUser: 'admin',
          apiPassword: 'encrypted_password_here',
          restApiEnabled: true,
          sshEnabled: true,
        },
        configuration: {
          hotspot: {
            enabled: true,
            configured: true,
            ssid: 'HomeWiFi-Guest',
            password: 'guestpass123',
            interface: 'wlan1',
            ipPool: '10.5.50.0/24',
            dnsServers: ['8.8.8.8', '8.8.4.4'],
            maxUsers: 50,
            ipPoolUsage: {
              total: 254,
              used: 5,
              available: 249,
              percentage: 2,
              lastSynced: new Date(),
            },
            serverStatus: {
              isRunning: true,
              disabled: false,
              keepaliveTimeout: '5m',
              idleTimeout: '5m',
              lastSynced: new Date(),
              mikrotikId: '*DEMO1',
            },
          },
          pppoe: {
            enabled: false,
            configured: false,
            interface: 'ether1',
            ipPool: '10.10.10.0/24',
            dnsServers: ['8.8.8.8'],
            defaultProfile: 'default',
          },
          network: {
            lanInterface: 'bridge',
            wanInterface: 'ether1',
            lanSubnet: '192.168.88.0/24',
            dhcpRange: '192.168.88.10-192.168.88.254',
            bridgePorts: [
              {
                interface: 'ether2',
                bridge: 'bridge',
                mikrotikId: '*DEMO2',
              },
              {
                interface: 'ether3',
                bridge: 'bridge',
                mikrotikId: '*DEMO3',
              },
              {
                interface: 'ether4',
                bridge: 'bridge',
                mikrotikId: '*DEMO4',
              },
            ],
            wanStatus: {
              isConnected: true,
              externalIP: '197.232.10.50',
              gateway: '197.232.10.1',
              dnsServers: ['8.8.8.8', '8.8.4.4'],
              lastConnected: new Date(),
              mikrotikId: '*DEMO5',
            },
          },
          deployedConfigs: [],
        },
        health: {
          status: 'online',
          lastSeen: new Date(),
          uptime: 86400,
          cpuUsage: 15,
          memoryUsage: 45,
          diskUsage: 30,
          temperature: 45,
          connectedUsers: 5,
          internetConnectivity: {
            isConnected: true,
            lastChecked: new Date(),
          },
        },
        statistics: {
          totalDataUsage: 50000000000, // 50GB
          monthlyDataUsage: 10000000000, // 10GB
          totalUsers: 25,
          activeUsers: 5,
          revenue: {
            total: 5000,
            monthly: 1200,
            daily: 50,
          },
        },
        // Packages with disabled field
        packages: {
          hotspot: [
            {
              name: '1hour',
              displayName: '1 Hour Package',
              description: 'Perfect for quick browsing',
              price: 10,
              duration: 60,
              dataLimit: 0,
              bandwidth: {
                upload: 512,
                download: 1024,
              },
              validity: 1,
              enabled: true,
              disabled: false,
              syncStatus: 'synced',
              activeUsers: 2,
              stats: {
                count: 15,
                revenue: 150,
                lastPurchased: new Date(Date.now() - 2 * 60 * 60 * 1000),
              },
              createdAt: new Date(),
              updatedAt: new Date(),
              lastSyncedAt: new Date(),
            },
            {
              name: '3hours',
              displayName: '3 Hours Package',
              description: 'Great for work or streaming',
              price: 25,
              duration: 180,
              dataLimit: 0,
              bandwidth: {
                upload: 512,
                download: 2048,
              },
              validity: 1,
              enabled: true,
              disabled: false,
              syncStatus: 'synced',
              activeUsers: 2,
              stats: {
                count: 8,
                revenue: 200,
                lastPurchased: new Date(Date.now() - 5 * 60 * 60 * 1000),
              },
              createdAt: new Date(),
              updatedAt: new Date(),
              lastSyncedAt: new Date(),
            },
            {
              name: '1day',
              displayName: '1 Day Package',
              description: 'All-day unlimited browsing',
              price: 100,
              duration: 1440,
              dataLimit: 0,
              bandwidth: {
                upload: 1024,
                download: 5120,
              },
              validity: 7,
              enabled: true,
              disabled: false,
              syncStatus: 'synced',
              activeUsers: 1,
              stats: {
                count: 5,
                revenue: 500,
                lastPurchased: new Date(Date.now() - 12 * 60 * 60 * 1000),
              },
              createdAt: new Date(),
              updatedAt: new Date(),
              lastSyncedAt: new Date(),
            },
          ],
          pppoe: [],
        },
        // Network interfaces
        networkInterfaces: [
          {
            name: 'ether1',
            type: 'ethernet',
            running: true,
            disabled: false,
            macAddress: '00:11:22:33:44:55',
            mikrotikId: '*DEMO_ETH1',
          },
          {
            name: 'ether2',
            type: 'ethernet',
            running: true,
            disabled: false,
            macAddress: '00:11:22:33:44:56',
            mikrotikId: '*DEMO_ETH2',
          },
          {
            name: 'wlan1',
            type: 'wireless',
            running: true,
            disabled: false,
            macAddress: '00:11:22:33:44:57',
            mikrotikId: '*DEMO_WLAN1',
          },
          {
            name: 'bridge',
            type: 'bridge',
            running: true,
            disabled: false,
            macAddress: '00:11:22:33:44:58',
            mikrotikId: '*DEMO_BRIDGE',
          },
        ],
        // DHCP Status
        dhcpStatus: {
          hotspot: {
            serverName: 'dhcp-hotspot',
            isActive: true,
            totalLeases: 50,
            activeLeases: 5,
            lastSynced: new Date(),
            mikrotikId: '*DEMO_DHCP_HS',
          },
          lan: {
            serverName: 'dhcp-lan',
            isActive: true,
            totalLeases: 254,
            activeLeases: 12,
            lastSynced: new Date(),
            mikrotikId: '*DEMO_DHCP_LAN',
          },
        },
        configurationStatus: {
          configured: true,
          configuredAt: new Date(),
          completedSteps: [
            'Basic network configuration',
            'Hotspot server setup',
            'DHCP configuration',
            'Package profiles created',
            'DNS servers configured',
          ],
          failedSteps: [],
          lastChecked: new Date(),
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log('  ✓ Demo router created');
      console.log('    Name: Main House WiFi');
      console.log('    Serial: DEMO-ROUTER-001');
      console.log('    Packages: 3 hotspot packages');
      console.log('    Network: 4 interfaces configured');
    } else {
      console.log('  ⊙ Demo router already exists');
    }

    // ==========================================
    // 3B. SEED DEMO ISP CUSTOMER
    // ==========================================
    console.log('\n🏢 Creating demo ISP customer...');

    const ispUserId = new ObjectId();

    const ispExists = await db
      .collection('users')
      .findOne({ email: 'isp@demo.com' });

    if (!ispExists) {
      // Create ISP user with business info
      await db.collection('users').insertOne({
        _id: ispUserId,
        name: 'Demo ISP Networks',
        email: 'isp@demo.com',
        emailVerified: new Date(),
        role: 'isp',
        status: 'active',
        businessInfo: {
          name: 'Demo ISP Networks Ltd',
          type: 'isp',
          address: {
            street: '456 Tech Park Avenue',
            city: 'Nairobi',
            county: 'Nairobi',
            country: 'Kenya',
            postalCode: '00200',
          },
          contact: {
            phone: '+254722334455',
            email: 'isp@demo.com',
          },
        },
        paymentSettings: {
          preferredMethod: 'bank_transfer',
          paybillNumber: null,
          accountNumber: null,
          commissionRate: 0,  // ISPs pay 0% commission
          autoPayouts: false,
        },
        payoutSettings: {
          minAmount: 5000, // Higher minimum for ISP
          autoPayouts: false, // Manual payouts for ISP
          schedule: 'manual',
          bankAccount: {
            accountName: 'Demo ISP Networks Ltd',
            accountNumber: '1234567890',
            bankName: 'Kenya Commercial Bank',
            branchCode: '001',
          },
          mpesaNumber: '+254722334455',
        },
        subscription: {
          plan: 'isp',  // Up to 5 routers
          status: 'active',
          monthlyFee: 2500,  // KES 2,500/month
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          features: ['up_to_5_routers', 'advanced_analytics', 'priority_support', 'custom_branding'],
          maxRouters: 5,
        },
        statistics: {
          totalRouters: 0,
          activeUsers: 0,
          totalRevenue: 0,
          monthlyRevenue: 0,
        },
        smsCredits: {
          balance: 250, // ISP starts with 250 SMS credits
          totalPurchased: 250,
          totalUsed: 0,
          lastPurchaseDate: new Date(),
          lastPurchaseAmount: 250,
        },
        preferences: {
          language: 'en',
          notifications: {
            email: true,
            sms: true,
            push: true,
          },
          theme: 'system',
        },
        metadata: {
          loginCount: 0,
          lastLogin: null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log('  ✓ Demo ISP customer created');
      console.log('    Email: isp@demo.com');
      console.log('    Plan: ISP (up to 5 routers) - KES 2,500/month');
      console.log('    Commission: 0% (pays subscription fee)');
    } else {
      console.log('  ⊙ Demo ISP already exists');
    }

    // ==========================================
    // 4. SEED DEMO VOUCHERS
    // ==========================================
    console.log('\n🎫 Creating demo vouchers...');

    const vouchersExist = await db
      .collection('vouchers')
      .countDocuments({ routerId });

    if (vouchersExist === 0) {
      const vouchers = [];
      const packages = [
        { type: '1hour', duration: 60, price: 10 },
        { type: '3hours', duration: 180, price: 25 },
        { type: '1day', duration: 1440, price: 100 },
      ];

      for (let i = 0; i < 10; i++) {
        const pkg = packages[i % packages.length];
        if (pkg) {
          vouchers.push({
            _id: new ObjectId(),
            routerId,
            userId: homeownerUserId,  // Router owner
            customerId: null,  // WiFi customer (null = not purchased yet)
            reference: `VCH${Date.now()}${i}`,  // Unique payment reference
            voucherInfo: {
              code: `DEMO${String(i + 1).padStart(4, '0')}`,
              password: `DEMO${String(i + 1).padStart(4, '0')}`,
              packageType: pkg.type,
              duration: pkg.duration,
              dataLimit: 0,
              bandwidth: {
                upload: 512,
                download: 1024,
              },
              price: pkg.price,
              currency: 'KES',
            },
            usage: {
              used: i < 3, // First 3 are used
              customerId: i < 3 ? `user${i + 1}` : null,
              deviceMac: i < 3 ? `AA:BB:CC:DD:EE:0${i}` : null,
              startTime: i < 3 ? new Date(Date.now() - 24 * 60 * 60 * 1000) : null,
              endTime: i < 3 ? new Date() : null,
              dataUsed: i < 3 ? 500000000 : 0,
              timeUsed: i < 3 ? pkg.duration : 0,
            },
            payment: {
              method: 'mpesa',
              transactionId: null,
              phoneNumber: null,
              amount: pkg.price,
              commission: pkg.price * 0.20,  // 20% commission for homeowners
              paymentDate: null,
            },
            batch: {
              batchId: 'BATCH001',
              batchSize: 10,
              generatedBy: homeownerUserId,
            },
            expiry: {
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
              autoDelete: true,
            },
            status: i < 3 ? 'used' : 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      await db.collection('vouchers').insertMany(vouchers);
      console.log(`  ✓ Created ${vouchers.length} demo vouchers`);
      console.log('    3 used, 7 active');
    } else {
      console.log('  ⊙ Demo vouchers already exist');
    }

    // ==========================================
    // 5. SEED DEMO PAYMENTS
    // ==========================================
    console.log('\n💰 Creating demo payments...');

    const paymentsExist = await db
      .collection('payments')
      .countDocuments({ userId: homeownerUserId });

    if (paymentsExist === 0) {
      const payments = [];

      for (let i = 0; i < 5; i++) {
        payments.push({
          _id: new ObjectId(),
          userId: homeownerUserId,
          transaction: {
            type: 'voucher_purchase',
            amount: 100,
            currency: 'KES',
            description: `Voucher purchase - 1 day package`,
            reference: `TXN${Date.now() + i}`,
          },
          mpesa: {
            transactionId: `MPESA${Date.now() + i}`,
            phoneNumber: '+254712345678',
            accountReference: 'VOUCHER',
            transactionDesc: 'Voucher Purchase',
            merchantRequestId: `MR${Date.now() + i}`,
            checkoutRequestId: `CR${Date.now() + i}`,
            resultCode: 0,
            resultDesc: 'Success',
          },
          paybill: {
            paybillNumber: '123456',
            accountNumber: 'DEMO001',
            type: 'company',
          },
          reconciliation: {
            isReconciled: true,
            reconciledAt: new Date(),
            reconciledBy: adminUserId,
            matchedTransactionId: `MPESA${Date.now() + i}`,
            discrepancy: 0,
          },
          commission: {
            rate: 15,
            amount: 15,
            status: 'pending',
            paidAt: null,
          },
          linkedItems: [
            {
              type: 'voucher',
              itemId: new ObjectId(),
              quantity: 1,
            },
          ],
          status: 'completed',
          createdAt: new Date(Date.now() - (5 - i) * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        });
      }

      await db.collection('payments').insertMany(payments);
      console.log(`  ✓ Created ${payments.length} demo payments`);
      console.log('    Total: KES 500');
    } else {
      console.log('  ⊙ Demo payments already exist');
    }

    // ==========================================
    // 6. SEED COMPANY PAYBILL
    // ==========================================
    console.log('\n📱 Creating company paybill...');

    const paybillExists = await db
      .collection('paybills')
      .findOne({ 'paybillInfo.type': 'company' });

    if (!paybillExists) {
      await db.collection('paybills').insertOne({
        _id: new ObjectId(),
        userId: null, // Company paybill (not associated with a router owner)
        paybillInfo: {
          number: '123456',
          name: 'MikroTik Billing Company Paybill',
          type: 'paybill', // 'paybill' or 'till'
          provider: 'safaricom',
        },
        credentials: {
          consumerKey: 'your_consumer_key_here',
          consumerSecret: 'your_consumer_secret_here',
          passKey: 'your_passkey_here',
          accessToken: null,
          tokenExpiresAt: null,
          lastTokenRefresh: null,
        },
        config: {
          environment: 'sandbox', // 'sandbox' or 'production'
          webhookUrl: 'https://yourdomain.com/api/webhooks/mpesa/callback',
          confirmationUrl: 'https://yourdomain.com/api/webhooks/mpesa',
        },
        statistics: {
          totalTransactions: 5,
          totalAmount: 500,
          successRate: 100,
          lastTransaction: new Date(),
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log('  ✓ Company paybill created');
      console.log('    Number: 123456');
      console.log('    Type: paybill');
    } else {
      console.log('  ⊙ Company paybill already exists');
    }

    // ==========================================
    // 7. SEED DEMO WIFI CUSTOMERS (Voucher Purchasers)
    // ==========================================
    console.log('\n📱 Creating demo WiFi customers...');

    const wifiCustomers = [
      {
        phone: '254707861420',
        name: 'Kevin Mulug',
        email: 'kevin@example.com',
      },
      {
        phone: '254702209337',
        name: 'King Malik',
        email: 'malik@example.com',
      },
      {
        phone: '254757096651',
        name: 'Bobo B',
        email: null,  // Some customers may not provide email
      },
    ];

    let customersCreated = 0;
    for (const customer of wifiCustomers) {
      const exists = await db
        .collection('customers')
        .findOne({ phone: customer.phone });

      if (!exists) {
        // Calculate SHA-256 hash for phone number (for M-Pesa webhook matching)
        const crypto = await import('crypto');
        const sha256Phone = crypto
          .createHash('sha256')
          .update(customer.phone)
          .digest('hex');

        await db.collection('customers').insertOne({
          _id: new ObjectId(),
          routerId: routerId, // Associate with the demo router
          phone: customer.phone,
          sha256Phone,
          name: customer.name,
          email: customer.email,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastPurchaseDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        });
        customersCreated++;
      }
    }

    if (customersCreated > 0) {
      console.log(`  ✓ Created ${customersCreated} WiFi customers`);
      console.log('    (These are people who purchased vouchers)');
    } else {
      console.log('  ⊙ WiFi customers already exist');
    }

    console.log('\n✅ Database seeding completed successfully!\n');

    // Show summary
    console.log('📊 Seeded Data Summary:');
    console.log('  👤 Users: 3 (1 admin, 1 homeowner, 1 ISP)');
    console.log('  📱 WiFi Customers: 3 (voucher purchasers)');
    console.log('  🔌 Routers: 1 demo router');
    console.log('  🎫 Vouchers: 10 (3 used, 7 active)');
    console.log('  💰 Payments: 5 completed transactions');
    console.log('  📱 Paybills: 1 company paybill');
    console.log('\n💡 Pricing Model:');
    console.log('  Homeowners: 20% commission per voucher sale');
    console.log('  ISPs: KES 2,500/month (≤5 routers) or KES 3,900/month (unlimited)');
    console.log('\n🎉 Demo data ready for testing!\n');

    console.log('🔑 Demo Login Credentials:');
    console.log('  Admin: admin@mikrotikbilling.com');
    console.log('  Homeowner: homeowner@demo.com (20% commission per sale)');
    console.log('  ISP: isp@demo.com (KES 2,500/month subscription)');
    console.log('  (Use email magic link or OAuth to login)\n');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the seeding
seedDatabase();