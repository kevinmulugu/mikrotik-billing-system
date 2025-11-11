// lib/interfaces/router-provider.interface.ts

import { ObjectId } from 'mongodb';

/**
 * Service types supported by routers
 */
export type ServiceType = 'hotspot' | 'pppoe' | 'radius';

/**
 * Router types supported by the platform
 */
export type RouterType = 'mikrotik' | 'unifi';

/**
 * Captive portal deployment methods
 */
export type CaptivePortalMethod = 'http_upload' | 'ssh_deploy' | 'api_config';

/**
 * Voucher code formats
 */
export type VoucherFormat = 'username_password' | 'numeric_code';

/**
 * Package management strategies
 */
export type PackageManagementStrategy = 'sync_from_router' | 'database_defined';

/**
 * Router connection configuration
 */
export interface RouterConnectionConfig {
  ipAddress: string;
  port: number;
  username: string;
  password: string;
  // UniFi-specific
  site?: string;
  // MikroTik-specific
  useVPN?: boolean;
  vpnIP?: string;
}

/**
 * Connection test result
 */
export interface ConnectionResult {
  success: boolean;
  data?: {
    connected: boolean;
    routerInfo?: RouterInfo;
    sites?: UniFiSite[]; // For UniFi
  };
  error?: string;
}

/**
 * Connection test result (alias for backward compatibility)
 */
export interface ConnectionTestResult extends ConnectionResult {}

/**
 * Router information
 */
export interface RouterInfo {
  version: string;
  model: string;
  identity?: string;
  cpuLoad: number;
  memoryUsage: number;
  uptime: string;
  cpuCount?: number;
  platform?: string;
}

/**
 * UniFi site information
 */
export interface UniFiSite {
  _id: string;
  name: string;
  desc: string;
  anonymous_id?: string;
  role?: string;
}

/**
 * Voucher generation parameters
 */
export interface VoucherGenerationParams {
  quantity: number;
  packageId: string;
  packageName: string;
  serviceType: ServiceType;
  duration: number; // minutes
  bandwidth?: {
    upload: number; // Kbps
    download: number; // Kbps
  };
  dataLimit?: number; // MB
  price: number;
  // PPPoE-specific
  pppoeInterface?: string;
  // UniFi-specific
  site?: string;
}

/**
 * Generated voucher
 */
export interface GeneratedVoucher {
  code: string;
  password?: string; // MikroTik only (for hotspot and PPPoE)
  packageName: string;
  duration: number;
  price: number;
  // Vendor-specific data
  vendorData?: Record<string, any>;
}

/**
 * Voucher generation result
 */
export interface VoucherGenerationResult {
  success: boolean;
  vouchers: GeneratedVoucher[];
  error?: string;
  // UniFi-specific
  createTime?: number;
}

/**
 * Voucher activation result
 */
export interface VoucherActivationResult {
  success: boolean;
  message?: string;
  error?: string;
  activatedAt?: Date;
}

/**
 * Voucher status
 */
export interface VoucherStatus {
  code: string;
  status: 'active' | 'used' | 'expired' | 'disabled';
  usedBy?: string;
  usedAt?: Date;
  bytesUsed?: number;
  sessionsUsed?: number;
}

/**
 * Package/Profile parameters
 */
export interface PackageParams {
  name: string;
  displayName: string;
  price: number;
  duration: number; // minutes
  bandwidth?: {
    upload: number;
    download: number;
  };
  dataLimit?: number; // MB
  // MikroTik hotspot-specific
  sessionTimeout?: string;
  idleTimeout?: string;
  rateLimit?: string;
  // MikroTik PPPoE-specific
  pppoeInterface?: string;
  localAddress?: string;
  remoteAddress?: string;
}

/**
 * Package validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Synced package
 */
export interface SyncedPackage {
  mikrotikId?: string; // MikroTik .id
  name: string;
  displayName: string;
  price: number;
  duration: number;
  bandwidth: {
    upload: number;
    download: number;
  };
  dataLimit?: number;
  // MikroTik-specific
  sessionTimeout?: string;
  idleTimeout?: string;
  rateLimit?: string;
  addressPool?: string;
  sharedUsers?: string;
  transparentProxy?: string;
  // PPPoE-specific
  pppoeInterface?: string;
  localAddress?: string;
  remoteAddress?: string;
  // Status
  disabled: boolean;
  lastSynced?: Date;
}

/**
 * Package sync result
 */
export interface PackageSyncResult {
  success: boolean;
  packages: SyncedPackage[];
  added: number;
  updated: number;
  removed: number;
  error?: string;
}

/**
 * Package creation result
 */
export interface PackageCreationResult {
  success: boolean;
  package?: SyncedPackage;
  error?: string;
}

/**
 * Captive portal configuration
 */
export interface CaptivePortalConfig {
  method: CaptivePortalMethod;
  targetPath: string;
  requiresSSH: boolean;
  supportsCustomization: boolean;
  // SSH-specific (for UniFi)
  sshPublicKey?: string;
  sshInstructions?: string;
}

/**
 * Captive portal files
 */
export interface CaptivePortalFiles {
  [filename: string]: string | Buffer;
}

