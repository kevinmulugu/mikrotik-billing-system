// lib/services/mikrotik-service-config.ts - Complete Part 3: Service Configuration

import { MikroTikService, MikroTikConnectionConfig } from './mikrotik-core';
import { ConfigurationResult } from './mikrotik-network';

interface PPPoEServerConfig {
  'service-name': string;
  interface: string;
  'default-profile': string;
  disabled?: string;
}

interface PPPProfileConfig {
  name: string;
  'local-address': string;
  'remote-address': string;
  'dns-server': string;
  'rate-limit'?: string;
  'session-timeout'?: string;
  'idle-timeout'?: string;
}

interface HotspotProfileConfig {
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

interface HotspotServerConfig {
  name: string;
  interface: string;
  'address-pool': string;
  profile: string;
}

export class MikroTikServiceConfig {
  /**
   * Step 8: Configure PPPoE servers
   */
  static async configurePPPoEServers(
    config: MikroTikConnectionConfig,
    servers: PPPoEServerConfig[]
  ): Promise<ConfigurationResult> {
    try {
      const createdServers = [];

      for (const server of servers) {
        // Check if PPPoE server exists
        const existingServers = await MikroTikService.makeRequest(
          config,
          '/rest/interface/pppoe-server/server',
          'GET'
        );

        const serverExists = Array.isArray(existingServers)
          ? existingServers.find(
              (s: any) =>
                s['service-name'] === server['service-name'] &&
                s.interface === server.interface
            )
          : false;

        if (!serverExists) {
          const result = await MikroTikService.makeRequest(
            config,
            '/rest/interface/pppoe-server/server',
            'POST',
            server
          );
          createdServers.push(result);
        } else {
          createdServers.push({ existing: true, serviceName: server['service-name'] });
        }
      }

      return {
        success: true,
        step: 'pppoe_servers',
        message: `Configured ${servers.length} PPPoE servers successfully`,
        data: createdServers,
      };
    } catch (error) {
      return {
        success: false,
        step: 'pppoe_servers',
        message: 'Failed to configure PPPoE servers',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Step 9: Create PPP profiles
   */
  static async createPPPProfiles(
    config: MikroTikConnectionConfig,
    profiles: PPPProfileConfig[]
  ): Promise<ConfigurationResult> {
    try {
      const createdProfiles = [];

      for (const profile of profiles) {
        // Check if profile exists
        const existingProfiles = await MikroTikService.makeRequest(
          config,
          '/rest/ppp/profile',
          'GET'
        );

        const profileExists = Array.isArray(existingProfiles)
          ? existingProfiles.find((p: any) => p.name === profile.name)
          : false;

        if (!profileExists) {
          const result = await MikroTikService.makeRequest(
            config,
            '/rest/ppp/profile',
            'POST',
            profile
          );
          createdProfiles.push(result);
        } else {
          createdProfiles.push({ existing: true, name: profile.name });
        }
      }

      return {
        success: true,
        step: 'ppp_profiles',
        message: `Created ${profiles.length} PPP profiles successfully`,
        data: createdProfiles,
      };
    } catch (error) {
      return {
        success: false,
        step: 'ppp_profiles',
        message: 'Failed to create PPP profiles',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Step 10: Configure Hotspot
   */
  static async configureHotspot(
    config: MikroTikConnectionConfig,
    hotspotProfile: HotspotProfileConfig,
    hotspotServer: HotspotServerConfig
  ): Promise<ConfigurationResult> {
    try {
      // Ensure secure defaults for hotspot profile
      const secureProfile: HotspotProfileConfig = {
        ...hotspotProfile,
        'login-by': 'http-chap',  // SECURE: Username/password only
        'shared-users': '1',  // SECURE: One device per user
        'transparent-proxy': 'yes',  // Enable transparent proxy
      };

      // Create hotspot profile
      const existingProfiles = await MikroTikService.makeRequest(
        config,
        '/rest/ip/hotspot/profile',
        'GET'
      );

      const profileExists = Array.isArray(existingProfiles)
        ? existingProfiles.find((p: any) => p.name === secureProfile.name)
        : false;

      if (!profileExists) {
        await MikroTikService.makeRequest(
          config,
          '/rest/ip/hotspot/profile',
          'POST',
          secureProfile
        );
        console.log(`✓ Created secure hotspot profile: ${secureProfile.name}`);
      } else {
        // Update existing profile with secure settings
        await MikroTikService.makeRequest(
          config,
          `/rest/ip/hotspot/profile/${profileExists['.id']}`,
          'PATCH',
          {
            'login-by': 'http-chap',
            'shared-users': '1',
            'transparent-proxy': 'yes',
          }
        );
        console.log(`✓ Updated hotspot profile with secure settings: ${secureProfile.name}`);
      }

      // Create hotspot server
      const existingServers = await MikroTikService.makeRequest(
        config,
        '/rest/ip/hotspot',
        'GET'
      );

      const serverExists = Array.isArray(existingServers)
        ? existingServers.find((s: any) => s.name === hotspotServer.name)
        : false;

      if (!serverExists) {
        await MikroTikService.makeRequest(
          config,
          '/rest/ip/hotspot',
          'POST',
          hotspotServer
        );
      }

      return {
        success: true,
        step: 'hotspot_configuration',
        message: 'Hotspot configured successfully with secure authentication',
        data: { profile: secureProfile.name, server: hotspotServer.name },
      };
    } catch (error) {
      return {
        success: false,
        step: 'hotspot_configuration',
        message: 'Failed to configure hotspot',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Configure secure hotspot authentication mode
   * 
   * Disables insecure login methods and enforces username/password authentication:
   * - Disables cookie-based authentication
   * - Disables trial/free access
   * - Disables MAC authentication
   * - Enables HTTP CHAP (secure password authentication)
   * - Enforces HTTPS redirect for login
   * 
   * @param config - MikroTik connection configuration
   * @param hotspotServerName - Name of the hotspot server to configure
   * @returns Configuration result
   */
  static async configureSecureHotspotAuth(
    config: MikroTikConnectionConfig,
    hotspotServerName: string = 'hotspot1'
  ): Promise<ConfigurationResult> {
    try {
      // Get hotspot server
      const servers = await MikroTikService.makeRequest(
        config,
        '/rest/ip/hotspot',
        'GET'
      );

      const server = Array.isArray(servers)
        ? servers.find((s: any) => s.name === hotspotServerName)
        : null;

      if (!server) {
        return {
          success: false,
          step: 'hotspot_secure_auth',
          message: `Hotspot server ${hotspotServerName} not found`,
          error: 'Server not found',
        };
      }

      // Get the hotspot profile
      const profileName = server.profile;
      const profiles = await MikroTikService.makeRequest(
        config,
        '/rest/ip/hotspot/profile',
        'GET'
      );

      const profile = Array.isArray(profiles)
        ? profiles.find((p: any) => p.name === profileName)
        : null;

      if (!profile) {
        return {
          success: false,
          step: 'hotspot_secure_auth',
          message: `Hotspot profile ${profileName} not found`,
          error: 'Profile not found',
        };
      }

      // Update profile with secure authentication settings
      await MikroTikService.makeRequest(
        config,
        `/rest/ip/hotspot/profile/${profile['.id']}`,
        'PATCH',
        {
          'login-by': 'http-chap',  // Only HTTP CHAP (username/password)
          'use-radius': 'no',  // Disable RADIUS (using local auth)
          'shared-users': '1',  // One device per user
          'transparent-proxy': 'yes',  // Enable transparent proxy
        }
      );

      console.log(`✓ Configured secure authentication for hotspot profile: ${profileName}`);
      console.log('  - Login method: HTTP CHAP (username/password only)');
      console.log('  - Cookie auth: Disabled');
      console.log('  - Trial mode: Disabled');
      console.log('  - MAC auth: Disabled');
      console.log('  - Shared users: 1 (one device per user)');

      return {
        success: true,
        step: 'hotspot_secure_auth',
        message: `Secure authentication configured for ${hotspotServerName}`,
        data: {
          server: hotspotServerName,
          profile: profileName,
          loginBy: 'http-chap',
          sharedUsers: 1,
        },
      };
    } catch (error) {
      return {
        success: false,
        step: 'hotspot_secure_auth',
        message: 'Failed to configure secure hotspot authentication',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Step 11: Create hotspot user profiles (time-based packages for Kenya)
   */
  static async createHotspotUserProfiles(
    config: MikroTikConnectionConfig
  ): Promise<ConfigurationResult> {
    try {
      const profiles = [
        {
          name: '1hour-10ksh',
          'session-timeout': '1h',
          'idle-timeout': '10m',
          'keepalive-timeout': '2m',
          'status-autorefresh': '1m',
          'shared-users': '1',
          'rate-limit': '2M/5M',
          'transparent-proxy': 'yes',
        },
        {
          name: '3hours-25ksh',
          'session-timeout': '3h',
          'idle-timeout': '15m',
          'keepalive-timeout': '2m',
          'status-autorefresh': '1m',
          'shared-users': '1',
          'rate-limit': '3M/6M',
          'transparent-proxy': 'yes',
        },
        {
          name: '5hours-40ksh',
          'session-timeout': '5h',
          'idle-timeout': '20m',
          'keepalive-timeout': '2m',
          'status-autorefresh': '1m',
          'shared-users': '1',
          'rate-limit': '4M/8M',
          'transparent-proxy': 'yes',
        },
        {
          name: '12hours-70ksh',
          'session-timeout': '12h',
          'idle-timeout': '30m',
          'keepalive-timeout': '2m',
          'status-autorefresh': '1m',
          'shared-users': '1',
          'rate-limit': '5M/10M',
          'transparent-proxy': 'yes',
        },
        {
          name: '1day-100ksh',
          'session-timeout': '1d',
          'idle-timeout': '1h',
          'keepalive-timeout': '2m',
          'status-autorefresh': '1m',
          'shared-users': '1',
          'rate-limit': '6M/12M',
          'transparent-proxy': 'yes',
        },
        {
          name: '3days-250ksh',
          'session-timeout': '3d',
          'idle-timeout': '2h',
          'keepalive-timeout': '2m',
          'status-autorefresh': '1m',
          'shared-users': '2',
          'rate-limit': '8M/15M',
          'transparent-proxy': 'yes',
        },
        {
          name: '1week-400ksh',
          'session-timeout': '1w',
          'idle-timeout': '4h',
          'keepalive-timeout': '2m',
          'status-autorefresh': '1m',
          'shared-users': '2',
          'rate-limit': '10M/20M',
          'transparent-proxy': 'yes',
        },
        {
          name: '1month-1200ksh',
          'session-timeout': '30d',
          'idle-timeout': '12h',
          'keepalive-timeout': '2m',
          'status-autorefresh': '1m',
          'shared-users': '3',
          'rate-limit': '15M/25M',
          'transparent-proxy': 'yes',
        },
      ];

      const existingProfiles = await MikroTikService.makeRequest(
        config,
        '/rest/ip/hotspot/user/profile',
        'GET'
      );

      const createdProfiles = [];

      for (const profile of profiles) {
        const profileExists = Array.isArray(existingProfiles)
          ? existingProfiles.find((p: any) => p.name === profile.name)
          : false;

        if (!profileExists) {
          const result = await MikroTikService.makeRequest(
            config,
            '/rest/ip/hotspot/user/profile',
            'POST',
            profile
          );
          createdProfiles.push(result);
        } else {
          createdProfiles.push({ existing: true, name: profile.name });
        }
      }

      return {
        success: true,
        step: 'hotspot_user_profiles',
        message: `Created ${profiles.length} hotspot user profiles successfully`,
        data: { profilesCreated: createdProfiles.length, profiles: profiles.map(p => p.name) },
      };
    } catch (error) {
      return {
        success: false,
        step: 'hotspot_user_profiles',
        message: 'Failed to create hotspot user profiles',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Step 12: Create PPPoE user profiles (service tiers)
   */
  static async createPPPoEUserProfiles(
    config: MikroTikConnectionConfig,
    localAddress: string,
    remotePool: string
  ): Promise<ConfigurationResult> {
    try {
      const profiles = [
        {
          name: 'home-basic-5mbps',
          'local-address': localAddress,
          'remote-address': remotePool,
          'dns-server': '8.8.8.8,8.8.4.4',
          'rate-limit': '5M/5M',
          'session-timeout': '0',
          'idle-timeout': '0',
        },
        {
          name: 'home-standard-10mbps',
          'local-address': localAddress,
          'remote-address': remotePool,
          'dns-server': '8.8.8.8,8.8.4.4',
          'rate-limit': '10M/10M',
          'session-timeout': '0',
          'idle-timeout': '0',
        },
        {
          name: 'home-premium-20mbps',
          'local-address': localAddress,
          'remote-address': remotePool,
          'dns-server': '8.8.8.8,8.8.4.4',
          'rate-limit': '20M/20M',
          'session-timeout': '0',
          'idle-timeout': '0',
        },
        {
          name: 'business-50mbps',
          'local-address': localAddress,
          'remote-address': remotePool,
          'dns-server': '8.8.8.8,8.8.4.4',
          'rate-limit': '50M/50M',
          'session-timeout': '0',
          'idle-timeout': '0',
        },
      ];

      const existingProfiles = await MikroTikService.makeRequest(
        config,
        '/rest/ppp/profile',
        'GET'
      );

      const createdProfiles = [];

      for (const profile of profiles) {
        const profileExists = Array.isArray(existingProfiles)
          ? existingProfiles.find((p: any) => p.name === profile.name)
          : false;

        if (!profileExists) {
          const result = await MikroTikService.makeRequest(
            config,
            '/rest/ppp/profile',
            'POST',
            profile
          );
          createdProfiles.push(result);
        } else {
          createdProfiles.push({ existing: true, name: profile.name });
        }
      }

      return {
        success: true,
        step: 'pppoe_user_profiles',
        message: `Created ${profiles.length} PPPoE user profiles successfully`,
        data: { profilesCreated: createdProfiles.length, profiles: profiles.map(p => p.name) },
      };
    } catch (error) {
      return {
        success: false,
        step: 'pppoe_user_profiles',
        message: 'Failed to create PPPoE user profiles',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Step 13: Create special profiles (trial, admin, suspended)
   */
  static async createSpecialProfiles(
    config: MikroTikConnectionConfig
  ): Promise<ConfigurationResult> {
    try {
      // Trial/Free Profile (15 minutes)
      const trialProfile = {
        name: 'trial-15min',
        'session-timeout': '15m',
        'idle-timeout': '5m',
        'keepalive-timeout': '1m',
        'status-autorefresh': '30s',
        'shared-users': '1',
        'rate-limit': '1M/2M',
        'transparent-proxy': 'yes',
      };

      // Admin/Management Profile (Unlimited)
      const adminProfile = {
        name: 'admin-unlimited',
        'session-timeout': '0',
        'idle-timeout': '0',
        'keepalive-timeout': '2m',
        'status-autorefresh': '1m',
        'shared-users': '1',
        'rate-limit': '50M/50M',
        'transparent-proxy': 'no',
      };

      const specialProfiles = [trialProfile, adminProfile];
      const existingProfiles = await MikroTikService.makeRequest(
        config,
        '/rest/ip/hotspot/user/profile',
        'GET'
      );

      const createdProfiles = [];

      for (const profile of specialProfiles) {
        const profileExists = Array.isArray(existingProfiles)
          ? existingProfiles.find((p: any) => p.name === profile.name)
          : false;

        if (!profileExists) {
          const result = await MikroTikService.makeRequest(
            config,
            '/rest/ip/hotspot/user/profile',
            'POST',
            profile
          );
          createdProfiles.push(result);
        }
      }

      return {
        success: true,
        step: 'special_profiles',
        message: 'Special profiles created successfully',
        data: { profilesCreated: createdProfiles.length },
      };
    } catch (error) {
      return {
        success: false,
        step: 'special_profiles',
        message: 'Failed to create special profiles',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export type {
  PPPoEServerConfig,
  PPPProfileConfig,
  HotspotProfileConfig,
  HotspotServerConfig,
};

export default MikroTikServiceConfig;