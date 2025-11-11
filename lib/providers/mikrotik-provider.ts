// lib/providers/mikrotik-provider.ts

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
  PackageParams,
  ValidationResult,
  PackageCreationResult,
  CaptivePortalConfig,
  CaptivePortalFiles,
  DeploymentResult,
  RouterInfo,
  ActiveUser,
  RouterHealth,
  CaptivePortalMethod,
  VoucherFormat,
} from '@/lib/interfaces/router-provider.interface';
import { MikroTikService } from '@/lib/services/mikrotik';

/**
 * MikroTik Router Provider
 * 
 * Implements RouterProvider interface by wrapping existing MikroTikService
 * Supports: Hotspot, PPPoE (future), RADIUS (future)
 */
export class MikroTikProvider implements RouterProvider {
  public readonly type: RouterType = 'mikrotik';
  private config: RouterConnectionConfig;
  private connectionConfig: {
    ipAddress: string;
    port: number;
    username: string;
    password: string;
  };

  constructor(config: RouterConnectionConfig) {
    this.config = config;
    this.connectionConfig = {
      ipAddress: config.useVPN && config.vpnIP ? config.vpnIP : config.ipAddress,
      port: config.port,
      username: config.username,
      password: config.password,
    };
  }

  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================

  async connect(): Promise<ConnectionResult> {
    return this.testConnection();
  }

  async disconnect(): Promise<void> {
    // MikroTik REST API is stateless - no disconnect needed
    return Promise.resolve();
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await MikroTikService.testConnection(this.connectionConfig);
      return result;
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
    // MikroTik supports Hotspot and PPPoE
    // RADIUS can be added in future
    return ['hotspot', 'pppoe'];
  }

  supportsService(service: ServiceType): boolean {
    return ['hotspot', 'pppoe'].includes(service);
  }

  // ============================================
  // VOUCHER OPERATIONS (Service-Aware)
  // ============================================

  async generateVouchersForService(
    service: ServiceType,
    params: VoucherGenerationParams
  ): Promise<VoucherGenerationResult> {
    if (!this.supportsService(service)) {
      return {
        success: false,
        vouchers: [],
        error: `MikroTik provider does not support ${service} service`,
      };
    }

    try {
      if (service === 'hotspot') {
        return await this.generateHotspotVouchers(params);
      } else if (service === 'pppoe') {
        return await this.generatePPPoEVouchers(params);
      }

      return {
        success: false,
        vouchers: [],
        error: `Service ${service} not implemented yet`,
      };
    } catch (error) {
      return {
        success: false,
        vouchers: [],
        error: error instanceof Error ? error.message : 'Voucher generation failed',
      };
    }
  }

  private async generateHotspotVouchers(
    params: VoucherGenerationParams
  ): Promise<VoucherGenerationResult> {
    // Generate random voucher codes
    const vouchers: GeneratedVoucher[] = [];
    
    for (let i = 0; i < params.quantity; i++) {
      const code = this.generateVoucherCode(8);
      const password = code; // MikroTik hotspot uses same code for username and password

      // Create hotspot user on MikroTik
      try {
        await MikroTikService.createHotspotUser(this.connectionConfig, {
          name: code,
          password: password,
          profile: params.packageName,
          limitUptime: this.convertMinutesToMikroTikFormat(params.duration),
          comment: `Generated via API - ${params.packageName}`,
        });

        vouchers.push({
          code,
          password,
          packageName: params.packageName,
          duration: params.duration,
          price: params.price,
          vendorData: {
            profile: params.packageName,
            limitUptime: this.convertMinutesToMikroTikFormat(params.duration),
          },
        });
      } catch (error) {
        console.error(`Failed to create hotspot user ${code}:`, error);
        // Continue with other vouchers
      }
    }

    const result: VoucherGenerationResult = {
      success: vouchers.length > 0,
      vouchers,
    };
    
    if (vouchers.length === 0) {
      result.error = 'Failed to create any vouchers';
    }
    
    return result;
  }

  private async generatePPPoEVouchers(
    params: VoucherGenerationParams
  ): Promise<VoucherGenerationResult> {
    // TODO: Implement PPPoE secret generation
    // This will be implemented in Phase 2.4
    return {
      success: false,
      vouchers: [],
      error: 'PPPoE voucher generation not implemented yet',
    };
  }

  async activateVoucher(
    service: ServiceType,
    code: string
  ): Promise<VoucherActivationResult> {
    // MikroTik vouchers are automatically activated when user logs in
    // This method is a no-op for MikroTik
    return {
      success: true,
      message: 'Voucher will be activated when user logs in',
    };
  }

