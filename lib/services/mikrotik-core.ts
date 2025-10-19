// lib/services/mikrotik-core.ts - Complete Part 1: Core Service

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

export class MikroTikService {
  /**
   * Core method to make HTTP requests to MikroTik REST API
   */
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
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

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

      // Handle empty responses
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Test connection to MikroTik router using REST API
   */
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

      return {
        success: true,
        data: {
          connected: true,
          routerInfo: {
            version: data.version || 'Unknown',
            model: data['board-name'] || 'Unknown',
            cpuLoad: data['cpu-load'] || 0,
            memoryUsage: Math.round(memoryUsage),
            uptime: data.uptime || '0s',
            ...(typeof data['cpu-count'] === 'number' ? { cpuCount: data['cpu-count'] } : {}),
            ...(typeof data.platform === 'string' ? { platform: data.platform } : {}),
          },
        },
      };
    } catch (error) {
      return this.handleConnectionError(error);
    }
  }

  /**
   * Handle connection errors with detailed messages
   */
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

  /**
   * Get router identity/name
   */
  static async getIdentity(config: MikroTikConnectionConfig): Promise<string | null> {
    try {
      const data = await this.makeRequest(config, '/rest/system/identity', 'GET');
      return data?.name || null;
    } catch (error) {
      console.error('Failed to fetch router identity:', error);
      return null;
    }
  }

  /**
   * Get all network interfaces
   */
  static async getInterfaces(config: MikroTikConnectionConfig): Promise<InterfaceInfo[]> {
    try {
      const interfaces = await this.makeRequest(config, '/rest/interface', 'GET');
      return Array.isArray(interfaces) ? interfaces : [];
    } catch (error) {
      console.error('Failed to fetch router interfaces:', error);
      return [];
    }
  }

  /**
   * Get MAC address of first available interface
   */
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

  /**
   * Check if hotspot is configured on router
   */
  static async checkHotspotStatus(config: MikroTikConnectionConfig): Promise<boolean> {
    try {
      const hotspots = await this.makeRequest(config, '/rest/ip/hotspot', 'GET');
      return Array.isArray(hotspots) && hotspots.length > 0;
    } catch (error) {
      console.error('Failed to check hotspot status:', error);
      return false;
    }
  }

  /**
   * Validate IP address format
   */
  static validateIpAddress(ip: string): boolean {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  /**
   * Format uptime from MikroTik string to human readable
   */
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

  /**
   * Encrypt password for storage (Base64 encoding)
   * TODO: Upgrade to AES-256 in production
   */
  static encryptPassword(password: string): string {
    return Buffer.from(password).toString('base64');
  }

  /**
   * Decrypt password from storage
   */
  static decryptPassword(encryptedPassword: string): string {
    try {
      return Buffer.from(encryptedPassword, 'base64').toString('utf-8');
    } catch (error) {
      console.error('Failed to decrypt password:', error);
      return '';
    }
  }

  /**
   * Parse uptime string to total seconds
   */
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

export type {
  MikroTikConnectionConfig,
  MikroTikSystemResource,
  ConnectionTestResult,
  InterfaceInfo,
};

export default MikroTikService;