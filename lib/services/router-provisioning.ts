// lib/services/router-provisioning.ts - Router Provisioning Service with Deployed Config Tracking

import { ObjectId } from 'mongodb';
import MikroTikService, {
  MikroTikCleanup,
  MikroTikNetworkConfig,
  MikroTikServiceConfig,
  type MikroTikConnectionConfig,
} from './mikrotik';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface DeployedConfig {
  name: string;
  type: string;
  parameters?: Record<string, any>;
  createdAt: Date;
  lastChecked: Date;
  status: 'active' | 'inactive' | 'error';
}

interface DeployedConfigs {
  ipPools: DeployedConfig[];
  dhcpServers: DeployedConfig[];
  dhcpNetworks: DeployedConfig[];
  bridges: DeployedConfig[];
  bridgePorts: DeployedConfig[];
  hotspotProfiles: DeployedConfig[];
  hotspotServers: DeployedConfig[];
  hotspotUserProfiles: DeployedConfig[];
  pppoeServers: DeployedConfig[];
  pppProfiles: DeployedConfig[];
  natRules: DeployedConfig[];
  wanConfig: DeployedConfig[];
  wifiConfig: DeployedConfig[];
}

interface RouterDocument {
  _id: ObjectId;
  ownerId: ObjectId;
  name: string;
  ipAddress: string;
  macAddress: string;
  port: number;
  username: string;
  password: string;
  location: {
    address: string;
    city: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  status: 'active' | 'inactive' | 'maintenance' | 'error';
  health: {
    isOnline: boolean;
    lastSeen: Date;
    uptime: string;
    cpuLoad: number;
    memoryUsage: number;
  };
  configuration: {
    wanInterface: string;
    lanInterfaces: string[];
    wifiSSID: string;
    bridgeName: string;
    hotspotEnabled: boolean;
    pppoeEnabled: boolean;
    deployedConfigs?: DeployedConfigs;
  };
  configurationStatus: {
    configured: boolean;
    completedSteps: string[];
    failedSteps: Array<{
      step: string;
      error: string;
      timestamp?: Date;
    }>;
    warnings: string[];
    configuredAt?: Date;
    lastAttempt?: Date;
    lastSyncedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface ProvisioningResult {
  success: boolean;
  routerId: string;
  completedSteps: string[];
  failedSteps: Array<{
    step: string;
    error: string;
    timestamp: Date;
  }>;
  warnings: string[];
  configuredAt: Date | undefined;
  error?: string;
}

// ============================================
// DEPLOYED CONFIG TRACKER
// ============================================

class DeployedConfigTracker {
  /**
   * Initialize deployedConfigs structure if it doesn't exist
   */
  static async initializeDeployedConfigs(db: any, routerId: string): Promise<void> {
    const emptyDeployedConfigs: DeployedConfigs = {
      ipPools: [],
      dhcpServers: [],
      dhcpNetworks: [],
      bridges: [],
      bridgePorts: [],
      hotspotProfiles: [],
      hotspotServers: [],
      hotspotUserProfiles: [],
      pppoeServers: [],
      pppProfiles: [],
      natRules: [],
      wanConfig: [],
      wifiConfig: [],
    };

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $setOnInsert: {
          'configuration.deployedConfigs': emptyDeployedConfigs,
        },
      }
    );
  }

  /**
   * Track IP Pool deployment
   */
  static async trackIPPool(
    db: any,
    routerId: string,
    name: string,
    ranges: string
  ): Promise<void> {
    const config: DeployedConfig = {
      name,
      type: 'ip-pool',
      parameters: { ranges },
      createdAt: new Date(),
      lastChecked: new Date(),
      status: 'active',
    };

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $pull: { 'configuration.deployedConfigs.ipPools': { name } },
      }
    );

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $push: { 'configuration.deployedConfigs.ipPools': config },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Track DHCP Server deployment
   */
  static async trackDHCPServer(
    db: any,
    routerId: string,
    name: string,
    interfaceName: string,
    addressPool: string
  ): Promise<void> {
    const config: DeployedConfig = {
      name,
      type: 'dhcp-server',
      parameters: { interface: interfaceName, addressPool },
      createdAt: new Date(),
      lastChecked: new Date(),
      status: 'active',
    };

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      { $pull: { 'configuration.deployedConfigs.dhcpServers': { name } } }
    );

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $push: { 'configuration.deployedConfigs.dhcpServers': config },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Track DHCP Network deployment
   */
  static async trackDHCPNetwork(
    db: any,
    routerId: string,
    address: string,
    gateway: string,
    dnsServer: string
  ): Promise<void> {
    const config: DeployedConfig = {
      name: address,
      type: 'dhcp-network',
      parameters: { address, gateway, dnsServer },
      createdAt: new Date(),
      lastChecked: new Date(),
      status: 'active',
    };

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      { $pull: { 'configuration.deployedConfigs.dhcpNetworks': { name: address } } }
    );

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $push: { 'configuration.deployedConfigs.dhcpNetworks': config },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Track Bridge deployment
   */
  static async trackBridge(
    db: any,
    routerId: string,
    bridgeName: string,
    bridgeAddress: string
  ): Promise<void> {
    const config: DeployedConfig = {
      name: bridgeName,
      type: 'bridge',
      parameters: { address: bridgeAddress },
      createdAt: new Date(),
      lastChecked: new Date(),
      status: 'active',
    };

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      { $pull: { 'configuration.deployedConfigs.bridges': { name: bridgeName } } }
    );

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $push: { 'configuration.deployedConfigs.bridges': config },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Track Bridge Port deployment
   */
  static async trackBridgePort(
    db: any,
    routerId: string,
    bridgeName: string,
    interfaceName: string
  ): Promise<void> {
    const config: DeployedConfig = {
      name: `${bridgeName}-${interfaceName}`,
      type: 'bridge-port',
      parameters: { bridge: bridgeName, interface: interfaceName },
      createdAt: new Date(),
      lastChecked: new Date(),
      status: 'active',
    };

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $pull: {
          'configuration.deployedConfigs.bridgePorts': {
            name: `${bridgeName}-${interfaceName}`,
          },
        },
      }
    );

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $push: { 'configuration.deployedConfigs.bridgePorts': config },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Track Hotspot Profile deployment
   */
  static async trackHotspotProfile(
    db: any,
    routerId: string,
    name: string,
    hotspotAddress: string,
    dnsName: string
  ): Promise<void> {
    const config: DeployedConfig = {
      name,
      type: 'hotspot-profile',
      parameters: { hotspotAddress, dnsName, loginBy: 'http-chap,trial,cookie' },
      createdAt: new Date(),
      lastChecked: new Date(),
      status: 'active',
    };

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      { $pull: { 'configuration.deployedConfigs.hotspotProfiles': { name } } }
    );

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $push: { 'configuration.deployedConfigs.hotspotProfiles': config },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Track Hotspot Server deployment
   */
  static async trackHotspotServer(
    db: any,
    routerId: string,
    name: string,
    interfaceName: string,
    addressPool: string,
    profile: string
  ): Promise<void> {
    const config: DeployedConfig = {
      name,
      type: 'hotspot-server',
      parameters: { interface: interfaceName, addressPool, profile },
      createdAt: new Date(),
      lastChecked: new Date(),
      status: 'active',
    };

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      { $pull: { 'configuration.deployedConfigs.hotspotServers': { name } } }
    );

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $push: { 'configuration.deployedConfigs.hotspotServers': config },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Track Hotspot User Profile deployment
   */
  static async trackHotspotUserProfile(
    db: any,
    routerId: string,
    name: string,
    sessionTimeout: string,
    rateLimit: string
  ): Promise<void> {
    const config: DeployedConfig = {
      name,
      type: 'hotspot-user-profile',
      parameters: { sessionTimeout, rateLimit },
      createdAt: new Date(),
      lastChecked: new Date(),
      status: 'active',
    };

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      { $pull: { 'configuration.deployedConfigs.hotspotUserProfiles': { name } } }
    );

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $push: { 'configuration.deployedConfigs.hotspotUserProfiles': config },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Track NAT Rule deployment
   */
  static async trackNATRule(
    db: any,
    routerId: string,
    chain: string,
    srcAddress: string,
    outInterface: string,
    action: string
  ): Promise<void> {
    const config: DeployedConfig = {
      name: `${chain}-${srcAddress}-${outInterface}`,
      type: 'nat-rule',
      parameters: { chain, srcAddress, outInterface, action },
      createdAt: new Date(),
      lastChecked: new Date(),
      status: 'active',
    };

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $pull: {
          'configuration.deployedConfigs.natRules': {
            name: `${chain}-${srcAddress}-${outInterface}`,
          },
        },
      }
    );

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $push: { 'configuration.deployedConfigs.natRules': config },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Track WAN Interface deployment
   */
  static async trackWANInterface(
    db: any,
    routerId: string,
    interfaceName: string
  ): Promise<void> {
    const config: DeployedConfig = {
      name: interfaceName,
      type: 'wan-interface',
      parameters: { interface: interfaceName, dhcpClient: true },
      createdAt: new Date(),
      lastChecked: new Date(),
      status: 'active',
    };

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      { $pull: { 'configuration.deployedConfigs.wanConfig': { name: interfaceName } } }
    );

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $push: { 'configuration.deployedConfigs.wanConfig': config },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Track WiFi Configuration deployment
   */
  static async trackWiFiConfig(
    db: any,
    routerId: string,
    interfaceName: string,
    ssid: string
  ): Promise<void> {
    const config: DeployedConfig = {
      name: interfaceName,
      type: 'wifi-config',
      parameters: { interface: interfaceName, ssid, mode: 'ap-bridge' },
      createdAt: new Date(),
      lastChecked: new Date(),
      status: 'active',
    };

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      { $pull: { 'configuration.deployedConfigs.wifiConfig': { name: interfaceName } } }
    );

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $push: { 'configuration.deployedConfigs.wifiConfig': config },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Track PPPoE Server deployment
   */
  static async trackPPPoEServer(
    db: any,
    routerId: string,
    serviceName: string,
    interfaceName: string,
    defaultProfile: string
  ): Promise<void> {
    const config: DeployedConfig = {
      name: serviceName,
      type: 'pppoe-server',
      parameters: { serviceName, interface: interfaceName, defaultProfile },
      createdAt: new Date(),
      lastChecked: new Date(),
      status: 'active',
    };

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      { $pull: { 'configuration.deployedConfigs.pppoeServers': { name: serviceName } } }
    );

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $push: { 'configuration.deployedConfigs.pppoeServers': config },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Track PPP Profile deployment
   */
  static async trackPPPProfile(
    db: any,
    routerId: string,
    name: string,
    localAddress: string,
    remoteAddress: string,
    rateLimit: string
  ): Promise<void> {
    const config: DeployedConfig = {
      name,
      type: 'ppp-profile',
      parameters: { localAddress, remoteAddress, rateLimit },
      createdAt: new Date(),
      lastChecked: new Date(),
      status: 'active',
    };

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      { $pull: { 'configuration.deployedConfigs.pppProfiles': { name } } }
    );

    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $push: { 'configuration.deployedConfigs.pppProfiles': config },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Update lastSyncedAt timestamp
   */
  static async updateLastSyncedAt(db: any, routerId: string): Promise<void> {
    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $set: {
          'configurationStatus.lastSyncedAt': new Date(),
          updatedAt: new Date(),
        },
      }
    );
  }
}

