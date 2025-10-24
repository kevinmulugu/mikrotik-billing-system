// lib/vpn-client-helper.ts
// Client-side helper for pushing VPN configuration to router from browser

export interface VPNConfig {
  clientPrivateKey: string;
  clientPublicKey: string;
  serverPublicKey: string;
  vpnIP: string;
  endpoint: string;
  allowedIPs: string;
  persistentKeepalive: number;
}

export interface RouterConnection {
  ipAddress: string;
  port: number;
  username: string;
  password: string;
}

/**
 * Test if router is reachable from browser (client-side)
 */
export async function testRouterConnection(
  connection: RouterConnection
): Promise<{ success: boolean; error?: string; routerInfo?: any }> {
  try {
    const baseUrl = `http://${connection.ipAddress}:${connection.port}`;
    const auth = btoa(`${connection.username}:${connection.password}`);

    const response = await fetch(`${baseUrl}/rest/system/resource`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      // Important: This will work from browser only if on same network
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      routerInfo: {
        version: data.version || 'Unknown',
        boardName: data['board-name'] || 'Unknown',
        uptime: data.uptime || '0s',
        cpuLoad: data['cpu-load'] || 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Push WireGuard configuration to router from browser
 */
export async function pushVPNConfigToRouter(
  connection: RouterConnection,
  vpnConfig: VPNConfig,
  onProgress?: (stage: string, progress: number) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = `http://${connection.ipAddress}:${connection.port}`;
    const auth = btoa(`${connection.username}:${connection.password}`);

    // Stage 1: Create WireGuard interface
    onProgress?.('Creating secure interface...', 20);
    
    const createInterfaceResponse = await fetch(`${baseUrl}/rest/interface/wireguard`, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'wg-mgmt',
        'private-key': vpnConfig.clientPrivateKey,
        'listen-port': 13231,
        comment: 'Management VPN Tunnel',
      }),
    });

    if (!createInterfaceResponse.ok) {
      throw new Error('Failed to create WireGuard interface');
    }

    // Stage 2: Add VPN server as peer
    onProgress?.('Connecting to VPN server...', 40);

    const [endpoint, port] = vpnConfig.endpoint.split(':');
    
    const addPeerResponse = await fetch(`${baseUrl}/rest/interface/wireguard/peers`, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        interface: 'wg-mgmt',
        'public-key': vpnConfig.serverPublicKey,
        'endpoint-address': endpoint,
        'endpoint-port': parseInt(port),
        'allowed-address': vpnConfig.allowedIPs,
        'persistent-keepalive': `${vpnConfig.persistentKeepalive}s`,
        comment: 'Central Management Server',
      }),
    });

    if (!addPeerResponse.ok) {
      throw new Error('Failed to add VPN peer');
    }

    // Stage 3: Assign IP address
    onProgress?.('Configuring network...', 60);

    const addAddressResponse = await fetch(`${baseUrl}/rest/ip/address`, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: `${vpnConfig.vpnIP}/32`,
        interface: 'wg-mgmt',
        comment: 'VPN Management IP',
      }),
    });

    if (!addAddressResponse.ok) {
      throw new Error('Failed to assign VPN IP');
    }

    // Stage 4: Add route
    onProgress?.('Setting up routing...', 80);

    const addRouteResponse = await fetch(`${baseUrl}/rest/ip/route`, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'dst-address': vpnConfig.allowedIPs,
        gateway: 'wg-mgmt',
        comment: 'VPN Network Route',
      }),
    });

    if (!addRouteResponse.ok) {
      throw new Error('Failed to add VPN route');
    }

    // Stage 5: Enable interface (if disabled)
    onProgress?.('Activating connection...', 90);

    const getInterfacesResponse = await fetch(`${baseUrl}/rest/interface/wireguard`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (getInterfacesResponse.ok) {
      const interfaces = await getInterfacesResponse.json();
      const wgInterface = interfaces.find((iface: any) => iface.name === 'wg-mgmt');
      
      if (wgInterface && wgInterface.disabled) {
        await fetch(`${baseUrl}/rest/interface/wireguard/${wgInterface['.id']}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ disabled: 'no' }),
        });
      }
    }

    onProgress?.('VPN configured successfully!', 100);

    return { success: true };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Configuration failed',
    };
  }
}

/**
 * Detect if user is likely on a local network
 */
export function detectLocalNetwork(): {
  isLocal: boolean;
  currentIP?: string;
  warning?: string;
} {
  // This is a basic heuristic check
  // More accurate detection would require actual network probing
  
  const userAgent = navigator.userAgent.toLowerCase();
  const connection = (navigator as any).connection;
  
  // Check if on mobile data
  if (connection && connection.effectiveType) {
    if (connection.effectiveType === '4g' || connection.effectiveType === '3g') {
      return {
        isLocal: false,
        warning: 'You appear to be on mobile data. Please connect to WiFi.',
      };
    }
  }

  // We can't reliably detect local network from browser
  // So we return a neutral result and rely on connection test
  return {
    isLocal: true, // Assume local until proven otherwise
  };
}

/**
 * Format progress messages for users
 */
export function getProgressMessage(stage: string): string {
  const messages: Record<string, string> = {
    'Creating secure interface...': 'Preparing secure connection...',
    'Connecting to VPN server...': 'Establishing tunnel...',
    'Configuring network...': 'Setting up network access...',
    'Setting up routing...': 'Configuring routes...',
    'Activating connection...': 'Activating secure connection...',
    'VPN configured successfully!': 'Secure connection ready!',
  };

  return messages[stage] || stage;
}