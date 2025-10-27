// src/app/api/routers/[id]/services/pppoe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { MikroTikService } from '@/lib/services/mikrotik';
import { getRouterConnectionConfig } from '@/lib/services/router-connection';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

interface PPPoEActionRequest {
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

    const body: PPPoEActionRequest = await request.json();

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

    // Get customer
    const customer = await db
      .collection('customers')
      .findOne({ userId: new ObjectId(userId) });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get router
    const router = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        customerId: customer._id,
      });

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    // Check if router is online
    if (router.health?.status !== 'online') {
      return NextResponse.json(
        { error: 'Router is offline. Please ensure router is connected.' },
        { status: 400 }
      );
    }

    // Check if PPPoE is enabled
    if (!router.configuration?.pppoe?.enabled) {
      return NextResponse.json(
        { error: 'PPPoE service is not configured on this router' },
        { status: 400 }
      );
    }

    // Get connection config
    // const connectionConfig = {
    //   ipAddress: router.connection?.ipAddress || '',
    //   port: router.connection?.port || 8728,
    //   username: router.connection?.apiUser || 'admin',
    //   password: MikroTikService.decryptPassword(router.connection?.apiPassword || ''),
    // };

    const connectionConfig = getRouterConnectionConfig(router, {
      forceLocal: false, // Use local IP for PPPoE management
      forceVPN: true, // Use VPN IP if available
    });

    let result: any = {};
    let actionDescription = '';

    // Determine server name or use default service name
    const serverName = body.serverName || 'pppoe-server1';

    switch (body.action) {
      case 'restart':
        // Get PPPoE servers
        const servers = await MikroTikService.makeRequest(
          connectionConfig,
          '/rest/interface/pppoe-server/server',
          'GET'
        );

        if (!Array.isArray(servers) || servers.length === 0) {
          return NextResponse.json(
            { error: 'No PPPoE servers found on router' },
            { status: 404 }
          );
        }

        const server = servers.find((s: any) => s['service-name'] === serverName);

        if (!server) {
          return NextResponse.json(
            { error: `PPPoE server '${serverName}' not found` },
            { status: 404 }
          );
        }

        // Disable server
        await MikroTikService.makeRequest(
          connectionConfig,
          `/rest/interface/pppoe-server/server/${server['.id']}`,
          'PATCH',
          { disabled: 'true' }
        );

        // Wait 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Enable server
        await MikroTikService.makeRequest(
          connectionConfig,
          `/rest/interface/pppoe-server/server/${server['.id']}`,
          'PATCH',
          { disabled: 'false' }
        );

        result = {
          success: true,
          message: 'PPPoE service restarted successfully',
          serverName: serverName,
        };
        actionDescription = `Restarted PPPoE service: ${serverName}`;
        break;

      case 'enable':
        // Enable PPPoE service
        const enableServers = await MikroTikService.makeRequest(
          connectionConfig,
          '/rest/interface/pppoe-server/server',
          'GET'
        );

        if (!Array.isArray(enableServers) || enableServers.length === 0) {
          return NextResponse.json(
            { error: 'No PPPoE servers found on router' },
            { status: 404 }
          );
        }

        const enableServer = enableServers.find((s: any) => s['service-name'] === serverName);

        if (!enableServer) {
          return NextResponse.json(
            { error: `PPPoE server '${serverName}' not found` },
            { status: 404 }
          );
        }

        // Enable by setting disabled=false
        await MikroTikService.makeRequest(
          connectionConfig,
          `/rest/interface/pppoe-server/server/${enableServer['.id']}`,
          'PATCH',
          { disabled: 'false' }
        );

        result = {
          success: true,
          message: 'PPPoE service enabled successfully',
          serverName: serverName,
        };
        actionDescription = `Enabled PPPoE service: ${serverName}`;
        break;

      case 'disable':
        // Disable PPPoE service
        const disableServers = await MikroTikService.makeRequest(
          connectionConfig,
          '/rest/interface/pppoe-server/server',
          'GET'
        );

        if (!Array.isArray(disableServers) || disableServers.length === 0) {
          return NextResponse.json(
            { error: 'No PPPoE servers found on router' },
            { status: 404 }
          );
        }

        const disableServer = disableServers.find((s: any) => s['service-name'] === serverName);

        if (!disableServer) {
          return NextResponse.json(
            { error: `PPPoE server '${serverName}' not found` },
            { status: 404 }
          );
        }

        // Disable by setting disabled=true
        await MikroTikService.makeRequest(
          connectionConfig,
          `/rest/interface/pppoe-server/server/${disableServer['.id']}`,
          'PATCH',
          { disabled: 'true' }
        );

        result = {
          success: true,
          message: 'PPPoE service disabled successfully',
          serverName: serverName,
        };
        actionDescription = `Disabled PPPoE service: ${serverName}`;
        break;

      case 'status':
        // Get PPPoE server status
        const statusServers = await MikroTikService.makeRequest(
          connectionConfig,
          '/rest/interface/pppoe-server/server',
          'GET'
        );

        if (!Array.isArray(statusServers) || statusServers.length === 0) {
          return NextResponse.json(
            { error: 'No PPPoE servers found on router' },
            { status: 404 }
          );
        }

        const statusServer = statusServers.find((s: any) => s['service-name'] === serverName);

        if (!statusServer) {
          return NextResponse.json(
            { error: `PPPoE server '${serverName}' not found` },
            { status: 404 }
          );
        }

        // Get active PPPoE users
        const activeUsers = await MikroTikService.getActivePPPoEUsers(connectionConfig);

        // Get PPP secrets (configured users)
        const secrets = await MikroTikService.makeRequest(
          connectionConfig,
          '/rest/ppp/secret',
          'GET'
        );

        result = {
          success: true,
          server: {
            serviceName: statusServer['service-name'],
            interface: statusServer.interface,
            defaultProfile: statusServer['default-profile'],
            disabled: statusServer.disabled === 'true',
            oneSessionPerHost: statusServer['one-session-per-host'],
            maxSessions: statusServer['max-sessions'],
          },
          activeUsers: activeUsers.length,
          configuredUsers: Array.isArray(secrets) ? secrets.length : 0,
          users: activeUsers.map((user: any) => ({
            name: user.name,
            address: user.address,
            uptime: user.uptime,
            service: user.service,
            callerID: user['caller-id'],
            encoding: user.encoding,
            sessionId: user['.id'],
          })),
        };
        actionDescription = `Retrieved PPPoE service status: ${serverName}`;
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
        fields: ['pppoe_service'],
      },
      metadata: {
        sessionId: '',
        correlationId: `pppoe-${body.action}-${routerId}`,
        source: 'web',
        severity: body.action === 'restart' ? 'warning' : 'info',
      },
      timestamp: new Date(),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error controlling PPPoE service:', error);
    return NextResponse.json(
      {
        error: 'Failed to control PPPoE service',
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

    // Get customer
    const customer = await db
      .collection('customers')
      .findOne({ userId: new ObjectId(userId) });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get router
    const router = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        customerId: customer._id,
      });

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    // Return PPPoE configuration from database
    return NextResponse.json({
      success: true,
      pppoe: router.configuration?.pppoe || {},
      enabled: router.configuration?.pppoe?.enabled || false,
    });
  } catch (error) {
    console.error('Error fetching PPPoE info:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch PPPoE information',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}