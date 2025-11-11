// lib/factories/router-provider.factory.ts

import { RouterProvider, RouterConnectionConfig, RouterType } from '@/lib/interfaces/router-provider.interface';

/**
 * Factory for creating router provider instances
 * 
 * This factory creates the appropriate router provider based on router type
 * (MikroTik, UniFi, etc.)
 */
export class RouterProviderFactory {
  /**
   * Create a router provider instance
   * 
   * @param routerType - Type of router ('mikrotik', 'unifi', etc.)
   * @param config - Connection configuration
   * @returns Router provider instance
   * @throws Error if router type is unsupported
   */
  static create(
    routerType: RouterType,
    config: RouterConnectionConfig
  ): RouterProvider {
    switch (routerType) {
      case 'mikrotik':
        // Lazy load to avoid circular dependencies
        const { MikroTikProvider } = require('@/lib/providers/mikrotik-provider');
        return new MikroTikProvider(config);

      case 'unifi':
        // Lazy load UniFi provider (Phase 2)
        const { UniFiProvider } = require('@/lib/providers/unifi-provider');
        return new UniFiProvider(config);

      default:
        throw new Error(`Unsupported router type: ${routerType}`);
    }
  }

  /**
   * Get list of supported router types
   */
  static getSupportedTypes(): RouterType[] {
    return ['mikrotik', 'unifi'];
  }

  /**
   * Check if a router type is supported
   */
  static isSupported(routerType: string): routerType is RouterType {
    return ['mikrotik', 'unifi'].includes(routerType);
  }
}
