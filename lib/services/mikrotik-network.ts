// lib/services/mikrotik-network.ts - Complete Part 2: Network Configuration

import { MikroTikService, MikroTikConnectionConfig } from './mikrotik-core';

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

export class MikroTikNetworkConfig {
  /**
   * Detect if the router has wireless capability
   * Checks for the presence of wireless interfaces
   * 
   * @returns true if router has WiFi hardware, false otherwise
   */
  static async hasWirelessCapability(
    config: MikroTikConnectionConfig
  ): Promise<boolean> {
    try {
      const interfaces = await MikroTikService.makeRequest(
        config,
        '/rest/interface/wireless',
        'GET'
      );

      return Array.isArray(interfaces) && interfaces.length > 0;
    } catch (error) {
      console.error('Failed to check wireless capability:', error);
      // If we can't check, assume no wireless (fail-safe)
      return false;
    }
  }

  /**
   * Create secure WiFi security profile with WPA2-PSK and AES encryption
   * 
   * @param config - MikroTik connection configuration
   * @param profileName - Name for the security profile (e.g., 'secure-wifi')
   * @param password - WiFi password (WPA2-PSK key) - minimum 8 characters recommended
   * @returns Configuration result with profile details
   */
  static async createSecureWiFiSecurityProfile(
    config: MikroTikConnectionConfig,
    profileName: string,
    password: string
  ): Promise<ConfigurationResult> {
    try {
      // Validate password strength
      if (!password || password.length < 8) {
        return {
          success: false,
          step: 'wifi_security_profile',
          message: 'WiFi password must be at least 8 characters long',
          error: 'Invalid password',
        };
      }

      // Check if profile already exists
      const existingProfiles = await MikroTikService.makeRequest(
        config,
        '/rest/interface/wireless/security-profiles',
        'GET'
      );

      const existing = Array.isArray(existingProfiles)
        ? existingProfiles.find((p: any) => p.name === profileName)
        : null;

      if (existing) {
        console.log(`Security profile ${profileName} already exists, updating...`);
        
        // Update existing profile
        await MikroTikService.makeRequest(
          config,
          `/rest/interface/wireless/security-profiles/${existing['.id']}`,
          'PATCH',
          {
            'authentication-types': 'wpa2-psk',
            'mode': 'dynamic-keys',
            'unicast-ciphers': 'aes-ccm',
            'group-ciphers': 'aes-ccm',
            'wpa2-pre-shared-key': password,
          }
        );

        return {
          success: true,
          step: 'wifi_security_profile',
          message: `Security profile ${profileName} updated with WPA2-PSK/AES`,
          data: existing,
        };
      }

      // Create new secure profile
      const result = await MikroTikService.makeRequest(
        config,
        '/rest/interface/wireless/security-profiles',
        'POST',
        {
          name: profileName,
          'authentication-types': 'wpa2-psk',
          'mode': 'dynamic-keys',
          'unicast-ciphers': 'aes-ccm',
          'group-ciphers': 'aes-ccm',
          'wpa2-pre-shared-key': password,
        }
      );

      return {
        success: true,
        step: 'wifi_security_profile',
        message: `Secure WiFi profile ${profileName} created with WPA2-PSK/AES encryption`,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        step: 'wifi_security_profile',
        message: 'Failed to create WiFi security profile',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Step 1: Configure WAN interface as DHCP client
   */
  static async configureWANInterface(
    config: MikroTikConnectionConfig,
    wanInterface: string = 'ether1'
  ): Promise<ConfigurationResult> {
    try {
      // Check if DHCP client already exists
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
          message: `WAN interface ${wanInterface} already configured as DHCP client`,
          data: existing,
        };
      }

      const result = await MikroTikService.makeRequest(
        config,
        '/rest/ip/dhcp-client',
        'POST',
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

  /**
   * Step 2: Configure LAN interfaces for PPPoE
   */
  static async configureLANInterfaces(
    config: MikroTikConnectionConfig,
    interfaces: Array<{ interface: string; address: string }>
  ): Promise<ConfigurationResult> {
    try {
      const results = [];

      for (const iface of interfaces) {
        // Check if address already exists
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
          const result = await MikroTikService.makeRequest(
            config,
            '/rest/ip/address',
            'POST',
            {
              address: iface.address,
              interface: iface.interface,
            }
          );
          results.push(result);
        } else {
          results.push({ existing: true, interface: iface.interface });
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
   * Step 3: Create and configure bridge for hotspot
   */
  static async configureBridge(
    config: MikroTikConnectionConfig,
    bridgeName: string,
    bridgeAddress: string,
    interfaces: string[]
  ): Promise<ConfigurationResult> {
    try {
      // Check if bridge exists
      const existingBridges = await MikroTikService.makeRequest(
        config,
        '/rest/interface/bridge',
        'GET'
      );

      let bridge = Array.isArray(existingBridges)
        ? existingBridges.find((b: any) => b.name === bridgeName)
        : null;

      // Create bridge if it doesn't exist
      if (!bridge) {
        bridge = await MikroTikService.makeRequest(
          config,
          '/rest/interface/bridge',
          'POST',
          { name: bridgeName }
        );
      }

      // Validate interfaces exist before trying to add them
      const availableInterfaces = await MikroTikService.makeRequest(
        config,
        '/rest/interface',
        'GET'
      );

      const validInterfaces = interfaces.filter(iface => {
        const exists = Array.isArray(availableInterfaces) && 
          availableInterfaces.some((i: any) => i.name === iface);
        
        if (!exists) {
          console.warn(`Interface ${iface} not found on router, skipping...`);
        }
        
        return exists;
      });

      if (validInterfaces.length === 0) {
        console.warn(`No valid interfaces found for bridge ${bridgeName}`);
        // Continue anyway - bridge can exist without ports
      }

      // Add interfaces to bridge
      for (const iface of validInterfaces) {
        const existingPorts = await MikroTikService.makeRequest(
          config,
          '/rest/interface/bridge/port',
          'GET'
        );

        // Check if interface is already on this bridge
        const portExists = Array.isArray(existingPorts)
          ? existingPorts.find(
              (p: any) => p.bridge === bridgeName && p.interface === iface
            )
          : false;

        if (portExists) {
          console.log(`Interface ${iface} already on bridge ${bridgeName}`);
          continue;
        }

        // Check if interface is on a different bridge
        const existingPort = Array.isArray(existingPorts)
          ? existingPorts.find((p: any) => p.interface === iface)
          : null;

        if (existingPort && existingPort.bridge !== bridgeName) {
          console.log(`Removing interface ${iface} from bridge ${existingPort.bridge}`);
          try {
            await MikroTikService.makeRequest(
              config,
              `/rest/interface/bridge/port/${existingPort['.id']}`,
              'DELETE'
            );
          } catch (removeError) {
            console.error(`Failed to remove ${iface} from old bridge:`, removeError);
            // Continue anyway - might still be able to add
          }
        }

        // Add interface to new bridge
        try {
          await MikroTikService.makeRequest(
            config,
            '/rest/interface/bridge/port',
            'POST',
            {
              bridge: bridgeName,
              interface: iface,
            }
          );
          console.log(`Added interface ${iface} to bridge ${bridgeName}`);
        } catch (addError) {
          console.error(`Failed to add ${iface} to bridge:`, addError);
          // Continue with other interfaces
        }
      }

      // Assign IP to bridge
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
        await MikroTikService.makeRequest(config, '/rest/ip/address', 'POST', {
          address: bridgeAddress,
          interface: bridgeName,
        });
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

  /**
   * Step 4: Configure WiFi interface
   */
  static async configureWiFi(
    config: MikroTikConnectionConfig,
    wlanInterface: string,
    ssid: string,
    securityProfile: string = 'default'
  ): Promise<ConfigurationResult> {
    try {
      // Get wireless interface
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

      // Configure wireless settings
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

      // Enable wireless interface
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

  /**
   * Step 5: Create IP pools
   */
  static async createIPPools(
    config: MikroTikConnectionConfig,
    pools: IPPoolConfig[]
  ): Promise<ConfigurationResult> {
    try {
      const results = [];

      for (const pool of pools) {
        // Check if pool exists
        const existingPools = await MikroTikService.makeRequest(
          config,
          '/rest/ip/pool',
          'GET'
        );

        const exists = Array.isArray(existingPools)
          ? existingPools.find((p: any) => p.name === pool.name)
          : false;

        if (!exists) {
          const result = await MikroTikService.makeRequest(
            config,
            '/rest/ip/pool',
            'POST',
            pool
          );
          results.push(result);
        } else {
          results.push({ existing: true, name: pool.name });
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

  /**
   * Step 6: Configure DHCP server for hotspot
   */
  static async configureDHCPServer(
    config: MikroTikConnectionConfig,
    serverConfig: DHCPServerConfig,
    networkConfig: DHCPNetworkConfig
  ): Promise<ConfigurationResult> {
    try {
      // Create DHCP network
      const existingNetworks = await MikroTikService.makeRequest(
        config,
        '/rest/ip/dhcp-server/network',
        'GET'
      );

      const networkExists = Array.isArray(existingNetworks)
        ? existingNetworks.find((n: any) => n.address === networkConfig.address)
        : false;

      if (!networkExists) {
        await MikroTikService.makeRequest(
          config,
          '/rest/ip/dhcp-server/network',
          'POST',
          networkConfig
        );
      }

      // Create DHCP server
      const existingServers = await MikroTikService.makeRequest(
        config,
        '/rest/ip/dhcp-server',
        'GET'
      );

      const serverExists = Array.isArray(existingServers)
        ? existingServers.find((s: any) => s.name === serverConfig.name)
        : false;

      if (!serverExists) {
        await MikroTikService.makeRequest(
          config,
          '/rest/ip/dhcp-server',
          'POST',
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

  /**
   * Step 7: Configure NAT rules
   */
  static async configureNAT(
    config: MikroTikConnectionConfig,
    rules: NATRuleConfig[]
  ): Promise<ConfigurationResult> {
    try {
      const createdRules = [];

      for (const rule of rules) {
        // Check if rule exists
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
          const result = await MikroTikService.makeRequest(
            config,
            '/rest/ip/firewall/nat',
            'POST',
            rule
          );
          createdRules.push(result);
        } else {
          createdRules.push({ existing: true, srcAddress: rule['src-address'] });
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

export type {
  ConfigurationResult,
  IPPoolConfig,
  DHCPServerConfig,
  DHCPNetworkConfig,
  NATRuleConfig,
};

export default MikroTikNetworkConfig;