// src/app/routers/[id]/packages/[packageName]/page.tsx
'use client';

import { use, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  ArrowLeft, Package, Loader2, Edit, RefreshCw, 
  Clock, Zap, HardDrive, DollarSign, Calendar,
  TrendingUp, Users, Ticket, AlertTriangle,
  CheckCircle2, XCircle, Activity, BarChart3
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ViewPackagePageProps {
  params: Promise<{
    id: string;
    packageName: string;
  }>;
}

export default function ViewPackagePage({ params }: ViewPackagePageProps) {
  const { id: routerId, packageName } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [packageData, setPackageData] = useState<any>(null);
  const [routerData, setRouterData] = useState<any>(null);
  const [showToggleDialog, setShowToggleDialog] = useState(false);
  const [toggleAction, setToggleAction] = useState<'enable' | 'disable'>('disable');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPackageData();
    }
  }, [status, routerId, packageName]);

  const fetchPackageData = async () => {
    try {
      setLoading(true);
      
      // Fetch router data to get package info
      const routerResponse = await fetch(`/api/routers/${routerId}`);
      const routerData = await routerResponse.json();

      if (!routerResponse.ok) {
        toast.error(routerData.error || 'Failed to fetch router');
        return;
      }

      setRouterData(routerData.router);

      // Find the specific package
      const pkg = routerData.router.packages?.hotspot?.find(
        (p: any) => p.name === packageName
      );

      if (!pkg) {
        toast.error('Package not found');
        return;
      }

      setPackageData(pkg);
    } catch (error) {
      console.error('Error fetching package:', error);
      toast.error('Failed to fetch package data');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/routers/${routerId}/packages/${packageName}/sync`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to sync package');
        return;
      }

      toast.success('Package synced to router successfully!');
      await fetchPackageData();
    } catch (error) {
      console.error('Error syncing package:', error);
      toast.error('Failed to sync package');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    setActionLoading(true);
    try {
      const newStatus = packageData.enabled ? 'disabled' : 'enabled';
      
      const response = await fetch(`/api/routers/${routerId}/packages/${packageName}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !packageData.enabled }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || `Failed to ${toggleAction} package`);
        return;
      }

      toast.success(`Package ${newStatus} successfully!`);
      setShowToggleDialog(false);
      await fetchPackageData();
    } catch (error) {
      console.error('Error toggling package status:', error);
      toast.error(`Failed to ${toggleAction} package`);
    } finally {
      setActionLoading(false);
    }
  };

  const openToggleDialog = (action: 'enable' | 'disable') => {
    setToggleAction(action);
    setShowToggleDialog(true);
  };

  const formatDate = (date: string | Date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutes`;
    if (minutes < 1440) return `${(minutes / 60).toFixed(1)} hours`;
    if (minutes < 10080) return `${(minutes / 1440).toFixed(1)} days`;
    if (minutes < 43200) return `${(minutes / 10080).toFixed(1)} weeks`;
    return `${(minutes / 43200).toFixed(1)} months`;
  };

  const formatBytes = (mb: number) => {
    if (mb === 0) return 'Unlimited';
    if (mb < 1024) return `${mb} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const getSyncStatusBadge = (syncStatus: string) => {
    const variants = {
      synced: { className: 'bg-green-500 hover:bg-green-600', label: 'Synced', icon: CheckCircle2 },
      out_of_sync: { className: 'bg-yellow-500 hover:bg-yellow-600', label: 'Out of Sync', icon: AlertTriangle },
      not_on_router: { className: 'bg-red-500 hover:bg-red-600', label: 'Not on Router', icon: XCircle },
    };
    const variant = variants[syncStatus as keyof typeof variants] || variants.synced;
    const Icon = variant.icon;
    return (
      <Badge className={variant.className}>
        <Icon className="mr-1 h-3 w-3" />
        {variant.label}
      </Badge>
    );
  };

  if (loading || status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!packageData || !routerData) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle className="mx-auto h-16 w-16 text-red-500" />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Package not found</h2>
            <p className="text-muted-foreground">
              This package doesn't exist or you don't have access to it.
            </p>
          </div>
          <Button asChild>
            <Link href={`/routers/${routerId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Router
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const activeUsers = packageData.activeUsers || 0;
  const canDisable = packageData.enabled && activeUsers === 0;
  const canEnable = !packageData.enabled;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href={`/routers/${routerId}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold sm:text-3xl truncate">
                {packageData.displayName || packageData.name}
              </h1>
              {packageData.enabled ? (
                <Badge className="bg-green-500">Active</Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
              {getSyncStatusBadge(packageData.syncStatus || 'synced')}
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono">{packageData.name}</span>
              <span>•</span>
              <span>{routerData.name}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {(packageData.syncStatus === 'out_of_sync' || packageData.syncStatus === 'not_on_router') && (
            <Button 
              size="sm" 
              onClick={handleSync}
              disabled={actionLoading || routerData.status !== 'online'}
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync to Router
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <Link href={`/routers/${routerId}/packages/${packageName}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Package
            </Link>
          </Button>
          {packageData.enabled ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => openToggleDialog('disable')}
              disabled={actionLoading || !canDisable}
            >
              Disable Package
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => openToggleDialog('enable')}
              disabled={actionLoading}
            >
              Enable Package
            </Button>
          )}
        </div>
      </div>

      {/* Warning if package is disabled */}
      {!packageData.enabled && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This package is currently disabled. It cannot be used for new voucher purchases until enabled.
          </AlertDescription>
        </Alert>
      )}

      {/* Warning if out of sync */}
      {packageData.syncStatus !== 'synced' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This package is not synced with the router. Changes won't take effect until you sync it.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Price</p>
                <p className="text-2xl font-bold text-green-600">
                  KSh {packageData.price?.toLocaleString()}
                </p>
              </div>
              <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Sold</p>
                <p className="text-2xl font-bold">{packageData.stats?.count || 0}</p>
              </div>
              <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900">
                <Ticket className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold">
                  KSh {packageData.stats?.revenue?.toLocaleString() || 0}
                </p>
              </div>
              <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-900">
                <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">{activeUsers}</p>
              </div>
              <div className="rounded-full bg-orange-100 p-3 dark:bg-orange-900">
                <Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Package Details */}
        <Card>
          <CardHeader>
            <CardTitle>Package Details</CardTitle>
            <CardDescription>Technical specifications and limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  Technical Name
                </span>
                <span className="font-mono text-sm font-medium">{packageData.name}</span>
              </div>

              <div className="flex items-center justify-between py-3 border-b">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  Display Name
                </span>
                <span className="font-medium">{packageData.displayName || packageData.name}</span>
              </div>

              {packageData.description && (
                <div className="py-3 border-b">
                  <p className="text-sm text-muted-foreground mb-2">Description</p>
                  <p className="text-sm">{packageData.description}</p>
                </div>
              )}

              <div className="flex items-center justify-between py-3 border-b">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Duration
                </span>
                <span className="font-medium">{formatDuration(packageData.duration || 0)}</span>
              </div>

              <div className="flex items-center justify-between py-3 border-b">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <HardDrive className="h-4 w-4" />
                  Data Limit
                </span>
                <span className="font-medium">{formatBytes(packageData.dataLimit || 0)}</span>
              </div>

              <div className="flex items-center justify-between py-3 border-b">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Validity
                </span>
                <span className="font-medium">{packageData.validity || 30} days</span>
              </div>

              <div className="flex items-center justify-between py-3">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4" />
                  Bandwidth
                </span>
                <span className="font-medium">
                  {packageData.bandwidth?.upload || 0}M / {packageData.bandwidth?.download || 0}M
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timestamps & Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Timeline & Activity</CardTitle>
            <CardDescription>Package history and important dates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between py-3 border-b">
                <div>
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-xs text-muted-foreground mt-1">Package was first created</p>
                </div>
                <span className="text-sm text-right">
                  {formatDate(packageData.createdAt)}
                </span>
              </div>

              {packageData.updatedAt && packageData.updatedAt !== packageData.createdAt && (
                <div className="flex items-start justify-between py-3 border-b">
                  <div>
                    <p className="text-sm font-medium">Last Modified</p>
                    <p className="text-xs text-muted-foreground mt-1">Most recent update</p>
                  </div>
                  <span className="text-sm text-right">
                    {formatDate(packageData.updatedAt)}
                  </span>
                </div>
              )}

              {packageData.lastSyncedAt && (
                <div className="flex items-start justify-between py-3 border-b">
                  <div>
                    <p className="text-sm font-medium">Last Synced</p>
                    <p className="text-xs text-muted-foreground mt-1">Last sync to router</p>
                  </div>
                  <span className="text-sm text-right">
                    {formatDate(packageData.lastSyncedAt)}
                  </span>
                </div>
              )}

              {packageData.stats?.lastPurchased && (
                <div className="flex items-start justify-between py-3 border-b">
                  <div>
                    <p className="text-sm font-medium">Last Purchased</p>
                    <p className="text-xs text-muted-foreground mt-1">Most recent voucher sale</p>
                  </div>
                  <span className="text-sm text-right">
                    {formatDate(packageData.stats.lastPurchased)}
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between py-3">
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-xs text-muted-foreground mt-1">Current availability</p>
                </div>
                <div className="text-right">
                  {packageData.enabled ? (
                    <Badge className="bg-green-500">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Disabled</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Metrics
          </CardTitle>
          <CardDescription>Sales and revenue analytics for this package</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Total Vouchers Sold</p>
              <p className="text-3xl font-bold">{packageData.stats?.count || 0}</p>
              <p className="text-xs text-muted-foreground">
                All-time sales count
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
              <p className="text-3xl font-bold text-green-600">
                KSh {packageData.stats?.revenue?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-muted-foreground">
                Gross earnings from this package
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Average per Sale</p>
              <p className="text-3xl font-bold">
                KSh {packageData.stats?.count > 0 
                  ? Math.round((packageData.stats.revenue || 0) / packageData.stats.count).toLocaleString()
                  : 0
                }
              </p>
              <p className="text-xs text-muted-foreground">
                Revenue per voucher
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Manage vouchers and view analytics for this package</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button className="w-full justify-start" variant="outline" asChild>
            <Link href={`/routers/${routerId}/vouchers/generate?package=${packageName}`}>
              <Ticket className="mr-2 h-4 w-4" />
              Generate Vouchers for This Package
            </Link>
          </Button>
          <Button className="w-full justify-start" variant="outline" asChild>
            <Link href={`/routers/${routerId}/vouchers?package=${packageName}`}>
              <Activity className="mr-2 h-4 w-4" />
              View All Vouchers
            </Link>
          </Button>
          <Button className="w-full justify-start" variant="outline" asChild>
            <Link href={`/routers/${routerId}/analytics?package=${packageName}`}>
              <BarChart3 className="mr-2 h-4 w-4" />
              View Detailed Analytics
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Toggle Status Dialog */}
      <Dialog open={showToggleDialog} onOpenChange={setShowToggleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toggleAction === 'disable' ? 'Disable Package?' : 'Enable Package?'}
            </DialogTitle>
            <DialogDescription>
              {toggleAction === 'disable' ? (
                <>
                  {activeUsers > 0 ? (
                    <>
                      This package currently has <strong>{activeUsers} active users</strong>. 
                      You cannot disable it while users are connected. Please wait for all users 
                      to disconnect or manually disconnect them first.
                    </>
                  ) : (
                    <>
                      This will prevent new vouchers from being purchased for this package. 
                      Existing vouchers will continue to work. You can re-enable it anytime.
                    </>
                  )}
                </>
              ) : (
                <>
                  This will make the package available for new voucher purchases. 
                  Make sure it's synced to the router before enabling.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowToggleDialog(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant={toggleAction === 'disable' ? 'destructive' : 'default'}
              onClick={handleToggleStatus}
              disabled={actionLoading || (toggleAction === 'disable' && activeUsers > 0)}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {toggleAction === 'disable' ? 'Disable Package' : 'Enable Package'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}