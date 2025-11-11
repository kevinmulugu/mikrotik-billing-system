// src/app/api/routers/[id]/services/hotspot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { MikroTikService } from '@/lib/services/mikrotik';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

interface HotspotActionRequest {
  action: 'restart' | 'enable' | 'disable' | 'status';
  serverName?: string;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  const userId = session.user.id;
  const { id: routerId } = await params;

    // Validate ObjectId
    if (!ObjectId.isValid(routerId)) {
      return NextResponse.json({ error: 'Invalid router ID' }, { status: 400 });
    }

    const body: HotspotActionRequest = await request.json();

    if (!body.action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Validate action
    const validActions = ['restart', 'enable', 'disable', 'status'];
    if (!validActions.includes(body.action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get router and verify ownership
    const router = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        userId: new ObjectId(userId),
      });

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    // UniFi routers don't support hotspot service restart
    if (router.routerType === 'unifi') {
      return NextResponse.json(
        { 
          error: 'Service restart is not available for UniFi controllers. Manage services through your UniFi Controller UI.',
          routerType: 'unifi'
        },
        { status: 400 }
      );
    }

    // Check if router is online
    if (router.health?.status !== 'online') {
      return NextResponse.json(
        { error: 'Router is offline. Please ensure router is connected.' },
        { status: 400 }
      );
    }

    // Check if hotspot is enabled
    if (!router.configuration?.hotspot?.enabled) {
      return NextResponse.json(
        { error: 'Hotspot service is not configured on this router' },
        { status: 400 }
      );
    }

    // Get connection config
    const connectionConfig = {
      ipAddress: router.connection?.ipAddress || '',
      port: router.connection?.port || 8728,
      username: router.connection?.apiUser || 'admin',
      password: MikroTikService.decryptPassword(router.connection?.apiPassword || ''),
    };

    let result: any = {};
    let actionDescription = '';

    // Determine server name
    const serverName = body.serverName || 'hotspot1';

    switch (body.action) {
      case 'restart':
        // Restart hotspot service
        const restartSuccess = await MikroTikService.restartHotspotService(
          connectionConfig,
          serverName
        );

        if (!restartSuccess) {
          return NextResponse.json(
            { error: 'Failed to restart hotspot service' },
            { status: 500 }
          );
        }

        result = {
          success: true,
          message: 'Hotspot service restarted successfully',
          serverName: serverName,
        };
        actionDescription = `Restarted hotspot service: ${serverName}`;
        break;

      case 'enable':
        // Enable hotspot service
        const servers = await MikroTikService.getHotspotServers(connectionConfig);
        const server = servers.find((s: any) => s.name === serverName);

        if (!server) {
          return NextResponse.json(
            { error: `Hotspot server '${serverName}' not found` },
            { status: 404 }
          );
        }

        // Enable by setting disabled=false
        await MikroTikService.makeRequest(
          connectionConfig,
          `/rest/ip/hotspot/${server['.id']}`,
          'PATCH',
          { disabled: 'false' }
        );

        result = {
          success: true,
          message: 'Hotspot service enabled successfully',
          serverName: serverName,
        };
        actionDescription = `Enabled hotspot service: ${serverName}`;
        break;

      case 'disable':
        // Disable hotspot service
        const disableServers = await MikroTikService.getHotspotServers(connectionConfig);
        const disableServer = disableServers.find((s: any) => s.name === serverName);

        if (!disableServer) {
          return NextResponse.json(
            { error: `Hotspot server '${serverName}' not found` },
            { status: 404 }
          );
        }

        // Disable by setting disabled=true
        await MikroTikService.makeRequest(
          connectionConfig,
          `/rest/ip/hotspot/${disableServer['.id']}`,
          'PATCH',
          { disabled: 'true' }
        );

        result = {
          success: true,
          message: 'Hotspot service disabled successfully',
          serverName: serverName,
        };
        actionDescription = `Disabled hotspot service: ${serverName}`;
        break;

      case 'status':
        // Get hotspot status
        const statusServers = await MikroTikService.getHotspotServers(connectionConfig);
        const statusServer = statusServers.find((s: any) => s.name === serverName);

        if (!statusServer) {
          return NextResponse.json(
            { error: `Hotspot server '${serverName}' not found` },
            { status: 404 }
          );
        }

        // Get active users
        const activeUsers = await MikroTikService.getActiveHotspotUsers(connectionConfig);

        result = {
          success: true,
          server: {
            name: statusServer.name,
            interface: statusServer.interface,
            addressPool: statusServer['address-pool'],
            profile: statusServer.profile,
            disabled: statusServer.disabled === 'true',
            keepaliveTimeout: statusServer['keepalive-timeout'],
            idleTimeout: statusServer['idle-timeout'],
          },
          activeUsers: activeUsers.length,
          users: activeUsers.map((user: any) => ({
            username: user.user,
            address: user.address,
            macAddress: user['mac-address'],
            uptime: user.uptime,
            bytesIn: user['bytes-in'],
            bytesOut: user['bytes-out'],
            sessionId: user['.id'],
          })),
        };
        actionDescription = `Retrieved hotspot service status: ${serverName}`;
        break;
    }

    // Update router health timestamp
    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $set: {
          'health.lastSeen': new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Log audit entry
    await db.collection('audit_logs').insertOne({
      user: {
        userId: new ObjectId(userId),
        email: session.user.email || '',
        role: 'homeowner',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
      action: {
        type: 'update',
        resource: 'router_service',
        resourceId: new ObjectId(routerId),
        description: actionDescription,
      },
      changes: {
        before: {},
        after: { action: body.action, serverName: serverName },
        fields: ['hotspot_service'],
      },
      metadata: {
        sessionId: '',
        correlationId: `hotspot-${body.action}-${routerId}`,
        source: 'web',
        severity: body.action === 'restart' ? 'warning' : 'info',
      },
      timestamp: new Date(),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error controlling hotspot service:', error);
    return NextResponse.json(
      {
        error: 'Failed to control hotspot service',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  const userId = session.user.id;
  const { id: routerId } = await params;

    // Validate ObjectId
    if (!ObjectId.isValid(routerId)) {
      return NextResponse.json({ error: 'Invalid router ID' }, { status: 400 });
    }

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get router
    const router = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        userId: new ObjectId(userId),
      });

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    // Return hotspot configuration from database
    return NextResponse.json({
      success: true,
      hotspot: router.configuration?.hotspot || {},
      enabled: router.configuration?.hotspot?.enabled || false,
    });
  } catch (error) {
    console.error('Error fetching hotspot info:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch hotspot information',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}