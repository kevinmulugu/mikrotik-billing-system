// src/app/api/routers/[id]/vpn-config/route.ts
// Returns the stored WireGuard setup script for a router so the user can re-apply it
// without having to add the router again.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import VPNProvisioner from '@/lib/services/vpn-provisioner';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function buildSetupScript(config: {
  vpnIP: string;
  clientPrivateKey: string;
  serverPublicKey: string;
  endpoint: string;
  allowedIPs: string;
}): string {
  const [endpointHost, endpointPort] = config.endpoint.split(':');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  let apiDomain = 'localhost';
  try {
    apiDomain = new URL(appUrl).hostname;
  } catch {
    // keep default
  }

  return `# MikroTik VPN Restore Script
# Generated: ${new Date().toISOString()}
# VPN IP: ${config.vpnIP}
# NOTE: This script re-applies your existing VPN configuration.
# Run it in the MikroTik terminal (Winbox → New Terminal).

:log info "Restoring VPN configuration...";

# Remove existing wg-mgmt interface if present (idempotent)
/interface wireguard { :if ([find name="wg-mgmt"] != "") do={ remove [find name="wg-mgmt"] } };
/ip address { :if ([find interface="wg-mgmt"] != "") do={ remove [find interface="wg-mgmt"] } };

# Create WireGuard interface
/interface wireguard add name=wg-mgmt private-key="${config.clientPrivateKey}" listen-port=13231 comment="Management VPN";

# Add VPN server as peer
/interface wireguard peers add interface=wg-mgmt public-key="${config.serverPublicKey}" endpoint-address=${endpointHost} endpoint-port=${endpointPort ?? '51820'} allowed-address=${config.allowedIPs} persistent-keepalive=25s comment="VPN Server";

# Assign VPN IP to interface
/ip address add address=${config.vpnIP}/32 interface=wg-mgmt comment="VPN Management IP";

# Add route to VPN network
/ip route add dst-address=${config.allowedIPs} gateway=wg-mgmt comment="VPN Network Route";

# Allow incoming connections from VPN network
/ip firewall filter add chain=input src-address=${config.allowedIPs} action=accept place-before=0 comment="Allow VPN Management";

# Captive portal walled-garden entry
/ip hotspot walled-garden add dst-host=${apiDomain} comment="Captive Portal API Access";

# Enable WireGuard interface
/interface wireguard enable wg-mgmt;

:log info "VPN restore complete! IP: ${config.vpnIP}";`;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: routerId } = await params;

    if (!ObjectId.isValid(routerId)) {
      return NextResponse.json({ error: 'Invalid router ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME ?? 'mikrotik_billing');

    // Verify ownership and router type
    const router = await db.collection('routers').findOne({
      _id: new ObjectId(routerId),
      userId: new ObjectId(session.user.id),
    });

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    if (router.routerType !== 'mikrotik') {
      return NextResponse.json(
        { error: 'VPN configuration is only available for MikroTik routers' },
        { status: 400 }
      );
    }

    if (!router.vpnTunnel?.enabled || router.vpnTunnel?.status === 'pending') {
      return NextResponse.json(
        {
          error: 'VPN has not been configured for this router yet',
          status: router.vpnTunnel?.status ?? 'not_configured',
        },
        { status: 404 }
      );
    }

    // Fetch stored VPN tunnel
    const tunnel = await db.collection('vpn_tunnels').findOne({
      routerId: new ObjectId(routerId),
    });

    if (!tunnel) {
      return NextResponse.json(
        { error: 'VPN tunnel record not found. Please contact support.' },
        { status: 404 }
      );
    }

    // Decrypt the stored private key
    let clientPrivateKey: string;
    try {
      clientPrivateKey = VPNProvisioner.decryptPrivateKey(tunnel.vpnConfig.clientPrivateKey);
    } catch {
      return NextResponse.json(
        { error: 'Unable to decrypt VPN configuration. Please contact support.' },
        { status: 500 }
      );
    }

    const script = buildSetupScript({
      vpnIP: tunnel.vpnConfig.assignedIP,
      clientPrivateKey,
      serverPublicKey: tunnel.vpnConfig.serverPublicKey,
      endpoint: tunnel.vpnConfig.endpoint ?? process.env.VPN_SERVER_ENDPOINT ?? 'vpn.example.com:51820',
      allowedIPs: tunnel.vpnConfig.allowedIPs ?? process.env.VPN_NETWORK ?? '10.99.0.0/16',
    });

    return NextResponse.json({
      success: true,
      vpnIP: tunnel.vpnConfig.assignedIP,
      publicKey: tunnel.vpnConfig.clientPublicKey,
      status: router.vpnTunnel.status,
      lastHandshake: tunnel.connection?.lastHandshake ?? null,
      provisionedAt: tunnel.createdAt,
      script,
    });
  } catch (error) {
    console.error('[VPN Config] Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve VPN configuration' }, { status: 500 });
  }
}
