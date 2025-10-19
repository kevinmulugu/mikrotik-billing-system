// src/app/api/routers/add/route.ts - Enhanced with Deployment Tracking

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import MikroTikService from '@/lib/services/mikrotik';
import RouterProvisioningService from '@/lib/services/router-provisioning';

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
        'connection.ipAddress': body.ipAddress,
      });

    if (existingRouter) {
      return NextResponse.json(
        { error: 'A router with this IP address already exists in your account' },
        { status: 409 }
      );
    }

    // Test connection to router
    const connectionConfig = {
      ipAddress: body.ipAddress,
      port: parseInt(body.port) || 80,
      username: body.apiUser || 'admin',
      password: body.apiPassword,
    };

    const connectionTest = await MikroTikService.testConnection(connectionConfig);

    if (!connectionTest.success) {
      return NextResponse.json(
        {
          error: 'Failed to connect to router',
          details: connectionTest.error,
        },
        { status: 400 }
      );
    }

    // Get router MAC address and identity
    const macAddress = await MikroTikService.getRouterMacAddress(connectionConfig);
    const identity = await MikroTikService.getIdentity(connectionConfig);

    // Encrypt API password
    const encryptedPassword = MikroTikService.encryptPassword(body.apiPassword);

    // Create router document matching MongoDB schema
    const routerDocument = {
      customerId: customer._id,
      routerInfo: {
        name: body.name,
        model: body.model,
        serialNumber: body.serialNumber || '',
        macAddress: macAddress,
        firmwareVersion: connectionTest.data?.routerInfo.version || '',
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
        ipAddress: body.ipAddress,
        port: parseInt(body.port) || 80,
        apiUser: body.apiUser || 'admin',
        apiPassword: encryptedPassword,
        restApiEnabled: true,
        sshEnabled: false,
      },
      configuration: {
        wanInterface: 'ether1',
        lanInterfaces: ['ether2', 'ether3', 'ether4'],
        wifiSSID: body.ssid || '',
        bridgeName: 'hotspot-bridge',
        hotspotEnabled: body.hotspotEnabled,
        pppoeEnabled: body.pppoeEnabled,
        hotspot: {
          enabled: body.hotspotEnabled,
          ssid: body.ssid || '',
          password: body.hotspotPassword || '',
          interface: 'wlan1',
          ipPool: '192.168.10.0/24',
          dnsServers: ['8.8.8.8', '8.8.4.4'],
          maxUsers: parseInt(body.maxUsers || '50'),
        },
        pppoe: {
          enabled: body.pppoeEnabled,
          interface: body.pppoeInterface || 'ether1',
          ipPool: '192.168.100.0/24',
          dnsServers: ['8.8.8.8', '8.8.4.4'],
          defaultProfile: body.defaultProfile || 'home-standard-10mbps',
        },
        network: {
          lanInterface: 'bridge',
          wanInterface: 'ether1',
          lanSubnet: '192.168.88.0/24',
          dhcpRange: '192.168.88.10-192.168.88.254',
        },
      },
      health: {
        isOnline: true,
        status: 'online',
        lastSeen: new Date(),
        uptime: connectionTest.data?.routerInfo.uptime || '0s',
        cpuLoad: connectionTest.data?.routerInfo.cpuLoad || 0,
        cpuUsage: connectionTest.data?.routerInfo.cpuLoad || 0,
        memoryUsage: connectionTest.data?.routerInfo.memoryUsage || 0,
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
      configurationStatus: {
        configured: false,
        completedSteps: [],
        failedSteps: [],
        warnings: [],
      },
      status: 'inactive',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Insert router into database first
    const insertResult = await db.collection('routers').insertOne(routerDocument);
    const routerId = insertResult.insertedId.toString();

    console.log(`✓ Router ${routerId} saved to database`);
    console.log(`→ Starting full provisioning with deployment tracking...`);

    // Execute full router provisioning with deployment tracking
    const provisionResult = await RouterProvisioningService.provisionRouter(
      routerId,
      db
    );

    console.log(`→ Provisioning completed for router ${routerId}`);
    console.log(`  - Success: ${provisionResult.success}`);
    console.log(`  - Completed Steps: ${provisionResult.completedSteps.length}`);
    console.log(`  - Failed Steps: ${provisionResult.failedSteps.length}`);

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
        description: `Added new router: ${body.name}`,
      },
      changes: {
        before: null,
        after: routerDocument,
        fields: ['router_created'],
      },
      metadata: {
        sessionId: '',
        correlationId: `add-router-${routerId}`,
        source: 'web',
        severity: 'info',
      },
      timestamp: new Date(),
    });

    // Get final router state with deployed configs
    const finalRouter = await db.collection('routers').findOne(
      { _id: insertResult.insertedId },
      {
        projection: {
          'routerInfo.name': 1,
          'routerInfo.model': 1,
          'routerInfo.macAddress': 1,
          'routerInfo.firmwareVersion': 1,
          'connection.ipAddress': 1,
          'health.status': 1,
          'configurationStatus': 1,
          'configuration.deployedConfigs': 1,
        },
      }
    );

    // Return success response
    if (provisionResult.success) {
      return NextResponse.json(
        {
          success: true,
          message: 'Router added and provisioned successfully',
          routerId: routerId,
          router: {
            id: routerId,
            name: body.name,
            model: body.model,
            ipAddress: body.ipAddress,
            status: 'active',
            location: body.location.name || body.location.county,
            macAddress: macAddress,
            firmwareVersion: connectionTest.data?.routerInfo.version,
          },
          provisioning: {
            success: true,
            completedSteps: provisionResult.completedSteps,
            configuredAt: provisionResult.configuredAt,
            warnings: provisionResult.warnings,
            totalConfigsDeployed: Object.values(
              finalRouter?.configuration?.deployedConfigs || {}
            ).reduce((sum: number, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0),
          },
        },
        { status: 201 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Router added but provisioning partially failed',
          routerId: routerId,
          router: {
            id: routerId,
            name: body.name,
            model: body.model,
            ipAddress: body.ipAddress,
            status: 'error',
            location: body.location.name || body.location.county,
            macAddress: macAddress,
            firmwareVersion: connectionTest.data?.routerInfo.version,
          },
          provisioning: {
            success: false,
            error: provisionResult.error,
            completedSteps: provisionResult.completedSteps,
            failedSteps: provisionResult.failedSteps,
            warnings: provisionResult.warnings,
          },
        },
        { status: 207 } // 207 Multi-Status
      );
    }
  } catch (error) {
    console.error('Add Router API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to add router',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}