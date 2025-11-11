// src/app/api/routers/add/route.ts - Enhanced with Client-Side VPN Bridge

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId, Long, Int32 } from 'mongodb';
import { MikroTikService } from '@/lib/services/mikrotik';
import { MikroTikOrchestrator } from '@/lib/services/mikrotik-orchestrator';
import VPNProvisioner from '@/lib/services/vpn-provisioner';
import { NotificationService } from '@/lib/services/notification';

interface AddRouterRequest {
  name: string;
  routerType: 'mikrotik' | 'unifi'; // Router vendor type
  model: string;
  serialNumber?: string;
  location: {
    name: string;
    street?: string;
    city?: string;
    county: string;
  };
  ipAddress: string;
  port: string;
  apiUser: string;
  apiPassword: string;
  hotspotEnabled: boolean;
  ssid?: string;
  hotspotPassword?: string;
  maxUsers?: string;
  pppoeEnabled: boolean;
  pppoeInterface?: string;
  defaultProfile?: string;
  // UniFi-specific fields
  controllerUrl?: string;
  siteId?: string;
  // NEW: VPN configuration from client
  vpnConfigured?: boolean;
  vpnIP?: string;
  vpnPublicKey?: string;
  // NEW: Plan selection for first router
  plan?: 'individual' | 'isp' | 'isp_pro';
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body: AddRouterRequest = await req.json();

    // Default to mikrotik if not specified
    const routerType = body.routerType || 'mikrotik';

    // Validate required fields
    if (!body.name || body.name.length < 3) {
      return NextResponse.json(
        { error: 'Router name must be at least 3 characters' },
        { status: 400 }
      );
    }

    if (!body.model) {
      return NextResponse.json({ error: 'Router model is required' }, { status: 400 });
    }

    if (!body.location.county) {
      return NextResponse.json({ error: 'County is required' }, { status: 400 });
    }