  async deactivateVoucher(
    service: ServiceType,
    code: string
  ): Promise<void> {
    try {
      if (service === 'hotspot') {
        await MikroTikService.deleteHotspotUser(this.connectionConfig, code);
      } else if (service === 'pppoe') {
        // TODO: Implement PPPoE secret removal
        throw new Error('PPPoE deactivation not implemented yet');
      }
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
      if (service === 'hotspot') {
        const user = await MikroTikService.getHotspotUser(this.connectionConfig, code);

        if (!user) {
          return {
            code,
            status: 'expired',
          };
        }

        return {
          code,
          status: user.disabled ? 'disabled' : 'active',
          bytesUsed: parseInt(user['bytes-in'] || '0') + parseInt(user['bytes-out'] || '0'),
        };
      }

      throw new Error(`Service ${service} not implemented`);
    } catch (error) {
      return {
        code,
        status: 'expired',
      };
    }
  }

  // ============================================
  // PACKAGE MANAGEMENT (Service-Aware)
  // ============================================

  getPackageManagementStrategy(service: ServiceType): PackageManagementStrategy {
    // MikroTik always syncs packages from router
    return 'sync_from_router';
  }

  async syncPackagesFromRouter(service: ServiceType): Promise<PackageSyncResult> {
    try {
      if (service === 'hotspot') {
        return await this.syncHotspotPackages();
      } else if (service === 'pppoe') {
        return await this.syncPPPoEPackages();
      }

      return {
        success: false,
        packages: [],
        added: 0,
        updated: 0,
        removed: 0,
        error: `Service ${service} not implemented`,
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

  private async syncHotspotPackages(): Promise<PackageSyncResult> {
    const profiles = await MikroTikService.getHotspotUserProfiles(this.connectionConfig);
    
    const packages: SyncedPackage[] = profiles
      .filter((p: any) => p.name !== 'default' && p.name !== 'default-encryption')
      .map((profile: any) => this.parseHotspotProfile(profile));

    return {
      success: true,
      packages,
      added: packages.length,
      updated: 0,
      removed: 0,
    };
  }

  private async syncPPPoEPackages(): Promise<PackageSyncResult> {
    // TODO: Implement PPPoE profile sync
    return {
      success: false,
      packages: [],
      added: 0,
      updated: 0,
      removed: 0,
      error: 'PPPoE package sync not implemented yet',
    };
  }

  private parseHotspotProfile(profile: any): SyncedPackage {
    // Extract pricing from profile name (e.g., "1hour-10ksh" -> 10)
    const priceMatch = profile.name.match(/(\d+)ksh/i);
    const price = priceMatch ? parseInt(priceMatch[1]) : 0;

    // Extract duration from session-timeout
    let duration = 0;
    const durationStr = profile['session-timeout'] || '0';
    if (durationStr.includes('h')) {
      duration = parseInt(durationStr) * 60;
    } else if (durationStr.includes('d')) {
      duration = parseInt(durationStr) * 1440;
    } else if (durationStr.includes('w')) {
      duration = parseInt(durationStr) * 10080;
    } else {
      duration = parseInt(durationStr);
    }

    // Extract bandwidth from rate-limit
    const rateLimit = profile['rate-limit'] || '';
    const [upload, download] = rateLimit.split('/').map((s: string) => {
      const match = s.match(/(\d+)([KMG]?)/i);
      if (!match) return 0;
      const value = parseInt(match[1] || '0');
      const unit = match[2]?.toUpperCase();
      if (unit === 'M') return value * 1024;
      if (unit === 'G') return value * 1024 * 1024;
      return value;
    });

    return {
      mikrotikId: profile['.id'],
      name: profile.name,
      displayName: profile.name.replace(/-/g, ' ').toUpperCase(),
      price,
      duration,
      bandwidth: {
        upload: upload || 0,
        download: download || 0,
      },
      sessionTimeout: profile['session-timeout'],
      idleTimeout: profile['idle-timeout'],
      rateLimit: profile['rate-limit'],
      addressPool: profile['address-pool'] || 'hotspot-pool',
      sharedUsers: profile['shared-users'] || '1',
      transparentProxy: profile['transparent-proxy'] || 'yes',
      disabled: false,
      lastSynced: new Date(),
    };
  }

  // ============================================
  // CAPTIVE PORTAL (Hotspot Only)
  // ============================================

  getCaptivePortalConfig(): CaptivePortalConfig {
    return {
      method: 'http_upload',
      targetPath: '/hotspot',
      requiresSSH: false,
      supportsCustomization: true,
    };
  }

  async deployCaptivePortal(files: CaptivePortalFiles): Promise<DeploymentResult> {
    // NOTE: MikroTikService.uploadCaptivePortalFiles() expects specific parameters
    // For now, return not implemented - will be added in Phase 2.5
    return {
      success: false,
      message: 'Captive portal deployment via provider interface not implemented yet',
      error: 'Use MikroTikService.uploadCaptivePortalFiles() directly with required parameters',
    };
  }

  // ============================================
  // ROUTER INFORMATION
  // ============================================

  async getRouterInfo(): Promise<RouterInfo> {
    try {
      // Use direct REST API call to system/resource
      const resource: any = await (MikroTikService as any).makeRequest(
        this.connectionConfig,
        '/rest/system/resource',
        'GET'
      );
      
      return {
        version: resource.version || 'unknown',
        model: resource['board-name'] || 'unknown',
        identity: resource.identity || 'mikrotik',
        cpuLoad: resource['cpu-load'] || 0,
        memoryUsage: resource['total-memory'] 
          ? ((resource['total-memory'] - (resource['free-memory'] || 0)) / resource['total-memory']) * 100
          : 0,
        uptime: resource.uptime || '0s',
        cpuCount: resource['cpu-count'],
        platform: resource.platform,
      };
    } catch (error) {
      console.error('Failed to get router info:', error);
      return {
        version: 'unknown',
        model: 'unknown',
        identity: 'mikrotik',
        cpuLoad: 0,
        memoryUsage: 0,
        uptime: '0s',
      };
    }
  }

  async getActiveUsers(service?: ServiceType): Promise<ActiveUser[]> {
    try {
      if (!service || service === 'hotspot') {
        const active = await MikroTikService.getActiveHotspotUsers(this.connectionConfig);
        return active.map((user: any) => ({
          username: user.user || user.name || 'unknown',
          macAddress: user['mac-address'],
          ipAddress: user.address || user['ip-address'],
          uptime: user.uptime,
          bytesIn: parseInt(user['bytes-in'] || '0'),
          bytesOut: parseInt(user['bytes-out'] || '0'),
          service: 'hotspot' as ServiceType,
        }));
      }

      if (service === 'pppoe') {
        const active = await MikroTikService.getActivePPPoEUsers(this.connectionConfig);
        return active.map((user: any) => ({
          username: user.name || 'unknown',
          ipAddress: user.address || user['ip-address'],
          uptime: user.uptime,
          bytesIn: parseInt(user['bytes-in'] || '0'),
          bytesOut: parseInt(user['bytes-out'] || '0'),
          service: 'pppoe' as ServiceType,
        }));
      }

      return [];
    } catch (error) {
      console.error('Failed to get active users:', error);
      return [];
    }
  }

  async getRouterHealth(): Promise<RouterHealth> {
    try {
      // Use direct REST API call
      const resource: any = await (MikroTikService as any).makeRequest(
        this.connectionConfig,
        '/rest/system/resource',
        'GET'
      );
      const activeUsers = await this.getActiveUsers();

      return {
        status: 'online',
        lastChecked: new Date(),
        uptime: this.parseUptime(resource.uptime || '0s'),
        cpuUsage: resource['cpu-load'] || 0,
        memoryUsage: resource['total-memory']
          ? ((resource['total-memory'] - (resource['free-memory'] || 0)) / resource['total-memory']) * 100
          : 0,
        temperature: resource.temperature || undefined,
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
    return true; // MikroTik supports WireGuard VPN
  }

  supportsMultipleSites(): boolean {
    return false; // MikroTik doesn't have site concept
  }

  getCaptivePortalMethod(): CaptivePortalMethod {
    return 'http_upload';
  }

  getVoucherFormat(service: ServiceType): VoucherFormat {
    return 'username_password'; // Both hotspot and PPPoE use username/password
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private generateVoucherCode(length: number = 8): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private convertMinutesToMikroTikFormat(minutes: number): string {
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

  private parseUptime(uptime: string): number {
    // Convert MikroTik uptime string to milliseconds
    // Examples: "1d2h3m4s", "5w3d", "12h30m"
    let ms = 0;
    
    const weeks = uptime.match(/(\d+)w/);
    const days = uptime.match(/(\d+)d/);
    const hours = uptime.match(/(\d+)h/);
    const minutes = uptime.match(/(\d+)m/);
    const seconds = uptime.match(/(\d+)s/);
    
    if (weeks && weeks[1]) ms += parseInt(weeks[1]) * 7 * 24 * 60 * 60 * 1000;
    if (days && days[1]) ms += parseInt(days[1]) * 24 * 60 * 60 * 1000;
    if (hours && hours[1]) ms += parseInt(hours[1]) * 60 * 60 * 1000;
    if (minutes && minutes[1]) ms += parseInt(minutes[1]) * 60 * 1000;
    if (seconds && seconds[1]) ms += parseInt(seconds[1]) * 1000;
    
    return ms;
  }
}
