import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  DollarSign, 
  TrendingUp, 
  Users,
  Settings,
  History,
  BarChart3,
  Smartphone,
  Building2
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Payments - MikroTik Billing',
  description: 'Manage payments, commissions, and revenue tracking',
};

export default async function PaymentsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  // TODO: Fetch payment data from API
  const paymentStats = {
    totalRevenue: 87650,
    monthlyRevenue: 15750,
    todayRevenue: 2850,
    commission: 13147.5, // 15% of total revenue
    pendingPayments: 5,
    totalTransactions: 234,
    successRate: 98.5,
    paymentMethod: 'company_paybill', // or 'customer_paybill'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-blue-600" />
            Payment Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Track revenue, manage commissions, and configure payment settings
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <a href="/payments/setup">
              <Settings className="h-4 w-4 mr-2" />
              Payment Setup
            </a>
          </Button>
          <Button asChild>
            <a href="/payments/reconciliation">
              <BarChart3 className="h-4 w-4 mr-2" />
              Reconciliation
            </a>
          </Button>
        </div>
      </div>

      {/* Payment Method Status */}
      <Card className={`border-l-4 ${
        paymentStats.paymentMethod === 'company_paybill' 
          ? 'border-l-blue-500 bg-blue-50' 
          : 'border-l-green-500 bg-green-50'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {paymentStats.paymentMethod === 'company_paybill' ? (
                <Building2 className="h-5 w-5 text-blue-600" />
              ) : (
                <Smartphone className="h-5 w-5 text-green-600" />
              )}
              <div>
                <h3 className="font-medium">
                  {paymentStats.paymentMethod === 'company_paybill' 
                    ? 'Company Paybill Active' 
                    : 'Customer Paybill Active'
                  }
                </h3>
                <p className="text-sm text-muted-foreground">
                  {paymentStats.paymentMethod === 'company_paybill'
                    ? 'Using centralized payment processing with 15% commission'
                    : 'Using your own paybill for direct payments'
                  }
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/payments/setup">Configure</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-semibold text-foreground">
                  KSh {paymentStats.totalRevenue.toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-semibold text-blue-600">
                  KSh {paymentStats.monthlyRevenue.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Commission Earned</p>
                <p className="text-2xl font-semibold text-purple-600">
                  KSh {paymentStats.commission.toLocaleString()}
                </p>
              </div>
              <div className="bg-purple-100 p-2 rounded-lg">
                <span className="text-xs font-medium text-purple-600">15%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-semibold text-green-600">
                  {paymentStats.successRate}%
                </p>
              </div>
              <div className="h-5 w-5 bg-green-500 rounded-full"></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="commission">Commission</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { amount: 100, type: 'Voucher Sale', time: '5 min ago', status: 'completed' },
                    { amount: 50, type: 'Voucher Sale', time: '15 min ago', status: 'completed' },
                    { amount: 500, type: 'PPPoE Payment', time: '1 hour ago', status: 'completed' },
                    { amount: 25, type: 'Voucher Sale', time: '2 hours ago', status: 'pending' },
                  ].map((transaction, index) => (
                    <div key={index} className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium">KSh {transaction.amount}</p>
                        <p className="text-sm text-muted-foreground">{transaction.type}</p>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={transaction.status === 'completed' ? 'default' : 'secondary'}
                          className="mb-1"
                        >
                          {transaction.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground">{transaction.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-4" asChild>
                  <a href="/payments/history">View All Transactions</a>
                </Button>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" asChild>
                  <a href="/payments/reconciliation">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Payment Reconciliation
                  </a>
                </Button>
                
                <Button className="w-full justify-start" variant="outline" asChild>
                  <a href="/payments/commission">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Commission Tracking
                  </a>
                </Button>
                
                <Button className="w-full justify-start" variant="outline" asChild>
                  <a href="/payments/setup">
                    <Settings className="h-4 w-4 mr-2" />
                    Payment Settings
                  </a>
                </Button>
                
                <Button className="w-full justify-start" variant="outline" asChild>
                  <a href="/payments/history">
                    <History className="h-4 w-4 mr-2" />
                    Payment History
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Breakdown (This Month)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CreditCard className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-lg">Voucher Sales</h3>
                  <p className="text-2xl font-bold text-blue-600">KSh 9,450</p>
                  <p className="text-sm text-muted-foreground">142 vouchers sold</p>
                </div>
                
                <div className="text-center">
                  <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="h-8 w-8 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-lg">PPPoE Subscriptions</h3>
                  <p className="text-2xl font-bold text-purple-600">KSh 6,300</p>
                  <p className="text-sm text-muted-foreground">21 active users</p>
                </div>
                
                <div className="text-center">
                  <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-lg">Commission</h3>
                  <p className="text-2xl font-bold text-green-600">KSh 2,362</p>
                  <p className="text-sm text-muted-foreground">15% of total revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Transaction history interface will be loaded here.</p>
              <Button className="mt-4" asChild>
                <a href="/payments/history">View Transaction History</a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commission">
          <Card>
            <CardHeader>
              <CardTitle>Commission Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Commission tracking interface will be loaded here.</p>
              <Button className="mt-4" asChild>
                <a href="/payments/commission">Manage Commission</a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Payment Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Payment analytics dashboard will be loaded here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}