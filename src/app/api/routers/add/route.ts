// src/app/api/routers/add/route.ts - Enhanced with Client-Side VPN Bridge

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId, Long, Int32 } from 'mongodb';
import { MikroTikService } from '@/lib/services/mikrotik';
import { MikroTikOrchestrator } from '@/lib/services/mikrotik-orchestrator';
import VPNProvisioner from '@/lib/services/vpn-provisioner';

interface AddRouterRequest {
  name: string;
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
  // NEW: VPN configuration from client
  vpnConfigured?: boolean;
  vpnIP?: string;
  vpnPublicKey?: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body: AddRouterRequest = await req.json();

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

    if (!body.ipAddress || !MikroTikService.validateIpAddress(body.ipAddress)) {
      return NextResponse.json({ error: 'Valid IP address is required' }, { status: 400 });
    }

    if (!body.apiPassword) {
      return NextResponse.json({ error: 'API password is required' }, { status: 400 });
    }

    if (!body.location.county) {
      return NextResponse.json({ error: 'County is required' }, { status: 400 });
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

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get customer
    const customer = await db
      .collection('customers')
      .findOne({ userId: new ObjectId(userId) });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer profile not found. Please complete your profile setup.' },
        { status: 404 }
      );
    }

    // Check if router with same IP already exists for this customer
    const existingRouter = await db
      .collection('routers')
      .findOne({
        customerId: customer._id,
        'connection.localIP': body.ipAddress,
      });

    if (existingRouter) {
      return NextResponse.json(
        { error: 'A router with this IP address already exists in your account' },
        { status: 409 }
      );
    }

    // SKIP server-side connection test if client already did it
    // (Client-side bridge approach)
    let macAddress = 'Unknown';
    let identity = 'Unknown';
    let firmwareVersion = 'Unknown';

    // Connection config - will use VPN IP if provided
    const connectionConfig = {
      ipAddress: body.vpnConfigured && body.vpnIP ? body.vpnIP : body.ipAddress,
      port: parseInt(body.port) || 8728,
      username: body.apiUser || 'admin',
      password: body.apiPassword,
    };

    // If VPN was configured by client, verify it's working
    if (body.vpnConfigured && body.vpnIP) {
      console.log(`[Router Add] VPN pre-configured by client, testing connection...`);
      
      try {
        const vpnTest = await MikroTikService.testConnection(connectionConfig);
        if (vpnTest.success) {
          console.log(`[Router Add] ✓ VPN connection verified`);
          macAddress = await MikroTikService.getRouterMacAddress(connectionConfig);
          identity = await MikroTikService.getIdentity(connectionConfig);
          firmwareVersion = vpnTest.data?.routerInfo?.version || 'Unknown';
        } else {
          console.warn(`[Router Add] ⚠ VPN connection test failed, will retry`);
        }
      } catch (vpnTestError) {
        console.error(`[Router Add] VPN test error:`, vpnTestError);
      }
    }

    // ============================================
    // VPN TUNNEL OBJECT
    // ============================================
    
    let vpnTunnel: any = null;
    let vpnProvisioningSuccess = body.vpnConfigured || false;

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

    // Encrypt API password
    const encryptedPassword = MikroTikService.encryptPassword(body.apiPassword);

    // Create router document
    const routerDocument = {
      customerId: customer._id,
      routerInfo: {
        name: body.name,
        model: body.model,
        serialNumber: body.serialNumber || '',
        macAddress: macAddress,
        firmwareVersion: firmwareVersion,
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
      connection: {
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
      },
      vpnTunnel: vpnTunnel,
      configuration: {
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
    // SAVE VPN TUNNEL TO DATABASE (FIXED)
    // ============================================
    
    if (vpnProvisioningSuccess && body.vpnPublicKey && body.vpnIP) {
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
          customerId: customer._id,
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
    // EXECUTE ROUTER CONFIGURATION
    // ============================================
    
    console.log(`[Router Add] Starting router configuration...`);
    
    let configResult;
    try {
      configResult = await MikroTikOrchestrator.configureRouter(connectionConfig, {
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

    // Update customer statistics
    await db.collection('customers').updateOne(
      { _id: customer._id },
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