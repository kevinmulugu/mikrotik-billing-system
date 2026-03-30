// scripts/seed-database.ts
import { MongoClient, ObjectId, Int32, Long } from 'mongodb';
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
        phone: '+254700000001', // OTP auth phone (E.164 format)
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
        phone: '+254712345678', // OTP auth phone (E.164 format)
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
        phone: '+254722334455', // OTP auth phone (E.164 format)
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

    // Resolve actual ISP user ID (handles re-runs where user already exists)
    const actualIspUser = await db.collection('users').findOne({ email: 'isp@demo.com' });
    const actualIspUserId = actualIspUser?._id ?? ispUserId;

    // ==========================================
    // 3C. SEED ISP DEMO ROUTERS (2 routers)
    // ==========================================
    console.log('\n🔌 Creating ISP demo routers...');

    const ispRouter1Id = new ObjectId();
    const ispRouter2Id = new ObjectId();

    const ispRouter1Exists = await db
      .collection('routers')
      .findOne({ 'routerInfo.serialNumber': 'DEMO-ISP-001' });

    const ispRouter2Exists = await db
      .collection('routers')
      .findOne({ 'routerInfo.serialNumber': 'DEMO-ISP-002' });

    if (!ispRouter1Exists) {
      // ISP Router 1 — MikroTik with VPN tunnel connected
      await db.collection('routers').insertOne({
        _id: ispRouter1Id,
        userId: actualIspUserId,
        routerType: 'mikrotik',
        routerInfo: {
          name: 'CBD Hotspot Hub',
          model: 'MikroTik hAP ax²',
          serialNumber: 'DEMO-ISP-001',
          macAddress: '00:AA:BB:CC:DD:01',
          firmwareVersion: '7.14',
          location: {
            name: 'CBD Main Branch',
            coordinates: { latitude: -1.283, longitude: 36.819 },
            address: '456 Moi Avenue, Nairobi CBD',
          },
        },
        connection: {
          localIP: '192.168.1.1',
          vpnIP: '10.99.0.2',
          preferVPN: true,
          ipAddress: '10.99.0.2',
          port: 8728,
          apiUser: 'admin',
          apiPassword: 'demo_encrypted_password_isp1',
          restApiEnabled: true,
          sshEnabled: false,
        },
        vpnTunnel: {
          enabled: true,
          clientPublicKey: 'ISP1DemoPublicKeyBase64Placeholder0000001==',
          serverPublicKey: process.env.VPN_SERVER_PUBLIC_KEY || 'ServerPublicKeyPlaceholderBase64001==',
          assignedVPNIP: '10.99.0.2',
          status: 'connected',
          lastHandshake: new Date(Date.now() - 4 * 60 * 1000),
          provisionedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
          error: null,
          lastAttempt: null,
        },
        services: { hotspot: { enabled: true, packages: [], lastSynced: null } },
        capabilities: {
          supportsVPN: true,
          supportedServices: ['hotspot'],
          captivePortalMethod: 'http_upload',
          voucherFormat: 'username_password',
        },
        vendorConfig: {
          mikrotik: { firmwareVersion: '7.14', identity: 'CBD-Hub', architecture: 'arm64' },
        },
        configuration: {
          hotspot: {
            enabled: true, ssid: 'ISP-CBD-WiFi', password: 'hotspotisp1',
            interface: 'wlan1', ipPool: '10.5.51.0/24', dnsServers: ['8.8.8.8', '8.8.4.4'], maxUsers: 100,
          },
          pppoe: { enabled: false, interface: 'ether1', ipPool: '', dnsServers: [], defaultProfile: 'default' },
          network: { lanInterface: 'bridge', wanInterface: 'ether1', lanSubnet: '192.168.1.0/24', dhcpRange: '192.168.1.10-192.168.1.254' },
        },
        health: {
          status: 'online', lastSeen: new Date(), uptime: 432000,
          cpuUsage: 22, memoryUsage: 55, diskUsage: 18, temperature: 48, connectedUsers: 12,
        },
        statistics: {
          totalDataUsage: 200000000000, monthlyDataUsage: 40000000000,
          totalUsers: 120, activeUsers: 12,
          revenue: { total: 18000, monthly: 4500, daily: 180 },
        },
        configurationStatus: {
          configured: true, configuredAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
          completedSteps: ['Basic network configuration', 'Hotspot server setup', 'VPN tunnel established'],
          failedSteps: [],
        },
        status: 'active',
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      });
      console.log('  ✓ ISP Router 1 created: CBD Hotspot Hub (with VPN)');
    } else {
      console.log('  ⊙ ISP Router 1 already exists');
    }

    if (!ispRouter2Exists) {
      // ISP Router 2 — MikroTik, VPN pending setup
      await db.collection('routers').insertOne({
        _id: ispRouter2Id,
        userId: actualIspUserId,
        routerType: 'mikrotik',
        routerInfo: {
          name: 'Westlands Branch',
          model: 'MikroTik RB4011iGS+RM',
          serialNumber: 'DEMO-ISP-002',
          macAddress: '00:AA:BB:CC:DD:02',
          firmwareVersion: '7.12',
          location: {
            name: 'Westlands Office',
            coordinates: { latitude: -1.265, longitude: 36.806 },
            address: '78 Westlands Road, Nairobi',
          },
        },
        connection: {
          localIP: '192.168.2.1',
          vpnIP: null,
          preferVPN: false,
          ipAddress: '192.168.2.1',
          port: 8728,
          apiUser: 'admin',
          apiPassword: 'demo_encrypted_password_isp2',
          restApiEnabled: true,
          sshEnabled: false,
        },
        vpnTunnel: {
          enabled: false,
          clientPublicKey: null,
          serverPublicKey: null,
          assignedVPNIP: null,
          status: 'pending',
          lastHandshake: null,
          provisionedAt: null,
          error: 'VPN configuration pending',
          lastAttempt: null,
        },
        services: { hotspot: { enabled: true, packages: [], lastSynced: null } },
        capabilities: {
          supportsVPN: true,
          supportedServices: ['hotspot'],
          captivePortalMethod: 'http_upload',
          voucherFormat: 'username_password',
        },
        vendorConfig: {
          mikrotik: { firmwareVersion: '7.12', identity: 'Westlands', architecture: 'x86' },
        },
        configuration: {
          hotspot: {
            enabled: true, ssid: 'ISP-Westlands-WiFi', password: 'hotspotisp2',
            interface: 'wlan1', ipPool: '10.5.52.0/24', dnsServers: ['8.8.8.8', '8.8.4.4'], maxUsers: 80,
          },
          pppoe: { enabled: false, interface: 'ether1', ipPool: '', dnsServers: [], defaultProfile: 'default' },
          network: { lanInterface: 'bridge', wanInterface: 'ether1', lanSubnet: '192.168.2.0/24', dhcpRange: '192.168.2.10-192.168.2.254' },
        },
        health: {
          status: 'online', lastSeen: new Date(), uptime: 172800,
          cpuUsage: 18, memoryUsage: 42, diskUsage: 15, temperature: 44, connectedUsers: 7,
        },
        statistics: {
          totalDataUsage: 80000000000, monthlyDataUsage: 18000000000,
          totalUsers: 60, activeUsers: 7,
          revenue: { total: 8500, monthly: 2200, daily: 80 },
        },
        configurationStatus: {
          configured: true, configuredAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
          completedSteps: ['Basic network configuration', 'Hotspot server setup'],
          failedSteps: [],
          warnings: ['VPN not yet configured — router accessible only on local network'],
        },
        status: 'active',
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      });
      console.log('  ✓ ISP Router 2 created: Westlands Branch (VPN pending)');
    } else {
      console.log('  ⊙ ISP Router 2 already exists');
    }

    // Update ISP user statistics
    await db.collection('users').updateOne(
      { _id: actualIspUserId },
      { $set: { 'statistics.totalRouters': 2, updatedAt: new Date() } }
    );

    // ==========================================
    // 3D. SEED VPN TUNNEL FOR ISP ROUTER 1
    // ==========================================
    console.log('\n🔐 Creating VPN tunnel for ISP Router 1...');

    const resolvedIspRouter1Id = ispRouter1Exists
      ? (await db.collection('routers').findOne({ 'routerInfo.serialNumber': 'DEMO-ISP-001' }))?._id
      : ispRouter1Id;

    const vpnTunnelExists = resolvedIspRouter1Id
      ? await db.collection('vpn_tunnels').findOne({ routerId: resolvedIspRouter1Id })
      : null;

    if (!vpnTunnelExists && resolvedIspRouter1Id) {
      // Generate demo WireGuard-like keys (random bytes base64)
      const crypto = await import('crypto');
      const demoPrivKey = crypto.randomBytes(32).toString('base64');

      // Encrypt using same algorithm as VPNProvisioner.encryptPrivateKey
      const encKey = crypto.scryptSync(
        process.env.NEXTAUTH_SECRET || 'default-secret',
        'salt',
        32
      );
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', encKey, iv);
      let encrypted = cipher.update(demoPrivKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const encryptedPrivKey = `${iv.toString('hex')}:${encrypted}`;

      await db.collection('vpn_tunnels').insertOne({
        routerId: resolvedIspRouter1Id,
        userId: actualIspUserId,
        vpnConfig: {
          clientPrivateKey: encryptedPrivKey,
          clientPublicKey: 'ISP1DemoPublicKeyBase64Placeholder0000001==',
          serverPublicKey: process.env.VPN_SERVER_PUBLIC_KEY || 'ServerPublicKeyPlaceholderBase64001==',
          assignedIP: '10.99.0.2',
          endpoint: process.env.VPN_SERVER_ENDPOINT || 'vpn.example.com:51820',
          allowedIPs: process.env.VPN_NETWORK || '10.99.0.0/16',
          persistentKeepalive: new Int32(25),
        },
        connection: {
          status: 'connected',
          lastHandshake: new Date(Date.now() - 4 * 60 * 1000),
          bytesReceived: new Long(0),
          bytesSent: new Long(0),
          lastSeen: new Date(),
        },
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      });
      console.log('  ✓ VPN tunnel record created for ISP Router 1');
    } else {
      console.log('  ⊙ VPN tunnel already exists or router not found');
    }

    // ==========================================
    // 3E. SEED ISP WIFI CUSTOMERS
    // ==========================================
    console.log('\n📱 Creating ISP demo customers...');

    const ispCustomers = [
      { phone: '254701112233', firstName: 'Alice', lastName: 'Wanjiku', name: 'Alice Wanjiku', email: 'alice@example.com' },
      { phone: '254703334455', firstName: 'Brian', lastName: 'Otieno', name: 'Brian Otieno', email: null },
      { phone: '254705556677', firstName: 'Carol', lastName: 'Mwangi', name: 'Carol Mwangi', email: 'carol@example.com' },
      { phone: '254707778899', firstName: 'David', lastName: 'Kamau', name: 'David Kamau', email: null },
    ];

    const resolvedIspRouter1Id2 = resolvedIspRouter1Id ?? ispRouter1Id;
    let ispCustomersCreated = 0;

    for (const customer of ispCustomers) {
      const exists = await db.collection('customers').findOne({ phone: customer.phone });
      if (!exists) {
        const crypto2 = await import('crypto');
        const sha256Phone = crypto2.createHash('sha256').update(customer.phone).digest('hex');
        await db.collection('customers').insertOne({
          _id: new ObjectId(),
          routerId: resolvedIspRouter1Id2,
          phone: customer.phone,
          sha256Phone,
          name: customer.name,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
          lastPurchaseDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          totalPurchases: 5 + Math.floor(Math.random() * 15),
          totalSpent: 200 + Math.floor(Math.random() * 800),
        });
        ispCustomersCreated++;
      }
    }

    if (ispCustomersCreated > 0) {
      console.log(`  ✓ Created ${ispCustomersCreated} ISP WiFi customers`);
    } else {
      console.log('  ⊙ ISP customers already exist');
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
      // Package options matching the demo router
      const packageOptions = [
        { type: '1hour', amount: 10, description: 'Voucher purchase - 1 Hour Package' },
        { type: '3hours', amount: 25, description: 'Voucher purchase - 3 Hours Package' },
        { type: '1day', amount: 100, description: 'Voucher purchase - 1 Day Package' },
      ];

      // Demo customer phones — must match wifiCustomers names below
      const customerPhones = ['254707861420', '254702209337', '254757096651', '254711223344', '254720998877'];

      // Name map: phone → M-Pesa customer name (matches wifiCustomers section)
      const phoneNameMap: Record<string, string> = {
        '254707861420': 'Kevin Mulugi',
        '254702209337': 'James Kariuki',
        '254757096651': 'Grace Wambui',
        '254711223344': 'Peter Ochieng',
        '254720998877': 'Faith Njeri',
      };

      // Generate M-Pesa-style receipt number
      const mpesaReceipt = (idx: number) => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
        return 'Q' + Array.from({ length: 9 }, (_, i) => chars[(idx * 7 + i * 13) % chars.length]).join('');
      };

      const payments = [];
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      // Completed payments spread over 60 days (25 total)
      const completedDaysAgo = [60, 58, 55, 52, 50, 47, 45, 42, 40, 37, 35, 32, 28, 25, 21, 18, 15, 12, 9, 7, 5, 3, 2, 1, 0];
      for (let i = 0; i < completedDaysAgo.length; i++) {
        const pkg = packageOptions[i % packageOptions.length]!;
        const phone = customerPhones[i % customerPhones.length]!;
        const createdAt = new Date(now - completedDaysAgo[i]! * day - Math.floor(Math.random() * 8) * 60 * 60 * 1000);
        payments.push({
          _id: new ObjectId(),
          userId: homeownerUserId,
          routerId,
          mpesa: {
            checkoutRequestId: `ws_CO_${String(i).padStart(12, '0')}`,
            merchantRequestId: `${String(i * 3).padStart(6, '0')}-${String(i * 7).padStart(6, '0')}`,
            transactionId: mpesaReceipt(i),
            phoneNumber: phone,
            customerName: phoneNameMap[phone] ?? null,
            resultCode: 0,
            resultDesc: 'The service request is processed successfully.',
          },
          transaction: {
            amount: pkg.amount,
            type: 'voucher_purchase',
            description: pkg.description,
          },
          status: 'completed',
          reconciliation: {
            isReconciled: true,
            reconciledAt: createdAt,
            matchedTransactionId: mpesaReceipt(i),
          },
          linkedItems: [{ type: 'voucher', itemId: new ObjectId(), quantity: 1 }],
          metadata: {},
          createdAt,
          updatedAt: createdAt,
        });
      }

      // Failed payments (4)
      for (let i = 0; i < 4; i++) {
        const pkg = packageOptions[i % packageOptions.length]!;
        const phone = customerPhones[i % customerPhones.length]!;
        const createdAt = new Date(now - [30, 20, 10, 4][i]! * day);
        payments.push({
          _id: new ObjectId(),
          userId: homeownerUserId,
          routerId,
          mpesa: {
            checkoutRequestId: `ws_CO_FAIL_${String(i).padStart(8, '0')}`,
            merchantRequestId: `FAIL${String(i).padStart(6, '0')}-000000`,
            transactionId: null,
            phoneNumber: phone,
            customerName: phoneNameMap[phone] ?? null,
            resultCode: 1032,
            resultDesc: 'Request cancelled by user',
          },
          transaction: {
            amount: pkg.amount,
            type: 'voucher_purchase',
            description: pkg.description,
          },
          status: 'failed',
          reconciliation: { isReconciled: false, reconciledAt: null, matchedTransactionId: null },
          linkedItems: [],
          metadata: {},
          createdAt,
          updatedAt: createdAt,
        });
      }

      // Pending payment (1)
      payments.push({
        _id: new ObjectId(),
        userId: homeownerUserId,
        routerId,
        mpesa: {
          checkoutRequestId: `ws_CO_PEND_00000001`,
          merchantRequestId: `PEND01-000000`,
          transactionId: null,
          phoneNumber: customerPhones[0]!,
          resultCode: null,
          resultDesc: null,
        },
        transaction: {
          amount: 25,
          type: 'voucher_purchase',
          description: 'Voucher purchase - 3 Hours Package',
        },
        status: 'pending',
        reconciliation: { isReconciled: false, reconciledAt: null, matchedTransactionId: null },
        linkedItems: [],
        metadata: {},
        createdAt: new Date(now - 2 * 60 * 60 * 1000),
        updatedAt: new Date(now - 2 * 60 * 60 * 1000),
      });

      await db.collection('payments').insertMany(payments);
      const totalRevenue = completedDaysAgo.reduce((sum, _, i) => sum + (packageOptions[i % packageOptions.length]?.amount ?? 0), 0);
      console.log(`  ✓ Created ${payments.length} demo payments (25 completed, 4 failed, 1 pending)`);
      console.log(`    Total completed revenue: KES ${totalRevenue}`);
    } else {
      console.log('  ⊙ Demo payments already exist');
    }

    // ==========================================
    // 5B. SEED ISP PAYMENTS
    // ==========================================
    console.log('\n💰 Creating ISP demo payments...');

    const ispPaymentsExist = await db
      .collection('payments')
      .countDocuments({ userId: actualIspUserId });

    if (ispPaymentsExist === 0) {
      const ispPackages = [
        { type: '2hours', amount: 20, description: 'Voucher purchase - 2 Hours Package' },
        { type: '6hours', amount: 50, description: 'Voucher purchase - 6 Hours Package' },
        { type: '1day', amount: 150, description: 'Voucher purchase - 1 Day Package' },
        { type: '1week', amount: 500, description: 'Voucher purchase - 1 Week Package' },
      ];
      const ispPhones = ['254701112233', '254703334455', '254705556677', '254707778899'];
      const ispPhoneNameMap: Record<string, string> = {
        '254701112233': 'Alice Wanjiku',
        '254703334455': 'Brian Otieno',
        '254705556677': 'Carol Mwangi',
        '254707778899': 'David Kamau',
      };
      const ispMpesaReceipt = (idx: number) => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
        return 'R' + Array.from({ length: 9 }, (_, i) => chars[(idx * 11 + i * 17) % chars.length]).join('');
      };

      const ispPayments = [];
      const now2 = Date.now();
      const day2 = 24 * 60 * 60 * 1000;
      const completedDaysAgoIsp = [42, 39, 36, 33, 30, 27, 24, 21, 18, 15, 12, 9, 6, 3, 1];

      for (let i = 0; i < completedDaysAgoIsp.length; i++) {
        const pkg = ispPackages[i % ispPackages.length]!;
        const phone = ispPhones[i % ispPhones.length]!;
        const createdAt = new Date(now2 - completedDaysAgoIsp[i]! * day2);
        ispPayments.push({
          _id: new ObjectId(),
          userId: actualIspUserId,
          routerId: resolvedIspRouter1Id ?? ispRouter1Id,
          mpesa: {
            checkoutRequestId: `ws_CO_ISP_${String(i).padStart(10, '0')}`,
            merchantRequestId: `ISP${String(i * 3).padStart(6, '0')}-ISP`,
            transactionId: ispMpesaReceipt(i),
            phoneNumber: phone,
            customerName: ispPhoneNameMap[phone] ?? null,
            resultCode: 0,
            resultDesc: 'The service request is processed successfully.',
          },
          transaction: { amount: pkg.amount, type: 'voucher_purchase', description: pkg.description },
          status: 'completed',
          reconciliation: { isReconciled: true, reconciledAt: createdAt, matchedTransactionId: ispMpesaReceipt(i) },
          linkedItems: [{ type: 'voucher', itemId: new ObjectId(), quantity: 1 }],
          metadata: {},
          createdAt,
          updatedAt: createdAt,
        });
      }

      // 2 failed ISP payments
      for (let i = 0; i < 2; i++) {
        const createdAt = new Date(now2 - [14, 5][i]! * day2);
        ispPayments.push({
          _id: new ObjectId(),
          userId: actualIspUserId,
          routerId: resolvedIspRouter1Id ?? ispRouter1Id,
          mpesa: {
            checkoutRequestId: `ws_CO_ISP_FAIL_${i}`,
            merchantRequestId: `ISPFAIL${i}`,
            transactionId: null,
            phoneNumber: ispPhones[i % ispPhones.length]!,
            customerName: ispPhoneNameMap[ispPhones[i % ispPhones.length]!] ?? null,
            resultCode: 1032,
            resultDesc: 'Request cancelled by user',
          },
          transaction: { amount: 50, type: 'voucher_purchase', description: 'Voucher purchase - 6 Hours Package' },
          status: 'failed',
          reconciliation: { isReconciled: false, reconciledAt: null, matchedTransactionId: null },
          linkedItems: [],
          metadata: {},
          createdAt,
          updatedAt: createdAt,
        });
      }

      await db.collection('payments').insertMany(ispPayments);
      console.log(`  ✓ Created ${ispPayments.length} ISP payments (15 completed, 2 failed)`);
    } else {
      console.log('  ⊙ ISP payments already exist');
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
        firstName: 'Kevin',
        lastName: 'Mulugi',
        name: 'Kevin Mulugi',
        email: 'kevin@example.com',
        totalPurchases: 6,
        totalSpent: 635,
      },
      {
        phone: '254702209337',
        firstName: 'James',
        lastName: 'Kariuki',
        name: 'James Kariuki',
        email: 'james@example.com',
        totalPurchases: 5,
        totalSpent: 500,
      },
      {
        phone: '254757096651',
        firstName: 'Grace',
        lastName: 'Wambui',
        name: 'Grace Wambui',
        email: null,
        totalPurchases: 5,
        totalSpent: 650,
      },
      {
        phone: '254711223344',
        firstName: 'Peter',
        lastName: 'Ochieng',
        name: 'Peter Ochieng',
        email: null,
        totalPurchases: 5,
        totalSpent: 600,
      },
      {
        phone: '254720998877',
        firstName: 'Faith',
        lastName: 'Njeri',
        name: 'Faith Njeri',
        email: 'faith@example.com',
        totalPurchases: 5,
        totalSpent: 500,
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
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
          lastPurchaseDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          totalPurchases: customer.totalPurchases,
          totalSpent: customer.totalSpent,
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

    // ==========================================
    // SMS PLANS
    // ==========================================
    console.log('\n📲 Seeding SMS plans...');

    const smsPlans = [
      {
        planId: 'starter',
        name: 'Starter',
        description: 'Perfect for testing and low-volume use',
        pricePerCredit: 1.00,
        minimumCredits: 100,
        maximumCredits: 100,
        bonusPercentage: 0,
        isActive: true,
        isCustom: false,
        displayOrder: 1,
        features: [
          '100 SMS credits',
          'Valid for 12 months',
          'Standard delivery speed',
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        planId: 'basic',
        name: 'Basic',
        description: 'Good for small businesses and homeowners',
        pricePerCredit: 0.90,
        minimumCredits: 500,
        maximumCredits: 500,
        bonusPercentage: 0,
        isActive: true,
        isCustom: false,
        displayOrder: 2,
        features: [
          '500 SMS credits',
          '10% savings vs Starter',
          'Valid for 12 months',
          'Standard delivery speed',
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        planId: 'standard',
        name: 'Standard',
        description: 'Most popular — ideal for growing ISPs',
        pricePerCredit: 0.80,
        minimumCredits: 1000,
        maximumCredits: 1000,
        bonusPercentage: 0,
        isActive: true,
        isCustom: false,
        displayOrder: 3,
        features: [
          '1,000 SMS credits',
          '20% savings vs Starter',
          'Valid for 12 months',
          'Priority delivery',
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        planId: 'premium',
        name: 'Premium',
        description: 'For high-volume SMS users',
        pricePerCredit: 0.70,
        minimumCredits: 2500,
        maximumCredits: 2500,
        bonusPercentage: 0,
        isActive: true,
        isCustom: false,
        displayOrder: 4,
        features: [
          '2,500 SMS credits',
          '30% savings vs Starter',
          'Valid for 12 months',
          'Priority delivery',
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        planId: 'business',
        name: 'Business',
        description: 'For large ISPs with many customers',
        pricePerCredit: 0.60,
        minimumCredits: 5000,
        maximumCredits: 5000,
        bonusPercentage: 0,
        isActive: true,
        isCustom: false,
        displayOrder: 5,
        features: [
          '5,000 SMS credits',
          '40% savings vs Starter',
          'Valid for 12 months',
          'Priority delivery',
          'Dedicated support',
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        planId: 'enterprise',
        name: 'Enterprise',
        description: 'Custom amount — buy as many credits as you need at the best rate',
        pricePerCredit: 0.50,
        minimumCredits: 10000,
        maximumCredits: undefined,
        bonusPercentage: 0,
        isActive: true,
        isCustom: true,
        displayOrder: 6,
        features: [
          'Minimum 10,000 SMS credits',
          '50% savings vs Starter',
          'Valid for 24 months',
          'Priority delivery',
          'Dedicated support',
          'Custom invoicing available',
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    let smsPlansCreated = 0;
    for (const plan of smsPlans) {
      const exists = await db.collection('sms_plans').findOne({ planId: plan.planId });
      if (!exists) {
        await db.collection('sms_plans').insertOne(plan);
        smsPlansCreated++;
      }
    }

    if (smsPlansCreated > 0) {
      console.log(`  ✓ Created ${smsPlansCreated} SMS plans`);
    } else {
      console.log('  ⊙ SMS plans already exist');
    }

    console.log('\n✅ Database seeding completed successfully!\n');

    // Show summary
    console.log('📊 Seeded Data Summary:');
    console.log('  👤 Users: 3 (1 admin, 1 homeowner, 1 ISP)');
    console.log('  📱 WiFi Customers: 7 (3 homeowner + 4 ISP)');
    console.log('  🔌 Routers: 3 (1 homeowner + 2 ISP — 1 with VPN, 1 VPN pending)');
    console.log('  🔐 VPN Tunnels: 1 (ISP Router 1)');
    console.log('  🎫 Vouchers: 10 (3 used, 7 active)');
    console.log('  💰 Payments: 47 (30 homeowner + 17 ISP)');
    console.log('  📱 Paybills: 1 company paybill');
    console.log('  📲 SMS Plans: 6 (starter → enterprise)');
    console.log('\n💡 Pricing Model:');
    console.log('  Homeowners: 20% commission per voucher sale');
    console.log('  ISPs: KES 2,500/month (≤5 routers) or KES 3,900/month (unlimited)');
    console.log('  SMS Credits: KES 1.00 → 0.50/credit depending on plan');
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