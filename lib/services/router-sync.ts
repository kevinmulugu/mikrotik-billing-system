// lib/services/router-sync.ts - Router Synchronization Service

import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { MikroTikService } from './mikrotik';

interface RouterDocument {
  _id: ObjectId;
  customerId: ObjectId;
  routerInfo: any;
  connection: any;
  configuration: any;
  health: any;
  statistics: any;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SyncResult {
  success: boolean;
  message: string;
  changes?: string[];
  discrepancies?: Array<{
    field: string;
    expected: any;
    actual: any;
  }> | undefined;
  error?: string | undefined;
}

export class RouterSyncService {
  /**
   * Sync router configuration from MikroTik to MongoDB
   * This fetches the current state from the router and compares with DB
   */
  static async syncRouter(routerId: string): Promise<SyncResult> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

      // Fetch router from database
      const router = await db
        .collection('routers')
        .findOne({ _id: new ObjectId(routerId) });

      if (!router) {
        return {
          success: false,
          message: 'Router not found in database',
        };
      }

      // UniFi routers are synced via controller API, not direct connection
      if (router.routerType === 'unifi') {
        // Test UniFi Controller connectivity
        try {
          const { UniFiService } = await import('./unifi');
          const unifiService = new UniFiService({
            controllerUrl: router.connection?.controllerUrl,
            username: router.connection?.apiUser,
            password: router.connection?.apiPassword,
            site: router.connection?.siteId || 'default',
          });

          // Attempt login to verify connectivity
          const loginSuccess = await unifiService.login();
          
          if (loginSuccess) {
            // Controller is reachable
            await db.collection('routers').updateOne(
              { _id: new ObjectId(routerId) },
              {
                $set: {
                  'health.status': 'online',
                  'health.lastSeen': new Date(),
                  updatedAt: new Date(),
                },
              }
            );

            return {
              success: true,
              message: 'UniFi Controller is online and accessible',
              changes: [],
            };
          } else {
            // Login failed - controller may be offline or credentials invalid
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

            return {
              success: false,
              message: 'Failed to authenticate with UniFi Controller',
              error: 'Authentication failed',
            };
          }
        } catch (error) {
          // Connection error - controller is offline or unreachable
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

          return {
            success: false,
            message: 'UniFi Controller is unreachable',
            error: error instanceof Error ? error.message : 'Connection failed',
          };
        }
      }

      // Prepare connection config (MikroTik only)
      const config = {
        ipAddress: router.connection.ipAddress,
        port: router.connection.port || 8728,
        username: router.connection.apiUser || 'admin',
        password: MikroTikService.decryptPassword(router.connection.apiPassword),
      };

      // Test connection
      const connectionTest = await MikroTikService.testConnection(config);

      if (!connectionTest.success) {
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

        return {
          success: false,
          message: 'Router is offline or unreachable',
          error: connectionTest.error,
        };
      }

      // Router is online, fetch detailed information
      const systemResource = connectionTest.data?.routerInfo;
      const macAddress = await MikroTikService.getRouterMacAddress(config);
      const interfaces = await MikroTikService.getInterfaces(config);

      // Check for configuration discrepancies
      const discrepancies = await this.checkConfigurationDiscrepancies(config, router as RouterDocument);

      // Update router in database with latest info
      const updateData: any = {
        $set: {
          'routerInfo.macAddress': macAddress,
          'routerInfo.firmwareVersion': systemResource?.version || '',
          'health.status': discrepancies.length > 0 ? 'warning' : 'online',
          'health.lastSeen': new Date(),
          'health.uptime': this.parseUptime(systemResource?.uptime || '0s'),
          'health.cpuUsage': systemResource?.cpuLoad || 0,
          'health.memoryUsage': systemResource?.memoryUsage || 0,
          updatedAt: new Date(),
        },
      };

      await db.collection('routers').updateOne(
        { _id: new ObjectId(routerId) },
        updateData
      );

      // Log discrepancies if any
      if (discrepancies.length > 0) {
        await this.logConfigurationDiscrepancies(routerId, discrepancies);
      }

