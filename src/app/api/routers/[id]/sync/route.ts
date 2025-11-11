// src/app/api/routers/[id]/sync/route.ts - Enhanced Router Sync with MikroTik .id Validation
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

interface DriftItem {
  configType: string;
  configName: string;
  issue: string;
  mikrotikId?: string;
  actualMikrotikId?: string;
}

interface UnmanagedResource {
  configType: string;
  name: string;
  mikrotikId: string;
  canAdopt: boolean;
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

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Fetch router and verify ownership
    const router = await db.collection('routers').findOne({
      _id: new ObjectId(routerId),
      userId: new ObjectId(userId),
    });

    if (!router) {
      return NextResponse.json(
        { error: 'Router not found or access denied' },
        { status: 404 }
      );
    }

    // UniFi routers are synced differently (via controller API)
    if (router.routerType === 'unifi') {
      return NextResponse.json({
        success: true,
        message: 'UniFi routers sync from the controller automatically. Status updated.',
        router: {
          id: routerId,
          name: router.routerInfo?.name,
          status: router.health?.status || 'offline',
          lastSeen: router.health?.lastSeen || new Date(),
        },
      });
    }

    // Prepare connection config (MikroTik only)
    const connectionConfig = getRouterConnectionConfig(router, {
      forceLocal: false,
      forceVPN: true,
    });

    // Test connection and get system resource
    const connectionResult = await MikroTikService.testConnection(connectionConfig);

    if (!connectionResult.success) {
      // Update router status to offline
      await db.collection('routers').updateOne(
        { _id: new ObjectId(routerId) },
        {
          $set: {
            'health.status': 'offline',
            'health.lastSeen': new Date(),
            updatedAt: new Date(),
          },
        }
      );

      return NextResponse.json({
        success: false,
        error: connectionResult.error || 'Failed to connect to router',
        router: {
          status: 'offline',
          lastSeen: new Date(),
        },
      });
    }

    // Get router info
    const routerInfo = connectionResult.data?.routerInfo;

    // Initialize update object
    const updateFields: any = {
      'health.status': 'online',
      'health.lastSeen': new Date(),
      'health.uptime': MikroTikService.parseUptimeToSeconds(routerInfo?.uptime || '0s'),
      'health.cpuUsage': routerInfo?.cpuLoad || 0,
      'health.memoryUsage': routerInfo?.memoryUsage || 0,
      'routerInfo.firmwareVersion': routerInfo?.version || router.routerInfo?.firmwareVersion,
      updatedAt: new Date(),
    };

    // Sync results for response
    const syncResults: any = {
      health: true,
      activeUsers: false,
      networkInterfaces: false,
      bridgePorts: false,
      ipPools: false,
      dhcpStatus: false,
      hotspotServer: false,
      wanStatus: false,
      internetConnectivity: false,
      configValidation: false,
    };

    // Drift detection results
    const drifts: DriftItem[] = [];
    const unmanagedResources: UnmanagedResource[] = [];

    // ============================================
    // 1. Get active users count
    // ============================================
    let connectedUsers = 0;
    try {
      const activeHotspotUsers = await MikroTikService.getActiveHotspotUsers(connectionConfig);
      const activePPPoEUsers = await MikroTikService.getActivePPPoEUsers(connectionConfig);
      connectedUsers = activeHotspotUsers.length + activePPPoEUsers.length;

      updateFields['health.connectedUsers'] = connectedUsers;
      updateFields['statistics.activeUsers'] = connectedUsers;
      syncResults.activeUsers = true;
    } catch (error) {
      console.error('Failed to get active users:', error);
    }

    // ============================================
    // 2. Sync Network Interfaces
    // ============================================
    try {
      const interfaces = await MikroTikService.getInterfaces(connectionConfig);

      const networkInterfaces = interfaces.map((iface: any) => ({
        name: iface.name,
        type: iface.type || 'unknown',
        macAddress: iface['mac-address'] || '',
        status: iface.disabled === 'true' ? 'disabled' : 'running',
        rxBytes: parseInt(iface['rx-byte'] || '0'),
        txBytes: parseInt(iface['tx-byte'] || '0'),
        disabled: iface.disabled === 'true',
        mikrotikId: iface['.id'] || '',
      }));

      updateFields['networkInterfaces'] = networkInterfaces;
      syncResults.networkInterfaces = true;
    } catch (error) {
      console.error('Failed to sync network interfaces:', error);
    }

