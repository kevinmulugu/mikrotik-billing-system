// lib/services/mikrotik.ts - Complete MikroTik Service (Fixed Version with Cleanup)

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

interface BridgePort {
  '.id': string;
  bridge: string;
  interface: string;
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
  'html-directory'?: string;
  'http-proxy'?: string;
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

interface HotspotUserConfig {
  name: string;                    // Voucher code
  password: string;                // Voucher password
  profile: string;                 // MikroTik profile name (e.g., "3hours-25ksh")
  limitUptime?: string;            // Session duration (e.g., "3h", "1d") - CRITICAL
  server?: string;                 // Hotspot server (default: "hotspot1")
  comment?: string;                // Auto-generated if not provided
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
      const fetchOptions: RequestInit = {
        method,
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      };
      if (body !== undefined) {
        fetchOptions.body = JSON.stringify(body);
      }
      const response = await fetch(`${baseUrl}${endpoint}`, fetchOptions);

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

  /**
   * Hybrid request strategy with automatic fallback for POST operations
   * Handles RouterOS version differences in REST API implementation
   */
  static async makeHybridRequest(
    config: MikroTikConnectionConfig,
    endpoint: string,
    body: any
  ): Promise<any> {
    // Strategy 1: Try POST (standard REST API method for creation)
    try {
      return await this.makeRequest(config, endpoint, 'POST', body);
    } catch (error1) {
      const errorMsg = error1 instanceof Error ? error1.message : '';
      
      // Strategy 2: Try POST with /add suffix (older RouterOS versions)
      if (errorMsg.includes('400') || errorMsg.includes('no such command')) {
        try {
          return await this.makeRequest(config, `${endpoint}/add`, 'POST', body);
        } catch (error2) {
          // Strategy 3: Fall back to CLI API (most reliable)
          return await this.makeCliRequest(config, endpoint, body);
        }
      }
      
      throw error1;
    }
  }

