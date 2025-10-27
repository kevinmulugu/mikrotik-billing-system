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

interface VPNSetupScriptRequest {
  routerName: string;
  routerModel: string;
  ipAddress: string;
  userId: string;
}

interface VPNSetupScriptResult {
  success: boolean;
  setupToken?: string;
  script?: string;
  vpnIP?: string;
  expiresIn?: number;
  instructions?: {
    steps: string[];
  };
  error?: string;
  details?: string;
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
   * NEW PUBLIC METHOD: Generate VPN setup script for manual router configuration
   * This method is called by the API route to generate a script that users can
   * paste into their MikroTik router terminal
   */
  static async generateVPNSetupScript(
    data: VPNSetupScriptRequest
  ): Promise<VPNSetupScriptResult> {
    console.log(`[VPN Script] Generating VPN setup script for ${data.routerName}...`);

    try {
      // Step 1: Generate unique setup token
      const setupToken = crypto.randomBytes(32).toString('hex');

      // Step 2: Generate WireGuard keypair for router
      console.log(`[VPN Script] Generating WireGuard keypair...`);
      const keypair = await this.generateWireGuardKeypair();
      console.log(`[VPN Script] ✓ Keypair generated`);

      // Step 3: Allocate VPN IP from pool
      console.log(`[VPN Script] Allocating VPN IP address...`);
      const vpnIP = await this.getNextAvailableVPNIP();
      console.log(`[VPN Script] ✓ Assigned VPN IP: ${vpnIP}`);

      // Step 4: Register peer on VPN server
      console.log(`[VPN Script] Registering peer on VPN server...`);
      const peerRegistered = await this.addPeerToServer(keypair.publicKey, vpnIP);
      
      if (!peerRegistered) {
        throw new Error('Failed to register peer on VPN server');
      }
      console.log(`[VPN Script] ✓ Peer registered on server`);

      // Step 5: Store VPN configuration temporarily in database
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

      await db.collection('vpn_setup_tokens').insertOne({
        token: setupToken,
        userId: new ObjectId(data.userId),
        routerInfo: {
          name: data.routerName,
          model: data.routerModel,
          ipAddress: data.ipAddress,
        },
        vpnConfig: {
          clientPrivateKey: keypair.privateKey,
          clientPublicKey: keypair.publicKey,
          serverPublicKey: this.VPN_SERVER_PUBLIC_KEY,
          vpnIP,
          endpoint: this.VPN_SERVER_ENDPOINT,
          allowedIPs: this.VPN_NETWORK,
          persistentKeepalive: 25,
        },
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      });

      console.log(`[VPN Script] ✓ Setup token saved to database`);

      // Step 6: Generate MikroTik configuration script
      const appUrl = process.env.NEXTAUTH_URL || 'https://yourapp.com';
      const configUrl = `${appUrl}/api/vpn/config/${setupToken}`;

      const mikrotikScript = this.generateMikroTikScript({
        configUrl,
        vpnIP,
        clientPrivateKey: keypair.privateKey,
        serverPublicKey: this.VPN_SERVER_PUBLIC_KEY,
        endpoint: this.VPN_SERVER_ENDPOINT,
        allowedIPs: this.VPN_NETWORK,
        serverIP: this.VPN_SERVER_IP,
      });

      console.log(`[VPN Script] ✅ VPN setup script generated successfully`);

      // Step 7: Return the script and metadata
      return {
        success: true,
        setupToken,
        script: mikrotikScript,
        vpnIP,
        expiresIn: 1800, // 30 minutes in seconds
        instructions: {
          steps: [
            'Open your router terminal (Winbox → New Terminal, or WebFig → Terminal)',
            'Copy the entire script below',
            'Paste it into the router terminal and press Enter',
            'Wait 10-15 seconds for VPN to connect',
            'Click "Verify VPN" button below',
          ],
        },
      };

    } catch (error) {
      console.error(`[VPN Script] ❌ Failed to generate VPN setup script:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      };
    }
  }

  /**
   * Generate MikroTik script for router configuration
   */
  private static generateMikroTikScript(config: {
    configUrl: string;
    vpnIP: string;
    clientPrivateKey: string;
    serverPublicKey: string;
    endpoint: string;
    allowedIPs: string;
    serverIP: string;
  }): string {
    const [endpointHost, endpointPort] = config.endpoint.split(':');

    return `# MikroTik VPN Auto-Setup Script
# Generated: ${new Date().toISOString()}
# VPN IP: ${config.vpnIP}

:log info "Starting VPN setup...";

# Create WireGuard interface
/interface wireguard add name=wg-mgmt private-key="${config.clientPrivateKey}" listen-port=13231 comment="Management VPN";

# Add VPN server as peer
/interface wireguard peers add interface=wg-mgmt public-key="${config.serverPublicKey}" endpoint-address=${endpointHost} endpoint-port=${endpointPort} allowed-address=${config.allowedIPs} persistent-keepalive=25s comment="VPN Server";

# Assign VPN IP to interface
/ip address add address=${config.vpnIP}/32 interface=wg-mgmt comment="VPN Management IP";

# Add route to VPN network
/ip route add dst-address=${config.allowedIPs} gateway=wg-mgmt comment="VPN Network Route";

# Allow incoming connections from VPN network
/ip firewall filter add chain=input src-address=${config.allowedIPs} action=accept place-before=0 comment="Allow VPN Management";

# Enable WireGuard interface (if disabled)
/interface wireguard enable wg-mgmt;

:log info "VPN setup complete! IP: ${config.vpnIP}";

# Notify server that setup is complete (optional - router will be verified via VPN connectivity test)
:log info "Setup token: Check VPN connectivity from portal";`;
  }

  /**
   * Main method: Provision VPN for a router (EXISTING METHOD - NO CHANGES)
   * This is used for automatic provisioning when the system has direct access to the router
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
   * Generate WireGuard keypair using actual WireGuard tools
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
   * Get next available VPN IP from pool with database tracking
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
      const [octet1, octet2, octet3, octet4] = nextIP.split('.').map(Number);
      
      // We're working with 10.99.x.x network
      // So we only increment octet3 and octet4
      let newOctet4 = octet4 + 1;
      let newOctet3 = octet3;

      // Handle overflow from 4th octet to 3rd octet
      if (newOctet4 > 254) {
        newOctet4 = 1;
        newOctet3 += 1;
      }

      // Handle overflow from 3rd octet (pool exhausted)
      if (newOctet3 > 255) {
        throw new Error('VPN IP pool exhausted - no more IPs available in 10.99.0.0/16');
      }

      // Build new IP using original first two octets (10.99)
      const newNextIP = `${octet1}.${octet2}.${newOctet3}.${newOctet4}`;

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

      await execAsync(`ssh -o StrictHostKeyChecking=no ${sshKeyOption} ${this.VPN_SSH_HOST} '${sshCommand}'`);

      // Reload WireGuard configuration
      const reloadCommand = "sudo bash -c 'wg syncconf wg0 <(wg-quick strip wg0)'";
      await execAsync(`ssh -o StrictHostKeyChecking=no ${sshKeyOption} ${this.VPN_SSH_HOST} ${reloadCommand}`);

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

      await execAsync(`ssh -o StrictHostKeyChecking=no ${sshKeyOption} ${this.VPN_SSH_HOST} '${pingCommand}'`);
      
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

      await execAsync(`ssh -o StrictHostKeyChecking=no ${sshKeyOption} ${this.VPN_SSH_HOST} '${removeCommand}'`);

      // Reload WireGuard
      const reloadCommand = "sudo bash -c 'wg syncconf wg0 <(wg-quick strip wg0)'";
      await execAsync(`ssh -o StrictHostKeyChecking=no ${sshKeyOption} ${this.VPN_SSH_HOST} ${reloadCommand}`);

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