// lib/services/router-connection.ts

import MikroTikService from "./mikrotik";

export interface RouterConnectionOptions {
  forceLocal?: boolean;  // Force local IP (for VPN provisioning)
  forceVPN?: boolean;    // Force VPN IP (for verification)
}

export function getRouterConnectionConfig(
  router: any, 
  options?: RouterConnectionOptions
) {
  // Force options override everything
  if (options?.forceLocal) {
    return {
      ipAddress: router.connection?.localIP,
      port: router.connection?.port || 8728,
      username: router.connection?.apiUser || 'admin',
      password: MikroTikService.decryptPassword(router.connection?.apiPassword),
    };
  }

  if (options?.forceVPN) {
    const vpnIP = router.connection?.vpnIP || router.vpnTunnel?.assignedVPNIP;
    if (!vpnIP) {
      throw new Error('VPN IP not available');
    }
    return {
      ipAddress: vpnIP,
      port: router.connection?.port || 8728,
      username: router.connection?.apiUser || 'admin',
      password: MikroTikService.decryptPassword(router.connection?.apiPassword),
    };
  }

  // Use VPN if enabled and connected
  const useVPN = router.connection?.preferVPN && 
                 router.vpnTunnel?.status === 'connected' &&
                 router.vpnTunnel?.assignedVPNIP;

  const ipAddress = useVPN
    ? router.vpnTunnel.assignedVPNIP
    : router.connection?.localIP;

  console.log(`[Router Connection] Using ${useVPN ? 'VPN' : 'Local'} IP: ${ipAddress}`);

  return {
    ipAddress,
    port: router.connection?.port || 8728,
    username: router.connection?.apiUser || 'admin',
    password: MikroTikService.decryptPassword(router.connection?.apiPassword),
  };
}