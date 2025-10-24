// lib/services/vpn-monitor.ts
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================
// VPN MONITORING SERVICE
// ============================================

export class VPNMonitor {
  private static readonly VPN_SSH_HOST = process.env.VPN_SSH_HOST || 'root@vpn.qebol.co.ke';
  private static readonly VPN_SSH_KEY = process.env.VPN_SSH_KEY || '';
  private static readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private static readonly STALE_THRESHOLD = 10 * 60 * 1000; // 10 minutes

  /**
   * Check all VPN tunnels health
   */
  static async checkAllTunnels(): Promise<{
    total: number;
    connected: number;
    disconnected: number;
    stale: number;
    checked: number;
  }> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

      const tunnels = await db.collection('vpn_tunnels').find({}).toArray();

      const stats = {
        total: tunnels.length,
        connected: 0,
        disconnected: 0,
        stale: 0,
        checked: 0,
      };

      // Get WireGuard status from server
      const serverStatus = await this.getServerWireGuardStatus();

      for (const tunnel of tunnels) {
        stats.checked++;

        // Check if peer is in server's active peers
        const peerStatus = serverStatus.peers.find(
          (p: any) => p.publicKey === tunnel.vpnConfig.clientPublicKey
        );

        if (peerStatus) {
          // Peer exists on server
          const lastHandshake = peerStatus.lastHandshake 
            ? new Date(peerStatus.lastHandshake * 1000) 
            : null;

          const isStale = lastHandshake 
            ? Date.now() - lastHandshake.getTime() > this.STALE_THRESHOLD
            : true;

          const newStatus = isStale ? 'disconnected' : 'connected';

          // Update tunnel status
          await db.collection('vpn_tunnels').updateOne(
            { _id: tunnel._id },
            {
              $set: {
                'connection.status': newStatus,
                'connection.lastHandshake': lastHandshake,
                'connection.bytesReceived': peerStatus.bytesReceived || 0,
                'connection.bytesSent': peerStatus.bytesSent || 0,
                'connection.lastSeen': new Date(),
                updatedAt: new Date(),
              },
            }
          );

          // Update router status
          await db.collection('routers').updateOne(
            { _id: tunnel.routerId },
            {
              $set: {
                'vpnTunnel.status': newStatus,
                'vpnTunnel.lastHandshake': lastHandshake,
                'health.lastSeen': newStatus === 'connected' ? new Date() : tunnel.connection?.lastSeen,
                updatedAt: new Date(),
              },
            }
          );

          if (newStatus === 'connected') {
            stats.connected++;
          } else {
            stats.stale++;
          }

        } else {
          // Peer not found on server
          stats.disconnected++;

          await db.collection('vpn_tunnels').updateOne(
            { _id: tunnel._id },
            {
              $set: {
                'connection.status': 'disconnected',
                updatedAt: new Date(),
              },
            }
          );

          await db.collection('routers').updateOne(
            { _id: tunnel.routerId },
            {
              $set: {
                'vpnTunnel.status': 'disconnected',
                updatedAt: new Date(),
              },
            }
          );
        }
      }