  /**
   * CLI API fallback for problematic REST API endpoints
   */
  static async makeCliRequest(
    config: MikroTikConnectionConfig,
    endpoint: string,
    body: any
  ): Promise<any> {
    const cliPath = endpoint.replace('/rest', '');
    const commands = [cliPath];
    
    // Convert body object to CLI parameters
    for (const [key, value] of Object.entries(body)) {
      commands.push(`=${key}=${value}`);
    }

    const cliRequest = { commands };
    return await this.makeRequest(config, '/rest/cli', 'POST', cliRequest);
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

      const routerInfo = {
        version: data.version || 'Unknown',
        model: data['board-name'] || 'Unknown',
        cpuLoad: data['cpu-load'] || 0,
        memoryUsage: Math.round(memoryUsage),
        uptime: data.uptime || '0s',
        ...(data['cpu-count'] && { cpuCount: data['cpu-count'] }),
        ...(data.platform && { platform: data.platform }),
      };

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

  static async getBridgePorts(config: MikroTikConnectionConfig): Promise<BridgePort[]> {
    try {
      const ports = await this.makeRequest(config, '/rest/interface/bridge/port', 'GET');
      return Array.isArray(ports) ? ports : [];
    } catch (error) {
      console.error('Failed to fetch bridge ports:', error);
      return [];
    }
  }

  static async findBridgePort(
    config: MikroTikConnectionConfig,
    bridgeName: string,
    interfaceName: string
  ): Promise<BridgePort | null> {
    const ports = await this.getBridgePorts(config);
    return ports.find(p => p.bridge === bridgeName && p.interface === interfaceName) || null;
  }

  static async removeBridgePort(
    config: MikroTikConnectionConfig,
    portId: string
  ): Promise<void> {
    try {
      await this.makeRequest(config, `/rest/interface/bridge/port/${portId}`, 'DELETE');
    } catch (error) {
      // Fallback to CLI API for removal
      const cliRequest = {
        commands: [
          '/interface/bridge/port/remove',
          `=.id=${portId}`,
        ],
      };
      await this.makeRequest(config, '/rest/cli', 'POST', cliRequest);
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

  /**
   * Get all hotspot user profiles (packages)
   */
  static async getHotspotUserProfiles(config: MikroTikConnectionConfig): Promise<any[]> {
    try {
      const profiles = await this.makeRequest(
        config,
        '/rest/ip/hotspot/user/profile',
        'GET'
      );
      return Array.isArray(profiles) ? profiles : [];
    } catch (error) {
      console.error('Failed to fetch hotspot user profiles:', error);
      return [];
    }
  }

  /**
   * Get single hotspot user profile
   */
  static async getHotspotUserProfile(
    config: MikroTikConnectionConfig,
    profileName: string
  ): Promise<any | null> {
    try {
      const profiles = await this.getHotspotUserProfiles(config);
      return profiles.find((p: any) => p.name === profileName) || null;
    } catch (error) {
      console.error('Failed to fetch hotspot user profile:', error);
      return null;
    }
  }

  /**
   * Create hotspot user profile
   */
  static async createHotspotUserProfile(
    config: MikroTikConnectionConfig,
    profileConfig: any
  ): Promise<any> {
    try {
      return await this.makeHybridRequest(
        config,
        '/rest/ip/hotspot/user/profile',
        profileConfig
      );
    } catch (error) {
      console.error('Failed to create hotspot user profile:', error);
      throw error;
    }
  }

  /**
   * Delete hotspot user profile
   */
  static async deleteHotspotUserProfile(
    config: MikroTikConnectionConfig,
    profileName: string
  ): Promise<boolean> {
    try {
      const profile = await this.getHotspotUserProfile(config, profileName);
      if (!profile) return false;

      await this.makeRequest(
        config,
        `/rest/ip/hotspot/user/profile/${profile['.id']}`,
        'DELETE'
      );
      return true;
    } catch (error) {
      console.error('Failed to delete hotspot user profile:', error);
      return false;
    }
  }

  /**
   * Get all active hotspot users
   */
  static async getActiveHotspotUsers(config: MikroTikConnectionConfig): Promise<any[]> {
    try {
      const activeUsers = await this.makeRequest(
        config,
        '/rest/ip/hotspot/active',
        'GET'
      );
      return Array.isArray(activeUsers) ? activeUsers : [];
    } catch (error) {
      console.error('Failed to fetch active hotspot users:', error);
      return [];
    }
  }

  /**
   * Get all active PPPoE users
   */
  static async getActivePPPoEUsers(config: MikroTikConnectionConfig): Promise<any[]> {
    try {
      const activeUsers = await this.makeRequest(
        config,
        '/rest/ppp/active',
        'GET'
      );
      return Array.isArray(activeUsers) ? activeUsers : [];
    } catch (error) {
      console.error('Failed to fetch active PPPoE users:', error);
      return [];
    }
  }

  /**
   * Disconnect specific user
   */
  static async disconnectUser(
    config: MikroTikConnectionConfig,
    sessionId: string,
    type: 'hotspot' | 'pppoe'
  ): Promise<boolean> {
    try {
      const endpoint = type === 'hotspot' 
        ? `/rest/ip/hotspot/active/${sessionId}`
        : `/rest/ppp/active/${sessionId}`;

      await this.makeRequest(config, endpoint, 'DELETE');
      return true;
    } catch (error) {
      console.error('Failed to disconnect user:', error);
      return false;
    }
  }

  /**
   * Get user session details
   */
  static async getUserSession(
    config: MikroTikConnectionConfig,
    sessionId: string,
    type: 'hotspot' | 'pppoe'
  ): Promise<any | null> {
    try {
      const endpoint = type === 'hotspot'
        ? `/rest/ip/hotspot/active/${sessionId}`
        : `/rest/ppp/active/${sessionId}`;

      return await this.makeRequest(config, endpoint, 'GET');
    } catch (error) {
      console.error('Failed to get user session:', error);
      return null;
    }
  }

  /**
   * Create hotspot user (voucher)
   * Automatically generates comment and sets default server
   */
  static async createHotspotUser(
    config: MikroTikConnectionConfig,
    userConfig: HotspotUserConfig
  ): Promise<any> {
    try {
      // Auto-generate comment if not provided
      // Extract display name from profile (e.g., "3hours-25ksh" -> "3hours-25ksh")
      const comment = userConfig.comment || 
        `${userConfig.profile} voucher - Generated automatically`;
      
      // Default server to 'hotspot1' if not provided
      const server = userConfig.server || 'hotspot1';
      
      // Validate required fields
      if (!userConfig.name || !userConfig.password || !userConfig.profile) {
        throw new Error('name, password, and profile are required');
      }
      
      if (!userConfig.limitUptime) {
        throw new Error('limitUptime is required for hotspot users');
      }
      
      // Build MikroTik API payload
      // Note: MikroTik uses kebab-case for parameter names
      const mikrotikPayload = {
        name: userConfig.name,
        password: userConfig.password,
        profile: userConfig.profile,
        'limit-uptime': userConfig.limitUptime,
        server: server,
        comment: comment,
      };
      
      return await this.makeHybridRequest(
        config,
        '/rest/ip/hotspot/user',
        mikrotikPayload
      );
    } catch (error) {
      console.error('Failed to create hotspot user:', error);
      throw error;
    }
  }

  /**
   * Get hotspot user details
   */
  static async getHotspotUser(
    config: MikroTikConnectionConfig,
    username: string
  ): Promise<any | null> {
    try {
      const users = await this.makeRequest(
        config,
        '/rest/ip/hotspot/user',
        'GET'
      );
      
      if (!Array.isArray(users)) return null;
      return users.find((u: any) => u.name === username) || null;
    } catch (error) {
      console.error('Failed to get hotspot user:', error);
      return null;
    }
  }

  /**
   * Delete hotspot user
   */
  static async deleteHotspotUser(
    config: MikroTikConnectionConfig,
    username: string
  ): Promise<boolean> {
    try {
      const user = await this.getHotspotUser(config, username);
      if (!user) return false;

      await this.makeRequest(
        config,
        `/rest/ip/hotspot/user/${user['.id']}`,
        'DELETE'
      );
      return true;
    } catch (error) {
      console.error('Failed to delete hotspot user:', error);
      return false;
    }
  }

  /**
   * Check if voucher exists on router
   */
  static async voucherExists(
    config: MikroTikConnectionConfig,
    username: string
  ): Promise<boolean> {
    const user = await this.getHotspotUser(config, username);
    return user !== null;
  }

  /**
   * Bulk create hotspot users
   */
  static async bulkCreateHotspotUsers(
    config: MikroTikConnectionConfig,
    users: Array<{
      name: string;
      password: string;
      profile: string;
      comment?: string;
    }>
  ): Promise<{ success: number; failed: number; errors: any[] }> {
    const results = { success: 0, failed: 0, errors: [] as any[] };

    for (const user of users) {
      try {
        await this.createHotspotUser(config, user);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          user: user.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get all IP pools
   */
  static async getIPPools(config: MikroTikConnectionConfig): Promise<any[]> {
    try {
      const pools = await this.makeRequest(
        config,
        '/rest/ip/pool',
        'GET'
      );
      return Array.isArray(pools) ? pools : [];
    } catch (error) {
      console.error('Failed to fetch IP pools:', error);
      return [];
    }
  }

  /**
   * Get IP pool details with usage
   */
  static async getIPPoolDetails(
    config: MikroTikConnectionConfig,
    poolName: string
  ): Promise<any | null> {
    try {
      const pools = await this.getIPPools(config);
      const pool = pools.find((p: any) => p.name === poolName);
      
      if (!pool) return null;

      // Get pool usage from DHCP leases or active sessions
      const leases = await this.makeRequest(
        config,
        '/rest/ip/dhcp-server/lease',
        'GET'
      );

      const usedIPs = Array.isArray(leases) 
        ? leases.filter((l: any) => l['address-pool'] === poolName).length 
        : 0;

      return {
        ...pool,
        usage: {
          total: this.calculatePoolSize(pool.ranges),
          used: usedIPs,
          available: this.calculatePoolSize(pool.ranges) - usedIPs,
        },
      };
    } catch (error) {
      console.error('Failed to get IP pool details:', error);
      return null;
    }
  }

  /**
   * Calculate pool size from range string
   */
  private static calculatePoolSize(ranges: string): number {
    try {
      const rangeList = ranges.split(',');
      let total = 0;

      for (const range of rangeList) {
        const [start, end] = range.trim().split('-');
        if (!end) {
          total += 1; // Single IP
        } else {
          const startOctet = start ? parseInt(start.split('.').pop() || '0') : 0;
          const endOctet = end ? parseInt(end.split('.').pop() || '0') : 0;
          total += (endOctet - startOctet + 1);
        }
      }

      return total;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get all DHCP servers
   */
  static async getDHCPServers(config: MikroTikConnectionConfig): Promise<any[]> {
    try {
      const servers = await this.makeRequest(
        config,
        '/rest/ip/dhcp-server',
        'GET'
      );
      return Array.isArray(servers) ? servers : [];
    } catch (error) {
      console.error('Failed to fetch DHCP servers:', error);
      return [];
    }
  }

  /**
   * Get DHCP leases
   */
  static async getDHCPLeases(
    config: MikroTikConnectionConfig,
    serverName?: string
  ): Promise<any[]> {
    try {
      const leases = await this.makeRequest(
        config,
        '/rest/ip/dhcp-server/lease',
        'GET'
      );

      if (!Array.isArray(leases)) return [];

      if (serverName) {
        return leases.filter((l: any) => l['active-server'] === serverName);
      }

      return leases;
    } catch (error) {
      console.error('Failed to fetch DHCP leases:', error);
      return [];
    }
  }

  /**
   * Get hotspot servers
   */
  static async getHotspotServers(config: MikroTikConnectionConfig): Promise<any[]> {
    try {
      const servers = await this.makeRequest(
        config,
        '/rest/ip/hotspot',
        'GET'
      );
      return Array.isArray(servers) ? servers : [];
    } catch (error) {
      console.error('Failed to fetch hotspot servers:', error);
      return [];
    }
  }

  /**
   * Get hotspot server details
   */
  static async getHotspotServerDetails(
    config: MikroTikConnectionConfig,
    serverName: string
  ): Promise<any | null> {
    try {
      const servers = await this.getHotspotServers(config);
      return servers.find((s: any) => s.name === serverName) || null;
    } catch (error) {
      console.error('Failed to get hotspot server details:', error);
      return null;
    }
  }

  /**
   * Restart hotspot service
   */
  static async restartHotspotService(
    config: MikroTikConnectionConfig,
    serverName: string
  ): Promise<boolean> {
    try {
      const server = await this.getHotspotServerDetails(config, serverName);
      if (!server) return false;

      const serverId = server['.id'];

      // Disable
      await this.makeRequest(
        config,
        `/rest/ip/hotspot/${serverId}`,
        'PATCH',
        { disabled: 'true' }
      );

      // Wait 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Enable
      await this.makeRequest(
        config,
        `/rest/ip/hotspot/${serverId}`,
        'PATCH',
        { disabled: 'false' }
      );

      return true;
    } catch (error) {
      console.error('Failed to restart hotspot service:', error);
      return false;
    }
  }

  /**
   * Get interface statistics
   */
  static async getInterfaceStats(
    config: MikroTikConnectionConfig,
    interfaceName: string
  ): Promise<any | null> {
    try {
      const interfaces = await this.getInterfaces(config);
      const iface = interfaces.find((i: any) => i.name === interfaceName);
      
      if (!iface) return null;

      // Get traffic stats
      const stats = await this.makeRequest(
        config,
        `/rest/interface/${iface['.id']}/traffic`,
        'GET'
      );

      return {
        ...iface,
        stats: stats || {},
      };
    } catch (error) {
      console.error('Failed to get interface stats:', error);
      return null;
    }
  }

  /**
   * Get wireless registration table
   */
  static async getWirelessRegistrations(config: MikroTikConnectionConfig): Promise<any[]> {
    try {
      const registrations = await this.makeRequest(
        config,
        '/rest/interface/wireless/registration-table',
        'GET'
      );
      return Array.isArray(registrations) ? registrations : [];
    } catch (error) {
      console.error('Failed to fetch wireless registrations:', error);
      return [];
    }
  }

  /**
   * Get system logs
   */
  static async getSystemLogs(
    config: MikroTikConnectionConfig,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const logs = await this.makeRequest(
        config,
        '/rest/log',
        'GET'
      );
      
      if (!Array.isArray(logs)) return [];
      
      // Return most recent logs first
      return logs.slice(-limit).reverse();
    } catch (error) {
      console.error('Failed to fetch system logs:', error);
      return [];
    }
  }

  /**
   * Get active connections count
   */
  static async getActiveConnectionsCount(config: MikroTikConnectionConfig): Promise<number> {
    try {
      const connections = await this.makeRequest(
        config,
        '/rest/ip/firewall/connection',
        'GET'
      );
      return Array.isArray(connections) ? connections.length : 0;
    } catch (error) {
      console.error('Failed to get active connections count:', error);
      return 0;
    }
  }

  /**
   * Test internet connectivity from router
   */
  static async testInternetConnection(config: MikroTikConnectionConfig): Promise<boolean> {
    try {
      // Ping Google DNS
      const result = await this.makeRequest(
        config,
        '/rest/tool/ping',
        'POST',
        {
          address: '8.8.8.8',
          count: '3',
        }
      );
      return result ? true : false;
    } catch (error) {
      console.error('Failed to test internet connection:', error);
      return false;
    }
  }

  /**
   * Block MAC address
   */
  static async blockMacAddress(
    config: MikroTikConnectionConfig,
    macAddress: string,
    comment?: string
  ): Promise<boolean> {
    try {
      await this.makeHybridRequest(
        config,
        '/rest/ip/hotspot/ip-binding',
        {
          'mac-address': macAddress,
          type: 'blocked',
          comment: comment || `Blocked on ${new Date().toISOString()}`,
        }
      );
      return true;
    } catch (error) {
      console.error('Failed to block MAC address:', error);
      return false;
    }
  }

  /**
   * Unblock MAC address
   */
  static async unblockMacAddress(
    config: MikroTikConnectionConfig,
    macAddress: string
  ): Promise<boolean> {
    try {
      const bindings = await this.makeRequest(
        config,
        '/rest/ip/hotspot/ip-binding',
        'GET'
      );

      if (!Array.isArray(bindings)) return false;

      const binding = bindings.find(
        (b: any) => b['mac-address'] === macAddress && b.type === 'blocked'
      );

      if (!binding) return false;

      await this.makeRequest(
        config,
        `/rest/ip/hotspot/ip-binding/${binding['.id']}`,
        'DELETE'
      );

      return true;
    } catch (error) {
      console.error('Failed to unblock MAC address:', error);
      return false;
    }
  }

  /**
   * Get blocked MAC addresses
   */
  static async getBlockedMacAddresses(config: MikroTikConnectionConfig): Promise<any[]> {
    try {
      const bindings = await this.makeRequest(
        config,
        '/rest/ip/hotspot/ip-binding',
        'GET'
      );

      if (!Array.isArray(bindings)) return [];

      return bindings.filter((b: any) => b.type === 'blocked');
    } catch (error) {
      console.error('Failed to get blocked MAC addresses:', error);
      return [];
    }
  }

  /**
   * Convert duration in minutes to MikroTik time format
   * @param minutes - Duration in minutes
   * @returns MikroTik time format string (e.g., "3h", "1d", "1w")
   */
  static convertMinutesToMikroTikFormat(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h${remainingMinutes}m` : `${hours}h`;
    } else if (minutes < 10080) {
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      return remainingHours > 0 ? `${days}d${remainingHours}h` : `${days}d`;
    } else {
      const weeks = Math.floor(minutes / 10080);
      const remainingDays = Math.floor((minutes % 10080) / 1440);
      return remainingDays > 0 ? `${weeks}w${remainingDays}d` : `${weeks}w`;
    }
  }
}

// ============================================
// MIKROTIK CLEANUP SERVICE
// ============================================

export class MikroTikCleanup {
  /**
   * Clean up default bridge configuration that conflicts with our setup
   */
  static async cleanupDefaultBridge(
    config: MikroTikConnectionConfig
  ): Promise<ConfigurationResult> {
    try {
      const bridges = await MikroTikService.makeRequest(
        config,
        '/rest/interface/bridge',
        'GET'
      );

      const defaultBridge = Array.isArray(bridges)
        ? bridges.find((b: any) => b.name === 'bridge')
        : null;

      if (defaultBridge) {
        console.log('Found default bridge, cleaning up...');
        
        // Get all ports on default bridge
        const ports = await MikroTikService.getBridgePorts(config);
        const defaultBridgePorts = ports.filter(p => p.bridge === 'bridge');

        // Remove all ports from default bridge
        for (const port of defaultBridgePorts) {
          try {
            await MikroTikService.removeBridgePort(config, port['.id']);
            console.log(`Removed ${port.interface} from default bridge`);
          } catch (error) {
            console.warn(`Failed to remove port ${port.interface}:`, error);
          }
        }
      }

      return {
        success: true,
        step: 'cleanup_default_bridge',
        message: 'Default bridge cleaned up successfully',
      };
    } catch (error) {
      return {
        success: false,
        step: 'cleanup_default_bridge',
        message: 'Failed to clean up default bridge',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Remove conflicting DHCP server configuration
   */
  static async cleanupConflictingDHCP(
    config: MikroTikConnectionConfig,
    interfaceName: string
  ): Promise<ConfigurationResult> {
    try {
      const servers = await MikroTikService.makeRequest(
        config,
        '/rest/ip/dhcp-server',
        'GET'
      );

      const conflicting = Array.isArray(servers)
        ? servers.filter((s: any) => s.interface === interfaceName)
        : [];

      for (const server of conflicting) {
        try {
          await MikroTikService.makeRequest(
            config,
            `/rest/ip/dhcp-server/${server['.id']}`,
            'DELETE'
          );
          console.log(`Removed conflicting DHCP server on ${interfaceName}`);
        } catch (error) {
          console.warn(`Failed to remove DHCP server:`, error);
        }
      }

      return {
        success: true,
        step: 'cleanup_dhcp',
        message: 'Conflicting DHCP servers removed',
      };
    } catch (error) {
      return {
        success: false,
        step: 'cleanup_dhcp',
        message: 'Failed to clean up DHCP servers',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Remove existing hotspot configuration
   */
  static async cleanupExistingHotspot(
    config: MikroTikConnectionConfig
  ): Promise<ConfigurationResult> {
    try {
      const hotspots = await MikroTikService.makeRequest(
        config,
        '/rest/ip/hotspot',
        'GET'
      );

      if (Array.isArray(hotspots) && hotspots.length > 0) {
        for (const hotspot of hotspots) {
          try {
            await MikroTikService.makeRequest(
              config,
              `/rest/ip/hotspot/${hotspot['.id']}`,
              'DELETE'
            );
            console.log(`Removed existing hotspot: ${hotspot.name}`);
          } catch (error) {
            console.warn(`Failed to remove hotspot:`, error);
          }
        }
      }

      return {
        success: true,
        step: 'cleanup_hotspot',
        message: 'Existing hotspot configuration removed',
      };
    } catch (error) {
      return {
        success: false,
        step: 'cleanup_hotspot',
        message: 'Failed to clean up hotspot',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Comprehensive cleanup before provisioning
   */
  static async performFullCleanup(
    config: MikroTikConnectionConfig,
    interfacesToClean: string[]
  ): Promise<ConfigurationResult> {
    const results = [];

    // Clean up default bridge
    const bridgeCleanup = await this.cleanupDefaultBridge(config);
    results.push(bridgeCleanup);

    // Clean up DHCP servers on target interfaces
    for (const iface of interfacesToClean) {
      const dhcpCleanup = await this.cleanupConflictingDHCP(config, iface);
      results.push(dhcpCleanup);
    }

    // Clean up existing hotspot
    const hotspotCleanup = await this.cleanupExistingHotspot(config);
    results.push(hotspotCleanup);

    const allSuccess = results.every(r => r.success);

    return {
      success: allSuccess,
      step: 'full_cleanup',
      message: allSuccess
        ? 'Full cleanup completed successfully'
        : 'Cleanup completed with some warnings',
      data: results,
    };
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

      const result = await MikroTikService.makeHybridRequest(
        config,
        '/rest/ip/dhcp-client',
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
          const result = await MikroTikService.makeHybridRequest(
            config,
            '/rest/ip/address',
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

  /**
   * Configure bridge with proper cleanup and idempotency
   * FIXES: "device already added as bridge port" error
   */
  static async configureBridge(
    config: MikroTikConnectionConfig,
    bridgeName: string,
    bridgeAddress: string,
    interfaces: string[]
  ): Promise<ConfigurationResult> {
    try {
      // Step 1: Ensure bridge exists
      const existingBridges = await MikroTikService.makeRequest(
        config,
        '/rest/interface/bridge',
        'GET'
      );

      let bridge = Array.isArray(existingBridges)
        ? existingBridges.find((b: any) => b.name === bridgeName)
        : null;

      if (!bridge) {
        console.log(`Creating bridge: ${bridgeName}`);
        bridge = await MikroTikService.makeHybridRequest(
          config,
          '/rest/interface/bridge',
          { name: bridgeName }
        );
      } else {
        console.log(`Bridge ${bridgeName} already exists`);
      }

      // Step 2: Get all existing bridge ports
      const existingPorts = await MikroTikService.getBridgePorts(config);

      // Step 3: Process each interface with proper cleanup
      for (const iface of interfaces) {
        console.log(`Processing interface: ${iface}`);
        
        // Check if interface is already on ANY bridge
        const existingPort = existingPorts.find(p => p.interface === iface);

        if (existingPort) {
          if (existingPort.bridge === bridgeName) {
            // Already on correct bridge - skip
            console.log(`✓ Interface ${iface} already on bridge ${bridgeName}`);
            continue;
          } else {
            // On different bridge - remove it first
            console.log(`Removing ${iface} from bridge ${existingPort.bridge}`);
            await MikroTikService.removeBridgePort(config, existingPort['.id']);
          }
        }

        // Add interface to bridge using hybrid request
        try {
          console.log(`Adding ${iface} to bridge ${bridgeName}`);
          await MikroTikService.makeHybridRequest(
            config,
            '/rest/interface/bridge/port',
            {
              bridge: bridgeName,
              interface: iface,
            }
          );
          console.log(`✓ Added ${iface} to bridge ${bridgeName}`);
        } catch (error) {
          console.error(`Failed to add ${iface} to bridge:`, error);
          throw error;
        }
      }

      // Step 4: Configure bridge IP address
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
        console.log(`Assigning IP ${bridgeAddress} to bridge ${bridgeName}`);
        await MikroTikService.makeHybridRequest(
          config,
          '/rest/ip/address',
          {
            address: bridgeAddress,
            interface: bridgeName,
          }
        );
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
          const result = await MikroTikService.makeHybridRequest(
            config,
            '/rest/ip/pool',
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
        await MikroTikService.makeHybridRequest(
          config,
          '/rest/ip/dhcp-server/network',
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
        await MikroTikService.makeHybridRequest(
          config,
          '/rest/ip/dhcp-server',
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
          const result = await MikroTikService.makeHybridRequest(
            config,
            '/rest/ip/firewall/nat',
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
          const result = await MikroTikService.makeHybridRequest(
            config,
            '/rest/interface/pppoe-server/server',
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
          const result = await MikroTikService.makeHybridRequest(
            config,
            '/rest/ppp/profile',
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

  /**
   * Configure hotspot with fixed login-by parameter
   * FIXES: "invalid value for argument login-by" error
   */
  static async configureHotspot(
    config: MikroTikConnectionConfig,
    hotspotProfile: HotspotProfileConfig,
    hotspotServer: HotspotServerConfig
  ): Promise<ConfigurationResult> {
    try {
      // Fix login-by parameter - must be comma-separated valid values
      const fixedProfile = {
        ...hotspotProfile,
        'login-by': 'http-chap,trial,cookie', // Correct format for MikroTik
      };

      const existingProfiles = await MikroTikService.makeRequest(
        config,
        '/rest/ip/hotspot/profile',
        'GET'
      );

      const profileExists = Array.isArray(existingProfiles)
        ? existingProfiles.find((p: any) => p.name === fixedProfile.name)
        : false;

      if (!profileExists) {
        await MikroTikService.makeHybridRequest(
          config,
          '/rest/ip/hotspot/profile',
          fixedProfile
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
        await MikroTikService.makeHybridRequest(
          config,
          '/rest/ip/hotspot',
          hotspotServer
        );
      }

      return {
        success: true,
        step: 'hotspot_configuration',
        message: 'Hotspot configured successfully',
        data: { profile: fixedProfile.name, server: hotspotServer.name },
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
        { name: '1hour-10ksh', 'address-pool': 'hotspot-pool', 'session-timeout': '1h', 'idle-timeout': '10m', 'keepalive-timeout': '2m', 'status-autorefresh': '1m', 'shared-users': '1', 'rate-limit': '2M/5M', 'transparent-proxy': 'yes' },
        { name: '3hours-25ksh', 'address-pool': 'hotspot-pool', 'session-timeout': '3h', 'idle-timeout': '15m', 'keepalive-timeout': '2m', 'status-autorefresh': '1m', 'shared-users': '1', 'rate-limit': '3M/6M', 'transparent-proxy': 'yes' },
        { name: '5hours-40ksh', 'address-pool': 'hotspot-pool', 'session-timeout': '5h', 'idle-timeout': '20m', 'keepalive-timeout': '2m', 'status-autorefresh': '1m', 'shared-users': '1', 'rate-limit': '4M/8M', 'transparent-proxy': 'yes' },
        { name: '12hours-70ksh', 'address-pool': 'hotspot-pool', 'session-timeout': '12h', 'idle-timeout': '30m', 'keepalive-timeout': '2m', 'status-autorefresh': '1m', 'shared-users': '1', 'rate-limit': '5M/10M', 'transparent-proxy': 'yes' },
        { name: '1day-100ksh', 'address-pool': 'hotspot-pool', 'session-timeout': '1d', 'idle-timeout': '1h', 'keepalive-timeout': '2m', 'status-autorefresh': '1m', 'shared-users': '1', 'rate-limit': '6M/12M', 'transparent-proxy': 'yes' },
        { name: '3days-250ksh', 'address-pool': 'hotspot-pool', 'session-timeout': '3d', 'idle-timeout': '2h', 'keepalive-timeout': '2m', 'status-autorefresh': '1m', 'shared-users': '1', 'rate-limit': '8M/15M', 'transparent-proxy': 'yes' },
        { name: '1week-400ksh', 'address-pool': 'hotspot-pool', 'session-timeout': '1w', 'idle-timeout': '4h', 'keepalive-timeout': '2m', 'status-autorefresh': '1m', 'shared-users': '1', 'rate-limit': '10M/20M', 'transparent-proxy': 'yes' },
        { name: '1month-1200ksh', 'address-pool': 'hotspot-pool', 'session-timeout': '30d', 'idle-timeout': '12h', 'keepalive-timeout': '2m', 'status-autorefresh': '1m', 'shared-users': '1', 'rate-limit': '15M/25M', 'transparent-proxy': 'yes' },
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
          const result = await MikroTikService.makeHybridRequest(
            config,
            '/rest/ip/hotspot/user/profile',
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
          const result = await MikroTikService.makeHybridRequest(
            config,
            '/rest/ppp/profile',
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
          const result = await MikroTikService.makeHybridRequest(
            config,
            '/rest/ip/hotspot/user/profile',
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
  BridgePort,
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