// hooks/use-router-actions.ts
'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface RouterActionsHook {
  syncRouter: (routerId: string) => Promise<boolean>;
  syncPackages: (routerId: string) => Promise<boolean>;
  syncPackage: (routerId: string, packageName: string) => Promise<boolean>;
  togglePackageStatus: (routerId: string, packageName: string, enabled: boolean) => Promise<boolean>;
  deletePackage: (routerId: string, packageName: string) => Promise<boolean>;
  restartHotspot: (routerId: string) => Promise<boolean>;
  restartPPPoE: (routerId: string) => Promise<boolean>;
  getActiveUsers: (routerId: string, type?: 'all' | 'hotspot' | 'pppoe') => Promise<any>;
  disconnectUser: (routerId: string, sessionId: string, type: 'hotspot' | 'pppoe') => Promise<boolean>;
  isLoading: boolean;
}

export function useRouterActions(): RouterActionsHook {
  const [isLoading, setIsLoading] = useState(false);

  const syncRouter = async (routerId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/routers/${routerId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to sync router');
        return false;
      }

      if (data.success) {
        toast.success('Router synced successfully');
        // Reload the page to show updated data
        window.location.reload();
        return true;
      } else {
        toast.error(data.error || 'Failed to sync router');
        return false;
      }
    } catch (error) {
      console.error('Sync router error:', error);
      toast.error('Failed to sync router');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const syncPackages = async (routerId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/routers/${routerId}/packages/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to sync packages');
        return false;
      }

      if (data.success) {
        const { results } = data;
        toast.success(
          `Packages synced: ${results.synced} synced, ${results.newOnRouter} new, ${results.outOfSync} out of sync`
        );
        // Reload the page to show updated data
        window.location.reload();
        return true;
      } else {
        toast.error(data.error || 'Failed to sync packages');
        return false;
      }
    } catch (error) {
      console.error('Sync packages error:', error);
      toast.error('Failed to sync packages');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const syncPackage = async (routerId: string, packageName: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/routers/${routerId}/packages/${packageName}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to sync package');
        return false;
      }

      if (data.success) {
        toast.success('Package synced to router successfully');
        return true;
      } else {
        toast.error(data.error || 'Failed to sync package');
        return false;
      }
    } catch (error) {
      console.error('Sync package error:', error);
      toast.error('Failed to sync package');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const togglePackageStatus = async (
    routerId: string,
    packageName: string,
    enabled: boolean
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/routers/${routerId}/packages/${packageName}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.activeUsers > 0) {
          toast.error(
            `Cannot disable package with ${data.activeUsers} active user(s). Wait for them to disconnect first.`
          );
        } else {
          toast.error(data.error || `Failed to ${enabled ? 'enable' : 'disable'} package`);
        }
        return false;
      }

      if (data.success) {
        toast.success(data.message || `Package ${enabled ? 'enabled' : 'disabled'} successfully`);
        return true;
      } else {
        toast.error(data.error || `Failed to ${enabled ? 'enable' : 'disable'} package`);
        return false;
      }
    } catch (error) {
      console.error('Toggle package status error:', error);
      toast.error(`Failed to ${enabled ? 'enable' : 'disable'} package`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const deletePackage = async (routerId: string, packageName: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/routers/${routerId}/packages/${packageName}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.activeUsers > 0) {
          toast.error(
            `Cannot delete package with ${data.activeUsers} active user(s). Disable it instead.`
          );
        } else if (data.voucherCount > 0) {
          toast.error(
            `Cannot delete package with historical data (${data.voucherCount} vouchers). Disable it instead.`
          );
        } else {
          toast.error(data.error || 'Failed to delete package');
        }
        return false;
      }

      if (data.success) {
        toast.success('Package deleted successfully');
        return true;
      } else {
        toast.error(data.error || 'Failed to delete package');
        return false;
      }
    } catch (error) {
      console.error('Delete package error:', error);
      toast.error('Failed to delete package');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const restartHotspot = async (routerId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/routers/${routerId}/services/hotspot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to restart hotspot service');
        return false;
      }

      if (data.success) {
        toast.success('Hotspot service restarted successfully');
        return true;
      } else {
        toast.error(data.error || 'Failed to restart hotspot service');
        return false;
      }
    } catch (error) {
      console.error('Restart hotspot error:', error);
      toast.error('Failed to restart hotspot service');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const restartPPPoE = async (routerId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/routers/${routerId}/services/pppoe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to restart PPPoE service');
        return false;
      }

      if (data.success) {
        toast.success('PPPoE service restarted successfully');
        return true;
      } else {
        toast.error(data.error || 'Failed to restart PPPoE service');
        return false;
      }
    } catch (error) {
      console.error('Restart PPPoE error:', error);
      toast.error('Failed to restart PPPoE service');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const getActiveUsers = async (
    routerId: string,
    type: 'all' | 'hotspot' | 'pppoe' = 'all'
  ): Promise<any> => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/routers/${routerId}/users/active?type=${type}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to fetch active users');
        return null;
      }

      return data;
    } catch (error) {
      console.error('Get active users error:', error);
      toast.error('Failed to fetch active users');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectUser = async (
    routerId: string,
    sessionId: string,
    type: 'hotspot' | 'pppoe'
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/routers/${routerId}/users/active?sessionId=${sessionId}&type=${type}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to disconnect user');
        return false;
      }

      if (data.success) {
        toast.success('User disconnected successfully');
        return true;
      } else {
        toast.error(data.error || 'Failed to disconnect user');
        return false;
      }
    } catch (error) {
      console.error('Disconnect user error:', error);
      toast.error('Failed to disconnect user');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    syncRouter,
    syncPackages,
    syncPackage,
    togglePackageStatus,
    deletePackage,
    restartHotspot,
    restartPPPoE,
    getActiveUsers,
    disconnectUser,
    isLoading,
  };
}