/**
 * Captive portal deployment result
 */
export interface DeploymentResult {
  success: boolean;
  message: string;
  error?: string;
  // SSH-specific (for UniFi)
  requiresManualSSH?: boolean;
  sshInstructions?: {
    publicKey: string;
    targetPath: string;
    files: string[];
  };
}

/**
 * Active user information
 */
export interface ActiveUser {
  username: string;
  macAddress?: string;
  ipAddress?: string;
  uptime?: string;
  bytesIn?: number;
  bytesOut?: number;
  service?: ServiceType;
}

/**
 * Router health information
 */
export interface RouterHealth {
  status: 'online' | 'offline' | 'warning' | 'error';
  lastChecked: Date;
  uptime: number;
  cpuUsage: number;
  memoryUsage: number;
  temperature?: number;
  connectedUsers: number;
}

/**
 * Main RouterProvider interface
 * 
 * This interface abstracts router operations across different vendors
 * (MikroTik, UniFi, etc.) and services (Hotspot, PPPoE, etc.)
 */
export interface RouterProvider {
  /**
   * Router type (mikrotik, unifi, etc.)
   */
  readonly type: RouterType;

  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================

  /**
   * Connect to the router
   */
  connect(config: RouterConnectionConfig): Promise<ConnectionResult>;

  /**
   * Disconnect from the router
   */
  disconnect(): Promise<void>;

  /**
   * Test connection to the router
   */
  testConnection(): Promise<ConnectionTestResult>;

  // ============================================
  // SERVICE CAPABILITIES
  // ============================================

  /**
   * Get list of services supported by this router
   */
  getSupportedServices(): ServiceType[];

  /**
   * Check if router supports a specific service
   */
  supportsService(service: ServiceType): boolean;

  // ============================================
  // VOUCHER OPERATIONS (Service-Aware)
  // ============================================

  /**
   * Generate vouchers for a specific service
   */
  generateVouchersForService(
    service: ServiceType,
    params: VoucherGenerationParams
  ): Promise<VoucherGenerationResult>;

  /**
   * Activate a voucher on the router
   */
  activateVoucher(
    service: ServiceType,
    code: string
  ): Promise<VoucherActivationResult>;

  /**
   * Deactivate/remove a voucher from the router
   */
  deactivateVoucher(
    service: ServiceType,
    code: string
  ): Promise<void>;

  /**
   * Get voucher status from the router
   */
  getVoucherStatus(
    service: ServiceType,
    code: string
  ): Promise<VoucherStatus>;

  // ============================================
  // PACKAGE MANAGEMENT (Service-Aware)
  // ============================================

  /**
   * Get package management strategy for a service
   * - 'sync_from_router': Packages are synced from router (MikroTik)
   * - 'database_defined': Packages are defined in database (UniFi)
   */
  getPackageManagementStrategy(service: ServiceType): PackageManagementStrategy;

  /**
   * Sync packages from router (for sync_from_router strategy)
   * Optional: Only implemented by providers that sync from router
   */
  syncPackagesFromRouter?(service: ServiceType): Promise<PackageSyncResult>;

  /**
   * Validate package parameters for this router/service
   * Optional: Only implemented by providers that need validation
   */
  validatePackageParams?(
    service: ServiceType,
    params: PackageParams
  ): Promise<ValidationResult>;

  /**
   * Create a package on the router
   * Optional: Only implemented by providers that support package creation
   */
  createPackage?(
    service: ServiceType,
    params: PackageParams
  ): Promise<PackageCreationResult>;

  /**
   * Update a package on the router
   * Optional: Only implemented by providers that support package updates
   */
  updatePackage?(
    service: ServiceType,
    id: string,
    params: PackageParams
  ): Promise<void>;

  /**
   * Delete a package from the router
   * Optional: Only implemented by providers that support package deletion
   */
  deletePackage?(
    service: ServiceType,
    id: string
  ): Promise<void>;

  // ============================================
  // CAPTIVE PORTAL (Hotspot Only)
  // ============================================

  /**
   * Get captive portal configuration
   */
  getCaptivePortalConfig(): CaptivePortalConfig;

  /**
   * Deploy captive portal files to router
   */
  deployCaptivePortal(files: CaptivePortalFiles): Promise<DeploymentResult>;

  // ============================================
  // ROUTER INFORMATION
  // ============================================

  /**
   * Get router information
   */
  getRouterInfo(): Promise<RouterInfo>;

  /**
   * Get active users/sessions
   * @param service Optional: Filter by service type
   */
  getActiveUsers(service?: ServiceType): Promise<ActiveUser[]>;

  /**
   * Get router health metrics
   */
  getRouterHealth(): Promise<RouterHealth>;

  // ============================================
  // ROUTER CAPABILITIES
  // ============================================

  /**
   * Check if router supports VPN provisioning
   */
  supportsVPN(): boolean;

  /**
   * Check if router supports multiple sites
   */
  supportsMultipleSites(): boolean;

  /**
   * Get captive portal deployment method
   */
  getCaptivePortalMethod(): CaptivePortalMethod;

  /**
   * Get voucher code format for a service
   */
  getVoucherFormat(service: ServiceType): VoucherFormat;
}
