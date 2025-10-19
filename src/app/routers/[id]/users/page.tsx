import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { UserTable } from '@/components/users/user-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Users, 
  UserPlus, 
  Wifi, 
  Globe,
  Filter,
  Download
} from 'lucide-react';
import Link from 'next/link';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface RouterUsersPageProps {
  params: Promise<{
    id: string;
  }>;
}

async function getRouterUsersData(routerId: string, userId: string) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get customer
    const customer = await db
      .collection('customers')
      .findOne({ userId: new ObjectId(userId) });

    if (!customer) {
      return null;
    }

    // Verify router ownership
    const router = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        customerId: customer._id,
      });

    if (!router) {
      return null;
    }

    // Get voucher stats (hotspot users)
    const voucherStats = await db
      .collection('vouchers')
      .aggregate([
        {
          $match: {
            routerId: new ObjectId(routerId),
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
      .toArray();

    const totalVouchers = voucherStats.reduce((sum, stat) => sum + stat.count, 0);
    const usedVouchers = voucherStats.find(s => s._id === 'used')?.count || 0;
    const activeVouchers = voucherStats.find(s => s._id === 'active')?.count || 0;

    // Get PPPoE user stats
    const pppoeStats = await db
      .collection('pppoe_users')
      .aggregate([
        {
          $match: {
            routerId: new ObjectId(routerId),
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            online: {
              $sum: {
                $cond: [{ $eq: ['$connection.isOnline', true] }, 1, 0]
              }
            },
            active: {
              $sum: {
                $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
              }
            }
          }
        }
      ])
      .toArray();

    const pppoeData = pppoeStats[0] || { total: 0, online: 0, active: 0 };

    return {
      router: {
        id: router._id.toString(),
        name: router.routerInfo?.name || 'Unnamed Router',
      },
      stats: {
        totalUsers: totalVouchers + pppoeData.total,
        activeUsers: usedVouchers + pppoeData.online,
        hotspotUsers: totalVouchers,
        pppoeUsers: pppoeData.total,
        onlineHotspot: usedVouchers,
        onlinePppoe: pppoeData.online,
      }
    };
  } catch (error) {
    console.error('Error fetching router users data:', error);
    return null;
  }
}

export async function generateMetadata({ params }: RouterUsersPageProps): Promise<Metadata> {
  return {
    title: `Router Users`,
    description: 'Manage hotspot and PPPoE users for your router',
  };
}

export default async function RouterUsersPage({ params }: RouterUsersPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  // Await params (Next.js 15 requirement)
  const { id: routerId } = await params;

  const data = await getRouterUsersData(routerId, session.user.id);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Users className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Router not found</h2>
          <p className="text-muted-foreground mb-4">
            This router doesn't exist or you don't have access to it.
          </p>
          <Button asChild>
            <Link href="/routers">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Routers
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const { router, stats } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/routers/${routerId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-blue-600" />
            {router.name} - Users
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage all users connected to this router
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* User Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-3xl font-bold mt-1">{stats.totalUsers}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Online Now</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{stats.activeUsers}</p>
              </div>
              <div className="h-8 w-8 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hotspot</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-3xl font-bold">{stats.hotspotUsers}</p>
                  <Badge variant="secondary" className="text-xs">
                    {stats.onlineHotspot} online
                  </Badge>
                </div>
              </div>
              <Wifi className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">PPPoE</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-3xl font-bold">{stats.pppoeUsers}</p>
                  <Badge variant="secondary" className="text-xs">
                    {stats.onlinePppoe} online
                  </Badge>
                </div>
              </div>
              <Globe className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Management Tabs */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Users</TabsTrigger>
          <TabsTrigger value="hotspot">
            Hotspot
            <Badge variant="secondary" className="ml-2">
              {stats.hotspotUsers}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pppoe">
            PPPoE
            <Badge variant="secondary" className="ml-2">
              {stats.pppoeUsers}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">All Users</h3>
            <div className="flex gap-2">
              <Button size="sm" asChild>
                <Link href={`/routers/${routerId}/users/pppoe/add`}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add PPPoE User
                </Link>
              </Button>
            </div>
          </div>
          <UserTable routerId={routerId} userType="all" />
        </TabsContent>

        <TabsContent value="hotspot" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Hotspot Users</h3>
            <Button size="sm" asChild>
              <Link href={`/routers/${routerId}/vouchers/generate`}>
                <UserPlus className="h-4 w-4 mr-2" />
                Generate Vouchers
              </Link>
            </Button>
          </div>
          <UserTable routerId={routerId} userType="hotspot" />
        </TabsContent>

        <TabsContent value="pppoe" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">PPPoE Users</h3>
            <Button size="sm" asChild>
              <Link href={`/routers/${routerId}/users/pppoe/add`}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add PPPoE User
              </Link>
            </Button>
          </div>
          <UserTable routerId={routerId} userType="pppoe" />
        </TabsContent>
      </Tabs>
    </div>
  );
}