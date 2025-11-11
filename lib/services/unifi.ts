// lib/services/unifi.ts

import https from 'https';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * UniFi Controller Connection Configuration
 */
export interface UniFiConnectionConfig {
  controllerUrl: string;  // e.g., https://192.168.1.1:8443
  username: string;
  password: string;
  site?: string;          // Site ID (default: 'default')
  verifySsl?: boolean;    // Whether to verify SSL certificates (default: false)
}

/**
 * UniFi Site Information
 */
export interface UniFiSite {
  _id: string;
  name: string;
  desc: string;
  attr_hidden_id?: string;
  attr_no_delete?: boolean;
  role?: string;
}

/**
 * UniFi Voucher Configuration
 */
export interface UniFiVoucherConfig {
  quantity: number;
  duration: number;        // Minutes (e.g., 60, 480, 1440)
  quota?: number;          // Usage quota (0 = unlimited, 1 = single use, 2+ = multiple uses)
  note?: string;           // Optional note/description
  uploadLimit?: number;    // Upload limit in Kbps
  downloadLimit?: number;  // Download limit in Kbps
  bytesLimit?: number;     // Total bytes limit (MB)
}

/**
 * UniFi Voucher Object
 */
export interface UniFiVoucher {
  _id: string;
  site_id: string;
  note?: string;
  code: string;            // Voucher code (e.g., "12345-67890")
  quota: number;           // 0 = unlimited, 1+ = usage count
  duration: number;        // Duration in minutes
  qos_overwrite?: boolean;
  qos_upload_limit?: number;
  qos_download_limit?: number;
  used: number;            // Number of times used
  create_time: number;     // Unix timestamp
  for_hotspot?: boolean;
  admin_name?: string;
  status?: string;         // 'VALID_ONE', 'VALID_MULTI', 'USED', etc.
  status_expires?: number; // Unix timestamp when voucher expires
}

/**
 * UniFi Hotspot Package (Guest Authorization)
 */
export interface UniFiHotspotPackage {
  _id: string;
  site_id: string;
  name: string;
  download_enabled: boolean;
  download_limit_kbps?: number;
  upload_enabled: boolean;
  upload_limit_kbps?: number;
  download_limit_bytes?: number;
  time_enabled: boolean;
  time_limit_minutes?: number;
  traffic_enabled: boolean;
  traffic_limit_mb?: number;
}

/**
 * UniFi Active Client
 */
export interface UniFiActiveClient {
  _id: string;
  mac: string;
  ip?: string;
  hostname?: string;
  name?: string;
  authorized: boolean;
  voucher_code?: string;
  first_seen: number;
  last_seen: number;
  uptime: number;
  tx_bytes: number;
  rx_bytes: number;
  tx_packets: number;
  rx_packets: number;
}

/**
 * UniFi Controller Health
 */
export interface UniFiControllerHealth {
  version: string;
  uuid: string;
  update_available: boolean;
  update_downloaded: boolean;
}

/**
 * UniFi API Response
 */
interface UniFiApiResponse<T = any> {
  meta: {
    rc: string;      // 'ok' or 'error'
    msg?: string;
  };
  data: T;
}

/**
 * UniFi Controller API Client
 * 
 * Handles authentication, session management, and API calls to UniFi Controller
 * Supports UniFi OS (Dream Machine) and legacy controller
 */
export class UniFiService {
  private client: AxiosInstance;
  private config: UniFiConnectionConfig;
  private cookie?: string;
  private csrfToken?: string;
  private isUnifiOS: boolean = false; // UniFi OS uses different API paths

