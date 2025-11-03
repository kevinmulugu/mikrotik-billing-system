// src/app/payments/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Settings,
  History,
  BarChart3,
  Smartphone,
  Building2,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Users,
  FileText,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'

interface PaymentStats {
  totalRevenue: number
  monthlyRevenue: number
  todayRevenue: number
  totalCommission: number
  monthlyCommission: number
  pendingPayments: number
  totalTransactions: number
  monthlyTransactions: number
  successRate: number
  paymentMethod: 'company_paybill' | 'own_paybill'
  paybillInfo: {
    number: string
    name: string
    type: 'paybill' | 'till'
  } | null
  userPlan: string
  commissionRate: number
}

interface RevenueBreakdown {
  voucherSales: { revenue: number; count: number; commission: number }
  otherSales: { revenue: number; count: number; commission: number }
}

interface Transaction {
  id: string
  date: string
  type: string
  amount: number
  status: string
  mpesaRef?: string
  phoneNumber?: string
  routerName: string
  commission: number
  customerPhone?: string
}

export default function PaymentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<PaymentStats | null>(null)
  const [breakdown, setBreakdown] = useState<RevenueBreakdown | null>(null)
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPaymentStats()
    }
  }, [status])

  const fetchPaymentStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/payments/stats')
      if (!response.ok) {
        throw new Error('Failed to fetch payment statistics')
      }
      const data = await response.json()
      setStats(data.stats)
      setBreakdown(data.breakdown)
      setRecentTransactions(data.recentTransactions)
    } catch (error) {
      console.error('Error fetching payment stats:', error)
      toast.error('Failed to load payment statistics')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading payment data...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-destructive" />
          <p className="text-muted-foreground">Failed to load payment statistics</p>
          <Button onClick={fetchPaymentStats} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const isISP = stats.userPlan === 'isp' || stats.userPlan === 'isp_pro'

  return (
    <div className="space-y-6 p-6">
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
            <Link href="/payments/setup">
              <Settings className="h-4 w-4 mr-2" />
              Payment Setup
            </Link>
          </Button>
          <Button asChild>
            <Link href="/payments/reconciliation">
              <BarChart3 className="h-4 w-4 mr-2" />
              Reconciliation
            </Link>
          </Button>
        </div>
      </div>

      {/* Payment Method Status */}
      <Card className={`border-l-4 ${stats.paymentMethod === 'company_paybill'
        ? 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
        : 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20'
        }`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {stats.paymentMethod === 'company_paybill' ? (
                <Building2 className="h-5 w-5 text-blue-600" />
              ) : (
                <Smartphone className="h-5 w-5 text-green-600" />
              )}
              <div>
                <h3 className="font-medium">
                  {stats.paymentMethod === 'company_paybill'
                    ? 'Company Paybill Active'
                    : `Own Paybill Active${stats.paybillInfo ? ` (${stats.paybillInfo.number})` : ''}`
                  }
                </h3>
                <p className="text-sm text-muted-foreground">
                  {stats.paymentMethod === 'company_paybill'
                    ? `Using centralized payment processing with ${stats.commissionRate}% commission`
                    : 'Using your own paybill for direct payments'
                  }
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/payments/setup">Configure</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Stats - Continued in next part */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-semibold text-foreground">
                  {formatCurrency(stats.totalRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.totalTransactions} transactions
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {formatCurrency(stats.monthlyRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.monthlyTransactions} transactions
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {!isISP && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Commission Earned</p>
                  <p className="text-2xl font-semibold text-purple-600">
                    {formatCurrency(stats.totalCommission)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This month: {formatCurrency(stats.monthlyCommission)}
                  </p>
                </div>
                <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                  <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{stats.commissionRate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-semibold text-green-600">
                  {stats.successRate}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.pendingPayments} pending
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className={`grid w-full ${isISP ? 'grid-cols-3' : 'grid-cols-4'}`}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          {!isISP && <TabsTrigger value="commission">Commission</TabsTrigger>}
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Recent Transactions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Latest payment activity from your routers</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/payments/history">
                  View All
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No transactions yet</p>
                  <p className="text-sm">Payments will appear here once customers start purchasing</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`p-2 rounded-lg ${
                          tx.status === 'completed' ? 'bg-green-100 dark:bg-green-900' :
                          tx.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900' :
                          'bg-red-100 dark:bg-red-900'
                        }`}>
                          {tx.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          {tx.status === 'pending' && <Clock className="h-4 w-4 text-yellow-600" />}
                          {tx.status === 'failed' && <AlertCircle className="h-4 w-4 text-red-600" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{formatCurrency(tx.amount)}</p>
                            <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                              {tx.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {tx.routerName} • {tx.type} • {new Date(tx.date).toLocaleDateString()}
                          </p>
                          {tx.mpesaRef && (
                            <p className="text-xs text-muted-foreground">Ref: {tx.mpesaRef}</p>
                          )}
                        </div>
                      </div>
                      {!isISP && tx.commission > 0 && (
                        <div className="text-right">
                          <p className="text-sm font-medium text-purple-600">+{formatCurrency(tx.commission)}</p>
                          <p className="text-xs text-muted-foreground">Commission</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover:border-blue-500 transition-colors cursor-pointer">
              <Link href="/payments/history">
                <CardContent className="p-6 text-center">
                  <History className="h-8 w-8 mx-auto mb-3 text-blue-600" />
                  <h3 className="font-semibold mb-1">Payment History</h3>
                  <p className="text-sm text-muted-foreground">View all past transactions</p>
                </CardContent>
              </Link>
            </Card>

            <Card className="hover:border-purple-500 transition-colors cursor-pointer">
              <Link href={isISP ? "/settings" : "/payments/commission"}>
                <CardContent className="p-6 text-center">
                  <Users className="h-8 w-8 mx-auto mb-3 text-purple-600" />
                  <h3 className="font-semibold mb-1">{isISP ? 'Subscription' : 'Commission'}</h3>
                  <p className="text-sm text-muted-foreground">
                    {isISP ? 'Manage your subscription' : 'Track earnings & payouts'}
                  </p>
                </CardContent>
              </Link>
            </Card>

            <Card className="hover:border-green-500 transition-colors cursor-pointer">
              <Link href="/payments/reconciliation">
                <CardContent className="p-6 text-center">
                  <BarChart3 className="h-8 w-8 mx-auto mb-3 text-green-600" />
                  <h3 className="font-semibold mb-1">Reconciliation</h3>
                  <p className="text-sm text-muted-foreground">Match payments with records</p>
                </CardContent>
              </Link>
            </Card>
          </div>

          {/* Revenue Breakdown */}
          {breakdown && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Voucher Sales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Revenue</span>
                      <span className="font-semibold">{formatCurrency(breakdown.voucherSales.revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Count</span>
                      <span className="font-semibold">{breakdown.voucherSales.count}</span>
                    </div>
                    {!isISP && (
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-muted-foreground">Commission</span>
                        <span className="font-semibold text-purple-600">{formatCurrency(breakdown.voucherSales.commission)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Other Sales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Revenue</span>
                      <span className="font-semibold">{formatCurrency(breakdown.otherSales.revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Count</span>
                      <span className="font-semibold">{breakdown.otherSales.count}</span>
                    </div>
                    {!isISP && (
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-muted-foreground">Commission</span>
                        <span className="font-semibold text-purple-600">{formatCurrency(breakdown.otherSales.commission)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardContent className="p-6 text-center">
              <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">View detailed transaction history</p>
              <Button asChild>
                <Link href="/payments/history">Go to Payment History</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commission">
          <Card>
            <CardContent className="p-6 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">Track and manage your commission earnings</p>
              <Button asChild>
                <Link href="/payments/commission">Go to Commission Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardContent className="p-6 text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">Detailed payment analytics coming soon</p>
              <Button variant="outline" disabled>
                View Analytics
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}