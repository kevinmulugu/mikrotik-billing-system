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
    const connectionConfig = getRouterConnectionConfig(router, {
      forceLocal: false,
      forceVPN: true,
    });

    let result: any = {};
    let actionDescription = '';

    // Determine server name or use default service name
    const serverName = body.serverName || 'pppoe-server1';

    // CRITICAL: Check if we have mikrotikId cached in database for this server
    let cachedMikrotikId = router.configuration?.pppoe?.servers?.find(
      (s: any) => s.serviceName === serverName
    )?.mikrotikId;

    switch (body.action) {
      case 'restart':
        try {
          console.log(`[PPPoE] Restarting service: ${serverName}`);

          // Get PPPoE server with .id
          let serverId = cachedMikrotikId;
          let serverData: any = null;

          if (!serverId) {
            // Fetch from router if not cached
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

            serverData = servers.find((s: any) => s['service-name'] === serverName);

            if (!serverData) {
              return NextResponse.json(
                { error: `PPPoE server '${serverName}' not found` },
                { status: 404 }
              );
            }

            serverId = serverData['.id'];

            // CRITICAL: Cache mikrotikId in database for future use
            await db.collection('routers').updateOne(
              { _id: new ObjectId(routerId) },
              {
                $set: {
                  'configuration.pppoe.servers': [
                    {
                      serviceName: serverName,
                      mikrotikId: serverId,
                      interface: serverData.interface,
                      lastUpdated: new Date(),
                    },
                  ],
                  updatedAt: new Date(),
                },
              }
            );
            console.log(`[PPPoE] Cached server mikrotikId: ${serverId}`);
          }

          // Disable server
          await MikroTikService.makeRequest(
            connectionConfig,
            `/rest/interface/pppoe-server/server/${serverId}`,
            'PATCH',
            { disabled: 'true' }
          );

          console.log(`[PPPoE] Server disabled, waiting 2 seconds...`);

          // Wait 2 seconds
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Enable server
          await MikroTikService.makeRequest(
            connectionConfig,
            `/rest/interface/pppoe-server/server/${serverId}`,
            'PATCH',
            { disabled: 'false' }
          );

          console.log(`[PPPoE] Server re-enabled successfully`);

          result = {
            success: true,
            message: 'PPPoE service restarted successfully',
            serverName: serverName,
            mikrotikId: serverId,
          };
          actionDescription = `Restarted PPPoE service: ${serverName}`;
        } catch (restartError) {
          console.error('[PPPoE] Restart failed:', restartError);
          throw restartError;
        }
        break;

      case 'enable':
        try {
          console.log(`[PPPoE] Enabling service: ${serverName}`);

          // Get PPPoE server with .id
          let enableServerId = cachedMikrotikId;
          let enableServerData: any = null;

          if (!enableServerId) {
            // Fetch from router if not cached
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

            enableServerData = enableServers.find((s: any) => s['service-name'] === serverName);

            if (!enableServerData) {
              return NextResponse.json(
                { error: `PPPoE server '${serverName}' not found` },
                { status: 404 }
              );
            }

            enableServerId = enableServerData['.id'];

            // CRITICAL: Cache mikrotikId in database
            await db.collection('routers').updateOne(
              { _id: new ObjectId(routerId) },
              {
                $set: {
                  'configuration.pppoe.servers': [
                    {
                      serviceName: serverName,
                      mikrotikId: enableServerId,
                      interface: enableServerData.interface,
                      lastUpdated: new Date(),
                    },
                  ],
                  updatedAt: new Date(),
                },
              }
            );
            console.log(`[PPPoE] Cached server mikrotikId: ${enableServerId}`);
          }

          // Enable by setting disabled=false
          await MikroTikService.makeRequest(
            connectionConfig,
            `/rest/interface/pppoe-server/server/${enableServerId}`,
            'PATCH',
            { disabled: 'false' }
          );

          console.log(`[PPPoE] Server enabled successfully`);

          result = {
            success: true,
            message: 'PPPoE service enabled successfully',
            serverName: serverName,
            mikrotikId: enableServerId,
          };
          actionDescription = `Enabled PPPoE service: ${serverName}`;
        } catch (enableError) {
          console.error('[PPPoE] Enable failed:', enableError);
          throw enableError;
        }
        break;

      case 'disable':
        try {
          console.log(`[PPPoE] Disabling service: ${serverName}`);

          // Get PPPoE server with .id
          let disableServerId = cachedMikrotikId;
          let disableServerData: any = null;

          if (!disableServerId) {
            // Fetch from router if not cached
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

            disableServerData = disableServers.find((s: any) => s['service-name'] === serverName);

            if (!disableServerData) {
              return NextResponse.json(
                { error: `PPPoE server '${serverName}' not found` },
                { status: 404 }
              );
            }

            disableServerId = disableServerData['.id'];

            // CRITICAL: Cache mikrotikId in database
            await db.collection('routers').updateOne(
              { _id: new ObjectId(routerId) },
              {
                $set: {
                  'configuration.pppoe.servers': [
                    {
                      serviceName: serverName,
                      mikrotikId: disableServerId,
                      interface: disableServerData.interface,
                      lastUpdated: new Date(),
                    },
                  ],
                  updatedAt: new Date(),
                },
              }
            );
            console.log(`[PPPoE] Cached server mikrotikId: ${disableServerId}`);
          }

          // Disable by setting disabled=true
          await MikroTikService.makeRequest(
            connectionConfig,
            `/rest/interface/pppoe-server/server/${disableServerId}`,
            'PATCH',
            { disabled: 'true' }
          );

          console.log(`[PPPoE] Server disabled successfully`);

          result = {
            success: true,
            message: 'PPPoE service disabled successfully',
            serverName: serverName,
            mikrotikId: disableServerId,
          };
          actionDescription = `Disabled PPPoE service: ${serverName}`;
        } catch (disableError) {
          console.error('[PPPoE] Disable failed:', disableError);
          throw disableError;
        }
        break;

      case 'status':
        try {
          console.log(`[PPPoE] Getting status for service: ${serverName}`);

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

          // CRITICAL: Extract and cache mikrotikId
          const statusServerId = statusServer['.id'];

          // Update cache in database if not present or different
          if (!cachedMikrotikId || cachedMikrotikId !== statusServerId) {
            await db.collection('routers').updateOne(
              { _id: new ObjectId(routerId) },
              {
                $set: {
                  'configuration.pppoe.servers': [
                    {
                      serviceName: serverName,
                      mikrotikId: statusServerId,
                      interface: statusServer.interface,
                      lastUpdated: new Date(),
                    },
                  ],
                  updatedAt: new Date(),
                },
              }
            );
            console.log(`[PPPoE] Updated cached server mikrotikId: ${statusServerId}`);
          }

          // Get active PPPoE users (WITH .id for session management)
          const activeUsers = await MikroTikService.getActivePPPoEUsers(connectionConfig);

          // Get PPP secrets (configured users) WITH .id
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
              mikrotikId: statusServerId, // ← CRITICAL: Include in response
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
              sessionId: user['.id'], // Already includes .id - good!
            })),
            // CRITICAL: Include configured secrets with mikrotikId
            configuredSecrets: Array.isArray(secrets)
              ? secrets.map((secret: any) => ({
                  name: secret.name,
                  profile: secret.profile,
                  localAddress: secret['local-address'],
                  remoteAddress: secret['remote-address'],
                  disabled: secret.disabled === 'true',
                  mikrotikId: secret['.id'], // ← CRITICAL: PPP secret .id
                }))
              : [],
          };
          actionDescription = `Retrieved PPPoE service status: ${serverName}`;
        } catch (statusError) {
          console.error('[PPPoE] Status fetch failed:', statusError);
          throw statusError;
        }
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
    console.error('[PPPoE] Error controlling service:', error);
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

    // Return PPPoE configuration from database (including cached mikrotikIds)
    return NextResponse.json({
      success: true,
      pppoe: router.configuration?.pppoe || {},
      enabled: router.configuration?.pppoe?.enabled || false,
      // Include cached server info with mikrotikIds
      servers: router.configuration?.pppoe?.servers || [],
    });
  } catch (error) {
    console.error('[PPPoE] Error fetching info:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch PPPoE information',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}