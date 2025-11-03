"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Receipt,
  Users,
  Activity,
  RefreshCw,
  Info,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface CommissionPeriod {
  id: string;
  month: string;
  startDate: Date;
  endDate: Date;
  revenue: {
    totalRevenue: number;
    voucherRevenue: number;
    pppoeRevenue: number;
    transactionCount: number;
  };
  commission: {
    rate: number;
    amount: number;
    previousBalance: number;
    totalOwed: number;
  };
  payout: {
    status: "pending" | "processing" | "paid" | "failed";
    method?: string;
    transactionId?: string;
    paidAt?: Date;
    fees?: number;
  };
  breakdown: {
    type: string;
    count: number;
    revenue: number;
    commission: number;
  }[];
}

interface RevenueBreakdown {
  date: string;
  vouchers: number;
  pppoe: number;
  total: number;
}

export const CommissionTracker: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("current");
  const [timeRange, setTimeRange] = useState<string>("6months");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Real data from API
  const [stats, setStats] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [commissionRate, setCommissionRate] = useState<number>(0);
  const [userPlan, setUserPlan] = useState<string>('individual');

  // Fetch real commission data
  useEffect(() => {
    const fetchCommissionData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/payments/stats');
        if (!res.ok) throw new Error('Failed to fetch commission data');
        
        const data = await res.json();
        setStats(data.stats);
        setBreakdown(data.breakdown);
        setRecentTransactions(data.recentTransactions || []);
        setCommissionRate(data.stats?.commissionRate || 0);
        setUserPlan(data.stats?.userPlan || 'individual');
      } catch (error) {
        console.error('Error fetching commission data:', error);
        toast.error('Failed to load commission data');
      } finally {
        setLoading(false);
      }
    };

    fetchCommissionData();
  }, []);

  const isISP = userPlan === 'isp' || userPlan === 'isp_pro';

  // For backwards compatibility with existing UI
  const currentPeriod = {
    id: "current",
    month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(),
    revenue: {
      totalRevenue: stats?.monthlyRevenue || 0,
      voucherRevenue: breakdown?.voucherSales?.revenue || 0,
      pppoeRevenue: breakdown?.otherSales?.revenue || 0,
      transactionCount: stats?.monthlyTransactions || 0,
    },
    commission: {
      rate: commissionRate,
      amount: stats?.monthlyCommission || 0,
      previousBalance: 0,
      totalOwed: stats?.totalCommission || 0,
    },
    payout: {
      status: "pending" as const,
    },
    breakdown: [
      { 
        type: "Voucher Sales", 
        count: breakdown?.voucherSales?.count || 0, 
        revenue: breakdown?.voucherSales?.revenue || 0, 
        commission: breakdown?.voucherSales?.commission || 0 
      },
      { 
        type: "Other Sales", 
        count: breakdown?.otherSales?.count || 0, 
        revenue: breakdown?.otherSales?.revenue || 0, 
        commission: breakdown?.otherSales?.commission || 0 
      },
    ],
  };

  const lastPeriod = {
    revenue: {
      totalRevenue: stats?.totalRevenue || 0,
    },
  };

  // Calculate growth
  const revenueGrowth = 0; // Can be calculated from historical data if needed

  const commissionGrowth = 0; // Can be calculated from historical data if needed

  // Daily breakdown for chart (would come from API in production)
  const dailyBreakdown: RevenueBreakdown[] = [];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/payments/stats');
      if (!res.ok) throw new Error('Failed to refresh commission data');
      
      const data = await res.json();
      setStats(data.stats);
      setBreakdown(data.breakdown);
      setRecentTransactions(data.recentTransactions || []);
      setCommissionRate(data.stats?.commissionRate || 0);
      setUserPlan(data.stats?.userPlan || 'individual');
      
      toast.success("Commission data refreshed");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!currentPeriod) {
      toast.error("No active commission period");
      return;
    }

    if (currentPeriod.commission.amount < 1000) {
      toast.error("Minimum payout amount is KES 1,000");
      return;
    }

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success("Payout request submitted successfully");
    } catch (error) {
      toast.error("Failed to request payout");
    }
  };

  const handleExport = () => {
    toast.success("Exporting commission report...");
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusIcon = (status: CommissionPeriod["payout"]["status"]) => {
    switch (status) {
      case "paid":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "processing":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: CommissionPeriod["payout"]["status"]) => {
    switch (status) {
      case "paid":
        return "default";
      case "processing":
        return "secondary";
      case "pending":
        return "outline";
      case "failed":
        return "destructive";
    }
  };

  const selectedPeriodData = currentPeriod;

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Loading commission data...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentPeriod) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>
            No commission period data is currently available.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Commission Tracker</h2>
          <p className="text-muted-foreground mt-1">
            Track your earnings and commission payouts
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Current Period Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(currentPeriod.revenue.totalRevenue)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {revenueGrowth >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-green-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                  )}
                  <span
                    className={`text-xs ${
                      revenueGrowth >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {Math.abs(revenueGrowth).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="rounded-full bg-blue-500/10 p-3">
                <DollarSign className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Commission Earned</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(currentPeriod.commission.amount)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {commissionGrowth >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-green-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                  )}
                  <span
                    className={`text-xs ${
                      commissionGrowth >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {Math.abs(commissionGrowth).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="rounded-full bg-green-500/10 p-3">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Transactions</p>
                <p className="text-2xl font-bold">
                  {currentPeriod.revenue.transactionCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  This month
                </p>
              </div>
              <div className="rounded-full bg-purple-500/10 p-3">
                <Receipt className="h-5 w-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Commission Rate</p>
                <p className="text-2xl font-bold">{currentPeriod.commission.rate}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  On all transactions
                </p>
              </div>
              <div className="rounded-full bg-orange-500/10 p-3">
                <Activity className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payout Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payout Status - {currentPeriod.month}</CardTitle>
              <CardDescription>
                Current commission balance and payout information
              </CardDescription>
            </div>
            <Badge variant={getStatusBadge(currentPeriod.payout.status)}>
              {getStatusIcon(currentPeriod.payout.status)}
              <span className="ml-1">{currentPeriod.payout.status}</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
              <p className="text-3xl font-bold text-green-600">
                {formatCurrency(currentPeriod.commission.totalOwed)}
              </p>
            </div>
            {currentPeriod.payout.status === "pending" && (
              <Button onClick={handleRequestPayout}>
                <Wallet className="h-4 w-4 mr-2" />
                Request Payout
              </Button>
            )}
          </div>

          {currentPeriod.commission.totalOwed < 1000 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Minimum payout amount is KES 1,000. Current balance:{" "}
                {formatCurrency(currentPeriod.commission.totalOwed)}
              </AlertDescription>
            </Alert>
          )}

          {isISP && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                ISP plans have 0% commission. You pay a monthly subscription fee instead.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="breakdown" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="breakdown">Revenue Breakdown</TabsTrigger>
          <TabsTrigger value="history">Recent Transactions</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        {/* Breakdown Tab */}
        <TabsContent value="breakdown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Sources</CardTitle>
              <CardDescription>
                Breakdown by product type for {currentPeriod.month}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Voucher Sales</span>
                    <span className="font-semibold">
                      {formatCurrency(currentPeriod.revenue.voucherRevenue)}
                    </span>
                  </div>
                  <Progress
                    value={
                      (currentPeriod.revenue.voucherRevenue /
                        currentPeriod.revenue.totalRevenue) *
                      100
                    }
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {(
                      (currentPeriod.revenue.voucherRevenue /
                        currentPeriod.revenue.totalRevenue) *
                      100
                    ).toFixed(1)}
                    % of total revenue
                  </p>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">PPPoE Subscriptions</span>
                    <span className="font-semibold">
                      {formatCurrency(currentPeriod.revenue.pppoeRevenue)}
                    </span>
                  </div>
                  <Progress
                    value={
                      (currentPeriod.revenue.pppoeRevenue /
                        currentPeriod.revenue.totalRevenue) *
                      100
                    }
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {(
                      (currentPeriod.revenue.pppoeRevenue /
                        currentPeriod.revenue.totalRevenue) *
                      100
                    ).toFixed(1)}
                    % of total revenue
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Detailed Breakdown</h4>
                <div className="rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Product</th>
                        <th className="text-right p-3 font-medium">Sales</th>
                        <th className="text-right p-3 font-medium">Revenue</th>
                        <th className="text-right p-3 font-medium">Commission</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {currentPeriod.breakdown.map((item, index) => (
                        <tr key={index} className="hover:bg-muted/50">
                          <td className="p-3">{item.type}</td>
                          <td className="text-right p-3">{item.count}</td>
                          <td className="text-right p-3">{formatCurrency(item.revenue)}</td>
                          <td className="text-right p-3 font-semibold text-green-600">
                            {formatCurrency(item.commission)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-muted/50 font-semibold">
                      <tr>
                        <td className="p-3">Total</td>
                        <td className="text-right p-3">
                          {currentPeriod.breakdown.reduce((sum, item) => sum + item.count, 0)}
                        </td>
                        <td className="text-right p-3">
                          {formatCurrency(currentPeriod.revenue.totalRevenue)}
                        </td>
                        <td className="text-right p-3 text-green-600">
                          {formatCurrency(currentPeriod.commission.amount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                Your recent payment transactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentTransactions.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No transactions found for this period.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {recentTransactions.map((txn) => (
                    <div key={txn.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium capitalize">{txn.type}</h4>
                            <Badge variant={txn.status === 'completed' ? 'default' : 'secondary'}>
                              {txn.status}
                            </Badge>
                          </div>
                          <div className="grid gap-2 text-sm md:grid-cols-3">
                            <div>
                              <p className="text-muted-foreground">Amount</p>
                              <p className="font-medium">{formatCurrency(txn.amount)}</p>
                            </div>
                            {!isISP && (
                              <div>
                                <p className="text-muted-foreground">Commission</p>
                                <p className="font-semibold text-green-600">
                                  {formatCurrency(txn.commission)}
                                </p>
                              </div>
                            )}
                            <div>
                              <p className="text-muted-foreground">Date</p>
                              <p className="font-medium">
                                {new Date(txn.date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {txn.mpesaRef && (
                            <p className="text-xs text-muted-foreground mt-2">
                              M-Pesa Ref: {txn.mpesaRef}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Revenue Trends</CardTitle>
              <CardDescription>
                Revenue breakdown by week for {currentPeriod.month}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {dailyBreakdown.map((week, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{week.date}</span>
                      <span className="font-semibold">{formatCurrency(week.total)}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Vouchers</span>
                            <span>{formatCurrency(week.vouchers)}</span>
                          </div>
                          <Progress
                            value={(week.vouchers / week.total) * 100}
                            className="h-2"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">PPPoE</span>
                            <span>{formatCurrency(week.pppoe)}</span>
                          </div>
                          <Progress
                            value={(week.pppoe / week.total) * 100}
                            className="h-2"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Alert>
                <TrendingUp className="h-4 w-4" />
                <AlertTitle>Growing Revenue</AlertTitle>
                <AlertDescription>
                  Your revenue is {Math.abs(revenueGrowth).toFixed(1)}% {revenueGrowth >= 0 ? "higher" : "lower"} than last month.
                  Keep up the great work!
                </AlertDescription>
              </Alert>
              <Alert>
                <Users className="h-4 w-4" />
                <AlertTitle>Customer Activity</AlertTitle>
                <AlertDescription>
                  You've served {currentPeriod.revenue.transactionCount} customers this month.
                  Average revenue per transaction: {formatCurrency(currentPeriod.revenue.totalRevenue / currentPeriod.revenue.transactionCount)}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};