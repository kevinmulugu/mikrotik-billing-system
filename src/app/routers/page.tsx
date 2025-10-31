// src/app/routers/page.tsx
import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { RouterList } from '@/components/routers/router-list';
import { Button } from '@/components/ui/button';
import { Plus, Wifi, AlertTriangle, Users } from 'lucide-react';
import Link from 'next/link';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const metadata: Metadata = {
  title: 'My Routers',
  description: 'Manage all your MikroTik routers and monitor their performance',
};

async function getRoutersData(userId: string) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get user
    const user = await db
      .collection('users')
      .findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return null;
    }

    // Get routers owned by this user
    const routers = await db
      .collection('routers')
      .find({ userId: new ObjectId(userId) })
      .toArray();

    // Calculate statistics
    const totalRouters = routers.length;
    const onlineRouters = routers.filter(r => r.health?.status === 'online').length;
    const offlineRouters = routers.filter(r => r.health?.status === 'offline').length;
    const totalActiveUsers = routers.reduce((sum, r) => sum + (r.health?.connectedUsers || 0), 0);

    // Format routers
    const formattedRouters = routers.map((router) => ({
      id: router._id.toString(),
      name: router.routerInfo?.name || 'Unnamed Router',
      model: router.routerInfo?.model || 'Unknown',
      serialNumber: router.routerInfo?.serialNumber,
      location: router.routerInfo?.location?.name || 'Unknown Location',
      ipAddress: router.connection?.ipAddress,
      status: router.health?.status || 'offline',
      health: {
        lastSeen: router.health?.lastSeen,
        uptime: router.health?.uptime || 0,
        cpuUsage: router.health?.cpuUsage || 0,
        memoryUsage: router.health?.memoryUsage || 0,
        temperature: router.health?.temperature || 0,
        connectedUsers: router.health?.connectedUsers || 0,
      },
      statistics: {
        totalUsers: router.statistics?.totalUsers || 0,
        activeUsers: router.statistics?.activeUsers || 0,
        dailyRevenue: router.statistics?.revenue?.daily || 0,
        monthlyRevenue: router.statistics?.revenue?.monthly || 0,
        totalRevenue: router.statistics?.revenue?.total || 0,
      },
      configuration: {
        hotspotEnabled: router.configuration?.hotspot?.enabled || false,
        pppoeEnabled: router.configuration?.pppoe?.enabled || false,
      },
      createdAt: router.createdAt,
      updatedAt: router.updatedAt,
    }));

    return {
      statistics: {
        totalRouters,
        onlineRouters,
        offlineRouters,
        totalActiveUsers,
      },
      routers: formattedRouters,
    };
  } catch (error) {
    console.error('Error fetching routers:', error);
    return null;
  }
}

export default async function RoutersPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  const data = await getRoutersData(session.user.id);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Failed to load routers</h2>
          <p className="text-muted-foreground">Please try again later</p>
        </div>
      </div>
    );
  }

  const { statistics, routers } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wifi className="h-8 w-8 text-blue-600" />
            My Routers
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor your MikroTik routers
          </p>
        </div>
        
        <Button asChild>
          <Link href="/routers/add">
            <Plus className="h-4 w-4 mr-2" />
            Add Router
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Routers</p>
              <p className="text-3xl font-bold mt-1">{statistics.totalRouters}</p>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-lg">
              <Wifi className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Online</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                {statistics.onlineRouters}
              </p>
            </div>
            <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg">
              <div className="h-6 w-6 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Offline</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">
                {statistics.offlineRouters}
              </p>
            </div>
            <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Users</p>
              <p className="text-3xl font-bold mt-1">{statistics.totalActiveUsers}</p>
            </div>
            <div className="bg-purple-100 dark:bg-purple-900/20 p-3 rounded-lg">
              <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Router List */}
      {routers.length === 0 ? (
        <div className="bg-card rounded-lg border p-12 text-center">
          <Wifi className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No routers yet</h3>
          <p className="text-muted-foreground mb-6">
            Add your first MikroTik router to start managing your hotspot
          </p>
          <Button asChild>
            <Link href="/routers/add">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Router
            </Link>
          </Button>
        </div>
      ) : (
        <RouterList routers={routers} />
      )}
    </div>
  );
}