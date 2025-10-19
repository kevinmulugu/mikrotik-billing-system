// lib/services/mikrotik.ts - Complete MikroTik Service (All-In-One)

// ============================================
// TYPE DEFINITIONS
// ============================================

interface MikroTikConnectionConfig {
  ipAddress: string;
  port: number;
  username: string;
  password: string;
}

interface MikroTikSystemResource {
  version?: string;
  'board-name'?: string;
  'cpu-load'?: number;
  'free-memory'?: number;
  'total-memory'?: number;
  uptime?: string;
  'cpu-count'?: number;
  'cpu-frequency'?: number;
  platform?: string;
}

interface ConnectionTestResult {
  success: boolean;
  data?: {
    connected: boolean;
    routerInfo: {
      version: string;
      model: string;
      cpuLoad: number;
      memoryUsage: number;
      uptime: string;
      cpuCount?: number;
      platform?: string;
    };
  };
  error?: string;
}

interface InterfaceInfo {
  '.id': string;
  name: string;
  type?: string;
  'mac-address'?: string;
  disabled?: boolean;
}

interface ConfigurationResult {
  success: boolean;
  step: string;
  message: string;
  error?: string;
  data?: any;
}

interface IPPoolConfig {
  name: string;
  ranges: string;
}

interface DHCPServerConfig {
  name: string;
  interface: string;
  'address-pool': string;
}

interface DHCPNetworkConfig {
  address: string;
  gateway: string;
  'dns-server': string;
}

interface NATRuleConfig {
  chain: string;
  'src-address': string;
  'out-interface': string;
  action: string;
}

interface PPPoEServerConfig {
  'service-name': string;
  interface: string;
  'default-profile': string;
  disabled?: string;
}

interface PPPProfileConfig {
  name: string;
  'local-address': string;
  'remote-address': string;
  'dns-server': string;
  'rate-limit'?: string;
  'session-timeout'?: string;
  'idle-timeout'?: string;
}

interface HotspotProfileConfig {
  name: string;
  'hotspot-address': string;
  'dns-name': string;
  'html-directory': string;
  'http-proxy': string;
  'login-by': string;
  'rate-limit'?: string;
  'session-timeout'?: string;
  'idle-timeout'?: string;
  'keepalive-timeout'?: string;
  'status-autorefresh'?: string;
  'shared-users'?: string;
  'transparent-proxy'?: string;
}

interface HotspotServerConfig {
  name: string;
  interface: string;
  'address-pool': string;
  profile: string;
}

// ============================================
// MIKROTIK CORE SERVICE
// ============================================

export class MikroTikService {
  static async makeRequest(
    config: MikroTikConnectionConfig,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: any
  ): Promise<any> {
    const { ipAddress, username, password } = config;
    const baseUrl = `http://${ipAddress}`;
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : null,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        throw new Error('Authentication failed');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  static async testConnection(
    config: MikroTikConnectionConfig
  ): Promise<ConnectionTestResult> {
    try {
      const data: MikroTikSystemResource = await this.makeRequest(
        config,
        '/rest/system/resource',
        'GET'
      );

      const totalMemory = data['total-memory'] || 0;
      const freeMemory = data['free-memory'] || 0;
      const memoryUsage =
        totalMemory > 0 ? ((totalMemory - freeMemory) / totalMemory) * 100 : 0;

      const routerInfo: {
        version: string;
        model: string;
        cpuLoad: number;
        memoryUsage: number;
        uptime: string;
        cpuCount?: number;
        platform?: string;
      } = {
        version: data.version || 'Unknown',
        model: data['board-name'] || 'Unknown',
        cpuLoad: data['cpu-load'] || 0,
        memoryUsage: Math.round(memoryUsage),
        uptime: data.uptime || '0s',
      };

      if (typeof data['cpu-count'] === 'number') {
        routerInfo.cpuCount = data['cpu-count'];
      }
      if (typeof data.platform === 'string') {
        routerInfo.platform = data.platform;
      }

      return {
        success: true,
        data: {
          connected: true,
          routerInfo,
        },
      };
    } catch (error) {
      return this.handleConnectionError(error);
    }
  }

  private static handleConnectionError(error: any): ConnectionTestResult {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Connection timeout. Router did not respond within 30 seconds.',
        };
      }

