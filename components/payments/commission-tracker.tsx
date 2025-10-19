"use client";

import React, { useState } from "react";
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

  // Sample data - replace with API calls
  const commissionPeriods: CommissionPeriod[] = [
    {
      id: "period-1",
      month: "January 2025",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-01-31"),
      revenue: {
        totalRevenue: 45670,
        voucherRevenue: 28340,
        pppoeRevenue: 17330,
        transactionCount: 156,
      },
      commission: {
        rate: 15,
        amount: 6850,
        previousBalance: 0,
        totalOwed: 6850,
      },
      payout: {
        status: "paid",
        method: "M-Pesa",
        transactionId: "MPESA-COMM-123456",
        paidAt: new Date("2025-02-01"),
        fees: 0,
      },
      breakdown: [
        { type: "1 Hour Voucher", count: 45, revenue: 4500, commission: 675 },
        { type: "3 Hour Voucher", count: 32, revenue: 8000, commission: 1200 },
        { type: "5 Hour Voucher", count: 28, revenue: 11200, commission: 1680 },
        { type: "1 Day Voucher", count: 12, revenue: 4640, commission: 696 },
        { type: "PPPoE Monthly", count: 39, revenue: 17330, commission: 2599 },
      ],
    },
    {
      id: "period-2",
      month: "February 2025",
      startDate: new Date("2025-02-01"),
      endDate: new Date("2025-02-28"),
      revenue: {
        totalRevenue: 15600,
        voucherRevenue: 8920,
        pppoeRevenue: 6680,
        transactionCount: 48,
      },
      commission: {
        rate: 15,
        amount: 2340,
        previousBalance: 0,
        totalOwed: 2340,
      },
      payout: {
        status: "pending",
      },
      breakdown: [
        { type: "1 Hour Voucher", count: 12, revenue: 1200, commission: 180 },
        { type: "3 Hour Voucher", count: 8, revenue: 2000, commission: 300 },
        { type: "5 Hour Voucher", count: 10, revenue: 4000, commission: 600 },
        { type: "1 Day Voucher", count: 3, revenue: 1720, commission: 258 },
        { type: "PPPoE Monthly", count: 15, revenue: 6680, commission: 1002 },
      ],
    },
  ];

  const currentPeriod = commissionPeriods[1]; // February (current)
  const lastPeriod = commissionPeriods[0]; // January

  // Calculate growth
  const revenueGrowth =
    ((currentPeriod.revenue.totalRevenue - lastPeriod.revenue.totalRevenue) /
      lastPeriod.revenue.totalRevenue) *
    100;

  const commissionGrowth =
    ((currentPeriod.commission.amount - lastPeriod.commission.amount) /
      lastPeriod.commission.amount) *
    100;

  // Daily breakdown for chart
  const dailyBreakdown: RevenueBreakdown[] = [
    { date: "Week 1", vouchers: 2340, pppoe: 1500, total: 3840 },
    { date: "Week 2", vouchers: 1890, pppoe: 1680, total: 3570 },
    { date: "Week 3", vouchers: 2450, pppoe: 1750, total: 4200 },
    { date: "Week 4", vouchers: 2240, pppoe: 1750, total: 3990 },
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Commission data refreshed");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRequestPayout = async () => {
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

  const selectedPeriodData =
    selectedPeriod === "current"
      ? currentPeriod
      : commissionPeriods.find((p) => p.id === selectedPeriod) || currentPeriod;

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

          {currentPeriod.payout.status === "paid" && currentPeriod.payout.paidAt && (
            <Alert className="border-green-500 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-500">Payout Completed</AlertTitle>
              <AlertDescription>
                Paid on {currentPeriod.payout.paidAt.toLocaleDateString()} via{" "}
                {currentPeriod.payout.method}
                {currentPeriod.payout.transactionId && (
                  <>
                    <br />
                    Transaction ID: {currentPeriod.payout.transactionId}
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="breakdown" className="space-y-4">
        <TabsList>
          <TabsTrigger value="breakdown">Revenue Breakdown</TabsTrigger>
          <TabsTrigger value="history">Payout History</TabsTrigger>
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
              <CardTitle>Payout History</CardTitle>
              <CardDescription>
                All commission payouts and pending balances
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {commissionPeriods.map((period) => (
                <div key={period.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{period.month}</h4>
                        <Badge variant={getStatusBadge(period.payout.status)}>
                          {getStatusIcon(period.payout.status)}
                          <span className="ml-1">{period.payout.status}</span>
                        </Badge>
                      </div>
                      <div className="grid gap-2 text-sm md:grid-cols-3">
                        <div>
                          <p className="text-muted-foreground">Revenue</p>
                          <p className="font-medium">{formatCurrency(period.revenue.totalRevenue)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Commission</p>
                          <p className="font-semibold text-green-600">
                            {formatCurrency(period.commission.amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Transactions</p>
                          <p className="font-medium">{period.revenue.transactionCount}</p>
                        </div>
                      </div>
                      {period.payout.paidAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Paid on {period.payout.paidAt.toLocaleDateString()}
                          {period.payout.transactionId && ` • ${period.payout.transactionId}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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