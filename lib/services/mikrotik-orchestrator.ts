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
  wifiPassword?: string | undefined;  // WiFi WPA2-PSK password (min 8 chars)
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
// NETWORK CONFIGURATION CONSTANTS
// ============================================

/**
 * Safe subnet allocation that won't conflict with common ISP configurations
 * 
 * Avoided subnets (common ISP defaults):
 * - 192.168.0.0/24 (most common home routers)
 * - 192.168.1.0/24 (most common ISP CPE)
 * - 192.168.100.0/24 (common ISP DHCP)
 * - 10.0.0.0/24 (common ISP)
 * 
 * Safe subnets used:
 * - 192.168.88.0/24 (LAN - MikroTik default)
 * - 10.5.50.0/24 (Hotspot)
 * - 10.10.10.0/24 (PPPoE Interface 1)
 * - 10.10.11.0/24 (PPPoE Interface 2)
 * - 10.99.0.0/16 (VPN Management)
 */
const NETWORK_SUBNETS = {
  // PPPoE Configuration
  PPPOE: {
    INTERFACE_1: {
      GATEWAY: '10.10.10.1/24',
      NETWORK: '10.10.10.0/24',
      POOL_NAME: 'pppoe-pool-1',
      POOL_RANGE: '10.10.10.10-10.10.10.200',
    },
    INTERFACE_2: {
      GATEWAY: '10.10.11.1/24',
      NETWORK: '10.10.11.0/24',
      POOL_NAME: 'pppoe-pool-2',
      POOL_RANGE: '10.10.11.10-10.10.11.200',
    },
  },
  // Hotspot Configuration
  HOTSPOT: {
    GATEWAY: '10.5.50.1/24',
    NETWORK: '10.5.50.0/24',
    POOL_NAME: 'hotspot-pool',
    POOL_RANGE: '10.5.50.10-10.5.50.200',
  },
  // LAN Configuration (MikroTik default)
  LAN: {
    GATEWAY: '192.168.88.1/24',
    NETWORK: '192.168.88.0/24',
  },
};

// ============================================
// ORCHESTRATOR CLASS
// ============================================

