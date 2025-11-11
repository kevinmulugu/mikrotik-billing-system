// lib/providers/unifi-provider.ts

import {
  RouterProvider,
  RouterConnectionConfig,
  RouterType,
  ServiceType,
  ConnectionResult,
  ConnectionTestResult,
  VoucherGenerationParams,
  VoucherGenerationResult,
  GeneratedVoucher,
  VoucherActivationResult,
  VoucherStatus,
  PackageManagementStrategy,
  PackageSyncResult,
  SyncedPackage,
  CaptivePortalConfig,
  CaptivePortalFiles,
  DeploymentResult,
  RouterInfo,
  ActiveUser,
  RouterHealth,
  CaptivePortalMethod,
  VoucherFormat,
} from '@/lib/interfaces/router-provider.interface';
import {
  UniFiService,
  UniFiConnectionConfig,
  UniFiVoucher,
  UniFiHotspotPackage,
} from '@/lib/services/unifi';

/**
 * UniFi Controller Provider
 * 
 * Implements RouterProvider interface for UniFi Controllers
 * Supports: Hotspot (vouchers only)
 * Note: UniFi does not support PPPoE vouchers
 */
export class UniFiProvider implements RouterProvider {
  public readonly type: RouterType = 'unifi';
  private config: RouterConnectionConfig;
  private unifiConfig: UniFiConnectionConfig;
  private service: UniFiService;
  private selectedSite: string;

  constructor(config: RouterConnectionConfig) {
    this.config = config;
    // UniFi site stored in vendorConfig or default to 'default'
    this.selectedSite = 'default';
    
    // Map RouterConnectionConfig to UniFiConnectionConfig
    this.unifiConfig = {
      controllerUrl: config.useVPN && config.vpnIP 
        ? `https://${config.vpnIP}:${config.port}`
        : `https://${config.ipAddress}:${config.port}`,
      username: config.username,
      password: config.password,
      site: this.selectedSite,
      verifySsl: false, // Most UniFi controllers use self-signed certs
    };

    this.service = new UniFiService(this.unifiConfig);
  }

  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================

  async connect(): Promise<ConnectionResult> {
    return this.testConnection();
  }

