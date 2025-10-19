// src/app/routers/[id]/page.tsx
import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, Settings, Users, Ticket, BarChart3, Wifi, Activity,
  DollarSign, Clock, AlertTriangle, MapPin, Cpu, HardDrive, Thermometer,
  Server, Radio, Network, Package, RefreshCw, CheckCircle2, XCircle,
  Zap, Eye, Edit, Trash2
} from 'lucide-react';
import Link from 'next/link';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface RouterPageProps {
  params: {
    id: string;
  };
}

async function getRouterData(routerId: string, userId: string) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    const customer = await db
      .collection('customers')
      .findOne({ userId: new ObjectId(userId) });

    if (!customer) return null;

    const router = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        customerId: customer._id,
      });

    if (!router) return null;

    // Get package stats from vouchers
    const packageStats = await db
      .collection('vouchers')
      .aggregate([
        { $match: { routerId: router._id } },
        { $group: {
          _id: '$voucherInfo.packageType',
          count: { $sum: 1 },
          revenue: { $sum: '$voucherInfo.price' }
        }}
      ]).toArray();

    return {
      id: router._id.toString(),
      name: router.routerInfo?.name || 'Unnamed Router',
      model: router.routerInfo?.model || 'Unknown',
      serialNumber: router.routerInfo?.serialNumber || '',
      macAddress: router.routerInfo?.macAddress || '',
      firmwareVersion: router.routerInfo?.firmwareVersion || '',
      location: router.routerInfo?.location?.name || 'Unknown Location',
      address: router.routerInfo?.location?.address || '',
      ipAddress: router.connection?.ipAddress,
      status: router.health?.status || 'offline',
      health: {
        uptime: router.health?.uptime || 0,
        cpuUsage: router.health?.cpuUsage || 0,
        memoryUsage: router.health?.memoryUsage || 0,
        temperature: router.health?.temperature || 0,
        connectedUsers: router.health?.connectedUsers || 0,
        lastSeen: router.health?.lastSeen,
      },
      statistics: {
        totalUsers: router.statistics?.totalUsers || 0,
        activeUsers: router.statistics?.activeUsers || 0,
        dailyRevenue: router.statistics?.revenue?.daily || 0,
        monthlyRevenue: router.statistics?.revenue?.monthly || 0,
        totalRevenue: router.statistics?.revenue?.total || 0,
      },
      configuration: {
        hotspot: {
          enabled: router.configuration?.hotspot?.enabled || false,
          ssid: router.configuration?.hotspot?.ssid || '',
          password: router.configuration?.hotspot?.password || '',
          interface: router.configuration?.hotspot?.interface || '',
          ipPool: router.configuration?.hotspot?.ipPool || '',
          dnsServers: router.configuration?.hotspot?.dnsServers || [],
          maxUsers: router.configuration?.hotspot?.maxUsers || 0,
        },
        pppoe: {
          enabled: router.configuration?.pppoe?.enabled || false,
          interface: router.configuration?.pppoe?.interface || '',
          ipPool: router.configuration?.pppoe?.ipPool || '',
          dnsServers: router.configuration?.pppoe?.dnsServers || [],
          defaultProfile: router.configuration?.pppoe?.defaultProfile || '',
        },
        network: {
          lanInterface: router.configuration?.network?.lanInterface || '',
          wanInterface: router.configuration?.network?.wanInterface || '',
          lanSubnet: router.configuration?.network?.lanSubnet || '',
          dhcpRange: router.configuration?.network?.dhcpRange || '',
        },
      },
      configurationStatus: {
        configured: router.configurationStatus?.configured || false,
        completedSteps: router.configurationStatus?.completedSteps || [],
        failedSteps: router.configurationStatus?.failedSteps || [],
        warnings: router.configurationStatus?.warnings || [],
        configuredAt: router.configurationStatus?.configuredAt,
      },
      packages: {
        hotspot: (router.packages?.hotspot || []).map((pkg: any) => ({
          ...pkg,
          stats: packageStats.find((s: any) => s._id === pkg.name) || { count: 0, revenue: 0 }
        })),
        pppoe: router.packages?.pppoe || [],
      },
    };
  } catch (error) {
    console.error('Error fetching router:', error);
    return null;
  }
}

export async function generateMetadata({ params }: RouterPageProps): Promise<Metadata> {
  return {
    title: `Router Details - MikroTik Billing`,
    description: 'Manage your router settings, users, and monitor performance',
  };
}