    // ============================================
    // 3. Sync Bridge Ports
    // ============================================
    try {
      const bridgePorts = await MikroTikService.getBridgePorts(connectionConfig);

      const bridgePortsData = bridgePorts.map((port: any) => ({
        interface: port.interface,
        bridge: port.bridge,
        status: port.disabled === 'true' ? 'inactive' : 'active',
        mikrotikId: port['.id'] || '',
        lastSynced: new Date(),
      }));

      updateFields['configuration.network.bridgePorts'] = bridgePortsData;
      syncResults.bridgePorts = true;
    } catch (error) {
      console.error('Failed to sync bridge ports:', error);
    }

    // ============================================
    // 4. Sync IP Pool Usage (Hotspot)
    // ============================================
    if (router.configuration?.hotspot?.enabled) {
      try {
        const hotspotPoolName = 'hotspot-pool';
        const poolDetails = await MikroTikService.getIPPoolDetails(
          connectionConfig,
          hotspotPoolName
        );

        if (poolDetails && poolDetails.usage) {
          const total = poolDetails.usage.total || 0;
          const used = poolDetails.usage.used || 0;
          const available = poolDetails.usage.available || 0;
          const percentage = total > 0 ? Math.round((used / total) * 100) : 0;

          updateFields['configuration.hotspot.ipPoolUsage'] = {
            total,
            used,
            available,
            percentage,
            lastSynced: new Date(),
          };
          syncResults.ipPools = true;
        }
      } catch (error) {
        console.error('Failed to sync hotspot IP pool usage:', error);
      }
    }

    // ============================================
    // 5. Sync IP Pool Usage (PPPoE)
    // ============================================
    if (router.configuration?.pppoe?.enabled) {
      try {
        const pppoePoolName = 'pppoe-pool';
        const poolDetails = await MikroTikService.getIPPoolDetails(
          connectionConfig,
          pppoePoolName
        );

        if (poolDetails && poolDetails.usage) {
          const total = poolDetails.usage.total || 0;
          const used = poolDetails.usage.used || 0;
          const available = poolDetails.usage.available || 0;
          const percentage = total > 0 ? Math.round((used / total) * 100) : 0;

          updateFields['configuration.pppoe.ipPoolUsage'] = {
            total,
            used,
            available,
            percentage,
            lastSynced: new Date(),
          };
        }
      } catch (error) {
        console.error('Failed to sync PPPoE IP pool usage:', error);
      }
    }

    // ============================================
    // 6. Sync DHCP Server Status
    // ============================================
    try {
      const dhcpServers = await MikroTikService.getDHCPServers(connectionConfig);
      const dhcpLeases = await MikroTikService.getDHCPLeases(connectionConfig);

      // Hotspot DHCP
      const hotspotServer = dhcpServers.find(
        (s: any) => s.name === 'hotspot-dhcp' || s.interface === 'bridge'
      );

      if (hotspotServer) {
        const hotspotLeases = dhcpLeases.filter(
          (l: any) => l['active-server'] === hotspotServer.name
        );

        updateFields['dhcpStatus.hotspot'] = {
          serverName: hotspotServer.name,
          isActive: hotspotServer.disabled !== 'true',
          totalLeases: dhcpLeases.length,
          activeLeases: hotspotLeases.length,
          mikrotikId: hotspotServer['.id'] || '',
          lastSynced: new Date(),
        };
      }

      // LAN DHCP
      const lanServer = dhcpServers.find((s: any) => s.name === 'defconf' || s.name === 'dhcp1');

      if (lanServer) {
        const lanLeases = dhcpLeases.filter((l: any) => l['active-server'] === lanServer.name);

        updateFields['dhcpStatus.lan'] = {
          serverName: lanServer.name,
          isActive: lanServer.disabled !== 'true',
          totalLeases: dhcpLeases.length,
          activeLeases: lanLeases.length,
          mikrotikId: lanServer['.id'] || '',
          lastSynced: new Date(),
        };
      }

      syncResults.dhcpStatus = true;
    } catch (error) {
      console.error('Failed to sync DHCP status:', error);
    }