  constructor(config: UniFiConnectionConfig) {
    this.config = config;
    
    // Create axios instance with SSL verification disabled if needed
    this.client = axios.create({
      baseURL: config.controllerUrl,
      timeout: 30000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySsl ?? false,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Session expired, clear cookie
          this.cookie = undefined;
          this.csrfToken = undefined;
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Detect if controller is UniFi OS (Dream Machine, Cloud Key Gen2+)
   */
  private async detectUniFiOS(): Promise<boolean> {
    try {
      // Try UniFi OS endpoint
      const response = await this.client.get('/api/system', {
        validateStatus: (status) => status < 500,
      });
      
      if (response.status === 200) {
        this.isUnifiOS = true;
        return true;
      }
    } catch (error) {
      // Not UniFi OS or error
    }
    
    this.isUnifiOS = false;
    return false;
  }

  /**
   * Get base path for API calls
   * UniFi OS: /proxy/network/api/s/{site}
   * Legacy: /api/s/{site}
   */
  private getBasePath(site?: string): string {
    const siteId = site || this.config.site || 'default';
    
    if (this.isUnifiOS) {
      return `/proxy/network/api/s/${siteId}`;
    }
    
    return `/api/s/${siteId}`;
  }

  /**
   * Authenticate with UniFi Controller
   */
  async login(): Promise<boolean> {
    try {
      // Detect UniFi OS
      await this.detectUniFiOS();

      const loginPath = this.isUnifiOS ? '/api/auth/login' : '/api/login';
      
      const response = await this.client.post(loginPath, {
        username: this.config.username,
        password: this.config.password,
        remember: false,
      });

      // Extract cookies from response
      const cookies = response.headers['set-cookie'];
      if (cookies && cookies.length > 0) {
        // Store the session cookie
        this.cookie = cookies
          .map((cookie) => cookie.split(';')[0])
          .join('; ');
      }

      // Extract CSRF token if present
      const csrfCookie = cookies?.find((c) => c.startsWith('csrf_token='));
      if (csrfCookie) {
        this.csrfToken = csrfCookie.split('=')[1].split(';')[0];
      }

      return response.data?.meta?.rc === 'ok';
    } catch (error) {
      console.error('UniFi login failed:', error);
      return false;
    }
  }

  /**
   * Logout from UniFi Controller
   */
  async logout(): Promise<void> {
    try {
      const logoutPath = this.isUnifiOS ? '/api/auth/logout' : '/api/logout';
      
      await this.makeRequest(logoutPath, 'POST');
      
      this.cookie = undefined;
      this.csrfToken = undefined;
    } catch (error) {
      console.error('UniFi logout failed:', error);
    }
  }

  /**
   * Make authenticated request to UniFi Controller
   */
  private async makeRequest<T = any>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<T> {
    // Ensure we're logged in
    if (!this.cookie) {
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        throw new Error('Failed to authenticate with UniFi Controller');
      }
    }

    const config: AxiosRequestConfig = {
      method,
      url: path,
      headers: {
        Cookie: this.cookie,
      },
    };

    // Add CSRF token if available
    if (this.csrfToken) {
      config.headers!['X-Csrf-Token'] = this.csrfToken;
    }

    if (data) {
      config.data = data;
    }

    try {
      const response = await this.client.request<UniFiApiResponse<T>>(config);
      
      if (response.data?.meta?.rc !== 'ok') {
        throw new Error(response.data?.meta?.msg || 'UniFi API error');
      }

      return response.data.data;
    } catch (error: any) {
      // If 401, try to re-login once
      if (error.response?.status === 401 && this.cookie) {
        this.cookie = undefined;
        const loginSuccess = await this.login();
        
        if (loginSuccess) {
          // Retry the request
          config.headers!.Cookie = this.cookie;
          const retryResponse = await this.client.request<UniFiApiResponse<T>>(config);
          return retryResponse.data.data;
        }
      }
      
      throw error;
    }
  }

  // ============================================
  // SITE MANAGEMENT
  // ============================================

  /**
   * Get all sites from controller
   */
  async getSites(): Promise<UniFiSite[]> {
    const path = this.isUnifiOS ? '/proxy/network/api/self/sites' : '/api/self/sites';
    return this.makeRequest<UniFiSite[]>(path, 'GET');
  }

  /**
   * Get specific site details
   */
  async getSite(siteId: string): Promise<UniFiSite> {
    const sites = await this.getSites();
    const site = sites.find((s) => s.name === siteId || s._id === siteId);
    
    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }
    
    return site;
  }

  // ============================================
  // VOUCHER OPERATIONS
  // ============================================

  /**
   * Create vouchers on UniFi Controller
   */
  async createVouchers(
    config: UniFiVoucherConfig,
    site?: string
  ): Promise<UniFiVoucher[]> {
    const basePath = this.getBasePath(site);
    
    const payload = {
      cmd: 'create-voucher',
      n: config.quantity,
      expire: config.duration,
      quota: config.quota ?? 0,
      note: config.note || '',
      ...(config.uploadLimit && { up: config.uploadLimit }),
      ...(config.downloadLimit && { down: config.downloadLimit }),
      ...(config.bytesLimit && { bytes: config.bytesLimit * 1024 * 1024 }), // Convert MB to bytes
    };

    const result = await this.makeRequest<any>(
      `${basePath}/cmd/hotspot`,
      'POST',
      payload
    );

    // Fetch the created vouchers
    return this.getVouchers(site, config.quantity);
  }

  /**
   * Get all vouchers from site
   */
  async getVouchers(
    site?: string,
    limit?: number
  ): Promise<UniFiVoucher[]> {
    const basePath = this.getBasePath(site);
    
    const vouchers = await this.makeRequest<UniFiVoucher[]>(
      `${basePath}/stat/voucher`,
      'GET'
    );

    if (limit) {
      // Return most recent vouchers
      return vouchers
        .sort((a, b) => b.create_time - a.create_time)
        .slice(0, limit);
    }

    return vouchers;
  }

  /**
   * Get specific voucher by code
   */
  async getVoucher(
    code: string,
    site?: string
  ): Promise<UniFiVoucher | null> {
    const vouchers = await this.getVouchers(site);
    return vouchers.find((v) => v.code === code) || null;
  }

  /**
   * Delete voucher
   */
  async deleteVoucher(
    voucherId: string,
    site?: string
  ): Promise<boolean> {
    try {
      const basePath = this.getBasePath(site);
      
      await this.makeRequest(
        `${basePath}/cmd/hotspot`,
        'POST',
        {
          cmd: 'delete-voucher',
          _id: voucherId,
        }
      );
      
      return true;
    } catch (error) {
      console.error('Failed to delete voucher:', error);
      return false;
    }
  }

  /**
   * Revoke voucher (mark as used)
   */
  async revokeVoucher(
    voucherId: string,
    site?: string
  ): Promise<boolean> {
    try {
      const basePath = this.getBasePath(site);
      
      await this.makeRequest(
        `${basePath}/cmd/hotspot`,
        'POST',
        {
          cmd: 'revoke-voucher',
          _id: voucherId,
        }
      );
      
      return true;
    } catch (error) {
      console.error('Failed to revoke voucher:', error);
      return false;
    }
  }

  // ============================================
  // HOTSPOT PACKAGES (GUEST AUTHORIZATIONS)
  // ============================================

  /**
   * Get hotspot packages (guest authorization settings)
   */
  async getHotspotPackages(site?: string): Promise<UniFiHotspotPackage[]> {
    const basePath = this.getBasePath(site);
    
    return this.makeRequest<UniFiHotspotPackage[]>(
      `${basePath}/rest/hotspotpackage`,
      'GET'
    );
  }

  /**
   * Get specific hotspot package
   */
  async getHotspotPackage(
    packageId: string,
    site?: string
  ): Promise<UniFiHotspotPackage | null> {
    const packages = await this.getHotspotPackages(site);
    return packages.find((p) => p._id === packageId || p.name === packageId) || null;
  }

  /**
   * Create hotspot package
   */
  async createHotspotPackage(
    packageData: Partial<UniFiHotspotPackage>,
    site?: string
  ): Promise<UniFiHotspotPackage> {
    const basePath = this.getBasePath(site);
    
    return this.makeRequest<UniFiHotspotPackage>(
      `${basePath}/rest/hotspotpackage`,
      'POST',
      packageData
    );
  }

  // ============================================
  // ACTIVE CLIENTS
  // ============================================

  /**
   * Get active clients (guests)
   */
  async getActiveClients(site?: string): Promise<UniFiActiveClient[]> {
    const basePath = this.getBasePath(site);
    
    return this.makeRequest<UniFiActiveClient[]>(
      `${basePath}/stat/sta`,
      'GET'
    );
  }

  /**
   * Get guests authorized with vouchers
   */
  async getVoucherClients(site?: string): Promise<UniFiActiveClient[]> {
    const clients = await this.getActiveClients(site);
    return clients.filter((c) => c.authorized && c.voucher_code);
  }

  /**
   * Disconnect client
   */
  async disconnectClient(
    mac: string,
    site?: string
  ): Promise<boolean> {
    try {
      const basePath = this.getBasePath(site);
      
      await this.makeRequest(
        `${basePath}/cmd/stamgr`,
        'POST',
        {
          cmd: 'kick-sta',
          mac: mac.toLowerCase(),
        }
      );
      
      return true;
    } catch (error) {
      console.error('Failed to disconnect client:', error);
      return false;
    }
  }

  // ============================================
  // CONTROLLER INFORMATION
  // ============================================

  /**
   * Get controller status
   */
  async getControllerStatus(): Promise<UniFiControllerHealth> {
    const path = this.isUnifiOS ? '/proxy/network/api/status' : '/status';
    return this.makeRequest<UniFiControllerHealth>(path, 'GET');
  }

  /**
   * Test connection to controller
   */
  async testConnection(): Promise<{
    success: boolean;
    version?: string;
    sites?: number;
    error?: string;
  }> {
    try {
      const loginSuccess = await this.login();
      
      if (!loginSuccess) {
        return {
          success: false,
          error: 'Authentication failed',
        };
      }

      const sites = await this.getSites();
      const status = await this.getControllerStatus();

      return {
        success: true,
        version: status.version,
        sites: sites.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  // ============================================
  // STATIC HELPERS
  // ============================================

  /**
   * Create a UniFi service instance
   */
  static create(config: UniFiConnectionConfig): UniFiService {
    return new UniFiService(config);
  }

  /**
   * Test connection without creating persistent instance
   */
  static async testConnection(
    config: UniFiConnectionConfig
  ): Promise<{
    success: boolean;
    version?: string;
    sites?: number;
    error?: string;
  }> {
    const service = new UniFiService(config);
    const result = await service.testConnection();
    await service.logout();
    return result;
  }
}