export default async function RouterPage({ params }: RouterPageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/signin');

  const router = await getRouterData(params.id, session.user.id);

  if (!router) {
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

  const formatUptime = (uptime: number | string) => {
    if (typeof uptime === 'string') return uptime;
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return `${Math.floor(uptime / 60)}m`;
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
              <h1 className="text-2xl font-bold sm:text-3xl truncate">{router.name}</h1>
              {getStatusBadge(router.status)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Wifi className="h-4 w-4 shrink-0" />
                <span className="truncate">{router.model}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{router.location}</span>
              </span>
              {router.ipAddress && (
                <span className="font-mono text-xs">{router.ipAddress}</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync Now
          </Button>
          <Button size="sm" asChild>
            <Link href={`/routers/${router.id}/vouchers/generate`}>
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
                <p className="text-2xl font-bold">{router.health.connectedUsers}</p>
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
                <p className="text-2xl font-bold">{router.statistics.totalUsers}</p>
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
                  KSh {router.statistics.dailyRevenue.toLocaleString()}
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
                  {router.status === 'online' ? formatUptime(router.health.uptime) : 'Offline'}
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
            <TabsTrigger value="vouchers">Vouchers</TabsTrigger>
            <TabsTrigger value="users">Active Users</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
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
                {router.status === 'online' ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Cpu className="h-4 w-4" />
                          CPU Usage
                        </span>
                        <span className="font-semibold">{router.health.cpuUsage}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            router.health.cpuUsage > 80 ? 'bg-red-500' :
                            router.health.cpuUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${router.health.cpuUsage}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <HardDrive className="h-4 w-4" />
                          Memory Usage
                        </span>
                        <span className="font-semibold">{router.health.memoryUsage}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            router.health.memoryUsage > 80 ? 'bg-red-500' :
                            router.health.memoryUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${router.health.memoryUsage}%` }}
                        />
                      </div>
                    </div>
                    
                    {router.health.temperature > 0 && (
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Thermometer className="h-4 w-4" />
                          Temperature
                        </span>
                        <span className="text-lg font-semibold">{router.health.temperature}°C</span>
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
                  <Link href={`/routers/${router.id}/vouchers/generate`}>
                    <Ticket className="mr-2 h-4 w-4" />
                    Generate Vouchers
                  </Link>
                </Button>
                
                <Button className="w-full justify-start" variant="outline">
                  <Users className="mr-2 h-4 w-4" />
                  View Active Users
                </Button>
                
                <Button className="w-full justify-start" variant="outline">
                  <Package className="mr-2 h-4 w-4" />
                  Manage Packages
                </Button>
                
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href={`/routers/${router.id}/settings`}>
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
                    KSh {router.statistics.dailyRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Monthly Revenue</p>
                  <p className="text-3xl font-bold">
                    KSh {router.statistics.monthlyRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                  <p className="text-3xl font-bold">
                    KSh {router.statistics.totalRevenue.toLocaleString()}
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
                  {router.configuration.hotspot.enabled ? (
                    <Badge className="bg-green-500">Enabled</Badge>
                  ) : (
                    <Badge variant="secondary">Disabled</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {router.configuration.hotspot.enabled ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">SSID</span>
                        <span className="font-medium">{router.configuration.hotspot.ssid}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Interface</span>
                        <span className="font-medium">{router.configuration.hotspot.interface}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">IP Pool</span>
                        <span className="font-mono text-xs">{router.configuration.hotspot.ipPool}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Max Users</span>
                        <span className="font-medium">{router.configuration.hotspot.maxUsers}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Connected</span>
                        <span className="font-medium">
                          {router.health.connectedUsers}/{router.configuration.hotspot.maxUsers}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-muted-foreground">DNS</span>
                        <span className="font-mono text-xs">
                          {router.configuration.hotspot.dnsServers.join(', ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" className="flex-1">
                        <Settings className="mr-2 h-4 w-4" />
                        Configure
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Restart
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center">
                    <Radio className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Hotspot service is not enabled
                    </p>
                    <Button size="sm">Enable Hotspot</Button>
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
                  {router.configuration.pppoe.enabled ? (
                    <Badge className="bg-green-500">Enabled</Badge>
                  ) : (
                    <Badge variant="secondary">Disabled</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {router.configuration.pppoe.enabled ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Interface</span>
                        <span className="font-medium">{router.configuration.pppoe.interface}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">IP Pool</span>
                        <span className="font-mono text-xs">{router.configuration.pppoe.ipPool}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Default Profile</span>
                        <span className="font-medium">{router.configuration.pppoe.defaultProfile}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">DNS</span>
                        <span className="font-mono text-xs">
                          {router.configuration.pppoe.dnsServers.join(', ')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-muted-foreground">Active Users</span>
                        <span className="font-medium">0</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" className="flex-1">
                        <Settings className="mr-2 h-4 w-4" />
                        Configure
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Restart
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center">
                    <Server className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">
                      PPPoE service is not enabled
                    </p>
                    <Button size="sm">Enable PPPoE</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Configuration Status */}
          {router.configurationStatus.configured && (
            <Card>
              <CardHeader>
                <CardTitle>Configuration Status</CardTitle>
                <CardDescription>
                  Setup completed {router.configurationStatus.configuredAt 
                    ? new Date(router.configurationStatus.configuredAt).toLocaleString()
                    : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium">Setup Progress</span>
                    <Badge variant="outline">
                      {router.configurationStatus.completedSteps.length} steps completed
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {router.configurationStatus.completedSteps.map((step, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm py-1">
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        <span className="text-muted-foreground">{step}</span>
                      </div>
                    ))}
                  </div>
                  {router.configurationStatus.failedSteps.length > 0 && (
                    <div className="mt-4 pt-4 border-t space-y-2">
                      <span className="text-sm font-medium text-red-600">Failed Steps:</span>
                      {router.configurationStatus.failedSteps.map((step, index) => (
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
              <Button size="sm" variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Packages
              </Button>
              <Button size="sm">
                <Package className="mr-2 h-4 w-4" />
                Create Package
              </Button>
            </div>
          </div>

          {router.packages.hotspot.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {router.packages.hotspot.map((pkg: any) => (
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
                      <Button size="sm" variant="outline" className="flex-1">
                        <Edit className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        <Eye className="mr-1 h-3 w-3" />
                        View
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
                <Button>
                  <Package className="mr-2 h-4 w-4" />
                  Create Your First Package
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Vouchers Tab */}
        <TabsContent value="vouchers" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Voucher Management</h3>
              <p className="text-sm text-muted-foreground">
                Generate and manage hotspot vouchers
              </p>
            </div>
            <Button asChild>
              <Link href={`/routers/${router.id}/vouchers/generate`}>
                <Ticket className="mr-2 h-4 w-4" />
                Generate Vouchers
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Active Vouchers</p>
                  <p className="text-3xl font-bold">245</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Used Today</p>
                  <p className="text-3xl font-bold">18</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Revenue Today</p>
                  <p className="text-3xl font-bold">KSh 1,280</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                  <p className="text-3xl font-bold">94%</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Vouchers</CardTitle>
              <CardDescription>Latest generated vouchers for this router</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Ticket className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  No vouchers generated yet
                </p>
                <Button asChild>
                  <Link href={`/routers/${router.id}/vouchers/generate`}>
                    Generate Your First Vouchers
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
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
            <Button size="sm" variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Online Now</p>
                  <p className="text-3xl font-bold">{router.health.connectedUsers}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Hotspot Users</p>
                  <p className="text-3xl font-bold">{router.health.connectedUsers}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">PPPoE Users</p>
                  <p className="text-3xl font-bold">0</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Peak Today</p>
                  <p className="text-3xl font-bold">15</p>
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
              {router.health.connectedUsers > 0 ? (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Loading active users from router...
                  </p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No users currently connected
                  </p>
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
                View router network setup and infrastructure
              </p>
            </div>
            <Button size="sm" variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync All
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* WAN Configuration */}
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
                  <span className="font-medium">{router.configuration.network.wanInterface}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge className="bg-green-500">Connected</Badge>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">Type</span>
                  <span className="font-medium">DHCP Client</span>
                </div>
              </CardContent>
            </Card>

            {/* LAN Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  LAN Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Bridge</span>
                  <span className="font-medium">{router.configuration.network.lanInterface}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Subnet</span>
                  <span className="font-mono text-xs">{router.configuration.network.lanSubnet}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">DHCP Range</span>
                  <span className="font-mono text-xs">{router.configuration.network.dhcpRange}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* IP Pools */}
          <Card>
            <CardHeader>
              <CardTitle>IP Pools</CardTitle>
              <CardDescription>Address pools for hotspot and PPPoE services</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Hotspot Pool</h4>
                  <Badge variant="outline">Active</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pool Name</span>
                    <span className="font-medium">hotspot-pool</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Range</span>
                    <span className="font-mono text-xs">{router.configuration.hotspot.ipPool}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Available IPs</span>
                    <span className="font-medium">85/101</span>
                  </div>
                </div>
              </div>

              {router.configuration.pppoe.enabled && (
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">PPPoE Pool</h4>
                    <Badge variant="outline">Active</Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pool Name</span>
                      <span className="font-medium">pppoe-pool</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Range</span>
                      <span className="font-mono text-xs">{router.configuration.pppoe.ipPool}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Available IPs</span>
                      <span className="font-medium">91/91</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Interfaces */}
          <Card>
            <CardHeader>
              <CardTitle>Network Interfaces</CardTitle>
              <CardDescription>Physical and virtual interfaces on the router</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Network className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  Sync router to view interface details
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Analytics & Reports</h3>
              <p className="text-sm text-muted-foreground">
                Business intelligence and performance metrics
              </p>
            </div>
            <Button size="sm" variant="outline">
              <BarChart3 className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
                <CardDescription>Last 30 days revenue breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center border rounded-lg">
                  <div className="text-center">
                    <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Revenue chart</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Usage Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Usage Patterns</CardTitle>
                <CardDescription>Peak hours and user activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center border rounded-lg">
                  <div className="text-center">
                    <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Usage chart</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Package Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Package Performance</CardTitle>
              <CardDescription>Sales and revenue by package type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {router.packages.hotspot.map((pkg: any) => (
                  <div key={pkg._id || pkg.name} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div>
                      <p className="font-medium">{pkg.displayName || pkg.name}</p>
                      <p className="text-sm text-muted-foreground">KSh {pkg.price} - {pkg.duration} min</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{pkg.stats?.count || 0} sold</p>
                      <p className="text-sm text-muted-foreground">
                        KSh {pkg.stats?.revenue?.toLocaleString() || 0}
                      </p>
                    </div>
                  </div>
                ))}
                {router.packages.hotspot.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No package data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}