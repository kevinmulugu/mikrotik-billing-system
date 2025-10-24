// lib/services/vpn-provisioner.ts
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { MikroTikService } from './mikrotik';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================
// TYPE DEFINITIONS
// ============================================

interface VPNConfig {
  clientPrivateKey: string;
  clientPublicKey: string;
  serverPublicKey: string;
  vpnIP: string;
  endpoint: string;
  allowedIPs: string;
  persistentKeepalive: number;
}

interface VPNProvisioningResult {
  success: boolean;
  vpnConfig?: VPNConfig;
  vpnIP?: string;
  error?: string;
  details?: string;
}

interface RouterVPNData {
  routerId: string;
  customerId: ObjectId;
  localConnection: {
    ipAddress: string;
    port: number;
    username: string;
    password: string;
  };
}

interface WireGuardKeypair {
  privateKey: string;
  publicKey: string;
}

// ============================================
// VPN PROVISIONER SERVICE
// ============================================

export class VPNProvisioner {
  private static readonly VPN_SERVER_ENDPOINT = process.env.VPN_SERVER_ENDPOINT || 'vpn.qebol.co.ke:51820';
  private static readonly VPN_SERVER_PUBLIC_KEY = process.env.VPN_SERVER_PUBLIC_KEY || '';
  private static readonly VPN_SERVER_IP = process.env.VPN_SERVER_IP || '10.99.0.1';
  private static readonly VPN_NETWORK = process.env.VPN_NETWORK || '10.99.0.0/16';
  private static readonly VPN_SSH_HOST = process.env.VPN_SSH_HOST || 'root@vpn.qebol.co.ke';
  private static readonly VPN_SSH_KEY = process.env.VPN_SSH_KEY || '';