      if (error.message.includes('ECONNREFUSED')) {
        return {
          success: false,
          error: 'Connection refused. Make sure the router is reachable and REST API is enabled.',
        };
      }

      if (error.message.includes('Authentication failed')) {
        return {
          success: false,
          error: 'Authentication failed. Please check your username and password.',
        };
      }

      if (error.message.includes('ETIMEDOUT')) {
        return {
          success: false,
          error: 'Connection timeout. Check IP address and network connectivity.',
        };
      }

      if (error.message.includes('ENOTFOUND') || error.message.includes('EHOSTUNREACH')) {
        return {
          success: false,
          error: 'Router not found. Please verify the IP address.',
        };
      }

      if (error.message.includes('ECONNRESET')) {
        return {
          success: false,
          error: 'Connection reset by router. Check firewall settings.',
        };
      }

      return {
        success: false,
        error: `Connection failed: ${error.message}`,
      };
    }

    return {
      success: false,
      error: 'Failed to connect to router. Please check your settings and try again.',
    };
  }

  static async getIdentity(config: MikroTikConnectionConfig): Promise<string | null> {
    try {
      const data = await this.makeRequest(config, '/rest/system/identity', 'GET');
      return data?.name || null;
    } catch (error) {
      console.error('Failed to fetch router identity:', error);
      return null;
    }
  }

  static async getInterfaces(config: MikroTikConnectionConfig): Promise<InterfaceInfo[]> {
    try {
      const interfaces = await this.makeRequest(config, '/rest/interface', 'GET');
      return Array.isArray(interfaces) ? interfaces : [];
    } catch (error) {
      console.error('Failed to fetch router interfaces:', error);
      return [];
    }
  }

  static async getRouterMacAddress(config: MikroTikConnectionConfig): Promise<string> {
    try {
      const interfaces = await this.getInterfaces(config);
      const firstInterface = interfaces.find(iface => iface['mac-address']);
      return firstInterface?.['mac-address'] || '';
    } catch (error) {
      console.error('Failed to get MAC address:', error);
      return '';
    }
  }

  static async checkHotspotStatus(config: MikroTikConnectionConfig): Promise<boolean> {
    try {
      const hotspots = await this.makeRequest(config, '/rest/ip/hotspot', 'GET');
      return Array.isArray(hotspots) && hotspots.length > 0;
    } catch (error) {
      console.error('Failed to check hotspot status:', error);
      return false;
    }
  }

  static validateIpAddress(ip: string): boolean {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  static formatUptime(uptimeString: string): string {
    try {
      const weeks = uptimeString.match(/(\d+)w/);
      const days = uptimeString.match(/(\d+)d/);
      const hours = uptimeString.match(/(\d+)h/);
      const minutes = uptimeString.match(/(\d+)m/);

      const parts = [];
      if (weeks) parts.push(`${weeks[1]}w`);
      if (days) parts.push(`${days[1]}d`);
      if (hours) parts.push(`${hours[1]}h`);
      if (minutes) parts.push(`${minutes[1]}m`);

      return parts.join(' ') || '0m';
    } catch (error) {
      return uptimeString;
    }
  }

  static encryptPassword(password: string): string {
    return Buffer.from(password).toString('base64');
  }

  static decryptPassword(encryptedPassword: string): string {
    try {
      return Buffer.from(encryptedPassword, 'base64').toString('utf-8');
    } catch (error) {
      console.error('Failed to decrypt password:', error);
      return '';
    }
  }

  static parseUptimeToSeconds(uptimeString: string): number {
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
}

// ============================================
// MIKROTIK NETWORK CONFIGURATION
// ============================================

export class MikroTikNetworkConfig {
  static async configureWANInterface(
    config: MikroTikConnectionConfig,
    wanInterface: string = 'ether1'
  ): Promise<ConfigurationResult> {
    try {
      const existingClients = await MikroTikService.makeRequest(
        config,
        '/rest/ip/dhcp-client',
        'GET'
      );

      const existing = Array.isArray(existingClients)
        ? existingClients.find((client: any) => client.interface === wanInterface)
        : null;

      if (existing) {
        return {
          success: true,
          step: 'wan_interface',
          message: `WAN interface ${wanInterface} already configured`,
          data: existing,
        };
      }

      const result = await MikroTikService.makeRequest(
        config,
        '/rest/ip/dhcp-client',
        'PUT',
        {
          interface: wanInterface,
          'add-default-route': 'yes',
          'use-peer-dns': 'yes',
        }
      );

      return {
        success: true,
        step: 'wan_interface',
        message: `WAN interface ${wanInterface} configured successfully`,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        step: 'wan_interface',
        message: 'Failed to configure WAN interface',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async configureLANInterfaces(
    config: MikroTikConnectionConfig,
    interfaces: Array<{ interface: string; address: string }>
  ): Promise<ConfigurationResult> {
    try {
      const results = [];

      for (const iface of interfaces) {
        const existingAddresses = await MikroTikService.makeRequest(
          config,
          '/rest/ip/address',
          'GET'
        );

        const existing = Array.isArray(existingAddresses)
          ? existingAddresses.find(
              (addr: any) =>
                addr.interface === iface.interface && addr.address === iface.address
            )
          : null;

        if (!existing) {
          const result = await MikroTikService.makeRequest(
            config,
            '/rest/ip/address',
            'PUT',
            {
              address: iface.address,
              interface: iface.interface,
            }
          );
          results.push(result);
        }
      }

      return {
        success: true,
        step: 'lan_interfaces',
        message: 'LAN interfaces configured successfully',
        data: results,
      };
    } catch (error) {
      return {
        success: false,
        step: 'lan_interfaces',
        message: 'Failed to configure LAN interfaces',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async configureBridge(
    config: MikroTikConnectionConfig,
    bridgeName: string,
    bridgeAddress: string,
    interfaces: string[]
  ): Promise<ConfigurationResult> {
    try {
      const existingBridges = await MikroTikService.makeRequest(
        config,
        '/rest/interface/bridge',
        'GET'
      );

      let bridge = Array.isArray(existingBridges)
        ? existingBridges.find((b: any) => b.name === bridgeName)
        : null;

      if (!bridge) {
        bridge = await MikroTikService.makeRequest(
          config,
          '/rest/interface/bridge',
          'PUT',
          { name: bridgeName }
        );
      }

      for (const iface of interfaces) {
        const existingPorts = await MikroTikService.makeRequest(
          config,
          '/rest/interface/bridge/port',
          'GET'
        );

        const portExists = Array.isArray(existingPorts)
          ? existingPorts.find(
              (p: any) => p.bridge === bridgeName && p.interface === iface
            )
          : false;

        if (!portExists) {
          await MikroTikService.makeRequest(
            config,
            '/rest/interface/bridge/port',
            'PUT',
            {
              bridge: bridgeName,
              interface: iface,
            }
          );
        }
      }

      const existingAddresses = await MikroTikService.makeRequest(
        config,
        '/rest/ip/address',
        'GET'
      );

      const addressExists = Array.isArray(existingAddresses)
        ? existingAddresses.find(
            (addr: any) =>
              addr.interface === bridgeName && addr.address === bridgeAddress
          )
        : false;

      if (!addressExists) {
        await MikroTikService.makeRequest(config, '/rest/ip/address', 'PUT', {
          address: bridgeAddress,
          interface: bridgeName,
        });
      }

      return {
        success: true,
        step: 'bridge_configuration',
        message: `Bridge ${bridgeName} configured successfully`,
        data: bridge,
      };
    } catch (error) {
      return {
        success: false,
        step: 'bridge_configuration',
        message: 'Failed to configure bridge',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async configureWiFi(
    config: MikroTikConnectionConfig,
    wlanInterface: string,
    ssid: string,
    securityProfile: string = 'default'
  ): Promise<ConfigurationResult> {
    try {
      const interfaces = await MikroTikService.makeRequest(
        config,
        '/rest/interface/wireless',
        'GET'
      );

      const wlanIface = Array.isArray(interfaces)
        ? interfaces.find((iface: any) => iface.name === wlanInterface)
        : null;

      if (!wlanIface) {
        return {
          success: false,
          step: 'wifi_configuration',
          message: `Wireless interface ${wlanInterface} not found`,
          error: 'Interface not found',
        };
      }

      await MikroTikService.makeRequest(
        config,
        `/rest/interface/wireless/${wlanIface['.id']}`,
        'PATCH',
        {
          mode: 'ap-bridge',
          ssid: ssid,
          'security-profile': securityProfile,
        }
      );

      await MikroTikService.makeRequest(
        config,
        `/rest/interface/wireless/${wlanIface['.id']}`,
        'PATCH',
        {
          disabled: 'false',
        }
      );

      return {
        success: true,
        step: 'wifi_configuration',
        message: `WiFi configured with SSID: ${ssid}`,
        data: { interface: wlanInterface, ssid },
      };
    } catch (error) {
      return {
        success: false,
        step: 'wifi_configuration',
        message: 'Failed to configure WiFi',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async createIPPools(
    config: MikroTikConnectionConfig,
    pools: IPPoolConfig[]
  ): Promise<ConfigurationResult> {
    try {
      const results = [];

      for (const pool of pools) {
        const existingPools = await MikroTikService.makeRequest(
          config,
          '/rest/ip/pool',
          'GET'
        );

        const exists = Array.isArray(existingPools)
          ? existingPools.find((p: any) => p.name === pool.name)
          : false;

        if (!exists) {
          const result = await MikroTikService.makeRequest(
            config,
            '/rest/ip/pool',
            'PUT',
            pool
          );
          results.push(result);
        }
      }

      return {
        success: true,
        step: 'ip_pools',
        message: `Created ${pools.length} IP pools successfully`,
        data: results,
      };
    } catch (error) {
      return {
        success: false,
        step: 'ip_pools',
        message: 'Failed to create IP pools',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async configureDHCPServer(
    config: MikroTikConnectionConfig,
    serverConfig: DHCPServerConfig,
    networkConfig: DHCPNetworkConfig
  ): Promise<ConfigurationResult> {
    try {
      const existingNetworks = await MikroTikService.makeRequest(
        config,
        '/rest/ip/dhcp-server/network',
        'GET'
      );

      const networkExists = Array.isArray(existingNetworks)
        ? existingNetworks.find((n: any) => n.address === networkConfig.address)
        : false;

      if (!networkExists) {
        await MikroTikService.makeRequest(
          config,
          '/rest/ip/dhcp-server/network',
          'PUT',
          networkConfig
        );
      }

      const existingServers = await MikroTikService.makeRequest(
        config,
        '/rest/ip/dhcp-server',
        'GET'
      );

      const serverExists = Array.isArray(existingServers)
        ? existingServers.find((s: any) => s.name === serverConfig.name)
        : false;

      if (!serverExists) {
        await MikroTikService.makeRequest(
          config,
          '/rest/ip/dhcp-server',
          'PUT',
          serverConfig
        );
      }

      return {
        success: true,
        step: 'dhcp_server',
        message: 'DHCP server configured successfully',
        data: { server: serverConfig.name, network: networkConfig.address },
      };
    } catch (error) {
      return {
        success: false,
        step: 'dhcp_server',
        message: 'Failed to configure DHCP server',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async configureNAT(
    config: MikroTikConnectionConfig,
    rules: NATRuleConfig[]
  ): Promise<ConfigurationResult> {
    try {
      const createdRules = [];

      for (const rule of rules) {
        const existingRules = await MikroTikService.makeRequest(
          config,
          '/rest/ip/firewall/nat',
          'GET'
        );

        const ruleExists = Array.isArray(existingRules)
          ? existingRules.find(
              (r: any) =>
                r.chain === rule.chain &&
                r['src-address'] === rule['src-address'] &&
                r['out-interface'] === rule['out-interface']
            )
          : false;

        if (!ruleExists) {
          const result = await MikroTikService.makeRequest(
            config,
            '/rest/ip/firewall/nat',
            'PUT',
            rule
          );
          createdRules.push(result);
        }
      }

      return {
        success: true,
        step: 'nat_configuration',
        message: `Configured ${rules.length} NAT rules successfully`,
        data: createdRules,
      };
    } catch (error) {
      return {
        success: false,
        step: 'nat_configuration',
        message: 'Failed to configure NAT',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// ============================================
// MIKROTIK SERVICE CONFIGURATION
// ============================================

export class MikroTikServiceConfig {
  static async configurePPPoEServers(
    config: MikroTikConnectionConfig,
    servers: PPPoEServerConfig[]
  ): Promise<ConfigurationResult> {
    try {
      const createdServers = [];

      for (const server of servers) {
        const existingServers = await MikroTikService.makeRequest(
          config,
          '/rest/interface/pppoe-server/server',
          'GET'
        );

        const serverExists = Array.isArray(existingServers)
          ? existingServers.find(
              (s: any) =>
                s['service-name'] === server['service-name'] &&
                s.interface === server.interface
            )
          : false;

        if (!serverExists) {
          const result = await MikroTikService.makeRequest(
            config,
            '/rest/interface/pppoe-server/server',
            'PUT',
            server
          );
          createdServers.push(result);
        }
      }

      return {
        success: true,
        step: 'pppoe_servers',
        message: `Configured ${servers.length} PPPoE servers successfully`,
        data: createdServers,
      };
    } catch (error) {
      return {
        success: false,
        step: 'pppoe_servers',
        message: 'Failed to configure PPPoE servers',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async createPPPProfiles(
    config: MikroTikConnectionConfig,
    profiles: PPPProfileConfig[]
  ): Promise<ConfigurationResult> {
    try {
      const createdProfiles = [];

      for (const profile of profiles) {
        const existingProfiles = await MikroTikService.makeRequest(
          config,
          '/rest/ppp/profile',
          'GET'
        );

        const profileExists = Array.isArray(existingProfiles)
          ? existingProfiles.find((p: any) => p.name === profile.name)
          : false;

        if (!profileExists) {
          const result = await MikroTikService.makeRequest(
            config,
            '/rest/ppp/profile',
            'PUT',
            profile
          );
          createdProfiles.push(result);
        }
      }

      return {
        success: true,
        step: 'ppp_profiles',
        message: `Created ${profiles.length} PPP profiles successfully`,
        data: createdProfiles,
      };
    } catch (error) {
      return {
        success: false,
        step: 'ppp_profiles',
        message: 'Failed to create PPP profiles',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async configureHotspot(
    config: MikroTikConnectionConfig,
    hotspotProfile: HotspotProfileConfig,
    hotspotServer: HotspotServerConfig
  ): Promise<ConfigurationResult> {
    try {
      const existingProfiles = await MikroTikService.makeRequest(
        config,
        '/rest/ip/hotspot/profile',
        'GET'
      );

      const profileExists = Array.isArray(existingProfiles)
        ? existingProfiles.find((p: any) => p.name === hotspotProfile.name)
        : false;

      if (!profileExists) {
        await MikroTikService.makeRequest(
          config,
          '/rest/ip/hotspot/profile',
          'PUT',
          hotspotProfile
        );
      }

      const existingServers = await MikroTikService.makeRequest(
        config,
        '/rest/ip/hotspot',
        'GET'
      );

      const serverExists = Array.isArray(existingServers)
        ? existingServers.find((s: any) => s.name === hotspotServer.name)
        : false;

      if (!serverExists) {
        await MikroTikService.makeRequest(
          config,
          '/rest/ip/hotspot',
          'PUT',
          hotspotServer
        );
      }

      return {
        success: true,
        step: 'hotspot_configuration',
        message: 'Hotspot configured successfully',
        data: { profile: hotspotProfile.name, server: hotspotServer.name },
      };
    } catch (error) {
      return {
        success: false,
        step: 'hotspot_configuration',
        message: 'Failed to configure hotspot',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async createHotspotUserProfiles(
    config: MikroTikConnectionConfig
  ): Promise<ConfigurationResult> {
    try {
      const profiles = [
        { name: '1hour-10ksh', 'session-timeout': '1h', 'idle-timeout': '10m', 'keepalive-timeout': '2m', 'status-autorefresh': '1m', 'shared-users': '1', 'rate-limit': '2M/5M', 'transparent-proxy': 'yes' },
        { name: '3hours-25ksh', 'session-timeout': '3h', 'idle-timeout': '15m', 'keepalive-timeout': '2m', 'status-autorefresh': '1m', 'shared-users': '1', 'rate-limit': '3M/6M', 'transparent-proxy': 'yes' },
        { name: '5hours-40ksh', 'session-timeout': '5h', 'idle-timeout': '20m', 'keepalive-timeout': '2m', 'status-autorefresh': '1m', 'shared-users': '1', 'rate-limit': '4M/8M', 'transparent-proxy': 'yes' },
        { name: '12hours-70ksh', 'session-timeout': '12h', 'idle-timeout': '30m', 'keepalive-timeout': '2m', 'status-autorefresh': '1m', 'shared-users': '1', 'rate-limit': '5M/10M', 'transparent-proxy': 'yes' },
        { name: '1day-100ksh', 'session-timeout': '1d', 'idle-timeout': '1h', 'keepalive-timeout': '2m', 'status-autorefresh': '1m', 'shared-users': '1', 'rate-limit': '6M/12M', 'transparent-proxy': 'yes' },
        { name: '3days-250ksh', 'session-timeout': '3d', 'idle-timeout': '2h', 'keepalive-timeout': '2m', 'status-autorefresh': '1m', 'shared-users': '2', 'rate-limit': '8M/15M', 'transparent-proxy': 'yes' },
        { name: '1week-400ksh', 'session-timeout': '1w', 'idle-timeout': '4h', 'keepalive-timeout': '2m', 'status-autorefresh': '1m', 'shared-users': '2', 'rate-limit': '10M/20M', 'transparent-proxy': 'yes' },
        { name: '1month-1200ksh', 'session-timeout': '30d', 'idle-timeout': '12h', 'keepalive-timeout': '2m', 'status-autorefresh': '1m', 'shared-users': '3', 'rate-limit': '15M/25M', 'transparent-proxy': 'yes' },
      ];

      const existingProfiles = await MikroTikService.makeRequest(
        config,
        '/rest/ip/hotspot/user/profile',
        'GET'
      );

      const createdProfiles = [];

      for (const profile of profiles) {
        const profileExists = Array.isArray(existingProfiles)
          ? existingProfiles.find((p: any) => p.name === profile.name)
          : false;

        if (!profileExists) {
          const result = await MikroTikService.makeRequest(
            config,
            '/rest/ip/hotspot/user/profile',
            'PUT',
            profile
          );
          createdProfiles.push(result);
        }
      }

      return {
        success: true,
        step: 'hotspot_user_profiles',
        message: `Created ${profiles.length} hotspot user profiles successfully`,
        data: { profilesCreated: createdProfiles.length, profiles: profiles.map(p => p.name) },
      };
    } catch (error) {
      return {
        success: false,
        step: 'hotspot_user_profiles',
        message: 'Failed to create hotspot user profiles',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async createPPPoEUserProfiles(
    config: MikroTikConnectionConfig,
    localAddress: string,
    remotePool: string
  ): Promise<ConfigurationResult> {
    try {
      const profiles = [
        { name: 'home-basic-5mbps', 'local-address': localAddress, 'remote-address': remotePool, 'dns-server': '8.8.8.8,8.8.4.4', 'rate-limit': '5M/5M', 'session-timeout': '0', 'idle-timeout': '0' },
        { name: 'home-standard-10mbps', 'local-address': localAddress, 'remote-address': remotePool, 'dns-server': '8.8.8.8,8.8.4.4', 'rate-limit': '10M/10M', 'session-timeout': '0', 'idle-timeout': '0' },
        { name: 'home-premium-20mbps', 'local-address': localAddress, 'remote-address': remotePool, 'dns-server': '8.8.8.8,8.8.4.4', 'rate-limit': '20M/20M', 'session-timeout': '0', 'idle-timeout': '0' },
        { name: 'business-50mbps', 'local-address': localAddress, 'remote-address': remotePool, 'dns-server': '8.8.8.8,8.8.4.4', 'rate-limit': '50M/50M', 'session-timeout': '0', 'idle-timeout': '0' },
      ];

      const existingProfiles = await MikroTikService.makeRequest(
        config,
        '/rest/ppp/profile',
        'GET'
      );

      const createdProfiles = [];

      for (const profile of profiles) {
        const profileExists = Array.isArray(existingProfiles)
          ? existingProfiles.find((p: any) => p.name === profile.name)
          : false;

        if (!profileExists) {
          const result = await MikroTikService.makeRequest(
            config,
            '/rest/ppp/profile',
            'PUT',
            profile
          );
          createdProfiles.push(result);
        }
      }

      return {
        success: true,
        step: 'pppoe_user_profiles',
        message: `Created ${profiles.length} PPPoE user profiles successfully`,
        data: { profilesCreated: createdProfiles.length, profiles: profiles.map(p => p.name) },
      };
    } catch (error) {
      return {
        success: false,
        step: 'pppoe_user_profiles',
        message: 'Failed to create PPPoE user profiles',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async createSpecialProfiles(
    config: MikroTikConnectionConfig
  ): Promise<ConfigurationResult> {
    try {
      const specialProfiles = [
        { name: 'trial-15min', 'session-timeout': '15m', 'idle-timeout': '5m', 'keepalive-timeout': '1m', 'status-autorefresh': '30s', 'shared-users': '1', 'rate-limit': '1M/2M', 'transparent-proxy': 'yes' },
        { name: 'admin-unlimited', 'session-timeout': '0', 'idle-timeout': '0', 'keepalive-timeout': '2m', 'status-autorefresh': '1m', 'shared-users': '1', 'rate-limit': '50M/50M', 'transparent-proxy': 'no' },
      ];

      const existingProfiles = await MikroTikService.makeRequest(
        config,
        '/rest/ip/hotspot/user/profile',
        'GET'
      );

      const createdProfiles = [];

      for (const profile of specialProfiles) {
        const profileExists = Array.isArray(existingProfiles)
          ? existingProfiles.find((p: any) => p.name === profile.name)
          : false;

        if (!profileExists) {
          const result = await MikroTikService.makeRequest(
            config,
            '/rest/ip/hotspot/user/profile',
            'PUT',
            profile
          );
          createdProfiles.push(result);
        }
      }

      return {
        success: true,
        step: 'special_profiles',
        message: 'Special profiles created successfully',
        data: { profilesCreated: createdProfiles.length },
      };
    } catch (error) {
      return {
        success: false,
        step: 'special_profiles',
        message: 'Failed to create special profiles',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// ============================================
// EXPORTS
// ============================================

export type {
  MikroTikConnectionConfig,
  MikroTikSystemResource,
  ConnectionTestResult,
  InterfaceInfo,
  ConfigurationResult,
  IPPoolConfig,
  DHCPServerConfig,
  DHCPNetworkConfig,
  NATRuleConfig,
  PPPoEServerConfig,
  PPPProfileConfig,
  HotspotProfileConfig,
  HotspotServerConfig,
};

export default MikroTikService;