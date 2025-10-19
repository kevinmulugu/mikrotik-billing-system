// src/app/routers/[id]/page.tsx
'use client';

import { use, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, Settings, Users, Ticket, BarChart3, Wifi, Activity,
  DollarSign, Clock, AlertTriangle, MapPin, Cpu, HardDrive, Thermometer,
  Server, Radio, Network, Package, RefreshCw, CheckCircle2, XCircle,
  Zap, Eye, Edit, Trash2, Power, PowerOff, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouterActions } from '@/hooks/use-router-actions';

interface RouterPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function RouterPage({ params }: RouterPageProps) {
  // Unwrap params using React.use() for Next.js 15
  const { id: routerId } = use(params);
  
  const { data: session, status } = useSession();
  const router = useRouter();
  const routerActions = useRouterActions();
  const [routerData, setRouterData] = useState<any>(null);
  const [activeUsers, setActiveUsers] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchRouterData();
    }
  }, [status, routerId]);

  const fetchRouterData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/routers/${routerId}`);
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to fetch router');
        return;
      }

      setRouterData(data.router);
    } catch (error) {
      console.error('Error fetching router:', error);
      toast.error('Failed to fetch router data');
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveUsers = async () => {
    try {
      const data = await routerActions.getActiveUsers(routerId, 'all');
      if (data) {
        setActiveUsers(data);
      }
    } catch (error) {
      console.error('Error fetching active users:', error);
    }
  };

  const handleSyncRouter = async () => {
    setRefreshing(true);
    const success = await routerActions.syncRouter(routerId);
    if (success) {
      await fetchRouterData();
    }
    setRefreshing(false);
  };

  const handleSyncPackages = async () => {
    await routerActions.syncPackages(routerId);
    await fetchRouterData();
  };

  const handleRestartHotspot = async () => {
    await routerActions.restartHotspot(routerId);
  };

  const handleRestartPPPoE = async () => {
    await routerActions.restartPPPoE(routerId);
  };

  const handleDisconnectUser = async (sessionId: string, type: 'hotspot' | 'pppoe') => {
    const success = await routerActions.disconnectUser(routerId, sessionId, type);
    if (success) {
      await fetchActiveUsers();
    }
  };

  const formatUptime = (uptime: number | string) => {
    if (typeof uptime === 'string') return uptime;
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return `${Math.floor(uptime / 60)}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      online: { className: 'bg-green-500 hover:bg-green-600', label: 'Online' },
      offline: { className: 'bg-red-500 hover:bg-red-600', label: 'Offline' },
      warning: { className: 'bg-yellow-500 hover:bg-yellow-600', label: 'Warning' },
      error: { className: 'bg-red-600 hover:bg-red-700', label: 'Error' },
    };
    const variant = variants[status as keyof typeof variants] || { 
      className: 'bg-gray-500', label: 'Unknown' 
    };
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const getSyncStatusIcon = (syncStatus: string) => {
    const variants = {
      synced: { icon: CheckCircle2, className: 'text-green-600' },
      out_of_sync: { icon: AlertTriangle, className: 'text-yellow-600' },
      not_on_router: { icon: XCircle, className: 'text-red-600' },
    };
    const variant = variants[syncStatus as keyof typeof variants] || variants.synced;
    const Icon = variant.icon;
    return <Icon className={`h-4 w-4 ${variant.className}`} />;
  };

  if (loading || status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!routerData) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle className="mx-auto h-16 w-16 text-red-500" />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Router not found</h2>
            <p className="text-muted-foreground">
              This router doesn't exist or you don't have access to it.
            </p>
          </div>
          <Button asChild>
            <Link href="/routers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Routers
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/routers">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold sm:text-3xl truncate">{routerData.name}</h1>
              {getStatusBadge(routerData.status)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Wifi className="h-4 w-4 shrink-0" />
                <span className="truncate">{routerData.model}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{routerData.location.name}</span>
              </span>
              {routerData.ipAddress && (
                <span className="font-mono text-xs">{routerData.ipAddress}</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-end gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleSyncRouter}
            disabled={refreshing || routerActions.isLoading}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync Now
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/routers/${routerId}/vouchers`}>
              <Package className="mr-2 h-4 w-4" />
              Manage Vouchers
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/routers/${routerId}/vouchers/generate`}>
              <Ticket className="mr-2 h-4 w-4" />
              Generate Vouchers
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Connected</p>
                <p className="text-2xl font-bold">{routerData.health.connectedUsers}</p>
              </div>
              <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{routerData.statistics.totalUsers}</p>
              </div>
              <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
                <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Today</p>
                <p className="text-2xl font-bold">
                  KSh {routerData?.statistics?.dailyRevenue?.toLocaleString()}
                </p>
              </div>
              <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-900">
                <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Uptime</p>
                <p className="text-xl font-bold">
                  {routerData.status === 'online' ? formatUptime(routerData.health.uptime) : 'Offline'}
                </p>
              </div>
              <div className="rounded-full bg-orange-100 p-3 dark:bg-orange-900">
                <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-6">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-auto min-w-full">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="packages">Packages</TabsTrigger>
            <TabsTrigger value="users" onClick={() => fetchActiveUsers()}>Active Users</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
          </TabsList>
        </div>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Router Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Router Health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {routerData.status === 'online' ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Cpu className="h-4 w-4" />
                          CPU Usage
                        </span>
                        <span className="font-semibold">{routerData.health.cpuUsage}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            routerData.health.cpuUsage > 80 ? 'bg-red-500' :
                            routerData.health.cpuUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${routerData.health.cpuUsage}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <HardDrive className="h-4 w-4" />
                          Memory Usage
                        </span>
                        <span className="font-semibold">{routerData.health.memoryUsage}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            routerData.health.memoryUsage > 80 ? 'bg-red-500' :
                            routerData.health.memoryUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${routerData.health.memoryUsage}%` }}
                        />
                      </div>
                    </div>
                    
                    {routerData.health.temperature > 0 && (
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Thermometer className="h-4 w-4" />
                          Temperature
                        </span>
                        <span className="text-lg font-semibold">{routerData.health.temperature}°C</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertTriangle className="mb-3 h-12 w-12 text-red-500" />
                    <p className="text-sm text-muted-foreground">Router is offline</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common router management tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href={`/routers/${routerId}/vouchers/generate`}>
                    <Ticket className="mr-2 h-4 w-4" />
                    Generate Vouchers
                  </Link>
                </Button>
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href={`/routers/${routerId}/vouchers`}>
                    <Package className="mr-2 h-4 w-4" />
                    Manage Vouchers
                  </Link>
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => {
                    fetchActiveUsers();
                    document.querySelector('[value="users"]')?.dispatchEvent(new Event('click', { bubbles: true }));
                  }}
                >
                  <Users className="mr-2 h-4 w-4" />
                  View Active Users
                </Button>
                
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={handleSyncPackages}
                  disabled={routerActions.isLoading}
                >
                  {routerActions.isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Package className="mr-2 h-4 w-4" />
                  )}
                  Sync Packages
                </Button>
                
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href={`/routers/${routerId}/settings`}>
                    <Settings className="mr-2 h-4 w-4" />
                    Router Settings
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Overview</CardTitle>
              <CardDescription>Track your earnings from this router</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Daily Revenue</p>
                  <p className="text-3xl font-bold">
                    KSh {routerData?.statistics?.dailyRevenue?.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Monthly Revenue</p>
                  <p className="text-3xl font-bold">
                    KSh {routerData.statistics.monthlyRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                  <p className="text-3xl font-bold">
                    KSh {routerData.statistics.totalRevenue.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Hotspot Service */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="h-5 w-5" />
                    <CardTitle>Hotspot Service</CardTitle>
                  </div>
                  {routerData.configuration.hotspot.enabled ? (
                    <Badge className="bg-green-500">Enabled</Badge>
                  ) : (
                    <Badge variant="secondary">Disabled</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {routerData.configuration.hotspot.enabled ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">SSID</span>
                        <span className="font-medium">{routerData.configuration.hotspot.ssid}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Interface</span>
                        <span className="font-medium">{routerData.configuration.hotspot.interface}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">IP Pool</span>
                        <span className="font-mono text-xs">{routerData.configuration.hotspot.ipPool}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Max Users</span>
                        <span className="font-medium">{routerData.configuration.hotspot.maxUsers}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Connected</span>
                        <span className="font-medium">
                          {routerData.health.connectedUsers}/{routerData.configuration.hotspot.maxUsers}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-muted-foreground">DNS</span>
                        <span className="font-mono text-xs">
                          {routerData.configuration.hotspot.dnsServers.join(', ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={handleRestartHotspot}
                        disabled={routerActions.isLoading || routerData.status !== 'online'}
                      >
                        {routerActions.isLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Restart
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" asChild>
                        <Link href={`/routers/${routerId}/settings`}>
                          <Settings className="mr-2 h-4 w-4" />
                          Configure
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center">
                    <Radio className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Hotspot service is not enabled
                    </p>
                    <Button size="sm" asChild>
                      <Link href={`/routers/${routerId}/settings`}>
                        Enable Hotspot
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PPPoE Service */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    <CardTitle>PPPoE Service</CardTitle>
                  </div>
                  {routerData.configuration.pppoe.enabled ? (
                    <Badge className="bg-green-500">Enabled</Badge>
                  ) : (
                    <Badge variant="secondary">Disabled</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {routerData.configuration.pppoe.enabled ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Interface</span>
                        <span className="font-medium">{routerData.configuration.pppoe.interface}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">IP Pool</span>
                        <span className="font-mono text-xs">{routerData.configuration.pppoe.ipPool}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Default Profile</span>
                        <span className="font-medium">{routerData.configuration.pppoe.defaultProfile}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">DNS</span>
                        <span className="font-mono text-xs">
                          {routerData.configuration.pppoe.dnsServers.join(', ')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-muted-foreground">Active Users</span>
                        <span className="font-medium">0</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={handleRestartPPPoE}
                        disabled={routerActions.isLoading || routerData.status !== 'online'}
                      >
                        {routerActions.isLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Restart
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" asChild>
                        <Link href={`/routers/${routerId}/settings`}>
                          <Settings className="mr-2 h-4 w-4" />
                          Configure
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center">
                    <Server className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">
                      PPPoE service is not enabled
                    </p>
                    <Button size="sm" asChild>
                      <Link href={`/routers/${routerId}/settings`}>
                        Enable PPPoE
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Configuration Status */}
          {routerData.configurationStatus.configured && (
            <Card>
              <CardHeader>
                <CardTitle>Configuration Status</CardTitle>
                <CardDescription>
                  Setup completed {routerData.configurationStatus.configuredAt 
                    ? new Date(routerData.configurationStatus.configuredAt).toLocaleString()
                    : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium">Setup Progress</span>
                    <Badge variant="outline">
                      {routerData.configurationStatus.completedSteps.length} steps completed
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {routerData.configurationStatus.completedSteps.map((step: string, index: number) => (
                      <div key={index} className="flex items-center gap-2 text-sm py-1">
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        <span className="text-muted-foreground">{step}</span>
                      </div>
                    ))}
                  </div>
                  {routerData.configurationStatus.failedSteps.length > 0 && (
                    <div className="mt-4 pt-4 border-t space-y-2">
                      <span className="text-sm font-medium text-red-600">Failed Steps:</span>
                      {routerData.configurationStatus.failedSteps.map((step: string, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm py-1">
                          <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                          <span className="text-muted-foreground">{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Packages Tab */}
        <TabsContent value="packages" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">WiFi Packages</h3>
              <p className="text-sm text-muted-foreground">
                Manage pricing tiers and bandwidth packages
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleSyncPackages}
                disabled={routerActions.isLoading || routerData.status !== 'online'}
              >
                {routerActions.isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync Packages
              </Button>
              <Button size="sm" asChild>
                <Link href={`/routers/${routerId}/packages/create`}>
                  <Package className="mr-2 h-4 w-4" />
                  Create Package
                </Link>
              </Button>
            </div>
          </div>

          {routerData.packages?.hotspot && routerData.packages.hotspot.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {routerData.packages.hotspot.map((pkg: any) => (
                <Card key={pkg._id || pkg.name}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-base">{pkg.displayName || pkg.name}</CardTitle>
                        <p className="text-2xl font-bold text-green-600 mt-1">
                          KSh {pkg.price?.toLocaleString() || 0}
                        </p>
                      </div>
                      {getSyncStatusIcon(pkg.syncStatus || 'synced')}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          Duration
                        </span>
                        <span className="font-medium">{pkg.duration || 0} min</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Zap className="h-4 w-4" />
                          Speed
                        </span>
                        <span className="font-medium">
                          {pkg.bandwidth?.upload || 0}M / {pkg.bandwidth?.download || 0}M
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-muted-foreground">Sold</span>
                        <span className="font-semibold">{pkg.stats?.count || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Revenue</span>
                        <span className="font-semibold">KSh {pkg.stats?.revenue?.toLocaleString() || 0}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" className="flex-1" asChild>
                        <Link href={`/routers/${routerId}/packages/${pkg.name}/edit`}>
                          <Edit className="mr-1 h-3 w-3" />
                          Edit
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" asChild>
                        <Link href={`/routers/${routerId}/packages/${pkg.name}`}>
                          <Eye className="mr-1 h-3 w-3" />
                          View
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  No packages configured yet
                </p>
                <Button onClick={handleSyncPackages} disabled={routerActions.isLoading || routerData.status !== 'online'}>
                  {routerActions.isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Package className="mr-2 h-4 w-4" />
                  )}
                  Sync Packages from Router
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Active Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Active Users</h3>
              <p className="text-sm text-muted-foreground">
                Real-time view of connected users
              </p>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={fetchActiveUsers}
              disabled={routerActions.isLoading || routerData.status !== 'online'}
            >
              {routerActions.isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Online Now</p>
                  <p className="text-3xl font-bold">{activeUsers?.totalUsers || routerData.health.connectedUsers}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Hotspot Users</p>
                  <p className="text-3xl font-bold">{activeUsers?.statistics?.hotspotCount || 0}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">PPPoE Users</p>
                  <p className="text-3xl font-bold">{activeUsers?.statistics?.pppoeCount || 0}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Data Transfer</p>
                  <p className="text-xl font-bold">{formatBytes(activeUsers?.statistics?.totalDataUsage || 0)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Connected Users</CardTitle>
              <CardDescription>Live list of users currently connected</CardDescription>
            </CardHeader>
            <CardContent>
              {routerData.status !== 'online' ? (
                <div className="text-center py-12">
                  <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Router is offline. Cannot fetch active users.
                  </p>
                </div>
              ) : activeUsers ? (
                <>
                  {/* Hotspot Users */}
                  {activeUsers.hotspotUsers && activeUsers.hotspotUsers.length > 0 && (
                    <div className="space-y-3 mb-6">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Radio className="h-4 w-4" />
                        Hotspot Users ({activeUsers.hotspotUsers.length})
                      </h4>
                      <div className="space-y-2">
                        {activeUsers.hotspotUsers.map((user: any) => (
                          <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium">{user.username}</p>
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                                <span>{user.address}</span>
                                <span>{user.macAddress}</span>
                                <span>Uptime: {user.uptime}</span>
                                <span>↓ {formatBytes(user.bytesIn)}</span>
                                <span>↑ {formatBytes(user.bytesOut)}</span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDisconnectUser(user.id, 'hotspot')}
                              disabled={routerActions.isLoading}
                            >
                              {routerActions.isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <PowerOff className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PPPoE Users */}
                  {activeUsers.pppoeUsers && activeUsers.pppoeUsers.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        PPPoE Users ({activeUsers.pppoeUsers.length})
                      </h4>
                      <div className="space-y-2">
                        {activeUsers.pppoeUsers.map((user: any) => (
                          <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium">{user.username}</p>
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                                <span>{user.address}</span>
                                <span>Uptime: {user.uptime}</span>
                                <span>Service: {user.service}</span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDisconnectUser(user.id, 'pppoe')}
                              disabled={routerActions.isLoading}
                            >
                              {routerActions.isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <PowerOff className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Users */}
                  {(!activeUsers.hotspotUsers || activeUsers.hotspotUsers.length === 0) &&
                   (!activeUsers.pppoeUsers || activeUsers.pppoeUsers.length === 0) && (
                    <div className="text-center py-12">
                      <Users className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No users currently connected
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Click refresh to load active users
                  </p>
                  <Button onClick={fetchActiveUsers} disabled={routerActions.isLoading}>
                    {routerActions.isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Load Active Users
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Network Tab */}
        <TabsContent value="network" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Network Configuration</h3>
              <p className="text-sm text-muted-foreground">
                Detailed network infrastructure and connectivity status
              </p>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleSyncRouter}
              disabled={refreshing || routerActions.isLoading}
            >
              {refreshing || routerActions.isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync Network
            </Button>
          </div>

          {/* Connection Status Row */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Internet Connectivity Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  Internet Connection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {routerData.health?.internetConnectivity?.isConnected ? (
                    <Badge className="bg-green-500">Connected</Badge>
                  ) : (
                    <Badge variant="destructive">Disconnected</Badge>
                  )}
                </div>
                {routerData.health?.internetConnectivity?.lastChecked && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Last Checked</span>
                    <span className="text-xs">
                      {new Date(routerData.health.internetConnectivity.lastChecked).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-center py-8">
                    {routerData.health?.internetConnectivity?.isConnected ? (
                      <CheckCircle2 className="h-16 w-16 text-green-500" />
                    ) : (
                      <XCircle className="h-16 w-16 text-red-500" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* WAN Configuration & Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  WAN Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Interface</span>
                  <span className="font-medium">{routerData.configuration.network.wanInterface}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {routerData.configuration?.network?.wanStatus?.isConnected ? (
                    <Badge className="bg-green-500">Connected</Badge>
                  ) : (
                    <Badge variant="destructive">Disconnected</Badge>
                  )}
                </div>
                {routerData.configuration?.network?.wanStatus?.externalIP && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">External IP</span>
                    <span className="font-mono text-xs">{routerData.configuration.network.wanStatus.externalIP}</span>
                  </div>
                )}
                {routerData.configuration?.network?.wanStatus?.gateway && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Gateway</span>
                    <span className="font-mono text-xs">{routerData.configuration.network.wanStatus.gateway}</span>
                  </div>
                )}
                {routerData.configuration?.network?.wanStatus?.dnsServers && routerData.configuration.network.wanStatus.dnsServers.length > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">DNS Servers</span>
                    <span className="font-mono text-xs">
                      {routerData.configuration.network.wanStatus.dnsServers.join(', ')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* IP Pools & DHCP Status Row */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* IP Pool Usage */}
            {routerData.configuration.hotspot.enabled && (
              <Card>
                <CardHeader>
                  <CardTitle>Hotspot IP Pool Usage</CardTitle>
                  <CardDescription>Address allocation statistics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Pool Range</span>
                      <span className="font-mono text-xs">{routerData.configuration.hotspot.ipPool}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total IPs</span>
                      <span className="font-semibold">{routerData.configuration.hotspot.ipPoolUsage?.total || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Used</span>
                      <span className="font-semibold">{routerData.configuration.hotspot.ipPoolUsage?.used || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Available</span>
                      <span className="font-semibold text-green-600">
                        {routerData.configuration.hotspot.ipPoolUsage?.available || 0}
                      </span>
                    </div>
                  </div>
                  
                  {/* Visual Progress Bar */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Utilization</span>
                      <span className="font-semibold">
                        {routerData.configuration.hotspot.ipPoolUsage?.percentage || 0}%
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          (routerData.configuration.hotspot.ipPoolUsage?.percentage || 0) > 90 ? 'bg-red-500' :
                          (routerData.configuration.hotspot.ipPoolUsage?.percentage || 0) > 75 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${routerData.configuration.hotspot.ipPoolUsage?.percentage || 0}%` }}
                      />
                    </div>
                  </div>

                  {routerData.configuration.hotspot.ipPoolUsage?.lastSynced && (
                    <div className="pt-2 border-t text-xs text-muted-foreground">
                      Last synced: {new Date(routerData.configuration.hotspot.ipPoolUsage.lastSynced).toLocaleString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* DHCP Server Status */}
            <Card>
              <CardHeader>
                <CardTitle>DHCP Servers</CardTitle>
                <CardDescription>Active lease management</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Hotspot DHCP */}
                {routerData.dhcpStatus?.hotspot && (
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">Hotspot DHCP</span>
                      </div>
                      {routerData.dhcpStatus.hotspot.isActive ? (
                        <Badge className="bg-green-500 text-xs">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Server</span>
                        <span className="font-mono text-xs">{routerData.dhcpStatus.hotspot.serverName || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Leases</span>
                        <span className="font-medium">
                          {routerData.dhcpStatus.hotspot.activeLeases || 0} / {routerData.dhcpStatus.hotspot.totalLeases || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* LAN DHCP */}
                {routerData.dhcpStatus?.lan && (
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Network className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">LAN DHCP</span>
                      </div>
                      {routerData.dhcpStatus.lan.isActive ? (
                        <Badge className="bg-green-500 text-xs">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Server</span>
                        <span className="font-mono text-xs">{routerData.dhcpStatus.lan.serverName || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Leases</span>
                        <span className="font-medium">
                          {routerData.dhcpStatus.lan.activeLeases || 0} / {routerData.dhcpStatus.lan.totalLeases || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* LAN Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                LAN Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Bridge</span>
                  <span className="font-medium">{routerData.configuration.network.lanInterface}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Subnet</span>
                  <span className="font-mono text-xs">{routerData.configuration.network.lanSubnet}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b sm:border-b-0">
                  <span className="text-sm text-muted-foreground">DHCP Range</span>
                  <span className="font-mono text-xs">{routerData.configuration.network.dhcpRange}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">DNS Servers</span>
                  <span className="font-mono text-xs">
                    {routerData.configuration.hotspot.dnsServers.join(', ')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Network Interfaces Table */}
          {routerData.networkInterfaces && routerData.networkInterfaces.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Network Interfaces</CardTitle>
                <CardDescription>
                  Physical and virtual interface status and statistics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Interface</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Type</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">MAC Address</th>
                        <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">RX</th>
                        <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">TX</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routerData.networkInterfaces.map((iface: any, index: number) => (
                        <tr key={index} className="border-b last:border-b-0 hover:bg-muted/50">
                          <td className="py-3 px-2">
                            <span className="font-medium text-sm">{iface.name}</span>
                          </td>
                          <td className="py-3 px-2">
                            <Badge variant="outline" className="text-xs">
                              {iface.type}
                            </Badge>
                          </td>
                          <td className="py-3 px-2">
                            {iface.status === 'running' && !iface.disabled ? (
                              <Badge className="bg-green-500 text-xs">Running</Badge>
                            ) : iface.disabled ? (
                              <Badge variant="secondary" className="text-xs">Disabled</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">Down</Badge>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              {iface.macAddress}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className="text-sm">{formatBytes(iface.rxBytes || 0)}</span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className="text-sm">{formatBytes(iface.txBytes || 0)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bridge Ports Configuration */}
          {routerData.configuration?.network?.bridgePorts && routerData.configuration.network.bridgePorts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Bridge Configuration</CardTitle>
                <CardDescription>
                  Interface bridge port assignments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Interface</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Bridge</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Last Synced</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routerData.configuration.network.bridgePorts.map((port: any, index: number) => (
                        <tr key={index} className="border-b last:border-b-0 hover:bg-muted/50">
                          <td className="py-3 px-2">
                            <span className="font-medium text-sm">{port.interface}</span>
                          </td>
                          <td className="py-3 px-2">
                            <Badge variant="outline" className="text-xs">
                              {port.bridge}
                            </Badge>
                          </td>
                          <td className="py-3 px-2">
                            {port.status === 'active' ? (
                              <Badge className="bg-green-500 text-xs">Active</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Inactive</Badge>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <span className="text-xs text-muted-foreground">
                              {port.lastSynced ? new Date(port.lastSynced).toLocaleString() : 'Never'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hotspot Server Status */}
          {routerData.configuration.hotspot.enabled && routerData.configuration.hotspot.serverStatus && (
            <Card>
              <CardHeader>
                <CardTitle>Hotspot Server Status</CardTitle>
                <CardDescription>Server configuration and timeouts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Server Running</span>
                    {routerData.configuration.hotspot.serverStatus.isRunning ? (
                      <Badge className="bg-green-500">Yes</Badge>
                    ) : (
                      <Badge variant="destructive">No</Badge>
                    )}
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Server Disabled</span>
                    {routerData.configuration.hotspot.serverStatus.disabled ? (
                      <Badge variant="secondary">Yes</Badge>
                    ) : (
                      <Badge className="bg-green-500">No</Badge>
                    )}
                  </div>
                  <div className="flex justify-between items-center py-2 border-b sm:border-b-0">
                    <span className="text-sm text-muted-foreground">Keepalive Timeout</span>
                    <span className="font-medium text-sm">
                      {routerData.configuration.hotspot.serverStatus.keepaliveTimeout}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Idle Timeout</span>
                    <span className="font-medium text-sm">
                      {routerData.configuration.hotspot.serverStatus.idleTimeout}
                    </span>
                  </div>
                </div>
                {routerData.configuration.hotspot.serverStatus.lastSynced && (
                  <div className="pt-4 border-t mt-4 text-xs text-muted-foreground">
                    Last synced: {new Date(routerData.configuration.hotspot.serverStatus.lastSynced).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}