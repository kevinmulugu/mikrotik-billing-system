// src/app/customers/page.tsx
import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const metadata: Metadata = {
  title: 'WiFi Customers - MikroTik Billing',
  description: 'View all customers who purchased vouchers from your routers',
};

async function getCustomersData(userId: string) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get all routers owned by this user
    const routers = await db
      .collection('routers')
      .find({ userId: new ObjectId(userId) })
      .toArray();

    const routerIds = routers.map((r) => r._id);

    // Get all customers for these routers
    const customers = await db
      .collection('customers')
      .find({ routerId: { $in: routerIds } })
      .sort({ lastPurchaseDate: -1 })
      .limit(100)
      .toArray();

    // Calculate statistics
    const totalCustomers = customers.length;
    const totalSpent = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    const totalPurchases = customers.reduce((sum, c) => sum + (c.totalPurchases || 0), 0);

    // Get recent customers (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentCustomers = customers.filter(
      (c) => new Date(c.lastPurchaseDate) >= sevenDaysAgo
    ).length;

    // Group customers by router
    const customersByRouter = await Promise.all(
      routers.map(async (router) => {
        const routerCustomers = await db
          .collection('customers')
          .countDocuments({ routerId: router._id });

        return {
          routerId: router._id.toString(),
          routerName: router.routerInfo?.name || 'Unnamed Router',
          customerCount: routerCustomers,
        };
      })
    );

    // Format customers for display
    const formattedCustomers = customers.map((customer) => {
      const router = routers.find((r) => r._id.equals(customer.routerId));
      return {
        id: customer._id.toString(),
        phone: customer.phone,
        name: customer.name,
        email: customer.email,
        routerName: router?.routerInfo?.name || 'Unknown Router',
        lastPurchaseDate: customer.lastPurchaseDate,
        totalPurchases: customer.totalPurchases || 0,
        totalSpent: customer.totalSpent || 0,
      };
    });

    return {
      statistics: {
        totalCustomers,
        totalSpent,
        totalPurchases,
        recentCustomers,
      },
      customersByRouter,
      customers: formattedCustomers,
    };
  } catch (error) {
    console.error('Error fetching customers data:', error);
    return null;
  }
}

export default async function CustomersPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  const data = await getCustomersData(session.user.id);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Failed to load customers</h2>
          <p className="text-muted-foreground">Please try again later</p>
        </div>
      </div>
    );
  }

  const { statistics, customersByRouter, customers } = data;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            WiFi Customers
          </h1>
          <p className="text-muted-foreground mt-1">
            Customers who purchased vouchers from your routers
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Customers</CardDescription>
            <CardTitle className="text-2xl">{statistics.totalCustomers}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Across all routers</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(statistics.totalSpent)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span>All-time purchases</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Purchases</CardDescription>
            <CardTitle className="text-2xl">{statistics.totalPurchases}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShoppingCart className="h-4 w-4" />
              <span>Vouchers sold</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recent (7 days)</CardDescription>
            <CardTitle className="text-2xl">{statistics.recentCustomers}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>New customers</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customers by Router */}
      <Card>
        <CardHeader>
          <CardTitle>Customers by Router</CardTitle>
          <CardDescription>Distribution of customers across your routers</CardDescription>
        </CardHeader>
        <CardContent>
          {customersByRouter.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No routers found
            </p>
          ) : (
            <div className="space-y-3">
              {customersByRouter.map((router) => (
                <div
                  key={router.routerId}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{router.routerName}</p>
                    <p className="text-sm text-muted-foreground">
                      {router.customerCount} customer{router.customerCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <Badge variant="secondary">{router.customerCount}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Customers */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Customers</CardTitle>
          <CardDescription>Latest voucher purchases (up to 100)</CardDescription>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No customers yet</p>
              <p className="text-sm">
                Customers will appear here when they purchase vouchers
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">
                        {customer.name || 'Unknown Customer'}
                      </p>
                      {customer.phone && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {customer.phone}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{customer.routerName}</span>
                      <span>•</span>
                      <span>{formatDate(customer.lastPurchaseDate)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(customer.totalSpent)}</p>
                    <p className="text-xs text-muted-foreground">
                      {customer.totalPurchases} purchase{customer.totalPurchases !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
