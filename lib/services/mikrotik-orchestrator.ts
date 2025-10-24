// lib/services/mikrotik-orchestrator.ts - Full Configuration Orchestrator

import { 
  MikroTikService, 
  MikroTikNetworkConfig, 
  MikroTikServiceConfig,
  MikroTikConnectionConfig 
} from './mikrotik';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface RouterConfigOptions {
  hotspotEnabled: boolean;
  ssid?: string | undefined;
  pppoeEnabled: boolean;
  pppoeInterfaces?: string[] | undefined;
  wanInterface?: string | undefined;
  bridgeInterfaces?: string[] | undefined;
}

interface FullConfigurationResult {
  success: boolean;
  completedSteps: string[];
  failedSteps: Array<{
    step: string;
    error: string;
  }>;
  warnings: string[];
}

// ============================================
// ORCHESTRATOR CLASS
// ============================================

export class MikroTikOrchestrator {
  /**
   * Execute full router configuration based on settings
   */
  static async configureRouter(
    config: MikroTikConnectionConfig,
    options: RouterConfigOptions
  ): Promise<FullConfigurationResult> {
    const completedSteps: string[] = [];
    const failedSteps: Array<{ step: string; error: string }> = [];
    const warnings: string[] = [];

    try {
      // Step 1: Configure WAN interface
      const wanResult = await MikroTikNetworkConfig.configureWANInterface(
        config,
        options.wanInterface || 'ether1'
      );
      if (wanResult.success) {
        completedSteps.push('WAN Interface Configuration');
      } else {
        failedSteps.push({ step: 'WAN Interface', error: wanResult.error || 'Unknown error' });
      }

      // Step 2: Configure PPPoE if enabled
      if (options.pppoeEnabled) {
        const pppoeInterfaces = options.pppoeInterfaces || ['ether2', 'ether3'];
        
        // Configure LAN interfaces for PPPoE
        const lanResult = await MikroTikNetworkConfig.configureLANInterfaces(config, [
          { interface: pppoeInterfaces[0] ?? 'ether2', address: '192.168.100.1/24' },
          { interface: pppoeInterfaces[1] ?? 'ether3', address: '192.168.101.1/24' },
        ]);

        if (lanResult.success) {
          completedSteps.push('LAN Interfaces Configuration');
        } else {
          failedSteps.push({ step: 'LAN Interfaces', error: lanResult.error || 'Unknown error' });
        }

        // Create IP pools for PPPoE
        const poolResult = await MikroTikNetworkConfig.createIPPools(config, [
          { name: 'pppoe-pool-ether2', ranges: '192.168.100.10-192.168.100.200' },
          { name: 'pppoe-pool-ether3', ranges: '192.168.101.10-192.168.101.200' },
        ]);

        if (poolResult.success) {
          completedSteps.push('PPPoE IP Pools');
        } else {
          failedSteps.push({ step: 'PPPoE IP Pools', error: poolResult.error || 'Unknown error' });
        }

        // Create PPPoE servers
        const pppoeServerResult = await MikroTikServiceConfig.configurePPPoEServers(config, [
          {
            'service-name': 'pppoe-ether2',
            interface: pppoeInterfaces[0] ?? 'ether2',
            'default-profile': 'default',
            enabled: 'yes',
          },
          {
            'service-name': 'pppoe-ether3',
            interface: pppoeInterfaces[1] ?? 'ether3',
            'default-profile': 'default',
            enabled: 'yes',
          },
        ]);

        if (pppoeServerResult.success) {
          completedSteps.push('PPPoE Servers');
        } else {
          failedSteps.push({ step: 'PPPoE Servers', error: pppoeServerResult.error || 'Unknown error' });
        }

        // Create PPPoE user profiles
        const pppoeProfilesResult = await MikroTikServiceConfig.createPPPoEUserProfiles(
          config,
          '192.168.100.1',
          'pppoe-pool-ether2'
        );

        if (pppoeProfilesResult.success) {
          completedSteps.push('PPPoE User Profiles');
        } else {
          warnings.push('Some PPPoE profiles may not have been created');
        }

        // Configure NAT for PPPoE networks
        const pppoeNATResult = await MikroTikNetworkConfig.configureNAT(config, [
          {
            chain: 'srcnat',
            'src-address': '192.168.100.0/24',
            'out-interface': options.wanInterface || 'ether1',
            action: 'masquerade',
          },
          {
            chain: 'srcnat',
            'src-address': '192.168.101.0/24',
            'out-interface': options.wanInterface || 'ether1',
            action: 'masquerade',
          },
        ]);

        if (pppoeNATResult.success) {
          completedSteps.push('PPPoE NAT Rules');
        } else {
          failedSteps.push({ step: 'PPPoE NAT', error: pppoeNATResult.error || 'Unknown error' });
        }
      }

      // Step 3: Configure Hotspot if enabled
      if (options.hotspotEnabled && options.ssid) {
        // Create bridge for hotspot
        const bridgeInterfaces = options.bridgeInterfaces || ['wlan1', 'ether4'];
        const bridgeResult = await MikroTikNetworkConfig.configureBridge(
          config,
          'bridge-hotspot',
          '10.5.50.1/24',
          bridgeInterfaces
        );

        if (bridgeResult.success) {
          completedSteps.push('Hotspot Bridge Configuration');
        } else {
          failedSteps.push({ step: 'Hotspot Bridge', error: bridgeResult.error || 'Unknown error' });
        }

        // Configure WiFi
        const wifiResult = await MikroTikNetworkConfig.configureWiFi(
          config,
          'wlan1',
          options.ssid,
          'default'
        );

        if (wifiResult.success) {
          completedSteps.push('WiFi Configuration');
        } else {
          failedSteps.push({ step: 'WiFi Configuration', error: wifiResult.error || 'Unknown error' });
        }

        // Create hotspot IP pool
        const hotspotPoolResult = await MikroTikNetworkConfig.createIPPools(config, [
          { name: 'hotspot-pool', ranges: '10.5.50.10-10.5.50.200' },
        ]);

        if (hotspotPoolResult.success) {
          completedSteps.push('Hotspot IP Pool');
        } else {
          failedSteps.push({ step: 'Hotspot IP Pool', error: hotspotPoolResult.error || 'Unknown error' });
        }

        // Configure DHCP server for hotspot
        const dhcpResult = await MikroTikNetworkConfig.configureDHCPServer(
          config,
          {
            name: 'dhcp-hotspot',
            interface: 'bridge-hotspot',
            'address-pool': 'hotspot-pool',
          },
          {
            address: '10.5.50.0/24',
            gateway: '10.5.50.1',
            'dns-server': '8.8.8.8,8.8.4.4',
          }
        );

        if (dhcpResult.success) {
          completedSteps.push('Hotspot DHCP Server');
        } else {
          failedSteps.push({ step: 'Hotspot DHCP', error: dhcpResult.error || 'Unknown error' });
        }

        // Configure hotspot
        const hotspotResult = await MikroTikServiceConfig.configureHotspot(
          config,
          {
            name: 'hsprof1',
            'hotspot-address': '10.5.50.1',
            'dns-name': 'hotspot.local',
            'html-directory': 'hotspot',
            'http-proxy': '0.0.0.0:0',
            'login-by': 'username,trial,mac,cookie',
            'rate-limit': '512k/2M',
          },
          {
            name: 'hotspot1',
            interface: 'bridge-hotspot',
            'address-pool': 'hotspot-pool',
            profile: 'hsprof1',
            disabled: 'no',
          }
        );

        if (hotspotResult.success) {
          completedSteps.push('Hotspot Server Configuration');
        } else {
          failedSteps.push({ step: 'Hotspot Server', error: hotspotResult.error || 'Unknown error' });
        }

        // Create hotspot user profiles
        const hotspotProfilesResult = await MikroTikServiceConfig.createHotspotUserProfiles(config);

        if (hotspotProfilesResult.success) {
          completedSteps.push('Hotspot User Profiles');
        } else {
          warnings.push('Some hotspot profiles may not have been created');
        }

        // Configure NAT for hotspot
        const hotspotNATResult = await MikroTikNetworkConfig.configureNAT(config, [
          {
            chain: 'srcnat',
            'src-address': '10.5.50.0/24',
            'out-interface': options.wanInterface || 'ether1',
            action: 'masquerade',
          },
        ]);

        if (hotspotNATResult.success) {
          completedSteps.push('Hotspot NAT Rules');
        } else {
          failedSteps.push({ step: 'Hotspot NAT', error: hotspotNATResult.error || 'Unknown error' });
        }
      }

      return {
        success: failedSteps.length === 0,
        completedSteps,
        failedSteps,
        warnings,
      };
    } catch (error) {
      return {
        success: false,
        completedSteps,
        failedSteps: [
          ...failedSteps,
          {
            step: 'Configuration Process',
            error: error instanceof Error ? error.message : 'Unknown error occurred',
          },
        ],
        warnings,
      };
    }
  }
}

// ============================================
// EXPORTS
// ============================================

export type { RouterConfigOptions, FullConfigurationResult };

export default MikroTikOrchestrator;