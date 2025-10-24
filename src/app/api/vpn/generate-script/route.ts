// src/app/api/vpn/generate-script/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

interface GenerateScriptRequest {
  routerName: string;
  routerModel: string;
  ipAddress: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: GenerateScriptRequest = await req.json();

    if (!body.routerName || !body.ipAddress) {
      return NextResponse.json(
        { error: 'Router name and IP address are required' },
        { status: 400 }
      );
    }

    // Generate unique token for this VPN setup
    const setupToken = crypto.randomBytes(32).toString('hex');

    // Generate VPN keypair for router
    const { publicKey: clientPublicKey, privateKey: clientPrivateKey } = 
      generateWireGuardKeypair();

    // Assign VPN IP from pool (you should track this in DB)
    const vpnIP = await assignVPNIPFromPool();

    // Get VPN server details from environment
    const vpnServerPublicKey = process.env.VPN_SERVER_PUBLIC_KEY || '';
    const vpnServerEndpoint = process.env.VPN_SERVER_ENDPOINT || ''; // e.g., "vpn.yourapp.com:51820"
    const vpnAllowedIPs = process.env.VPN_NETWORK || '10.99.0.0/16';
    const vpnServerIP = process.env.VPN_SERVER_IP || '10.99.0.1';

    // Store VPN configuration temporarily in database
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    await db.collection('vpn_setup_tokens').insertOne({
      token: setupToken,
      userId: new ObjectId(session.user.id),
      routerInfo: {
        name: body.routerName,
        model: body.routerModel,
        ipAddress: body.ipAddress,
      },
      vpnConfig: {
        clientPrivateKey,
        clientPublicKey,
        serverPublicKey: vpnServerPublicKey,
        vpnIP,
        endpoint: vpnServerEndpoint,
        allowedIPs: vpnAllowedIPs,
        persistentKeepalive: 25,
      },
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    });

    // Register peer on VPN server (add to WireGuard config)
    await registerVPNPeerOnServer({
      publicKey: clientPublicKey,
      allowedIP: vpnIP,
    });

    // Generate the MikroTik script
    const appUrl = process.env.NEXTAUTH_URL || 'https://yourapp.com';
    const configUrl = `${appUrl}/api/vpn/config/${setupToken}`;

    const mikrotikScript = generateMikroTikScript({
      configUrl,
      vpnIP,
      clientPrivateKey,
      serverPublicKey: vpnServerPublicKey,
      endpoint: vpnServerEndpoint,
      allowedIPs: vpnAllowedIPs,
      serverIP: vpnServerIP,
    });

    // Return the script to display to user
    return NextResponse.json({
      success: true,
      data: {
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
      },
    });

  } catch (error) {
    console.error('Generate VPN Script Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate VPN script',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate WireGuard keypair
 */
function generateWireGuardKeypair(): { publicKey: string; privateKey: string } {
  // In production, use actual WireGuard key generation
  // For now, using crypto for demonstration
  const privateKey = crypto.randomBytes(32).toString('base64');
  const publicKey = crypto.randomBytes(32).toString('base64');
  
  return { privateKey, publicKey };
}

/**
 * Assign VPN IP from pool
 */
async function assignVPNIPFromPool(): Promise<string> {
  // In production, query DB for next available IP in range 10.99.1.1 - 10.99.255.254
  // For now, generate random IP
  const octet3 = Math.floor(Math.random() * 255) + 1;
  const octet4 = Math.floor(Math.random() * 254) + 1;
  return `10.99.${octet3}.${octet4}`;
}

/**
 * Register peer on VPN server
 */
async function registerVPNPeerOnServer(peer: { publicKey: string; allowedIP: string }) {
  // In production, this would:
  // 1. SSH to VPN server
  // 2. Add peer to WireGuard config: wg set wg0 peer <publicKey> allowed-ips <allowedIP>
  // 3. Or call WireGuard management API
  
  console.log(`[VPN] Registering peer: ${peer.publicKey} → ${peer.allowedIP}`);
  
  // Placeholder - implement actual VPN server configuration
  return true;
}

/**
 * Generate MikroTik script
 */
function generateMikroTikScript(config: {
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

# Enable WireGuard interface (if disabled)
/interface wireguard enable wg-mgmt;

:log info "VPN setup complete! IP: ${config.vpnIP}";

# Notify server that setup is complete (optional - router will be verified via VPN connectivity test)
:log info "Setup token: Check VPN connectivity from portal";`;
}