    // ============================================
    // 7. Sync Hotspot Server Status
    // ============================================
    if (router.configuration?.hotspot?.enabled) {
      try {
        const hotspotServers = await MikroTikService.getHotspotServers(connectionConfig);

        const hotspotServer = hotspotServers.find(
          (s: any) => s.name === 'hotspot1' || s.interface === 'bridge'
        );

        if (hotspotServer) {
          updateFields['configuration.hotspot.serverStatus'] = {
            isRunning: hotspotServer.disabled !== 'true',
            disabled: hotspotServer.disabled === 'true',
            keepaliveTimeout: hotspotServer['keepalive-timeout'] || '2m',
            idleTimeout: hotspotServer['idle-timeout'] || '5m',
            mikrotikId: hotspotServer['.id'] || '',
            lastSynced: new Date(),
          };
          syncResults.hotspotServer = true;
        }
      } catch (error) {
        console.error('Failed to sync hotspot server status:', error);
      }
    }

    // ============================================
    // 8. Sync WAN Status
    // ============================================
    try {
      const dhcpClients = await MikroTikService.makeRequest(
        connectionConfig,
        '/rest/ip/dhcp-client',
        'GET'
      );

      const wanInterface = router.configuration?.network?.wanInterface || 'ether1';
      const wanClient = Array.isArray(dhcpClients)
        ? dhcpClients.find((client: any) => client.interface === wanInterface)
        : null;

      if (wanClient) {
        updateFields['configuration.network.wanStatus'] = {
          isConnected: wanClient.status === 'bound',
          externalIP: wanClient.address || '',
          gateway: wanClient.gateway || '',
          dnsServers: wanClient['dhcp-server']?.split(',') || [],
          mikrotikId: wanClient['.id'] || '',
          lastConnected: new Date(),
        };
        syncResults.wanStatus = true;
      }
    } catch (error) {
      console.error('Failed to sync WAN status:', error);
    }

    // ============================================
    // 9. Router connectivity already verified
    // ============================================
    updateFields['health.internetConnectivity'] = {
      isConnected: true,
      lastChecked: new Date(),
    };
    syncResults.internetConnectivity = true;