// ============================================
// ROUTER PROVISIONING SERVICE
// ============================================

export class RouterProvisioningService {
  /**
   * Complete router provisioning with database updates and config tracking
   */
  static async provisionRouter(
    routerId: string,
    db: any
  ): Promise<ProvisioningResult> {
    const completedSteps: string[] = [];
    const failedSteps: Array<{ step: string; error: string; timestamp: Date }> = [];
    const warnings: string[] = [];

    try {
      // Step 1: Fetch router from database
      const router = await db.collection('routers').findOne({
        _id: new ObjectId(routerId),
      });

      if (!router) {
        throw new Error('Router not found');
      }

      // Initialize deployedConfigs structure
      await DeployedConfigTracker.initializeDeployedConfigs(db, routerId);

      // Update status to maintenance
      await this.updateRouterStatus(db, routerId, 'maintenance', {
        lastAttempt: new Date(),
      });

      // Step 2: Prepare MikroTik connection config
      const config: MikroTikConnectionConfig = {
        ipAddress: router.connection.ipAddress,
        port: router.connection.port || 80,
        username: router.connection.apiUser,
        password: MikroTikService.decryptPassword(router.connection.apiPassword),
      };      

      // Step 3: Test connection
      const connectionTest = await MikroTikService.testConnection(config);
      if (!connectionTest.success) {
        throw new Error(connectionTest.error || 'Connection test failed');
      }

      // Update health info
      await this.updateRouterHealth(db, routerId, connectionTest.data!.routerInfo);

      // Step 4: Perform cleanup (conditional based on provisioning state)
      console.log(`[${routerId}] Checking if cleanup is needed...`);

      // Skip cleanup on first provision to avoid losing connection
      if (router.configurationStatus?.configured === true) {
        console.log(`[${routerId}] Re-provisioning detected - performing selective cleanup...`);
        
        // Only cleanup LAN and WiFi interfaces, preserve WAN (management interface)
        const interfacesToClean = router.configuration.lanInterfaces || [];
        
        if (interfacesToClean.length > 0) {
          const cleanup = await MikroTikCleanup.performFullCleanup(config, interfacesToClean);
          
          if (!cleanup.success) {
            warnings.push(`Cleanup warning: ${cleanup.error}`);
          } else {
            console.log(`[${routerId}] Cleanup completed successfully`);
          }
        } else {
          console.log(`[${routerId}] No interfaces to clean`);
        }
      } else {
        console.log(`[${routerId}] First provision detected - skipping cleanup to preserve connection`);
        warnings.push('Cleanup skipped: First provision - router may have default configurations');
      }
      // Step 5: Configure WAN Interface
      console.log(`[${routerId}] Configuring WAN interface...`);
      const wanResult = await MikroTikNetworkConfig.configureWANInterface(
        config,
        router.configuration.wanInterface
      );

      if (wanResult.success) {
        completedSteps.push('WAN Interface Configuration');
        await this.addCompletedStep(db, routerId, 'WAN Interface Configuration');
        await DeployedConfigTracker.trackWANInterface(db, routerId, router.configuration.wanInterface);
      } else {
        const error = {
          step: 'WAN Interface Configuration',
          error: wanResult.error || 'Unknown error',
          timestamp: new Date(),
        };
        failedSteps.push(error);
        await this.addFailedStep(db, routerId, error);
      }

      // Step 6: Configure WiFi
      if (router.configuration.wifiSSID) {
        console.log(`[${routerId}] Configuring WiFi...`);
        const wifiResult = await MikroTikNetworkConfig.configureWiFi(
          config,
          'wlan1',
          router.configuration.wifiSSID
        );

        if (wifiResult.success) {
          completedSteps.push('WiFi Configuration');
          await this.addCompletedStep(db, routerId, 'WiFi Configuration');
          await DeployedConfigTracker.trackWiFiConfig(db, routerId, 'wlan1', router.configuration.wifiSSID);
        } else {
          const error = {
            step: 'WiFi Configuration',
            error: wifiResult.error || 'Unknown error',
            timestamp: new Date(),
          };
          failedSteps.push(error);
          await this.addFailedStep(db, routerId, error);
        }
      }

      // Step 7: Configure Hotspot (if enabled)
      if (router.configuration.hotspotEnabled) {
        await this.configureHotspot(db, routerId, config, router, completedSteps, failedSteps);
      }

      // Step 8: Configure PPPoE (if enabled)
      if (router.configuration.pppoeEnabled) {
        await this.configurePPPoE(db, routerId, config, router, completedSteps, failedSteps);
      }

      // Step 9: Update last synced timestamp
      await DeployedConfigTracker.updateLastSyncedAt(db, routerId);

      // Step 10: Finalize provisioning
      const isFullyConfigured = failedSteps.length === 0;
      const configuredAt = isFullyConfigured ? new Date() : undefined;

      await db.collection('routers').updateOne(
        { _id: new ObjectId(routerId) },
        {
          $set: {
            status: isFullyConfigured ? 'active' : 'error',
            'configurationStatus.configured': isFullyConfigured,
            'configurationStatus.completedSteps': completedSteps,
            'configurationStatus.failedSteps': failedSteps,
            'configurationStatus.warnings': warnings,
            'configurationStatus.configuredAt': configuredAt,
            'configurationStatus.lastAttempt': new Date(),
            updatedAt: new Date(),
          },
        }
      );

      return {
        success: isFullyConfigured,
        routerId,
        completedSteps,
        failedSteps,
        warnings,
        configuredAt,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update router with error status
      await db.collection('routers').updateOne(
        { _id: new ObjectId(routerId) },
        {
          $set: {
            status: 'error',
            'configurationStatus.configured': false,
            'configurationStatus.completedSteps': completedSteps,
            'configurationStatus.failedSteps': failedSteps,
            'configurationStatus.warnings': warnings,
            'configurationStatus.lastAttempt': new Date(),
            updatedAt: new Date(),
          },
        }
      );

      return {
        success: false,
        routerId,
        completedSteps,
        failedSteps,
        warnings,
        configuredAt: undefined,
        error: errorMessage,
      };
    }
  }

  /**
   * Configure Hotspot service with deployed config tracking
   */
  private static async configureHotspot(
    db: any,
    routerId: string,
    config: MikroTikConnectionConfig,
    router: any,
    completedSteps: string[],
    failedSteps: Array<{ step: string; error: string; timestamp: Date }>
  ): Promise<void> {
    // Create IP Pool
    console.log(`[${routerId}] Creating Hotspot IP Pool...`);
    const poolResult = await MikroTikNetworkConfig.createIPPools(config, [
      {
        name: 'hotspot-pool',
        ranges: '192.168.10.10-192.168.10.254',
      },
    ]);

    if (poolResult.success) {
      completedSteps.push('Hotspot IP Pool');
      await this.addCompletedStep(db, routerId, 'Hotspot IP Pool');
      await DeployedConfigTracker.trackIPPool(db, routerId, 'hotspot-pool', '192.168.10.10-192.168.10.254');
    } else {
      const error = {
        step: 'Hotspot IP Pool',
        error: poolResult.error || 'Unknown error',
        timestamp: new Date(),
      };
      failedSteps.push(error);
      await this.addFailedStep(db, routerId, error);
      return;
    }

    // Configure Bridge
    console.log(`[${routerId}] Configuring Hotspot Bridge...`);
    const bridgeName = router.configuration.bridgeName || 'hotspot-bridge';
    const bridgeAddress = '192.168.10.1/24';
    const bridgeInterfaces = ['wlan1', 'ether2'];

    const bridgeResult = await MikroTikNetworkConfig.configureBridge(
      config,
      bridgeName,
      bridgeAddress,
      bridgeInterfaces
    );

    if (bridgeResult.success) {
      completedSteps.push('Hotspot Bridge');
      await this.addCompletedStep(db, routerId, 'Hotspot Bridge');
      await DeployedConfigTracker.trackBridge(db, routerId, bridgeName, bridgeAddress);
      
      // Track each bridge port
      for (const iface of bridgeInterfaces) {
        await DeployedConfigTracker.trackBridgePort(db, routerId, bridgeName, iface);
      }
    } else {
      const error = {
        step: 'Hotspot Bridge',
        error: bridgeResult.error || 'Unknown error',
        timestamp: new Date(),
      };
      failedSteps.push(error);
      await this.addFailedStep(db, routerId, error);
      return;
    }

    // Configure DHCP Server
    console.log(`[${routerId}] Configuring Hotspot DHCP Server...`);
    const dhcpResult = await MikroTikNetworkConfig.configureDHCPServer(
      config,
      {
        name: 'hotspot-dhcp',
        interface: bridgeName,
        'address-pool': 'hotspot-pool',
      },
      {
        address: '192.168.10.0/24',
        gateway: '192.168.10.1',
        'dns-server': '8.8.8.8,8.8.4.4',
      }
    );

    if (dhcpResult.success) {
      completedSteps.push('Hotspot DHCP Server');
      await this.addCompletedStep(db, routerId, 'Hotspot DHCP Server');
      await DeployedConfigTracker.trackDHCPServer(db, routerId, 'hotspot-dhcp', bridgeName, 'hotspot-pool');
      await DeployedConfigTracker.trackDHCPNetwork(db, routerId, '192.168.10.0/24', '192.168.10.1', '8.8.8.8,8.8.4.4');
    } else {
      const error = {
        step: 'Hotspot DHCP Server',
        error: dhcpResult.error || 'Unknown error',
        timestamp: new Date(),
      };
      failedSteps.push(error);
      await this.addFailedStep(db, routerId, error);
      return;
    }

    // Create Hotspot User Profiles
    console.log(`[${routerId}] Creating Hotspot User Profiles...`);
    const profilesResult = await MikroTikServiceConfig.createHotspotUserProfiles(config);

    if (profilesResult.success) {
      completedSteps.push('Hotspot User Profiles');
      await this.addCompletedStep(db, routerId, 'Hotspot User Profiles');
      
      // Track each user profile
      const profiles = [
        { name: '1hour-10ksh', sessionTimeout: '1h', rateLimit: '2M/5M' },
        { name: '3hours-25ksh', sessionTimeout: '3h', rateLimit: '3M/6M' },
        { name: '5hours-40ksh', sessionTimeout: '5h', rateLimit: '4M/8M' },
        { name: '12hours-70ksh', sessionTimeout: '12h', rateLimit: '5M/10M' },
        { name: '1day-100ksh', sessionTimeout: '1d', rateLimit: '6M/12M' },
        { name: '3days-250ksh', sessionTimeout: '3d', rateLimit: '8M/15M' },
        { name: '1week-400ksh', sessionTimeout: '1w', rateLimit: '10M/20M' },
        { name: '1month-1200ksh', sessionTimeout: '30d', rateLimit: '15M/25M' },
      ];

      for (const profile of profiles) {
        await DeployedConfigTracker.trackHotspotUserProfile(
          db,
          routerId,
          profile.name,
          profile.sessionTimeout,
          profile.rateLimit
        );
      }
    } else {
      const error = {
        step: 'Hotspot User Profiles',
        error: profilesResult.error || 'Unknown error',
        timestamp: new Date(),
      };
      failedSteps.push(error);
      await this.addFailedStep(db, routerId, error);
    }

    // Configure Hotspot Server
    console.log(`[${routerId}] Configuring Hotspot Server...`);
    const hotspotResult = await MikroTikServiceConfig.configureHotspot(
      config,
      {
        name: 'hotspot-profile',
        'hotspot-address': '192.168.10.1',
        'dns-name': 'hotspot.local',
        'login-by': 'http-chap,trial,cookie',
      },
      {
        name: 'hotspot1',
        interface: bridgeName,
        'address-pool': 'hotspot-pool',
        profile: 'hotspot-profile',
      }
    );

    if (hotspotResult.success) {
      completedSteps.push('Hotspot Server');
      await this.addCompletedStep(db, routerId, 'Hotspot Server');
      await DeployedConfigTracker.trackHotspotProfile(db, routerId, 'hotspot-profile', '192.168.10.1', 'hotspot.local');
      await DeployedConfigTracker.trackHotspotServer(db, routerId, 'hotspot1', bridgeName, 'hotspot-pool', 'hotspot-profile');
    } else {
      const error = {
        step: 'Hotspot Server',
        error: hotspotResult.error || 'Unknown error',
        timestamp: new Date(),
      };
      failedSteps.push(error);
      await this.addFailedStep(db, routerId, error);
      return;
    }

    // Configure NAT
    console.log(`[${routerId}] Configuring Hotspot NAT Rules...`);
    const natResult = await MikroTikNetworkConfig.configureNAT(config, [
      {
        chain: 'srcnat',
        'src-address': '192.168.10.0/24',
        'out-interface': router.configuration.wanInterface,
        action: 'masquerade',
      },
    ]);

    if (natResult.success) {
      completedSteps.push('Hotspot NAT Rules');
      await this.addCompletedStep(db, routerId, 'Hotspot NAT Rules');
      await DeployedConfigTracker.trackNATRule(
        db,
        routerId,
        'srcnat',
        '192.168.10.0/24',
        router.configuration.wanInterface,
        'masquerade'
      );
    } else {
      const error = {
        step: 'Hotspot NAT Rules',
        error: natResult.error || 'Unknown error',
        timestamp: new Date(),
      };
      failedSteps.push(error);
      await this.addFailedStep(db, routerId, error);
    }
  }

  /**
   * Configure PPPoE service with deployed config tracking
   */
  private static async configurePPPoE(
    db: any,
    routerId: string,
    config: MikroTikConnectionConfig,
    router: any,
    completedSteps: string[],
    failedSteps: Array<{ step: string; error: string; timestamp: Date }>
  ): Promise<void> {
    // Create IP Pool
    console.log(`[${routerId}] Creating PPPoE IP Pool...`);
    const poolResult = await MikroTikNetworkConfig.createIPPools(config, [
      {
        name: 'pppoe-pool',
        ranges: '192.168.100.10-192.168.100.254',
      },
    ]);

    if (poolResult.success) {
      completedSteps.push('PPPoE IP Pool');
      await this.addCompletedStep(db, routerId, 'PPPoE IP Pool');
      await DeployedConfigTracker.trackIPPool(db, routerId, 'pppoe-pool', '192.168.100.10-192.168.100.254');
    } else {
      const error = {
        step: 'PPPoE IP Pool',
        error: poolResult.error || 'Unknown error',
        timestamp: new Date(),
      };
      failedSteps.push(error);
      await this.addFailedStep(db, routerId, error);
      return;
    }

    // Create PPPoE User Profiles
    console.log(`[${routerId}] Creating PPPoE User Profiles...`);
    const profilesResult = await MikroTikServiceConfig.createPPPoEUserProfiles(
      config,
      '192.168.100.1',
      'pppoe-pool'
    );

    if (profilesResult.success) {
      completedSteps.push('PPPoE User Profiles');
      await this.addCompletedStep(db, routerId, 'PPPoE User Profiles');
      
      // Track each PPP profile
      const profiles = [
        { name: 'home-basic-5mbps', localAddress: '192.168.100.1', remoteAddress: 'pppoe-pool', rateLimit: '5M/5M' },
        { name: 'home-standard-10mbps', localAddress: '192.168.100.1', remoteAddress: 'pppoe-pool', rateLimit: '10M/10M' },
        { name: 'home-premium-20mbps', localAddress: '192.168.100.1', remoteAddress: 'pppoe-pool', rateLimit: '20M/20M' },
        { name: 'business-50mbps', localAddress: '192.168.100.1', remoteAddress: 'pppoe-pool', rateLimit: '50M/50M' },
      ];

      for (const profile of profiles) {
        await DeployedConfigTracker.trackPPPProfile(
          db,
          routerId,
          profile.name,
          profile.localAddress,
          profile.remoteAddress,
          profile.rateLimit
        );
      }
    } else {
      const error = {
        step: 'PPPoE User Profiles',
        error: profilesResult.error || 'Unknown error',
        timestamp: new Date(),
      };
      failedSteps.push(error);
      await this.addFailedStep(db, routerId, error);
    }

    // Configure PPPoE Server
    console.log(`[${routerId}] Configuring PPPoE Server...`);
    const serverResult = await MikroTikServiceConfig.configurePPPoEServers(config, [
      {
        'service-name': 'pppoe-service',
        interface: router.configuration.bridgeName || 'bridge',
        'default-profile': 'home-standard-10mbps',
      },
    ]);

    if (serverResult.success) {
      completedSteps.push('PPPoE Server');
      await this.addCompletedStep(db, routerId, 'PPPoE Server');
      await DeployedConfigTracker.trackPPPoEServer(
        db,
        routerId,
        'pppoe-service',
        router.configuration.bridgeName || 'bridge',
        'home-standard-10mbps'
      );
    } else {
      const error = {
        step: 'PPPoE Server',
        error: serverResult.error || 'Unknown error',
        timestamp: new Date(),
      };
      failedSteps.push(error);
      await this.addFailedStep(db, routerId, error);
    }
  }

  /**
   * Update router status
   */
  private static async updateRouterStatus(
    db: any,
    routerId: string,
    status: string,
    additionalFields: Record<string, any> = {}
  ): Promise<void> {
    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $set: {
          status,
          ...additionalFields,
          updatedAt: new Date(),
        },
      }
    );
  }

  /**
   * Update router health information
   */
  private static async updateRouterHealth(
    db: any,
    routerId: string,
    routerInfo: any
  ): Promise<void> {
    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $set: {
          'health.isOnline': true,
          'health.lastSeen': new Date(),
          'health.uptime': routerInfo.uptime,
          'health.cpuLoad': routerInfo.cpuLoad,
          'health.memoryUsage': routerInfo.memoryUsage,
          updatedAt: new Date(),
        },
      }
    );
  }

  /**
   * Add completed step to router configuration
   */
  private static async addCompletedStep(
    db: any,
    routerId: string,
    step: string
  ): Promise<void> {
    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $addToSet: { 'configurationStatus.completedSteps': step },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Add failed step to router configuration
   */
  private static async addFailedStep(
    db: any,
    routerId: string,
    error: { step: string; error: string; timestamp: Date }
  ): Promise<void> {
    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $push: { 'configurationStatus.failedSteps': error },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Retry failed provisioning steps only
   */
  static async retryFailedSteps(
    routerId: string,
    db: any
  ): Promise<ProvisioningResult> {
    const router = await db.collection('routers').findOne({
      _id: new ObjectId(routerId),
    });

    if (!router) {
      throw new Error('Router not found');
    }

    // Clear failed steps and retry full provisioning
    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $set: {
          'configurationStatus.failedSteps': [],
          'configurationStatus.completedSteps': [],
          updatedAt: new Date(),
        },
      }
    );

    return await this.provisionRouter(routerId, db);
  }

  /**
   * Sync router configuration - compare deployed configs with actual router state
   */
  static async syncRouterConfiguration(
    routerId: string,
    db: any
  ): Promise<{
    success: boolean;
    drifts: Array<{
      configType: string;
      configName: string;
      issue: string;
    }>;
    lastSyncedAt: Date;
  }> {
    const router = await db.collection('routers').findOne({
      _id: new ObjectId(routerId),
    });

    if (!router) {
      throw new Error('Router not found');
    }

    const config: MikroTikConnectionConfig = {
      ipAddress: router.ipAddress,
      port: router.port || 80,
      username: router.username,
      password: MikroTikService.decryptPassword(router.password),
    };

    const drifts: Array<{ configType: string; configName: string; issue: string }> = [];

    // Check IP Pools
    if (router.configuration.deployedConfigs?.ipPools) {
      const actualPools = await MikroTikService.makeRequest(config, '/rest/ip/pool', 'GET');
      
      for (const deployedPool of router.configuration.deployedConfigs.ipPools) {
        const actualPool = Array.isArray(actualPools)
          ? actualPools.find((p: any) => p.name === deployedPool.name)
          : null;

        if (!actualPool) {
          drifts.push({
            configType: 'ip-pool',
            configName: deployedPool.name,
            issue: 'Configuration missing on router',
          });
        } else {
          // Update lastChecked timestamp
          await db.collection('routers').updateOne(
            { 
              _id: new ObjectId(routerId),
              'configuration.deployedConfigs.ipPools.name': deployedPool.name
            },
            {
              $set: {
                'configuration.deployedConfigs.ipPools.$.lastChecked': new Date(),
              },
            }
          );
        }
      }
    }

    // Check Hotspot Servers
    if (router.configuration.deployedConfigs?.hotspotServers) {
      const actualHotspots = await MikroTikService.makeRequest(config, '/rest/ip/hotspot', 'GET');
      
      for (const deployedHotspot of router.configuration.deployedConfigs.hotspotServers) {
        const actualHotspot = Array.isArray(actualHotspots)
          ? actualHotspots.find((h: any) => h.name === deployedHotspot.name)
          : null;

        if (!actualHotspot) {
          drifts.push({
            configType: 'hotspot-server',
            configName: deployedHotspot.name,
            issue: 'Configuration missing on router',
          });
        } else {
          // Update lastChecked timestamp
          await db.collection('routers').updateOne(
            { 
              _id: new ObjectId(routerId),
              'configuration.deployedConfigs.hotspotServers.name': deployedHotspot.name
            },
            {
              $set: {
                'configuration.deployedConfigs.hotspotServers.$.lastChecked': new Date(),
              },
            }
          );
        }
      }
    }

    // Update last synced timestamp
    const lastSyncedAt = new Date();
    await DeployedConfigTracker.updateLastSyncedAt(db, routerId);

    return {
      success: drifts.length === 0,
      drifts,
      lastSyncedAt,
    };
  }

  /**
   * Get deployed configuration summary
   */
  static async getDeployedConfigsSummary(
    routerId: string,
    db: any
  ): Promise<{
    totalConfigs: number;
    configsByType: Record<string, number>;
    oldestCheck: Date | null;
    newestCheck: Date | null;
  }> {
    const router = await db.collection('routers').findOne(
      { _id: new ObjectId(routerId) },
      { projection: { 'configuration.deployedConfigs': 1 } }
    );

    if (!router?.configuration?.deployedConfigs) {
      return {
        totalConfigs: 0,
        configsByType: {},
        oldestCheck: null,
        newestCheck: null,
      };
    }

    let totalConfigs = 0;
    const configsByType: Record<string, number> = {};
    let oldestCheck: Date | null = null;
    let newestCheck: Date | null = null;

    // Count configs by type and find oldest/newest checks
    for (const [configType, configs] of Object.entries(router.configuration.deployedConfigs)) {
      if (Array.isArray(configs)) {
        totalConfigs += configs.length;
        configsByType[configType] = configs.length;

        for (const config of configs) {
          const lastChecked = new Date(config.lastChecked);
          
          if (!oldestCheck || lastChecked < oldestCheck) {
            oldestCheck = lastChecked;
          }
          
          if (!newestCheck || lastChecked > newestCheck) {
            newestCheck = lastChecked;
          }
        }
      }
    }

    return {
      totalConfigs,
      configsByType,
      oldestCheck,
      newestCheck,
    };
  }
}

export default RouterProvisioningService;