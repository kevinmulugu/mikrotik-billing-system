import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Wifi, Globe, UserPlus } from 'lucide-react';

export const metadata: Metadata = {
  title: 'All Users - PAY N BROWSE',
  description: 'Manage all users across your routers',
};

export default async function AllUsersPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            All Users
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage users across all your routers
          </p>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-semibold text-foreground">127</p>
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Online Now</p>
                <p className="text-2xl font-semibold text-green-600">34</p>
              </div>
              <div className="h-5 w-5 bg-green-500 rounded-full"></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hotspot Users</p>
                <p className="text-2xl font-semibold text-blue-600">89</p>
              </div>
              <Wifi className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">PPPoE Users</p>
                <p className="text-2xl font-semibold text-purple-600">38</p>
              </div>
              <Globe className="h-5 w-5 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Management Tabs */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Users</TabsTrigger>
          <TabsTrigger value="hotspot">Hotspot Users</TabsTrigger>
          <TabsTrigger value="pppoe">PPPoE Users</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Users Across Routers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                View and manage all users from your different routers in one place.
              </p>
              {/* TODO: Add comprehensive user table component */}
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Global user management interface will be loaded here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hotspot">
          <Card>
            <CardHeader>
              <CardTitle>Hotspot Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Active voucher sessions and hotspot connections across all routers.
              </p>
              <div className="text-center py-8">
                <Wifi className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                <p className="text-muted-foreground">Global hotspot user interface will be loaded here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pppoe">
          <Card>
            <CardHeader>
              <CardTitle>PPPoE Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                All PPPoE user accounts across your routers.
              </p>
              <div className="text-center py-8">
                <Globe className="h-12 w-12 text-purple-400 mx-auto mb-4" />
                <p className="text-muted-foreground">Global PPPoE user interface will be loaded here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}