    // ============================================
    // 10. VALIDATE DEPLOYED CONFIGURATIONS WITH .ID
    // ============================================
    try {
      // Validate IP Pools
      if (router.configuration?.deployedConfigs?.ipPools) {
        const actualPools = await MikroTikService.makeRequest(
          connectionConfig,
          '/rest/ip/pool',
          'GET'
        );

        for (const deployedPool of router.configuration.deployedConfigs.ipPools) {
          let actualPool = null;

          // Try to find by .id first (most reliable)
          if (deployedPool.mikrotikId && Array.isArray(actualPools)) {
            actualPool = actualPools.find((p: any) => p['.id'] === deployedPool.mikrotikId);
          }

          // Fallback to name matching
          if (!actualPool && Array.isArray(actualPools)) {
            actualPool = actualPools.find((p: any) => p.name === deployedPool.name);

            // If found by name but .id differs, it was recreated
            if (actualPool && actualPool['.id'] !== deployedPool.mikrotikId) {
              drifts.push({
                configType: 'ip-pool',
                configName: deployedPool.name,
                issue: 'Resource was deleted and recreated (different .id)',
                mikrotikId: deployedPool.mikrotikId,
                actualMikrotikId: actualPool['.id'],
              });

              // Update with new .id
              await db.collection('routers').updateOne(
                {
                  _id: new ObjectId(routerId),
                  'configuration.deployedConfigs.ipPools.name': deployedPool.name,
                },
                {
                  $set: {
                    'configuration.deployedConfigs.ipPools.$.mikrotikId': actualPool['.id'],
                    'configuration.deployedConfigs.ipPools.$.lastChecked': new Date(),
                    'configuration.deployedConfigs.ipPools.$.status': 'drift',
                  },
                }
              );
            }
          }

          if (!actualPool) {
            drifts.push({
              configType: 'ip-pool',
              configName: deployedPool.name,
              issue: deployedPool.mikrotikId
                ? 'Configuration missing on router (was deleted)'
                : 'Configuration missing on router',
              mikrotikId: deployedPool.mikrotikId,
            });

            // Mark as error status
            await db.collection('routers').updateOne(
              {
                _id: new ObjectId(routerId),
                'configuration.deployedConfigs.ipPools.name': deployedPool.name,
              },
              {
                $set: {
                  'configuration.deployedConfigs.ipPools.$.lastChecked': new Date(),
                  'configuration.deployedConfigs.ipPools.$.status': 'error',
                },
              }
            );
          } else if (actualPool['.id'] === deployedPool.mikrotikId) {
            // Update lastChecked for valid configs
            await db.collection('routers').updateOne(
              {
                _id: new ObjectId(routerId),
                'configuration.deployedConfigs.ipPools.name': deployedPool.name,
              },
              {
                $set: {
                  'configuration.deployedConfigs.ipPools.$.lastChecked': new Date(),
                  'configuration.deployedConfigs.ipPools.$.status': 'active',
                },
              }
            );
          }
        }

        // Find unmanaged IP pools
        if (Array.isArray(actualPools)) {
          const managedIds = router.configuration.deployedConfigs.ipPools
            .map((p: any) => p.mikrotikId)
            .filter(Boolean);

          for (const pool of actualPools) {
            if (!managedIds.includes(pool['.id'])) {
              unmanagedResources.push({
                configType: 'ip-pool',
                name: pool.name,
                mikrotikId: pool['.id'],
                canAdopt: true,
              });
            }
          }
        }
      }

      // Validate Hotspot Servers
      if (router.configuration?.deployedConfigs?.hotspotServers) {
        const actualHotspots = await MikroTikService.makeRequest(
          connectionConfig,
          '/rest/ip/hotspot',
          'GET'
        );

        for (const deployedHotspot of router.configuration.deployedConfigs.hotspotServers) {
          let actualHotspot = null;

          // Try to find by .id first
          if (deployedHotspot.mikrotikId && Array.isArray(actualHotspots)) {
            actualHotspot = actualHotspots.find(
              (h: any) => h['.id'] === deployedHotspot.mikrotikId
            );
          }

          // Fallback to name matching
          if (!actualHotspot && Array.isArray(actualHotspots)) {
            actualHotspot = actualHotspots.find((h: any) => h.name === deployedHotspot.name);

            if (actualHotspot && actualHotspot['.id'] !== deployedHotspot.mikrotikId) {
              drifts.push({
                configType: 'hotspot-server',
                configName: deployedHotspot.name,
                issue: 'Resource was deleted and recreated (different .id)',
                mikrotikId: deployedHotspot.mikrotikId,
                actualMikrotikId: actualHotspot['.id'],
              });

              // Update with new .id
              await db.collection('routers').updateOne(
                {
                  _id: new ObjectId(routerId),
                  'configuration.deployedConfigs.hotspotServers.name': deployedHotspot.name,
                },
                {
                  $set: {
                    'configuration.deployedConfigs.hotspotServers.$.mikrotikId':
                      actualHotspot['.id'],
                    'configuration.deployedConfigs.hotspotServers.$.lastChecked': new Date(),
                    'configuration.deployedConfigs.hotspotServers.$.status': 'drift',
                  },
                }
              );
            }
          }

          if (!actualHotspot) {
            drifts.push({
              configType: 'hotspot-server',
              configName: deployedHotspot.name,
              issue: deployedHotspot.mikrotikId
                ? 'Configuration missing on router (was deleted)'
                : 'Configuration missing on router',
              mikrotikId: deployedHotspot.mikrotikId,
            });

            await db.collection('routers').updateOne(
              {
                _id: new ObjectId(routerId),
                'configuration.deployedConfigs.hotspotServers.name': deployedHotspot.name,
              },
              {
                $set: {
                  'configuration.deployedConfigs.hotspotServers.$.lastChecked': new Date(),
                  'configuration.deployedConfigs.hotspotServers.$.status': 'error',
                },
              }
            );
          } else if (actualHotspot['.id'] === deployedHotspot.mikrotikId) {
            await db.collection('routers').updateOne(
              {
                _id: new ObjectId(routerId),
                'configuration.deployedConfigs.hotspotServers.name': deployedHotspot.name,
              },
              {
                $set: {
                  'configuration.deployedConfigs.hotspotServers.$.lastChecked': new Date(),
                  'configuration.deployedConfigs.hotspotServers.$.status': 'active',
                },
              }
            );
          }
        }

        // Find unmanaged hotspot servers
        if (Array.isArray(actualHotspots)) {
          const managedIds = router.configuration.deployedConfigs.hotspotServers
            .map((h: any) => h.mikrotikId)
            .filter(Boolean);

          for (const hotspot of actualHotspots) {
            if (!managedIds.includes(hotspot['.id'])) {
              unmanagedResources.push({
                configType: 'hotspot-server',
                name: hotspot.name,
                mikrotikId: hotspot['.id'],
                canAdopt: true,
              });
            }
          }
        }
      }

      // Validate DHCP Servers
      if (router.configuration?.deployedConfigs?.dhcpServers) {
        const actualDhcpServers = await MikroTikService.makeRequest(
          connectionConfig,
          '/rest/ip/dhcp-server',
          'GET'
        );

        for (const deployedDhcp of router.configuration.deployedConfigs.dhcpServers) {
          let actualDhcp = null;

          if (deployedDhcp.mikrotikId && Array.isArray(actualDhcpServers)) {
            actualDhcp = actualDhcpServers.find((d: any) => d['.id'] === deployedDhcp.mikrotikId);
          }

          if (!actualDhcp && Array.isArray(actualDhcpServers)) {
            actualDhcp = actualDhcpServers.find((d: any) => d.name === deployedDhcp.name);

            if (actualDhcp && actualDhcp['.id'] !== deployedDhcp.mikrotikId) {
              drifts.push({
                configType: 'dhcp-server',
                configName: deployedDhcp.name,
                issue: 'Resource was deleted and recreated (different .id)',
                mikrotikId: deployedDhcp.mikrotikId,
                actualMikrotikId: actualDhcp['.id'],
              });

              await db.collection('routers').updateOne(
                {
                  _id: new ObjectId(routerId),
                  'configuration.deployedConfigs.dhcpServers.name': deployedDhcp.name,
                },
                {
                  $set: {
                    'configuration.deployedConfigs.dhcpServers.$.mikrotikId': actualDhcp['.id'],
                    'configuration.deployedConfigs.dhcpServers.$.lastChecked': new Date(),
                    'configuration.deployedConfigs.dhcpServers.$.status': 'drift',
                  },
                }
              );
            }
          }

          if (!actualDhcp) {
            drifts.push({
              configType: 'dhcp-server',
              configName: deployedDhcp.name,
              issue: 'Configuration missing on router',
              mikrotikId: deployedDhcp.mikrotikId,
            });

            await db.collection('routers').updateOne(
              {
                _id: new ObjectId(routerId),
                'configuration.deployedConfigs.dhcpServers.name': deployedDhcp.name,
              },
              {
                $set: {
                  'configuration.deployedConfigs.dhcpServers.$.lastChecked': new Date(),
                  'configuration.deployedConfigs.dhcpServers.$.status': 'error',
                },
              }
            );
          } else if (actualDhcp['.id'] === deployedDhcp.mikrotikId) {
            await db.collection('routers').updateOne(
              {
                _id: new ObjectId(routerId),
                'configuration.deployedConfigs.dhcpServers.name': deployedDhcp.name,
              },
              {
                $set: {
                  'configuration.deployedConfigs.dhcpServers.$.lastChecked': new Date(),
                  'configuration.deployedConfigs.dhcpServers.$.status': 'active',
                },
              }
            );
          }
        }
      }

      // Validate NAT Rules
      if (router.configuration?.deployedConfigs?.natRules) {
        const actualNatRules = await MikroTikService.makeRequest(
          connectionConfig,
          '/rest/ip/firewall/nat',
          'GET'
        );

        for (const deployedNat of router.configuration.deployedConfigs.natRules) {
          let actualNat = null;

          if (deployedNat.mikrotikId && Array.isArray(actualNatRules)) {
            actualNat = actualNatRules.find((n: any) => n['.id'] === deployedNat.mikrotikId);
          }

          if (!actualNat) {
            drifts.push({
              configType: 'nat-rule',
              configName: deployedNat.name,
              issue: 'NAT rule missing on router',
              mikrotikId: deployedNat.mikrotikId,
            });

            await db.collection('routers').updateOne(
              {
                _id: new ObjectId(routerId),
                'configuration.deployedConfigs.natRules.name': deployedNat.name,
              },
              {
                $set: {
                  'configuration.deployedConfigs.natRules.$.lastChecked': new Date(),
                  'configuration.deployedConfigs.natRules.$.status': 'error',
                },
              }
            );
          } else {
            await db.collection('routers').updateOne(
              {
                _id: new ObjectId(routerId),
                'configuration.deployedConfigs.natRules.name': deployedNat.name,
              },
              {
                $set: {
                  'configuration.deployedConfigs.natRules.$.lastChecked': new Date(),
                  'configuration.deployedConfigs.natRules.$.status': 'active',
                },
              }
            );
          }
        }
      }

      // Update last synced timestamp
      await db.collection('routers').updateOne(
        { _id: new ObjectId(routerId) },
        {
          $set: {
            'configurationStatus.lastSyncedAt': new Date(),
          },
        }
      );

      syncResults.configValidation = true;
    } catch (error) {
      console.error('Failed to validate deployed configurations:', error);
    }