      console.log(`[VPN Monitor] Health check complete:`, stats);
      return stats;

    } catch (error) {
      console.error('[VPN Monitor] Health check failed:', error);
      throw error;
    }
  }

  /**
   * Get WireGuard status from server
   */
  private static async getServerWireGuardStatus(): Promise<{
    interface: string;
    publicKey: string;
    listeningPort: number;
    peers: Array<{
      publicKey: string;
      endpoint?: string;
      allowedIPs: string[];
      latestHandshake?: number;
      bytesReceived: number;
      bytesSent: number;
      lastHandshake?: number;
    }>;
  }> {
    try {
      const sshKeyOption = this.VPN_SSH_KEY ? `-i ${this.VPN_SSH_KEY}` : '';
      const command = 'sudo wg show wg0 dump';

      const { stdout } = await execAsync(
        `ssh ${sshKeyOption} ${this.VPN_SSH_HOST} '${command}'`
      );

      const lines = stdout.trim().split('\n');
      const [interfaceLine, ...peerLines] = lines;

      const [privateKey, publicKey, listeningPort] = interfaceLine.split('\t');

      const peers = peerLines.map(line => {
        const [
          publicKey,
          presharedKey,
          endpoint,
          allowedIPs,
          latestHandshake,
          bytesReceived,
          bytesSent,
          keepalive,
        ] = line.split('\t');

        return {
          publicKey,
          endpoint: endpoint !== '(none)' ? endpoint : undefined,
          allowedIPs: allowedIPs.split(','),
          lastHandshake: latestHandshake !== '0' ? parseInt(latestHandshake) : undefined,
          bytesReceived: parseInt(bytesReceived) || 0,
          bytesSent: parseInt(bytesSent) || 0,
        };
      });

      return {
        interface: 'wg0',
        publicKey,
        listeningPort: parseInt(listeningPort),
        peers,
      };

    } catch (error) {
      console.error('[VPN Monitor] Failed to get server status:', error);
      throw error;
    }
  }

  /**
   * Check specific router VPN status
   */
  static async checkRouterStatus(routerId: string): Promise<{
    status: string;
    lastSeen: Date | null;
    connected: boolean;
    vpnIP?: string;
    bytesReceived?: number;
    bytesSent?: number;
  }> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

      const tunnel = await db.collection('vpn_tunnels').findOne({
        routerId: new ObjectId(routerId),
      });

      if (!tunnel) {
        return {
          status: 'not_found',
          lastSeen: null,
          connected: false,
        };
      }

      const serverStatus = await this.getServerWireGuardStatus();
      const peerStatus = serverStatus.peers.find(
        p => p.publicKey === tunnel.vpnConfig.clientPublicKey
      );

      if (peerStatus && peerStatus.lastHandshake) {
        const lastHandshake = new Date(peerStatus.lastHandshake * 1000);
        const timeSinceHandshake = Date.now() - lastHandshake.getTime();
        const connected = timeSinceHandshake < this.STALE_THRESHOLD;

        return {
          status: connected ? 'connected' : 'stale',
          lastSeen: lastHandshake,
          connected,
          vpnIP: tunnel.vpnConfig.assignedIP,
          bytesReceived: peerStatus.bytesReceived,
          bytesSent: peerStatus.bytesSent,
        };
      }

      return {
        status: 'disconnected',
        lastSeen: tunnel.connection?.lastSeen || null,
        connected: false,
        vpnIP: tunnel.vpnConfig.assignedIP,
      };

    } catch (error) {
      console.error('[VPN Monitor] Failed to check router status:', error);
      return {
        status: 'error',
        lastSeen: null,
        connected: false,
      };
    }
  }

  /**
   * Get VPN statistics
   */
  static async getStatistics(): Promise<{
    totalTunnels: number;
    activeTunnels: number;
    inactiveTunnels: number;
    failedTunnels: number;
    ipPoolUsage: number;
    totalCapacity: number;
    averageLatency?: number;
  }> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

      const [totalTunnels, activeTunnels, inactiveTunnels, failedTunnels, ipPool] = 
        await Promise.all([
          db.collection('vpn_tunnels').countDocuments(),
          db.collection('vpn_tunnels').countDocuments({ 'connection.status': 'connected' }),
          db.collection('vpn_tunnels').countDocuments({ 'connection.status': 'disconnected' }),
          db.collection('vpn_tunnels').countDocuments({ 'connection.status': 'failed' }),
          db.collection('vpn_ip_pool').findOne({ network: '10.99.0.0/16' }),
        ]);

      return {
        totalTunnels,
        activeTunnels,
        inactiveTunnels,
        failedTunnels,
        ipPoolUsage: ipPool?.usedCount || 0,
        totalCapacity: ipPool?.totalCapacity || 65534,
      };

    } catch (error) {
      console.error('[VPN Monitor] Failed to get statistics:', error);
      throw error;
    }
  }

  /**
   * Attempt to reconnect stale tunnels
   */
  static async reconnectStaleTunnels(): Promise<{
    attempted: number;
    succeeded: number;
    failed: number;
  }> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

      const staleTunnels = await db.collection('vpn_tunnels').find({
        'connection.status': 'disconnected',
      }).toArray();

      const stats = {
        attempted: staleTunnels.length,
        succeeded: 0,
        failed: 0,
      };

      for (const tunnel of staleTunnels) {
        try {
          // Ping router via VPN IP
          const vpnIP = tunnel.vpnConfig.assignedIP;
          const sshKeyOption = this.VPN_SSH_KEY ? `-i ${this.VPN_SSH_KEY}` : '';
          const pingCommand = `ping -c 2 -W 2 ${vpnIP}`;

          await execAsync(`ssh ${sshKeyOption} ${this.VPN_SSH_HOST} '${pingCommand}'`);

          // Ping successful - update status
          await db.collection('vpn_tunnels').updateOne(
            { _id: tunnel._id },
            {
              $set: {
                'connection.status': 'connected',
                'connection.lastSeen': new Date(),
                updatedAt: new Date(),
              },
            }
          );

          await db.collection('routers').updateOne(
            { _id: tunnel.routerId },
            {
              $set: {
                'vpnTunnel.status': 'connected',
                'health.lastSeen': new Date(),
                'health.status': 'online',
                updatedAt: new Date(),
              },
            }
          );

          stats.succeeded++;
          console.log(`[VPN Monitor] ✓ Reconnected router: ${vpnIP}`);

        } catch (error) {
          stats.failed++;
          console.log(`[VPN Monitor] ✗ Failed to reconnect: ${tunnel.vpnConfig.assignedIP}`);
        }
      }

      console.log(`[VPN Monitor] Reconnection attempt complete:`, stats);
      return stats;

    } catch (error) {
      console.error('[VPN Monitor] Reconnection attempt failed:', error);
      throw error;
    }
  }

  /**
   * Send alerts for disconnected routers
   */
  static async checkAndAlert(): Promise<{
    alertsSent: number;
    routers: Array<{ name: string; vpnIP: string; downtime: number }>;
  }> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const disconnectedTunnels = await db.collection('vpn_tunnels').find({
        'connection.status': 'disconnected',
        'connection.lastSeen': { $lt: oneHourAgo },
      }).toArray();

      const alerts = [];

      for (const tunnel of disconnectedTunnels) {
        const router = await db.collection('routers').findOne({
          _id: tunnel.routerId,
        });

        if (router) {
          const downtime = Date.now() - new Date(tunnel.connection.lastSeen).getTime();

          alerts.push({
            name: router.routerInfo?.name || 'Unknown Router',
            vpnIP: tunnel.vpnConfig.assignedIP,
            downtime: Math.floor(downtime / (60 * 1000)), // minutes
          });

          // TODO: Send notification to customer
          console.log(
            `[VPN Monitor] ⚠ Alert: ${router.routerInfo?.name} disconnected for ${Math.floor(downtime / (60 * 1000))} minutes`
          );
        }
      }

      return {
        alertsSent: alerts.length,
        routers: alerts,
      };

    } catch (error) {
      console.error('[VPN Monitor] Alert check failed:', error);
      throw error;
    }
  }

  /**
   * Start continuous monitoring (call this once on server startup)
   */
  static startMonitoring(): NodeJS.Timeout {
    console.log('[VPN Monitor] Starting continuous monitoring...');

    // Initial check
    this.checkAllTunnels().catch(console.error);

    // Schedule regular checks
    return setInterval(() => {
      this.checkAllTunnels()
        .then(() => this.reconnectStaleTunnels())
        .then(() => this.checkAndAlert())
        .catch(console.error);
    }, this.HEALTH_CHECK_INTERVAL);
  }
}

export default VPNMonitor;