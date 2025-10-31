// types/mikrotik.ts - MikroTik Related Types

export interface MikroTikConnectionConfig {
  ipAddress: string;
  port: number;
  username: string;
  password: string;
}

export interface MikroTikSystemResource {
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

export interface ConnectionTestResult {
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

export interface InterfaceInfo {
  '.id': string;
  name: string;
  type?: string;
  'mac-address'?: string;
  disabled?: boolean;
}

export interface IPPoolConfig {
  name: string;
  ranges: string;
}

export interface PPPProfileConfig {
  name: string;
  'local-address': string;
  'remote-address': string;
  'dns-server': string;
  'rate-limit'?: string;
  'session-timeout'?: string;
  'idle-timeout'?: string;
}

export interface HotspotProfileConfig {
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

export interface NATRuleConfig {
  chain: string;
  'src-address': string;
  'out-interface': string;
  action: string;
}

export interface DHCPServerConfig {
  name: string;
  interface: string;
  'address-pool': string;
}

export interface DHCPNetworkConfig {
  address: string;
  gateway: string;
  'dns-server': string;
}

export interface PPPoEServerConfig {
  'service-name': string;
  interface: string;
  'default-profile': string;
  disabled?: string;
}

export interface BridgeConfig {
  name: string;
}

export interface BridgePortConfig {
  bridge: string;
  interface: string;
}

export interface IPAddressConfig {
  address: string;
  interface: string;
  network?: string;
}

export interface WirelessConfig {
  mode?: string;
  ssid?: string;
  'security-profile'?: string;
  disabled?: string;
}

export interface ConfigurationResult {
  success: boolean;
  step: string;
  message: string;
  error?: string;
  data?: any;
}

export interface FullConfigurationResult {
  success: boolean;
  completedSteps: string[];
  failedSteps: Array<{
    step: string;
    error: string;
  }>;
  warnings: string[];
}

export interface RouterConfigOptions {
  hotspotEnabled: boolean;
  ssid?: string;
  pppoeEnabled: boolean;
  pppoeInterfaces?: string[];
  wanInterface?: string;
  bridgeInterfaces?: string[];
}

export interface SyncResult {
  success: boolean;
  message: string;
  changes?: string[];
  discrepancies?: Array<{
    field: string;
    expected: any;
    actual: any;
  }>;
  error?: string;
}

export interface RouterDocument {
  _id: any;
  userId: any;
  routerInfo: {
    name: string;
    model: string;
    serialNumber: string;
    macAddress: string;
    firmwareVersion: string;
    location: {
      name: string;
      coordinates: {
        latitude: number;
        longitude: number;
      };
      address: string;
    };
  };
  connection: {
    ipAddress: string;
    port: number;
    apiUser: string;
    apiPassword: string;
    restApiEnabled: boolean;
    sshEnabled: boolean;
  };
  configuration: {
    hotspot: {
      enabled: boolean;
      ssid: string;
      password: string;
      interface: string;
      ipPool: string;
      dnsServers: string[];
      maxUsers: number;
    };
    pppoe: {
      enabled: boolean;
      interface: string;
      ipPool: string;
      dnsServers: string[];
      defaultProfile: string;
    };
    network: {
      lanInterface: string;
      wanInterface: string;
      lanSubnet: string;
      dhcpRange: string;
    };
  };
  health: {
    status: string;
    lastSeen: Date;
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    temperature: number;
    connectedUsers: number;
  };
  statistics: {
    totalDataUsage: number;
    monthlyDataUsage: number;
    totalUsers: number;
    activeUsers: number;
    revenue: {
      total: number;
      monthly: number;
      daily: number;
    };
  };
  status: string;
  configurationStatus?: {
    configured: boolean;
    completedSteps: string[];
    failedSteps: Array<{ step: string; error: string }>;
    warnings: string[];
    configuredAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}