    // ============================================
    // Update database with all synced data
    // ============================================
    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      { $set: updateFields }
    );

    // ============================================
    // Log audit entry
    // ============================================
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
        resource: 'router_sync',
        resourceId: new ObjectId(routerId),
        description: `Comprehensive router sync for: ${router.routerInfo?.name}`,
      },
      changes: {
        before: {},
        after: syncResults,
        fields: Object.keys(syncResults).filter((k) => syncResults[k]),
      },
      metadata: {
        sessionId: '',
        correlationId: `sync-router-${routerId}`,
        source: 'web',
        severity: drifts.length > 0 ? 'warning' : 'info',
        driftsDetected: drifts.length,
        unmanagedResourcesFound: unmanagedResources.length,
      },
      timestamp: new Date(),
    });

    // ============================================
    // Return comprehensive sync results
    // ============================================
    return NextResponse.json({
      success: true,
      message: drifts.length > 0
        ? `Router synced with ${drifts.length} configuration drift(s) detected`
        : 'Router synced successfully',
      syncResults,
      router: {
        status: 'online',
        lastSeen: new Date(),
        uptime: MikroTikService.parseUptimeToSeconds(routerInfo?.uptime || '0s'),
        cpuUsage: routerInfo?.cpuLoad || 0,
        memoryUsage: routerInfo?.memoryUsage || 0,
        connectedUsers,
        firmwareVersion: routerInfo?.version,
      },
      configValidation: {
        hasDrifts: drifts.length > 0,
        driftCount: drifts.length,
        drifts: drifts,
        hasUnmanagedResources: unmanagedResources.length > 0,
        unmanagedResourceCount: unmanagedResources.length,
        unmanagedResources: unmanagedResources,
      },
    });
  } catch (error) {
    console.error('Router Sync API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync router',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}