  async disconnect(): Promise<void> {
    await this.service.logout();
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.service.testConnection();
      
      if (result.success) {
        return {
          success: true,
          data: {
            connected: true,
            routerInfo: {
              version: result.version || 'unknown',
              model: 'UniFi Controller',
              identity: this.selectedSite,
              cpuLoad: 0,
              memoryUsage: 0,
              uptime: '0s',
            },
          },
        };
      }

      return {
        success: false,
        error: result.error || 'Connection failed',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  // ============================================
  // SERVICE CAPABILITIES
  // ============================================

  getSupportedServices(): ServiceType[] {
    // UniFi only supports hotspot vouchers
    return ['hotspot'];
  }

  supportsService(service: ServiceType): boolean {
    return service === 'hotspot';
  }

  // ============================================
  // VOUCHER OPERATIONS (Hotspot Only)
  // ============================================

  async generateVouchersForService(
    service: ServiceType,
    params: VoucherGenerationParams
  ): Promise<VoucherGenerationResult> {
    if (service !== 'hotspot') {
      return {
        success: false,
        vouchers: [],
        error: `UniFi provider only supports hotspot service, got ${service}`,
      };
    }

    try {
      // Parse bandwidth from package name or use defaults
      const bandwidth = this.parseBandwidthFromPackage(params.packageName);
      
      const unifiVouchers = await this.service.createVouchers(
        {
          quantity: params.quantity,
          duration: params.duration,
          quota: 0, // 0 = unlimited uses (can be customized)
          note: `${params.packageName} - ${params.price} KSH`,
          uploadLimit: bandwidth.upload,
          downloadLimit: bandwidth.download,
        },
        this.selectedSite
      );

      const vouchers: GeneratedVoucher[] = unifiVouchers.map((v) => ({
        code: v.code,
        password: v.code, // UniFi uses same code for both
        packageName: params.packageName,
        duration: params.duration,
        price: params.price,
        vendorData: {
          unifiId: v._id,
          createTime: v.create_time,
          quota: v.quota,
        },
      }));

      return {
        success: vouchers.length > 0,
        vouchers,
      };
    } catch (error) {
      return {
        success: false,
        vouchers: [],
        error: error instanceof Error ? error.message : 'Voucher generation failed',
      };
    }
  }

  async activateVoucher(
    service: ServiceType,
    code: string
  ): Promise<VoucherActivationResult> {
    // UniFi vouchers are automatically activated when user enters code
    // This method is a no-op for UniFi
    return {
      success: true,
      message: 'Voucher will be activated when guest enters code in captive portal',
    };
  }

  async deactivateVoucher(
    service: ServiceType,
    code: string
  ): Promise<void> {
    try {
      const voucher = await this.service.getVoucher(code, this.selectedSite);
      
      if (!voucher) {
        throw new Error(`Voucher ${code} not found`);
      }

      await this.service.deleteVoucher(voucher._id, this.selectedSite);
    } catch (error) {
      console.error(`Failed to deactivate voucher ${code}:`, error);
      throw error;
    }
  }

  async getVoucherStatus(
    service: ServiceType,
    code: string
  ): Promise<VoucherStatus> {
    try {
      const voucher = await this.service.getVoucher(code, this.selectedSite);

      if (!voucher) {
        return {
          code,
          status: 'expired',
        };
      }

      // Determine status based on voucher data
      let status: 'active' | 'used' | 'expired' | 'disabled' = 'active';
      
      if (voucher.status === 'USED' || (voucher.quota > 0 && voucher.used >= voucher.quota)) {
        status = 'used';
      } else if (voucher.status_expires && voucher.status_expires < Date.now() / 1000) {
        status = 'expired';
      }

      return {
        code,
        status,
      };
    } catch (error) {
      return {
        code,
        status: 'expired',
      };
    }
  }

  // ============================================
  // PACKAGE MANAGEMENT (Create on Controller)
  // ============================================

  getPackageManagementStrategy(service: ServiceType): PackageManagementStrategy {
    // UniFi doesn't have traditional packages, vouchers are standalone
    // But we can sync hotspot packages if needed
    return 'sync_from_router';
  }

  async syncPackagesFromRouter(service: ServiceType): Promise<PackageSyncResult> {
    try {
      if (service !== 'hotspot') {
        return {
          success: false,
          packages: [],
          added: 0,
          updated: 0,
          removed: 0,
          error: 'UniFi only supports hotspot service',
        };
      }

      const hotspotPackages = await this.service.getHotspotPackages(this.selectedSite);
      
      const packages: SyncedPackage[] = hotspotPackages.map((pkg) => ({
        unifiId: pkg._id,
        name: pkg.name,
        displayName: pkg.name,
        price: 0, // Price not stored in UniFi
        duration: pkg.time_limit_minutes || 0,
        bandwidth: {
          upload: pkg.upload_limit_kbps || 0,
          download: pkg.download_limit_kbps || 0,
        },
        disabled: false,
        lastSynced: new Date(),
      }));

      return {
        success: true,
        packages,
        added: packages.length,
        updated: 0,
        removed: 0,
      };
    } catch (error) {
      return {
        success: false,
        packages: [],
        added: 0,
        updated: 0,
        removed: 0,
        error: error instanceof Error ? error.message : 'Package sync failed',
      };
    }
  }

  // ============================================
  // CAPTIVE PORTAL (SSH Deploy)
  // ============================================

  getCaptivePortalConfig(): CaptivePortalConfig {
    return {
      method: 'ssh_deploy',
      targetPath: '/srv/unifi/data/sites/{site}/guest',
      requiresSSH: true,
      supportsCustomization: true,
    };
  }

  async deployCaptivePortal(files: CaptivePortalFiles): Promise<DeploymentResult> {
    // UniFi captive portal customization requires SSH access to controller
    // Or GUI-based customization through controller settings
    return {
      success: false,
      message: 'UniFi captive portal deployment requires SSH access or GUI customization',
      error: 'Use UniFi Controller web interface to customize guest portal',
    };
  }

  // ============================================
  // ROUTER INFORMATION
  // ============================================

  async getRouterInfo(): Promise<RouterInfo> {
    try {
      const status = await this.service.getControllerStatus();
      const sites = await this.service.getSites();

      return {
        version: status.version || 'unknown',
        model: 'UniFi Controller',
        identity: this.selectedSite,
        cpuLoad: 0, // UniFi API doesn't expose CPU load easily
        memoryUsage: 0,
        uptime: '0s',
      };
    } catch (error) {
      console.error('Failed to get router info:', error);
      return {
        version: 'unknown',
        model: 'UniFi Controller',
        identity: this.selectedSite,
        cpuLoad: 0,
        memoryUsage: 0,
        uptime: '0s',
      };
    }
  }

  async getActiveUsers(service?: ServiceType): Promise<ActiveUser[]> {
    try {
      if (service && service !== 'hotspot') {
        return [];
      }

      const clients = await this.service.getVoucherClients(this.selectedSite);

      return clients.map((client) => ({
        username: client.voucher_code || client.hostname || client.mac,
        macAddress: client.mac,
        ipAddress: client.ip || 'unknown',
        uptime: this.formatUptime(client.uptime),
        bytesIn: client.rx_bytes,
        bytesOut: client.tx_bytes,
        service: 'hotspot' as ServiceType,
      }));
    } catch (error) {
      console.error('Failed to get active users:', error);
      return [];
    }
  }

  async getRouterHealth(): Promise<RouterHealth> {
    try {
      const status = await this.service.getControllerStatus();
      const activeUsers = await this.getActiveUsers();

      return {
        status: 'online',
        lastChecked: new Date(),
        uptime: 0, // UniFi API doesn't provide uptime easily
        cpuUsage: 0,
        memoryUsage: 0,
        connectedUsers: activeUsers.length,
      };
    } catch (error) {
      return {
        status: 'offline',
        lastChecked: new Date(),
        uptime: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        connectedUsers: 0,
      };
    }
  }

  // ============================================
  // ROUTER CAPABILITIES
  // ============================================

  supportsVPN(): boolean {
    return false; // UniFi Controller doesn't expose VPN API
  }

  supportsMultipleSites(): boolean {
    return true; // UniFi supports multiple sites
  }

  getCaptivePortalMethod(): CaptivePortalMethod {
    return 'ssh_deploy';
  }

  getVoucherFormat(service: ServiceType): VoucherFormat {
    return 'numeric_code'; // UniFi uses numeric codes like "12345-67890"
  }

  // ============================================
  // SITE MANAGEMENT (UniFi Specific)
  // ============================================

  async getSites(): Promise<Array<{ id: string; name: string; description: string }>> {
    try {
      const sites = await this.service.getSites();
      return sites.map((s) => ({
        id: s._id,
        name: s.name,
        description: s.desc,
      }));
    } catch (error) {
      console.error('Failed to get sites:', error);
      return [];
    }
  }

  async switchSite(siteId: string): Promise<boolean> {
    try {
      // Verify site exists
      const site = await this.service.getSite(siteId);
      
      if (site) {
        this.selectedSite = siteId;
        this.unifiConfig.site = siteId;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to switch site:', error);
      return false;
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private parseBandwidthFromPackage(packageName: string): {
    upload: number;
    download: number;
  } {
    // Try to extract bandwidth from package name
    // Examples: "1hour-10mbps", "daily-5mbps", "weekly-20mbps"
    const bandwidthMatch = packageName.match(/(\d+)mbps/i);
    
    if (bandwidthMatch && bandwidthMatch[1]) {
      const mbps = parseInt(bandwidthMatch[1]);
      const kbps = mbps * 1024;
      return {
        upload: kbps,
        download: kbps,
      };
    }

    // Default bandwidth: 10 Mbps
    return {
      upload: 10240, // 10 Mbps in Kbps
      download: 10240,
    };
  }

  private formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h${minutes}m`;
    }
    
    return `${minutes}m`;
  }
}