export class MikroTikOrchestrator {
  /**
   * Execute full router configuration based on settings
   * 
   * Configuration order:
   * 1. WAN Interface (verify existing configuration)
   * 2. PPPoE Service (if enabled)
   * 3. Hotspot Service (if enabled)
   * 
   * Uses safe, non-conflicting subnets to prevent routing issues.
   */
  static async configureRouter(
    config: MikroTikConnectionConfig,
    options: RouterConfigOptions
  ): Promise<FullConfigurationResult> {
    const completedSteps: string[] = [];
    const failedSteps: Array<{ step: string; error: string }> = [];
    const warnings: string[] = [];

    console.log('[Orchestrator] Starting router configuration...');
    console.log('[Orchestrator] Options:', {
      hotspotEnabled: options.hotspotEnabled,
      pppoeEnabled: options.pppoeEnabled,
      wanInterface: options.wanInterface || 'ether1',
    });

    try {
      // ============================================
      // STEP 1: Configure WAN Interface
      // ============================================
      console.log('[Orchestrator] Step 1: Configuring WAN interface...');
      
      const wanResult = await MikroTikNetworkConfig.configureWANInterface(
        config,
        options.wanInterface || 'ether1'
      );
      
      if (wanResult.success) {
        completedSteps.push('WAN Interface Configuration');
        console.log('[Orchestrator] ✓ WAN interface configured');
      } else {
        failedSteps.push({ 
          step: 'WAN Interface', 
          error: wanResult.error || 'Unknown error' 
        });
        console.error('[Orchestrator] ✗ WAN interface configuration failed:', wanResult.error);
      }

      // ============================================
      // STEP 2: Configure PPPoE Service (if enabled)
      // ============================================
      if (options.pppoeEnabled) {
        console.log('[Orchestrator] Step 2: Configuring PPPoE service...');
        
        const pppoeInterfaces = options.pppoeInterfaces || ['ether2', 'ether3'];
        const interface1 = pppoeInterfaces[0] ?? 'ether2';
        const interface2 = pppoeInterfaces[1] ?? 'ether3';

        console.log('[Orchestrator] PPPoE interfaces:', { interface1, interface2 });
        console.log('[Orchestrator] Using safe subnets:', {
          interface1: NETWORK_SUBNETS.PPPOE.INTERFACE_1.NETWORK,
          interface2: NETWORK_SUBNETS.PPPOE.INTERFACE_2.NETWORK,
        });

        // Step 2.1: Configure PPPoE gateway interfaces
        console.log('[Orchestrator] Step 2.1: Configuring PPPoE gateway IPs...');
        
        const lanResult = await MikroTikNetworkConfig.configureLANInterfaces(config, [
          { 
            interface: interface1, 
            address: NETWORK_SUBNETS.PPPOE.INTERFACE_1.GATEWAY 
          },
          { 
            interface: interface2, 
            address: NETWORK_SUBNETS.PPPOE.INTERFACE_2.GATEWAY 
          },
        ]);

        if (lanResult.success) {
          completedSteps.push('PPPoE Gateway Interfaces');
          console.log('[Orchestrator] ✓ PPPoE gateway interfaces configured');
        } else {
          failedSteps.push({ 
            step: 'PPPoE Gateway Interfaces', 
            error: lanResult.error || 'Unknown error' 
          });
          console.error('[Orchestrator] ✗ PPPoE gateway interfaces failed:', lanResult.error);
        }

        // Step 2.2: Create IP pools for PPPoE clients
        console.log('[Orchestrator] Step 2.2: Creating PPPoE IP pools...');
        
        const poolResult = await MikroTikNetworkConfig.createIPPools(config, [
          { 
            name: NETWORK_SUBNETS.PPPOE.INTERFACE_1.POOL_NAME, 
            ranges: NETWORK_SUBNETS.PPPOE.INTERFACE_1.POOL_RANGE 
          },
          { 
            name: NETWORK_SUBNETS.PPPOE.INTERFACE_2.POOL_NAME, 
            ranges: NETWORK_SUBNETS.PPPOE.INTERFACE_2.POOL_RANGE 
          },
        ]);

        if (poolResult.success) {
          completedSteps.push('PPPoE IP Pools');
          console.log('[Orchestrator] ✓ PPPoE IP pools created');
        } else {
          failedSteps.push({ 
            step: 'PPPoE IP Pools', 
            error: poolResult.error || 'Unknown error' 
          });
          console.error('[Orchestrator] ✗ PPPoE IP pools failed:', poolResult.error);
        }

        // Step 2.3: Create PPPoE servers
        console.log('[Orchestrator] Step 2.3: Creating PPPoE servers...');
        
        const pppoeServerResult = await MikroTikServiceConfig.configurePPPoEServers(config, [
          {
            'service-name': `pppoe-${interface1}`,
            interface: interface1,
            'default-profile': 'default',
          },
          {
            'service-name': `pppoe-${interface2}`,
            interface: interface2,
            'default-profile': 'default',
          },
        ]);

        if (pppoeServerResult.success) {
          completedSteps.push('PPPoE Servers');
          console.log('[Orchestrator] ✓ PPPoE servers created');
        } else {
          failedSteps.push({ 
            step: 'PPPoE Servers', 
            error: pppoeServerResult.error || 'Unknown error' 
          });
          console.error('[Orchestrator] ✗ PPPoE servers failed:', pppoeServerResult.error);
        }

        // Step 2.4: Create PPPoE user profiles
        console.log('[Orchestrator] Step 2.4: Creating PPPoE user profiles...');
        
        const pppoeGatewayIP = NETWORK_SUBNETS.PPPOE.INTERFACE_1.GATEWAY.split('/')[0] ?? '10.10.10.1';
        const pppoeProfilesResult = await MikroTikServiceConfig.createPPPoEUserProfiles(
          config,
          pppoeGatewayIP, // Extract IP without CIDR
          NETWORK_SUBNETS.PPPOE.INTERFACE_1.POOL_NAME
        );

        if (pppoeProfilesResult.success) {
          completedSteps.push('PPPoE User Profiles');
          console.log('[Orchestrator] ✓ PPPoE user profiles created');
        } else {
          warnings.push('Some PPPoE profiles may not have been created');
          console.warn('[Orchestrator] ⚠ PPPoE profiles warning:', pppoeProfilesResult.error);
        }

        // Step 2.5: Configure NAT for PPPoE networks
        console.log('[Orchestrator] Step 2.5: Configuring PPPoE NAT rules...');
        
        const pppoeNATResult = await MikroTikNetworkConfig.configureNAT(config, [
          {
            chain: 'srcnat',
            'src-address': NETWORK_SUBNETS.PPPOE.INTERFACE_1.NETWORK,
            'out-interface': options.wanInterface || 'ether1',
            action: 'masquerade',
          },
          {
            chain: 'srcnat',
            'src-address': NETWORK_SUBNETS.PPPOE.INTERFACE_2.NETWORK,
            'out-interface': options.wanInterface || 'ether1',
            action: 'masquerade',
          },
        ]);

        if (pppoeNATResult.success) {
          completedSteps.push('PPPoE NAT Rules');
          console.log('[Orchestrator] ✓ PPPoE NAT rules configured');
        } else {
          failedSteps.push({ 
            step: 'PPPoE NAT', 
            error: pppoeNATResult.error || 'Unknown error' 
          });
          console.error('[Orchestrator] ✗ PPPoE NAT failed:', pppoeNATResult.error);
        }

        console.log('[Orchestrator] ✓ PPPoE configuration complete');
      }

      // ============================================
      // STEP 3: Configure Hotspot Service (if enabled)
      // ============================================
      if (options.hotspotEnabled && options.ssid) {
        console.log('[Orchestrator] Step 3: Configuring Hotspot service...');
        console.log('[Orchestrator] Hotspot SSID:', options.ssid);
        console.log('[Orchestrator] Hotspot subnet:', NETWORK_SUBNETS.HOTSPOT.NETWORK);

        // Check if router has wireless capability
        const hasWiFi = await MikroTikNetworkConfig.hasWirelessCapability(config);
        console.log('[Orchestrator] Wireless capability detected:', hasWiFi);

        // Use appropriate bridge interfaces based on wireless capability
        let bridgeInterfaces: string[];
        if (options.bridgeInterfaces) {
          bridgeInterfaces = options.bridgeInterfaces;
        } else {
          // Default: Use wlan1 + ether5 if WiFi available, otherwise just ether5
          bridgeInterfaces = hasWiFi ? ['wlan1', 'ether5'] : ['ether5'];
        }
        console.log('[Orchestrator] Bridge interfaces:', bridgeInterfaces);

        // Step 3.1: Create bridge for hotspot
        console.log('[Orchestrator] Step 3.1: Creating hotspot bridge...');
        
        const bridgeResult = await MikroTikNetworkConfig.configureBridge(
          config,
          'bridge-hotspot',
          NETWORK_SUBNETS.HOTSPOT.GATEWAY,
          bridgeInterfaces
        );

        if (bridgeResult.success) {
          completedSteps.push('Hotspot Bridge Configuration');
          console.log('[Orchestrator] ✓ Hotspot bridge created');
        } else {
          failedSteps.push({ 
            step: 'Hotspot Bridge', 
            error: bridgeResult.error || 'Unknown error' 
          });
          console.error('[Orchestrator] ✗ Hotspot bridge failed:', bridgeResult.error);
        }

        // Step 3.2: Configure WiFi (only if hardware is available)
        if (hasWiFi) {
          console.log('[Orchestrator] Step 3.2: Configuring WiFi with security...');
          
          // Step 3.2a: Create secure WiFi security profile
          console.log('[Orchestrator] Step 3.2a: Creating secure WiFi security profile...');
          const wifiPassword = options.wifiPassword || `HotSpot${Math.random().toString(36).substring(2, 10).toUpperCase()}!`;
          
          const securityProfileResult = await MikroTikNetworkConfig.createSecureWiFiSecurityProfile(
            config,
            'secure-wifi',
            wifiPassword
          );

          if (securityProfileResult.success) {
            completedSteps.push('WiFi Security Profile (WPA2-PSK/AES)');
            console.log('[Orchestrator] ✓ WiFi security profile created');
            console.log(`[Orchestrator]   WiFi Password: ${wifiPassword}`);
          } else {
            failedSteps.push({ 
              step: 'WiFi Security Profile', 
              error: securityProfileResult.error || 'Unknown error' 
            });
            console.error('[Orchestrator] ✗ WiFi security profile failed:', securityProfileResult.error);
          }

          // Step 3.2b: Configure WiFi interface with secure profile
          const wifiResult = await MikroTikNetworkConfig.configureWiFi(
            config,
            'wlan1',
            options.ssid,
            'secure-wifi'  // Use secure profile instead of 'default'
          );

          if (wifiResult.success) {
            completedSteps.push('WiFi Configuration (WPA2-PSK Protected)');
            console.log('[Orchestrator] ✓ WiFi configured with WPA2-PSK encryption');
          } else {
            failedSteps.push({ 
              step: 'WiFi Configuration', 
              error: wifiResult.error || 'Unknown error' 
            });
            console.error('[Orchestrator] ✗ WiFi configuration failed:', wifiResult.error);
          }
        } else {
          console.log('[Orchestrator] Step 3.2: Skipping WiFi configuration (no wireless hardware)');
          completedSteps.push('WiFi Configuration (Skipped - No Hardware)');
        }

        // Step 3.3: Create hotspot IP pool
        console.log('[Orchestrator] Step 3.3: Creating hotspot IP pool...');
        
        const hotspotPoolResult = await MikroTikNetworkConfig.createIPPools(config, [
          { 
            name: NETWORK_SUBNETS.HOTSPOT.POOL_NAME, 
            ranges: NETWORK_SUBNETS.HOTSPOT.POOL_RANGE 
          },
        ]);

        if (hotspotPoolResult.success) {
          completedSteps.push('Hotspot IP Pool');
          console.log('[Orchestrator] ✓ Hotspot IP pool created');
        } else {
          failedSteps.push({ 
            step: 'Hotspot IP Pool', 
            error: hotspotPoolResult.error || 'Unknown error' 
          });
          console.error('[Orchestrator] ✗ Hotspot IP pool failed:', hotspotPoolResult.error);
        }

        // Step 3.4: Configure DHCP server for hotspot
        console.log('[Orchestrator] Step 3.4: Configuring hotspot DHCP server...');
        
        const dhcpResult = await MikroTikNetworkConfig.configureDHCPServer(
          config,
          {
            name: 'dhcp-hotspot',
            interface: 'bridge-hotspot',
            'address-pool': NETWORK_SUBNETS.HOTSPOT.POOL_NAME,
          },
          {
            address: NETWORK_SUBNETS.HOTSPOT.NETWORK,
            gateway: NETWORK_SUBNETS.HOTSPOT.GATEWAY.split('/')[0] ?? '10.5.50.1', // Extract IP without CIDR
            'dns-server': '8.8.8.8,8.8.4.4',
          }
        );

        if (dhcpResult.success) {
          completedSteps.push('Hotspot DHCP Server');
          console.log('[Orchestrator] ✓ Hotspot DHCP server configured');
        } else {
          failedSteps.push({ 
            step: 'Hotspot DHCP', 
            error: dhcpResult.error || 'Unknown error' 
          });
          console.error('[Orchestrator] ✗ Hotspot DHCP failed:', dhcpResult.error);
        }

        // Step 3.5: Configure hotspot server
        console.log('[Orchestrator] Step 3.5: Configuring hotspot server...');
        
        const hotspotGatewayIP = NETWORK_SUBNETS.HOTSPOT.GATEWAY.split('/')[0] ?? '10.5.50.1';
        const hotspotResult = await MikroTikServiceConfig.configureHotspot(
          config,
          {
            name: 'hsprof1',
            'hotspot-address': hotspotGatewayIP,
            'dns-name': 'hotspot.local',
            'html-directory': 'hotspot',
            'http-proxy': '0.0.0.0:0',
            'login-by': 'username,trial,mac,cookie',
            'rate-limit': '512k/2M',
          },
          {
            name: 'hotspot1',
            interface: 'bridge-hotspot',
            'address-pool': NETWORK_SUBNETS.HOTSPOT.POOL_NAME,
            profile: 'hsprof1',
            disabled: 'no',
          }
        );

        if (hotspotResult.success) {
          completedSteps.push('Hotspot Server Configuration');
          console.log('[Orchestrator] ✓ Hotspot server configured');
        } else {
          failedSteps.push({ 
            step: 'Hotspot Server', 
            error: hotspotResult.error || 'Unknown error' 
          });
          console.error('[Orchestrator] ✗ Hotspot server failed:', hotspotResult.error);
        }

        // Step 3.5a: Secure hotspot authentication
        console.log('[Orchestrator] Step 3.5a: Securing hotspot authentication...');
        
        const hotspotSecurityResult = await MikroTikServiceConfig.configureSecureHotspotAuth(
          config,
          'hotspot1'
        );

        if (hotspotSecurityResult.success) {
          completedSteps.push('Hotspot Authentication Security (HTTP CHAP Only)');
          console.log('[Orchestrator] ✓ Hotspot authentication secured');
          console.log('[Orchestrator]   - Login method: Username/Password only');
          console.log('[Orchestrator]   - Cookie auth: Disabled');
          console.log('[Orchestrator]   - Trial mode: Disabled');
          console.log('[Orchestrator]   - MAC auth: Disabled');
          console.log('[Orchestrator]   - Device limit: 1 per user');
        } else {
          warnings.push('Hotspot security hardening may not have been applied');
          console.warn('[Orchestrator] ⚠ Hotspot security warning:', hotspotSecurityResult.error);
        }

        // Step 3.6: Create hotspot user profiles
        console.log('[Orchestrator] Step 3.6: Creating hotspot user profiles...');
        
        const hotspotProfilesResult = await MikroTikServiceConfig.createHotspotUserProfiles(config);

        if (hotspotProfilesResult.success) {
          completedSteps.push('Hotspot User Profiles');
          console.log('[Orchestrator] ✓ Hotspot user profiles created');
        } else {
          warnings.push('Some hotspot profiles may not have been created');
          console.warn('[Orchestrator] ⚠ Hotspot profiles warning:', hotspotProfilesResult.error);
        }

        // Step 3.7: Configure NAT for hotspot
        console.log('[Orchestrator] Step 3.7: Configuring hotspot NAT rules...');
        
        const hotspotNATResult = await MikroTikNetworkConfig.configureNAT(config, [
          {
            chain: 'srcnat',
            'src-address': NETWORK_SUBNETS.HOTSPOT.NETWORK,
            'out-interface': options.wanInterface || 'ether1',
            action: 'masquerade',
          },
        ]);

        if (hotspotNATResult.success) {
          completedSteps.push('Hotspot NAT Rules');
          console.log('[Orchestrator] ✓ Hotspot NAT rules configured');
        } else {
          failedSteps.push({ 
            step: 'Hotspot NAT', 
            error: hotspotNATResult.error || 'Unknown error' 
          });
          console.error('[Orchestrator] ✗ Hotspot NAT failed:', hotspotNATResult.error);
        }

        console.log('[Orchestrator] ✓ Hotspot configuration complete');
      }

      // ============================================
      // CONFIGURATION SUMMARY
      // ============================================
      const success = failedSteps.length === 0;
      
      console.log('[Orchestrator] ============================================');
      console.log('[Orchestrator] Configuration Summary:');
      console.log('[Orchestrator] Status:', success ? '✅ SUCCESS' : '⚠ PARTIAL SUCCESS');
      console.log('[Orchestrator] Completed Steps:', completedSteps.length);
      console.log('[Orchestrator] Failed Steps:', failedSteps.length);
      console.log('[Orchestrator] Warnings:', warnings.length);
      
      if (completedSteps.length > 0) {
        console.log('[Orchestrator] ✓ Completed:', completedSteps.join(', '));
      }
      
      if (failedSteps.length > 0) {
        console.log('[Orchestrator] ✗ Failed:');
        failedSteps.forEach(step => {
          console.log(`[Orchestrator]   - ${step.step}: ${step.error}`);
        });
      }
      
      if (warnings.length > 0) {
        console.log('[Orchestrator] ⚠ Warnings:', warnings.join(', '));
      }
      
      console.log('[Orchestrator] ============================================');

      return {
        success,
        completedSteps,
        failedSteps,
        warnings,
      };

    } catch (error) {
      console.error('[Orchestrator] ❌ Critical error during configuration:', error);
      
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
export { NETWORK_SUBNETS };
export default MikroTikOrchestrator;