  /**
   * Main method: Provision VPN for a router
   */
  static async provisionRouterVPN(data: RouterVPNData): Promise<VPNProvisioningResult> {
    console.log(`[VPN] Starting VPN provisioning for router...`);

    try {
      // Step 1: Generate WireGuard keypair for router
      console.log(`[VPN] Generating WireGuard keypair...`);
      const keypair = await this.generateWireGuardKeypair();
      console.log(`[VPN] ✓ Keypair generated`);

      // Step 2: Get next available VPN IP
      console.log(`[VPN] Allocating VPN IP address...`);
      const vpnIP = await this.getNextAvailableVPNIP();
      console.log(`[VPN] ✓ Assigned VPN IP: ${vpnIP}`);

      // Step 3: Add peer to VPN server
      console.log(`[VPN] Adding peer to VPN server...`);
      const peerAdded = await this.addPeerToServer(keypair.publicKey, vpnIP);
      
      if (!peerAdded) {
        throw new Error('Failed to add peer to VPN server');
      }
      console.log(`[VPN] ✓ Peer added to server`);

      // Step 4: Build WireGuard configuration
      const wgConfig: VPNConfig = {
        clientPrivateKey: keypair.privateKey,
        clientPublicKey: keypair.publicKey,
        serverPublicKey: this.VPN_SERVER_PUBLIC_KEY,
        vpnIP: vpnIP,
        endpoint: this.VPN_SERVER_ENDPOINT,
        allowedIPs: this.VPN_NETWORK,
        persistentKeepalive: 25,
      };

      // Step 5: Push WireGuard config to MikroTik router
      console.log(`[VPN] Configuring WireGuard on router...`);
      const routerConfigured = await this.pushWireGuardToRouter(
        data.localConnection,
        wgConfig
      );

      if (!routerConfigured) {
        // Rollback: Remove peer from server
        await this.rollbackVPN(keypair.publicKey);
        throw new Error('Failed to configure WireGuard on router');
      }
      console.log(`[VPN] ✓ Router configured`);

      // Step 6: Wait for tunnel establishment (30 seconds)
      console.log(`[VPN] Waiting for tunnel to establish...`);
      await this.sleep(30000);

      // Step 7: Test VPN connectivity
      console.log(`[VPN] Testing VPN connectivity...`);
      const isConnected = await this.testVPNConnectivity(vpnIP);

      if (!isConnected) {
        console.warn(`[VPN] ⚠ VPN tunnel not responding, but configuration applied`);
      } else {
        console.log(`[VPN] ✓ VPN tunnel active and responding`);
      }

      // Step 8: Save VPN configuration to database
      await this.saveVPNTunnelToDB({
        routerId: data.routerId,
        customerId: data.customerId,
        vpnConfig: wgConfig,
        status: isConnected ? 'connected' : 'setup',
      });

      console.log(`[VPN] ✅ VPN provisioning completed successfully`);

      return {
        success: true,
        vpnConfig: wgConfig,
        vpnIP: vpnIP,
      };

    } catch (error) {
      console.error(`[VPN] ❌ VPN provisioning failed:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      };
    }
  }

  /**
   * Generate WireGuard keypair
   */
  private static async generateWireGuardKeypair(): Promise<WireGuardKeypair> {
    try {
      // Generate private key
      const { stdout: privateKey } = await execAsync('wg genkey');
      const trimmedPrivateKey = privateKey.trim();

      // Generate public key from private key
      const { stdout: publicKey } = await execAsync(
        `echo "${trimmedPrivateKey}" | wg pubkey`
      );
      const trimmedPublicKey = publicKey.trim();

      return {
        privateKey: trimmedPrivateKey,
        publicKey: trimmedPublicKey,
      };
    } catch (error) {
      console.error('[VPN] Failed to generate keypair:', error);
      throw new Error('Failed to generate WireGuard keypair');
    }
  }

  /**
   * Get next available VPN IP from pool
   */
  private static async getNextAvailableVPNIP(): Promise<string> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

      // Get IP pool document
      const ipPool = await db.collection('vpn_ip_pool').findOne({
        network: this.VPN_NETWORK,
      });

      if (!ipPool) {
        throw new Error('VPN IP pool not found in database');
      }

      // Parse next available IP
      const nextIP = ipPool.nextAvailable;

      // Check if IP is already assigned
      const existingTunnel = await db.collection('vpn_tunnels').findOne({
        'vpnConfig.assignedIP': nextIP,
      });

      if (existingTunnel) {
        // Find next available IP
        const assignedIPs = await db.collection('vpn_tunnels')
          .find({}, { projection: { 'vpnConfig.assignedIP': 1 } })
          .toArray();

        const usedIPs = new Set(assignedIPs.map(t => t.vpnConfig?.assignedIP).filter(Boolean));

        // Generate next IP in range 10.99.1.1 - 10.99.255.254
        for (let i = 1; i <= 255; i++) {
          for (let j = 1; j <= 254; j++) {
            const candidateIP = `10.99.${i}.${j}`;
            if (!usedIPs.has(candidateIP)) {
              // Update next available IP in pool
              await db.collection('vpn_ip_pool').updateOne(
                { network: this.VPN_NETWORK },
                {
                  $set: { nextAvailable: candidateIP, updatedAt: new Date() },
                  $inc: { usedCount: 1 },
                }
              );
              return candidateIP;
            }
          }
        }

        throw new Error('VPN IP pool exhausted');
      }

      // Increment to next IP for future use
      const [a, b, c, d] = nextIP.split('.').map(Number);
      let nextD = d + 1;
      let nextC = c;
      let nextB = b;

      if (nextD > 254) {
        nextD = 1;
        nextC += 1;
      }
      if (nextC > 255) {
        nextC = 1;
        nextB += 1;
      }

      const newNextIP = `10.99.${nextB}.${nextC}.${nextD}`;

      await db.collection('vpn_ip_pool').updateOne(
        { network: this.VPN_NETWORK },
        {
          $set: { nextAvailable: newNextIP, updatedAt: new Date() },
          $inc: { usedCount: 1 },
        }
      );

      return nextIP;

    } catch (error) {
      console.error('[VPN] Failed to get next available IP:', error);
      throw new Error('Failed to allocate VPN IP address');
    }
  }

  /**
   * Add peer to VPN server via SSH
   */
  private static async addPeerToServer(publicKey: string, vpnIP: string): Promise<boolean> {
    try {
      const sshCommand = `
        sudo bash -c "cat >> /etc/wireguard/wg0.conf << 'EOF'

# Router Peer - ${vpnIP}
[Peer]
PublicKey = ${publicKey}
AllowedIPs = ${vpnIP}/32
PersistentKeepalive = 25
EOF"
      `;

      const sshKeyOption = this.VPN_SSH_KEY ? `-i ${this.VPN_SSH_KEY}` : '';

      await execAsync(`ssh ${sshKeyOption} ${this.VPN_SSH_HOST} '${sshCommand}'`);

      // Reload WireGuard configuration
      const reloadCommand = 'sudo wg syncconf wg0 <(wg-quick strip wg0)';
      await execAsync(`ssh ${sshKeyOption} ${this.VPN_SSH_HOST} '${reloadCommand}'`);

      console.log(`[VPN] Peer added to server: ${publicKey.substring(0, 10)}...`);
      return true;

    } catch (error) {
      console.error('[VPN] Failed to add peer to server:', error);
      return false;
    }
  }

  /**
   * Push WireGuard configuration to MikroTik router
   */
  private static async pushWireGuardToRouter(
    connection: { ipAddress: string; port: number; username: string; password: string },
    wgConfig: VPNConfig
  ): Promise<boolean> {
    try {
      const config = {
        ipAddress: connection.ipAddress,
        port: connection.port,
        username: connection.username,
        password: connection.password,
      };

      // Step 1: Create WireGuard interface
      console.log('[VPN] Creating WireGuard interface on router...');
      const createInterfaceResult = await MikroTikService.makeRequest(
        config,
        '/rest/interface/wireguard',
        'PUT',
        {
          name: 'wg-mgmt',
          'private-key': wgConfig.clientPrivateKey,
          'listen-port': 13231,
          comment: 'Management VPN Tunnel',
        }
      );

      if (!createInterfaceResult) {
        throw new Error('Failed to create WireGuard interface');
      }

      // Step 2: Add peer (VPN server)
      console.log('[VPN] Adding VPN server as peer...');
      const [endpoint, port] = wgConfig.endpoint.split(':');
      
      await MikroTikService.makeRequest(
        config,
        '/rest/interface/wireguard/peers',
        'PUT',
        {
          interface: 'wg-mgmt',
          'public-key': wgConfig.serverPublicKey,
          'endpoint-address': endpoint,
          'endpoint-port': parseInt(port),
          'allowed-address': wgConfig.allowedIPs,
          'persistent-keepalive': `${wgConfig.persistentKeepalive}s`,
          comment: 'Central Management Server',
        }
      );

      // Step 3: Assign IP address to WireGuard interface
      console.log('[VPN] Assigning VPN IP to interface...');
      await MikroTikService.makeRequest(
        config,
        '/rest/ip/address',
        'PUT',
        {
          address: `${wgConfig.vpnIP}/32`,
          interface: 'wg-mgmt',
          comment: 'VPN Management IP',
        }
      );

      // Step 4: Add route for VPN network
      console.log('[VPN] Adding route for VPN network...');
      await MikroTikService.makeRequest(
        config,
        '/rest/ip/route',
        'PUT',
        {
          'dst-address': wgConfig.allowedIPs,
          gateway: 'wg-mgmt',
          comment: 'VPN Network Route',
        }
      );

      // Step 5: Enable WireGuard interface
      console.log('[VPN] Enabling WireGuard interface...');
      const interfaces = await MikroTikService.makeRequest(
        config,
        '/rest/interface/wireguard',
        'GET'
      );

      const wgInterface = interfaces.find((iface: any) => iface.name === 'wg-mgmt');
      
      if (wgInterface && wgInterface.disabled) {
        await MikroTikService.makeRequest(
          config,
          `/rest/interface/wireguard/${wgInterface['.id']}`,
          'PATCH',
          { disabled: 'no' }
        );
      }

      console.log('[VPN] ✓ WireGuard configuration applied to router');
      return true;

    } catch (error) {
      console.error('[VPN] Failed to configure router:', error);
      return false;
    }
  }

  /**
   * Test VPN connectivity by pinging router via VPN IP
   */
  private static async testVPNConnectivity(vpnIP: string): Promise<boolean> {
    try {
      const sshKeyOption = this.VPN_SSH_KEY ? `-i ${this.VPN_SSH_KEY}` : '';
      const pingCommand = `ping -c 3 -W 2 ${vpnIP}`;

      await execAsync(`ssh ${sshKeyOption} ${this.VPN_SSH_HOST} '${pingCommand}'`);
      
      console.log(`[VPN] ✓ Router responding at VPN IP: ${vpnIP}`);
      return true;

    } catch (error) {
      console.error(`[VPN] Router not responding at VPN IP: ${vpnIP}`);
      return false;
    }
  }

  /**
   * Rollback VPN configuration (remove peer from server)
   */
  static async rollbackVPN(publicKey: string): Promise<void> {
    try {
      console.log('[VPN] Rolling back VPN configuration...');

      const sshKeyOption = this.VPN_SSH_KEY ? `-i ${this.VPN_SSH_KEY}` : '';

      // Remove peer from config file
      const removeCommand = `
        sudo sed -i '/PublicKey = ${publicKey}/,+2d' /etc/wireguard/wg0.conf
      `;

      await execAsync(`ssh ${sshKeyOption} ${this.VPN_SSH_HOST} '${removeCommand}'`);

      // Reload WireGuard
      const reloadCommand = 'sudo wg syncconf wg0 <(wg-quick strip wg0)';
      await execAsync(`ssh ${sshKeyOption} ${this.VPN_SSH_HOST} '${reloadCommand}'`);

      console.log('[VPN] ✓ VPN configuration rolled back');

    } catch (error) {
      console.error('[VPN] Failed to rollback VPN:', error);
    }
  }

  /**
   * Save VPN tunnel configuration to MongoDB
   */
  private static async saveVPNTunnelToDB(data: {
    routerId: string;
    customerId: ObjectId;
    vpnConfig: VPNConfig;
    status: string;
  }): Promise<void> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

      // Encrypt private key before saving
      const encryptedPrivateKey = this.encryptPrivateKey(data.vpnConfig.clientPrivateKey);

      const vpnTunnel = {
        routerId: new ObjectId(data.routerId),
        customerId: data.customerId,
        vpnConfig: {
          clientPrivateKey: encryptedPrivateKey,
          clientPublicKey: data.vpnConfig.clientPublicKey,
          serverPublicKey: data.vpnConfig.serverPublicKey,
          assignedIP: data.vpnConfig.vpnIP,
          endpoint: data.vpnConfig.endpoint,
          allowedIPs: data.vpnConfig.allowedIPs,
          persistentKeepalive: data.vpnConfig.persistentKeepalive,
        },
        connection: {
          status: data.status,
          lastHandshake: new Date(),
          bytesReceived: 0,
          bytesSent: 0,
          lastSeen: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection('vpn_tunnels').insertOne(vpnTunnel);

      console.log('[VPN] ✓ VPN tunnel saved to database');

    } catch (error) {
      console.error('[VPN] Failed to save VPN tunnel to database:', error);
      throw error;
    }
  }

  /**
   * Encrypt private key for storage
   */
  private static encryptPrivateKey(privateKey: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(
      process.env.NEXTAUTH_SECRET || 'default-secret',
      'salt',
      32
    );
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt private key
   */
  static decryptPrivateKey(encryptedKey: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(
      process.env.NEXTAUTH_SECRET || 'default-secret',
      'salt',
      32
    );

    const [ivHex, encrypted] = encryptedKey.split(':');
    const iv = Buffer.from(ivHex, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Sleep utility
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check VPN tunnel status
   */
  static async checkTunnelStatus(routerId: string): Promise<{
    status: string;
    lastSeen: Date | null;
    connected: boolean;
  }> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

      const tunnel = await db.collection('vpn_tunnels').findOne({
        routerId: new ObjectId(routerId),
      });

      if (!tunnel) {
        return { status: 'not_found', lastSeen: null, connected: false };
      }

      const lastSeen = tunnel.connection?.lastSeen || null;
      const timeSinceLastSeen = lastSeen 
        ? Date.now() - new Date(lastSeen).getTime()
        : Infinity;

      const connected = timeSinceLastSeen < 5 * 60 * 1000; // 5 minutes

      return {
        status: tunnel.connection?.status || 'unknown',
        lastSeen,
        connected,
      };

    } catch (error) {
      console.error('[VPN] Failed to check tunnel status:', error);
      return { status: 'error', lastSeen: null, connected: false };
    }
  }
}

export default VPNProvisioner;