      return {
        success: true,
        message: 'Router synced successfully',
        changes: ['Updated health status', 'Updated firmware version', 'Updated MAC address'],
        discrepancies: discrepancies.length > 0 ? discrepancies : undefined,
      };
    } catch (error) {
      console.error('Router sync error:', error);
      return {
        success: false,
        message: 'Failed to sync router',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check for configuration discrepancies between DB and actual router
   */
  private static async checkConfigurationDiscrepancies(
    config: any,
    router: RouterDocument
  ): Promise<Array<{ field: string; expected: any; actual: any }>> {
    const discrepancies: Array<{ field: string; expected: any; actual: any }> = [];

    try {
      // Check hotspot configuration if enabled
      if (router.configuration.hotspot.enabled) {
        const hotspots = await MikroTikService.makeRequest(config, '/rest/ip/hotspot', 'GET');
        
        if (!Array.isArray(hotspots) || hotspots.length === 0) {
          discrepancies.push({
            field: 'hotspot.enabled',
            expected: true,
            actual: false,
          });
        } else {
          // Check WiFi SSID
          const wireless = await MikroTikService.makeRequest(
            config,
            '/rest/interface/wireless/wlan1',
            'GET'
          );

          if (wireless?.ssid !== router.configuration.hotspot.ssid) {
            discrepancies.push({
              field: 'hotspot.ssid',
              expected: router.configuration.hotspot.ssid,
              actual: wireless?.ssid || 'Not configured',
            });
          }
        }
      }

      // Check PPPoE configuration if enabled
      if (router.configuration.pppoe.enabled) {
        const pppoeServers = await MikroTikService.makeRequest(
          config,
          '/rest/interface/pppoe-server/server',
          'GET'
        );

        if (!Array.isArray(pppoeServers) || pppoeServers.length === 0) {
          discrepancies.push({
            field: 'pppoe.enabled',
            expected: true,
            actual: false,
          });
        }
      }

      // Check NAT rules
      const natRules = await MikroTikService.makeRequest(
        config,
        '/rest/ip/firewall/nat',
        'GET'
      );

      const masqueradeRules = Array.isArray(natRules)
        ? natRules.filter((rule: any) => rule.action === 'masquerade')
        : [];

      if (masqueradeRules.length === 0) {
        discrepancies.push({
          field: 'nat.masquerade',
          expected: 'At least one masquerade rule',
          actual: 'No masquerade rules found',
        });
      }
    } catch (error) {
      console.error('Error checking discrepancies:', error);
    }

    return discrepancies;
  }

  /**
   * Log configuration discrepancies to audit log
   */
  private static async logConfigurationDiscrepancies(
    routerId: string,
    discrepancies: Array<{ field: string; expected: any; actual: any }>
  ): Promise<void> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

      await db.collection('audit_logs').insertOne({
        user: {
          userId: new ObjectId('000000000000000000000000'), // System user
          email: 'system@mikrotik-billing.com',
          role: 'system',
          ipAddress: 'internal',
          userAgent: 'RouterSyncService',
        },
        action: {
          type: 'warning',
          resource: 'router',
          resourceId: new ObjectId(routerId),
          description: `Configuration discrepancies detected on router`,
        },
        changes: {
          before: null,
          after: null,
          fields: discrepancies.map((d) => d.field),
        },
        metadata: {
          sessionId: '',
          correlationId: `sync-${routerId}-${Date.now()}`,
          source: 'system',
          severity: 'warning',
        },
        timestamp: new Date(),
      });

      console.warn(`Configuration discrepancies logged for router ${routerId}:`, discrepancies);
    } catch (error) {
      console.error('Failed to log discrepancies:', error);
    }
  }

  /**
   * Parse uptime string to seconds
   */
  private static parseUptime(uptimeString: string): number {
    try {
      const weeks = uptimeString.match(/(\d+)w/);
      const days = uptimeString.match(/(\d+)d/);
      const hours = uptimeString.match(/(\d+)h/);
      const minutes = uptimeString.match(/(\d+)m/);
      const seconds = uptimeString.match(/(\d+)s/);

      let totalSeconds = 0;
      if (weeks) totalSeconds += parseInt(weeks[1] || '0') * 7 * 24 * 60 * 60;
      if (days) totalSeconds += parseInt(days[1] || '0') * 24 * 60 * 60;
      if (hours) totalSeconds += parseInt(hours[1] || '0') * 60 * 60;
      if (minutes) totalSeconds += parseInt(minutes[1] || '0') * 60;
      if (seconds) totalSeconds += parseInt(seconds[1] || '0');

      return totalSeconds;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get connected users count from router
   */
  static async getConnectedUsersCount(
    config: any
  ): Promise<{ hotspot: number; pppoe: number; total: number }> {
    try {
      // Get active hotspot users
      const hotspotUsers = await MikroTikService.makeRequest(
        config,
        '/rest/ip/hotspot/active',
        'GET'
      );
      const hotspotCount = Array.isArray(hotspotUsers) ? hotspotUsers.length : 0;

      // Get active PPPoE users
      const pppoeUsers = await MikroTikService.makeRequest(
        config,
        '/rest/interface/pppoe-server',
        'GET'
      );
      const pppoeCount = Array.isArray(pppoeUsers)
        ? pppoeUsers.filter((u: any) => u.running === 'true').length
        : 0;

      return {
        hotspot: hotspotCount,
        pppoe: pppoeCount,
        total: hotspotCount + pppoeCount,
      };
    } catch (error) {
      console.error('Failed to get connected users:', error);
      return { hotspot: 0, pppoe: 0, total: 0 };
    }
  }
}

export default RouterSyncService;