    // Router-type specific validation
    if (routerType === 'mikrotik') {
      // MikroTik-specific validation
      if (!body.ipAddress || !MikroTikService.validateIpAddress(body.ipAddress)) {
        return NextResponse.json({ error: 'Valid IP address is required' }, { status: 400 });
      }

      if (!body.apiPassword) {
        return NextResponse.json({ error: 'API password is required' }, { status: 400 });
      }

      // Validate hotspot settings if enabled
      if (body.hotspotEnabled) {
        if (!body.ssid || body.ssid.length < 3) {
          return NextResponse.json(
            { error: 'SSID must be at least 3 characters when hotspot is enabled' },
            { status: 400 }
          );
        }
        if (!body.hotspotPassword || body.hotspotPassword.length < 8) {
          return NextResponse.json(
            { error: 'Hotspot password must be at least 8 characters' },
            { status: 400 }
          );
        }
      }
    } else if (routerType === 'unifi') {
      // UniFi-specific validation
      if (!body.controllerUrl) {
        return NextResponse.json({ error: 'UniFi Controller URL is required' }, { status: 400 });
      }

      // Clean the controller URL: remove backticks, quotes, and trim
      body.controllerUrl = body.controllerUrl.replace(/[`'"]/g, '').trim();

      // Validate URL format
      try {
        const url = new URL(body.controllerUrl);
        if (!url.protocol.startsWith('http')) {
          return NextResponse.json({ error: 'Controller URL must start with http:// or https://' }, { status: 400 });
        }
      } catch (error) {
        return NextResponse.json({ error: 'Invalid Controller URL format. Expected format: https://192.168.1.1:8443' }, { status: 400 });
      }

      if (!body.apiUser || !body.apiPassword) {
        return NextResponse.json({ error: 'UniFi Controller credentials are required' }, { status: 400 });
      }

      // UniFi doesn't need SSID/password validation - managed in controller
    }

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get user with business info
    const user = await db
      .collection('users')
      .findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ============================================
    // PLAN SELECTION & TRIAL LOGIC
    // ============================================

    const requestedPlan = body.plan as 'individual' | 'isp' | 'isp_pro' | undefined;

    // Define plan settings
    const planSettings: Record<string, {
      commissionRate: number;
      monthlyFee: number;
      features: string[];
      maxRouters: number;
    }> = {
      individual: {
        commissionRate: 20,
        monthlyFee: 0,
        features: ['single_router', 'basic_analytics', 'email_support'],
        maxRouters: 1,
      },
      isp: {
        commissionRate: 0,
        monthlyFee: 2500,
        features: ['up_to_5_routers', 'advanced_analytics', 'priority_support', 'bulk_voucher_generation'],
        maxRouters: 5,
      },
      isp_pro: {
        commissionRate: 0,
        monthlyFee: 3900,
        features: ['unlimited_routers', 'enterprise_analytics', 'priority_support', 'bulk_voucher_generation', 'white_label'],
        maxRouters: Infinity,
      }
    };

    // Check if user has a plan
    const hasPlan = user.subscription &&
      user.subscription.plan &&
      user.subscription.plan !== 'none' &&
      user.subscription.status !== 'pending';

    let selectedPlan: string;
    let trialEnds: Date | null = null;

    if (!hasPlan) {
      // User doesn't have a plan yet - require plan selection
      if (!requestedPlan || !planSettings[requestedPlan]) {
        return NextResponse.json(
          { error: 'Please select a plan (individual, isp, or isp_pro) when adding your first router' },
          { status: 400 }
        );
      }
      selectedPlan = requestedPlan;
    } else {
      // User already has a plan
      selectedPlan = user.subscription.plan;
    }

    // Validate router limits for the selected plan
    const currentRouters = user.statistics?.totalRouters ?? 0;
    const settings = planSettings[selectedPlan];

    if (!settings) {
      return NextResponse.json(
        { error: 'Invalid plan. Please contact support.' },
        { status: 400 }
      );
    }

    if (currentRouters >= settings.maxRouters) {
      return NextResponse.json(
        { error: `Router limit reached for your ${selectedPlan} plan. Please upgrade to add more routers.` },
        { status: 400 }
      );
    }

    // If this is the first router (no plan yet), set up subscription with 15-day trial
    if (!hasPlan) {
      const now = new Date();
      trialEnds = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days from now

      const subscriptionUpdate = {
        'subscription.plan': selectedPlan,
        'subscription.status': 'trial',
        'subscription.startDate': now,
        'subscription.endDate': trialEnds,
        'subscription.monthlyFee': settings.monthlyFee,
        'subscription.features': settings.features,
        'paymentSettings.commissionRate': settings.commissionRate,
        'businessInfo.type': (selectedPlan === 'individual') ? 'individual' : 'isp',
        'updatedAt': now
      };

      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: subscriptionUpdate }
      );

      console.log(`[Router Add] ✓ Plan '${selectedPlan}' activated with 15-day trial ending ${trialEnds.toISOString()}`);
    } else {
      // User already has a plan, use existing trial end date if in trial
      if (user.subscription.status === 'trial' && user.subscription.endDate) {
        trialEnds = new Date(user.subscription.endDate);
      }
    }


    // Note: localIP is NOT unique across routers (many routers use 192.168.88.1)
    // Only check for duplicate routers by matching userId + multiple unique identifiers
    const existingRouter = await db
      .collection('routers')
      .findOne({
        userId: new ObjectId(userId),
        $or: [
          { 'routerInfo.serialNumber': body.serialNumber },
          { 'routerInfo.macAddress': body.ipAddress }, // Will be replaced with actual MAC later
        ].filter(condition => {
          // Only check serialNumber if provided
          if ('routerInfo.serialNumber' in condition) {
            return body.serialNumber && body.serialNumber.length > 0;
          }
          return true;
        })
      });

    if (existingRouter && body.serialNumber) {
      return NextResponse.json(
        { error: 'A router with this serial number already exists in your account' },
        { status: 409 }
      );
    }

    // Router info variables
    let macAddress = 'Unknown';
    let identity = 'Unknown';
    let firmwareVersion = 'Unknown';
    let controllerVersion = 'Unknown';
    let selectedSite = body.siteId || '';
    let sites: any[] = [];

    // Connection config - router-type specific
    const connectionConfig = routerType === 'mikrotik' 
      ? {
          ipAddress: body.vpnConfigured && body.vpnIP ? body.vpnIP : body.ipAddress,
          port: parseInt(body.port) || 8728,
          username: body.apiUser || 'admin',
          password: body.apiPassword,
        }
      : {
          // UniFi connection config
          controllerUrl: body.controllerUrl || '',
          username: body.apiUser,
          password: body.apiPassword,
          siteId: body.siteId,
        };

    // Router-type specific connection testing
    if (routerType === 'mikrotik') {
      // MikroTik: Test VPN connection if configured
      if (body.vpnConfigured && body.vpnIP) {
        console.log(`[Router Add] VPN pre-configured by client, testing connection...`);

        try {
          const vpnTest = await MikroTikService.testConnection(connectionConfig as any);
          if (vpnTest.success) {
            console.log(`[Router Add] ✓ VPN connection verified`);
            macAddress = await MikroTikService.getRouterMacAddress(connectionConfig as any);
            const identityResult = await MikroTikService.getIdentity(connectionConfig as any);
            identity = identityResult || 'Unknown';
            firmwareVersion = vpnTest.data?.routerInfo?.version || 'Unknown';
          } else {
            console.warn(`[Router Add] ⚠ VPN connection test failed, will retry`);
          }
        } catch (vpnTestError) {
          console.error(`[Router Add] VPN test error:`, vpnTestError);
        }
      }
    } else if (routerType === 'unifi') {
      // UniFi: Test controller connection
      console.log(`[Router Add] Testing UniFi Controller connection...`);
      
      try {
        const { UniFiService } = await import('@/lib/services/unifi');
        const unifiService = new UniFiService({
          controllerUrl: body.controllerUrl!,
          username: body.apiUser,
          password: body.apiPassword,
          ...(body.siteId && { site: body.siteId }),
        });

        // Login to get controller info
        await unifiService.login();
        
        // Get available sites
        sites = await unifiService.getSites();
        if (sites.length > 0) {
          if (!selectedSite) {
            // Auto-select first site if not specified
            selectedSite = sites[0].name;
          }
          controllerVersion = 'Connected'; // Simplified version check
          console.log(`[Router Add] ✓ UniFi Controller connected, found ${sites.length} sites`);
        } else {
          throw new Error('No sites found in UniFi Controller');
        }

      } catch (unifiError) {
        console.error(`[Router Add] UniFi connection test failed:`, unifiError);
        return NextResponse.json(
          { 
            error: 'Failed to connect to UniFi Controller', 
            details: unifiError instanceof Error ? unifiError.message : 'Unknown error'
          },
          { status: 400 }
        );
      }
    }

    // ============================================
    // VPN TUNNEL OBJECT (MikroTik only)
    // ============================================

    let vpnTunnel: any = null;
    let vpnProvisioningSuccess = false;

    if (routerType === 'mikrotik') {
      vpnProvisioningSuccess = body.vpnConfigured || false;

      if (body.vpnConfigured && body.vpnIP && body.vpnPublicKey) {
        // VPN was configured by client-side bridge
        vpnTunnel = {
          enabled: true,
          clientPublicKey: body.vpnPublicKey,
          serverPublicKey: process.env.VPN_SERVER_PUBLIC_KEY || '',
          assignedVPNIP: body.vpnIP,
          status: 'connected',
          lastHandshake: new Date(),
          provisionedAt: new Date(),
        };

        console.log(`[Router Add] ✓ Using client-configured VPN: ${body.vpnIP}`);
      } else {
        // VPN not configured - mark as pending
        vpnTunnel = {
          enabled: false,
          status: 'pending',
          error: 'VPN configuration pending',
          lastAttempt: new Date(),
        };

        console.log(`[Router Add] ⚠ VPN not configured, marked as pending`);
      }
    } else {
      // UniFi routers don't use VPN
      vpnTunnel = {
        enabled: false,
        status: 'disconnected',  // Use 'disconnected' instead of 'not_applicable' for schema compatibility
        error: 'VPN not used for UniFi controllers',
        clientPublicKey: null,
        serverPublicKey: null,
        assignedVPNIP: null,
        lastHandshake: null,
        provisionedAt: null,
        lastAttempt: null,
      };
      console.log(`[Router Add] UniFi router - VPN not applicable`);
    }

    // Encrypt API password (for MikroTik)
    const encryptedPassword = routerType === 'mikrotik' 
      ? MikroTikService.encryptPassword(body.apiPassword)
      : body.apiPassword; // UniFi passwords stored as-is (consider encrypting in production)

    // Create router document with multi-router schema
    const routerDocument = {
      userId: new ObjectId(userId),
      // Router type
      routerType: routerType,
      routerInfo: {
        name: body.name,
        model: body.model,
        serialNumber: body.serialNumber || '',
        macAddress: macAddress,
        firmwareVersion: routerType === 'mikrotik' ? firmwareVersion : controllerVersion,
        location: {
          name: body.location.name || '',
          coordinates: {
            latitude: 0,
            longitude: 0,
          },
          address: [body.location.street, body.location.city, body.location.county]
            .filter(Boolean)
            .join(', '),
        },
      },
      connection: routerType === 'mikrotik' 
        ? {
            localIP: body.ipAddress,
            vpnIP: vpnTunnel?.assignedVPNIP,
            preferVPN: vpnProvisioningSuccess,
            ipAddress: vpnProvisioningSuccess
              ? vpnTunnel.assignedVPNIP
              : body.ipAddress,
            port: parseInt(body.port) || 8728,
            apiUser: body.apiUser || 'admin',
            apiPassword: encryptedPassword,
            restApiEnabled: true,
            sshEnabled: false,
          }
        : {
            // UniFi connection details
            controllerUrl: body.controllerUrl,
            siteId: selectedSite,
            apiUser: body.apiUser,
            apiPassword: encryptedPassword,
            localIP: body.controllerUrl || '',  // Use controller URL as localIP for schema compatibility
            vpnIP: null,  // UniFi doesn't use VPN
            preferVPN: false,  // UniFi doesn't use VPN
            ipAddress: body.controllerUrl || '',
            port: 443,
            restApiEnabled: true,
            sshEnabled: false,
          },
      vpnTunnel: vpnTunnel,
      // Service-aware configuration
      services: {
        hotspot: {
          enabled: body.hotspotEnabled,
          packages: [], // Will be synced later
          lastSynced: null,
        },
        ...(routerType === 'mikrotik' && body.pppoeEnabled && {
          pppoe: {
            enabled: true,
            interface: body.pppoeInterface || 'ether1',
            packages: [], // Will be synced later
            lastSynced: null,
          },
        }),
      },
      // Router capabilities
      capabilities: {
        supportsVPN: routerType === 'mikrotik',
        supportedServices: routerType === 'mikrotik' && body.pppoeEnabled 
          ? ['hotspot', 'pppoe'] 
          : ['hotspot'],
        captivePortalMethod: routerType === 'mikrotik' ? 'http_upload' : 'controller_managed',
        voucherFormat: routerType === 'mikrotik' ? 'username_password' : 'numeric_code',
      },
      // Vendor-specific config
      vendorConfig: routerType === 'mikrotik'
        ? {
            mikrotik: {
              firmwareVersion: firmwareVersion,
              identity: identity,
              architecture: 'unknown', // Will be updated on first sync
            },
          }
        : {
            unifi: {
              controllerVersion: controllerVersion,
              selectedSite: selectedSite,
              sites: sites.map((s: any) => ({ name: s.name, desc: s.desc })),
            },
          },
      // Legacy configuration (kept for backward compatibility with MikroTik)
      configuration: routerType === 'mikrotik'
        ? {
            hotspot: {
              enabled: body.hotspotEnabled,
              ssid: body.ssid || '',
              password: body.hotspotPassword || '',
              interface: 'wlan1',
              ipPool: '10.5.50.0/24',
              dnsServers: ['8.8.8.8', '8.8.4.4'],
              maxUsers: parseInt(body.maxUsers || '50'),
            },
            pppoe: {
              enabled: body.pppoeEnabled,
              interface: body.pppoeInterface || 'ether1',
              ipPool: '10.10.10.0/24',
              dnsServers: ['8.8.8.8', '8.8.4.4'],
              defaultProfile: body.defaultProfile || 'default',
            },
            network: {
              lanInterface: 'bridge',
              wanInterface: 'ether1',
              lanSubnet: '192.168.88.0/24',
              dhcpRange: '192.168.88.10-192.168.88.254',
            },
          }
        : {
            // UniFi configuration (minimal - managed in controller)
            hotspot: {
              enabled: body.hotspotEnabled,
              ssid: 'Managed in UniFi Controller',
              password: '',
              interface: '',
              ipPool: '',
              dnsServers: [],
              maxUsers: 0,
            },
            pppoe: {
              enabled: false,
              interface: '',
              ipPool: '',
              dnsServers: [],
              defaultProfile: '',
            },
            network: {
              lanInterface: '',
              wanInterface: '',
              lanSubnet: '',
              dhcpRange: '',
            },
          },
      health: {
        status: 'online',
        lastSeen: new Date(),
        uptime: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        temperature: 0,
        connectedUsers: 0,
      },
      statistics: {
        totalDataUsage: 0,
        monthlyDataUsage: 0,
        totalUsers: 0,
        activeUsers: 0,
        revenue: {
          total: 0,
          monthly: 0,
          daily: 0,
        },
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Insert router into database
    const insertResult = await db.collection('routers').insertOne(routerDocument);
    const routerId = insertResult.insertedId.toString();

    console.log(`[Router Add] ✓ Router created with ID: ${routerId}`);

    // ============================================
    // SAVE VPN TUNNEL TO DATABASE (MikroTik only)
    // ============================================

    if (routerType === 'mikrotik' && vpnProvisioningSuccess && body.vpnPublicKey && body.vpnIP) {
      try {
        console.log(`[Router Add] Saving VPN tunnel configuration...`);

        // Fetch the setup token to get the complete VPN config including private key
        const setupToken = await db.collection('vpn_setup_tokens').findOne({
          'vpnConfig.vpnIP': body.vpnIP,
          status: 'verified',
        });

        if (!setupToken) {
          console.warn(`[Router Add] ⚠ Setup token not found for VPN IP: ${body.vpnIP}`);
        }

        // Encrypt private key if available
        let encryptedPrivateKey = '';
        if (setupToken?.vpnConfig?.clientPrivateKey) {
          console.log(`[Router Add] Encrypting VPN private key...`);
          encryptedPrivateKey = VPNProvisioner.encryptPrivateKey(
            setupToken.vpnConfig.clientPrivateKey
          );
        } else {
          console.warn(`[Router Add] ⚠ Private key not found in setup token`);
        }

        // Insert VPN tunnel with proper BSON types
        await db.collection('vpn_tunnels').insertOne({
          routerId: insertResult.insertedId,
          userId: new ObjectId(userId),
          vpnConfig: {
            clientPrivateKey: encryptedPrivateKey,
            clientPublicKey: body.vpnPublicKey,
            serverPublicKey: process.env.VPN_SERVER_PUBLIC_KEY || '',
            assignedIP: body.vpnIP,
            endpoint: process.env.VPN_SERVER_ENDPOINT || 'vpn.qebol.co.ke:51820',
            allowedIPs: process.env.VPN_NETWORK || '10.99.0.0/16',
            persistentKeepalive: new Int32(25),  // ✅ Explicit int32 for BSON validation
          },
          connection: {
            status: 'connected',
            lastHandshake: new Date(),
            bytesReceived: new Long(0),  // ✅ Explicit long for BSON validation
            bytesSent: new Long(0),      // ✅ Explicit long for BSON validation
            lastSeen: new Date(),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        console.log(`[Router Add] ✓ VPN tunnel saved to database`);

        // Update setup token status to 'completed'
        if (setupToken) {
          await db.collection('vpn_setup_tokens').updateOne(
            { _id: setupToken._id },
            {
              $set: {
                status: 'completed',
                completedAt: new Date(),
                routerId: insertResult.insertedId,
              },
            }
          );
          console.log(`[Router Add] ✓ Setup token marked as completed`);
        }

      } catch (vpnError) {
        console.error(`[Router Add] ❌ Failed to save VPN tunnel:`, vpnError);

        // Don't fail the entire router add, just log the error
        // Update router status to indicate VPN issue
        await db.collection('routers').updateOne(
          { _id: insertResult.insertedId },
          {
            $set: {
              'vpnTunnel.status': 'failed',
              'vpnTunnel.error': vpnError instanceof Error ? vpnError.message : 'Failed to save VPN tunnel',
              'vpnTunnel.lastAttempt': new Date(),
            },
          }
        );
      }
    }

    // ============================================
    // EXECUTE ROUTER CONFIGURATION (MikroTik only)
    // ============================================

    let configResult: any = {
      success: true,
      completedSteps: [],
      failedSteps: [],
      warnings: [],
    };

    if (routerType === 'mikrotik') {
      console.log(`[Router Add] Starting MikroTik router configuration...`);

      try {
        const mikrotikConfig = connectionConfig as { ipAddress: string; port: number; username: string; password: string };
        
        configResult = await MikroTikOrchestrator.configureRouter(mikrotikConfig, {
          hotspotEnabled: body.hotspotEnabled,
          ssid: body.ssid,
          pppoeEnabled: body.pppoeEnabled,
          pppoeInterfaces: ['ether2', 'ether3'],
          wanInterface: 'ether1',
          bridgeInterfaces: ['wlan1', 'ether4'],
        });

        console.log(`[Router Add] Configuration result:`, {
          success: configResult.success,
          completedSteps: configResult.completedSteps,
          failedSteps: configResult.failedSteps,
        });
      } catch (configError) {
        console.error(`[Router Add] Configuration error:`, configError);
        configResult = {
          success: false,
          completedSteps: [],
          failedSteps: ['all'],
          warnings: [configError instanceof Error ? configError.message : 'Unknown configuration error'],
        };
      }
    } else {
      // UniFi routers don't need server-side configuration
      console.log(`[Router Add] UniFi router - skipping server-side configuration`);
      configResult = {
        success: true,
        completedSteps: ['controller_connected'],
        failedSteps: [],
        warnings: ['Configuration managed through UniFi Controller'],
      };
    }

    // Update router with configuration results
    await db.collection('routers').updateOne(
      { _id: insertResult.insertedId },
      {
        $set: {
          'health.status': configResult.success ? 'online' : 'warning',
          configurationStatus: {
            configured: configResult.success,
            completedSteps: configResult.completedSteps || [],
            failedSteps: configResult.failedSteps || [],
            warnings: configResult.warnings || [],
            configuredAt: new Date(),
          },
          updatedAt: new Date(),
        },
      }
    );

    // Update user statistics
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $inc: { 'statistics.totalRouters': 1 },
        $set: { updatedAt: new Date() },
      }
    );

    // Log audit entry
    await db.collection('audit_logs').insertOne({
      user: {
        userId: new ObjectId(userId),
        email: session.user.email || '',
        role: 'homeowner',
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
      },
      action: {
        type: 'create',
        resource: 'router',
        resourceId: insertResult.insertedId,
        description: `Added new router: ${body.name}${vpnProvisioningSuccess ? ' (with VPN)' : ''}`,
      },
      changes: {
        before: null,
        after: routerDocument,
        fields: ['router_created', vpnProvisioningSuccess ? 'vpn_enabled' : 'vpn_pending'],
      },
      metadata: {
        sessionId: '',
        correlationId: `add-router-${routerId}`,
        source: 'web',
        severity: 'info',
      },
      timestamp: new Date(),
    });

    // === Push captive portal files to router (MikroTik hotspot only) ===
    if (routerType === 'mikrotik' && body.hotspotEnabled) {
      try {
        console.log(`[Router Add] Pushing captive portal files to MikroTik router ${routerId}...`);

        const mikrotikConfig = connectionConfig as { ipAddress: string; port: number; username: string; password: string };
        
        // Decrypt API password for use
        const decryptedPassword = MikroTikService.decryptPassword(encryptedPassword);

        // Upload to simple /hotspot path (works on all MikroTik routers)
        const uploadResult = await MikroTikService.uploadCaptivePortalFiles(
          {
            ipAddress: mikrotikConfig.ipAddress,
            port: mikrotikConfig.port,
            username: mikrotikConfig.username,
            password: decryptedPassword,
          },
          {
            routerId: routerId,
            customerId: userId,  // This is passed as customerId parameter to the captive portal files
            routerName: body.name,
            location: body.location.name || body.location.county,
            baseUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || 'http://localhost:3000',
            // ftpUser and ftpPassword omitted to default to API user
            remotePath: '/hotspot',  // Simple path that works on all routers
          }
        );

        if (!uploadResult.success) {
          console.warn(`[Router Add] ⚠ Captive portal upload reported issues: ${uploadResult.error || uploadResult.stderr}`);
        } else {
          console.log(`[Router Add] ✓ Captive portal files uploaded: ${uploadResult.stdout?.slice(0, 200)}`);

          // === Verify upload before restarting ===
          console.log(`[Router Add] Verifying captive portal files...`);
          
          const mikrotikConfig = connectionConfig as { ipAddress: string; port: number; username: string; password: string };
          
          const hotspotExists = await MikroTikService.confirmHotspotDirectory({
            ipAddress: mikrotikConfig.ipAddress,
            port: mikrotikConfig.port,
            username: mikrotikConfig.username,
            password: decryptedPassword,
          });

          if (hotspotExists) {
            console.log(`[Router Add] ✓ Upload verified: hotspot directory exists`);
            
            // === Restart router to apply captive portal changes ===
            try {
              console.log(`[Router Add] Restarting router to apply captive portal changes...`);
            
              const mikrotikConfig = connectionConfig as { ipAddress: string; port: number; username: string; password: string };
              
              const restartResult = await MikroTikService.restartRouter({
                ipAddress: mikrotikConfig.ipAddress,
                port: mikrotikConfig.port,
                username: mikrotikConfig.username,
                password: decryptedPassword,
              });

              if (restartResult) {
                console.log(`[Router Add] ✓ Router restart initiated successfully`);
                
                // Update router status to indicate restart
                await db.collection('routers').updateOne(
                  { _id: insertResult.insertedId },
                  {
                    $set: {
                      'health.status': 'restarting',
                      'health.lastSeen': new Date(),
                      'updatedAt': new Date(),
                    },
                  }
                );
              } else {
                console.warn(`[Router Add] ⚠ Router restart command may have failed`);
              }
            } catch (restartErr) {
              console.warn(`[Router Add] ⚠ Router restart error (this is often expected):`, restartErr);
              // Don't fail the entire operation - router disconnect during restart is normal
            }
          } else {
            // Upload verification failed - skip restart
            console.warn(`[Router Add] ⚠ Upload verification failed, skipping router restart`);
            console.warn(`[Router Add]   Hotspot directory not found on router`);
          }
        }
      } catch (uploadErr) {
        console.error(`[Router Add] ❌ Failed to upload captive portal files:`, uploadErr);
      }
    }

    // Send success notification to user
    try {
      await NotificationService.createNotification({
        userId: session.user.id,
        type: 'success',
        category: 'router',
        priority: 'normal',
        title: 'Router Added Successfully',
        message: `Router "${body.name}" (${body.model}) connected and synced. ${vpnProvisioningSuccess ? 'Secure remote access enabled.' : 'Ready for voucher generation.'}`,
        metadata: {
          resourceType: 'router',
          resourceId: routerId.toString(),
          link: `/routers/${routerId}`,
        },
        sendEmail: false,
      });
      
      console.log('✅ [Notification] Router added notification created');
    } catch (notifError) {
      console.error('❌ [Notification] Failed to create router added notification:', notifError);
    }

    // Prepare response
    const responseData = {
      success: true,
      message: vpnProvisioningSuccess
        ? 'Router added successfully with secure remote access'
        : 'Router added successfully',
      routerId: routerId,
      router: {
        id: routerId,
        name: body.name,
        model: body.model,
        ipAddress: body.ipAddress,
        vpnIP: vpnTunnel?.assignedVPNIP,
        vpnEnabled: vpnProvisioningSuccess,
        status: configResult.success ? 'online' : 'warning',
        location: body.location.name || body.location.county,
        macAddress: macAddress,
        firmwareVersion: firmwareVersion,
      },
      vpn: {
        enabled: vpnProvisioningSuccess,
        status: vpnTunnel?.status,
        vpnIP: vpnTunnel?.assignedVPNIP,
      },
      configuration: {
        success: configResult.success,
        completedSteps: configResult.completedSteps || [],
        failedSteps: configResult.failedSteps || [],
        warnings: configResult.warnings || [],
      },
      subscription: {
        plan: selectedPlan,
        trialEndsAt: trialEnds ? trialEnds.toISOString() : null,
        isNewPlan: !hasPlan,
      },
    };

    console.log(`[Router Add] ✅ Router onboarding complete`);

    return NextResponse.json(responseData, { status: 201 });

  } catch (error) {
    console.error('[Router Add] ❌ API Error:', error);

    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error && error.stack ? error.stack : undefined;

    return NextResponse.json(
      {
        error: 'Failed to add router',
        details: errorMessage,
        debug: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
      },
      { status: 500 }
    );
  }
}