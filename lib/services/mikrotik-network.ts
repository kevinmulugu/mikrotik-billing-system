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

      // Add interfaces to bridge
      for (const iface of interfaces) {
        const existingPorts = await MikroTikService.makeRequest(
          config,
          '/rest/interface/bridge/port',
          'GET'
        );

        const portExists = Array.isArray(existingPorts)
          ? existingPorts.find(
              (p: any) => p.bridge === bridgeName && p.interface === iface
            )
          : false;

        if (!portExists) {
          await MikroTikService.makeRequest(
            config,
            '/rest/interface/bridge/port',
            'POST',
            {
              bridge: bridgeName,
              interface: iface,
            }
          );
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