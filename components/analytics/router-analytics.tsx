"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Wifi,
  Download,
  Upload,
  Clock,
  DollarSign,
  Activity,
  Calendar,
  BarChart3,
  PieChart,
  RefreshCw,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Separator } from "../ui/separator";

interface RouterAnalyticsProps {
  routerId: string;
  routerName: string;
}

interface UsageData {
  date: string;
  users: number;
  dataUsage: number;
  revenue: number;
}

interface TopUser {
  username: string;
  dataUsed: number;
  sessionTime: number;
  lastSeen: Date;
}

interface PeakHour {
  hour: string;
  users: number;
  dataUsage: number;
}

export const RouterAnalytics: React.FC<RouterAnalyticsProps> = ({
  routerId,
  routerName,
}) => {
  const [timeRange, setTimeRange] = useState<string>("7days");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sample data - replace with API calls
  const stats = {
    totalUsers: 342,
    activeUsers: 89,
    totalData: 1024 * 1024 * 1024 * 156, // 156 GB
    totalRevenue: 45670,
    avgSessionTime: 127, // minutes
    peakUsers: 45,
    growth: {
      users: 12.5,
      revenue: 18.3,
      data: -5.2,
    },
  };

  const usageData: UsageData[] = [
    { date: "Mon", users: 42, dataUsage: 15.3, revenue: 5200 },
    { date: "Tue", users: 38, dataUsage: 13.8, revenue: 4800 },
    { date: "Wed", users: 45, dataUsage: 16.2, revenue: 6100 },
    { date: "Thu", users: 51, dataUsage: 18.5, revenue: 6800 },
    { date: "Fri", users: 58, dataUsage: 21.4, revenue: 7900 },
    { date: "Sat", users: 67, dataUsage: 24.8, revenue: 9200 },
    { date: "Sun", users: 41, dataUsage: 14.6, revenue: 5670 },
  ];

  const topUsers: TopUser[] = [
    {
      username: "john_doe",
      dataUsed: 5.2 * 1024 * 1024 * 1024,
      sessionTime: 480,
      lastSeen: new Date(),
    },
    {
      username: "jane_smith",
      dataUsed: 4.8 * 1024 * 1024 * 1024,
      sessionTime: 420,
      lastSeen: new Date(Date.now() - 3600000),
    },
    {
      username: "bob_wilson",
      dataUsed: 4.3 * 1024 * 1024 * 1024,
      sessionTime: 390,
      lastSeen: new Date(Date.now() - 7200000),
    },
  ];

  const peakHours: PeakHour[] = [
    { hour: "08:00", users: 12, dataUsage: 2.3 },
    { hour: "12:00", users: 28, dataUsage: 5.8 },
    { hour: "16:00", users: 35, dataUsage: 7.2 },
    { hour: "20:00", users: 45, dataUsage: 9.8 },
    { hour: "22:00", users: 38, dataUsage: 8.1 },
  ];

  const packageStats = [
    { name: "1 Hour Voucher", count: 45, revenue: 4500, percentage: 15.8 },
    { name: "3 Hour Voucher", count: 32, revenue: 8000, percentage: 28.2 },
    { name: "1 Day Voucher", count: 28, revenue: 11200, percentage: 39.5 },
    { name: "PPPoE Monthly", count: 12, revenue: 4640, percentage: 16.5 },
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Analytics refreshed");
    } catch (error) {
      toast.error("Failed to refresh analytics");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    toast.success("Exporting analytics report...");
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getGrowthIcon = (value: number) => {
    return value >= 0 ? (
      <ArrowUpRight className="h-4 w-4 text-green-500" />
    ) : (
      <ArrowDownRight className="h-4 w-4 text-red-500" />
    );
  };

  const getGrowthColor = (value: number) => {
    return value >= 0 ? "text-green-500" : "text-red-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Analytics - {routerName}</h2>
          <p className="text-muted-foreground mt-1">
            Detailed insights and performance metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24hours">Last 24 Hours</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="90days">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
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

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                <div className="flex items-center gap-1 mt-1">
                  {getGrowthIcon(stats.growth.users)}
                  <span className={`text-xs ${getGrowthColor(stats.growth.users)}`}>
                    {Math.abs(stats.growth.users).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="rounded-full bg-blue-500/10 p-3">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Now</p>
                <p className="text-2xl font-bold">{stats.activeUsers}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Peak: {stats.peakUsers} users
                </p>
              </div>
              <div className="rounded-full bg-green-500/10 p-3">
                <Wifi className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Data Usage</p>
                <p className="text-2xl font-bold">{formatBytes(stats.totalData)}</p>
                <div className="flex items-center gap-1 mt-1">
                  {getGrowthIcon(stats.growth.data)}
                  <span className={`text-xs ${getGrowthColor(stats.growth.data)}`}>
                    {Math.abs(stats.growth.data).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="rounded-full bg-purple-500/10 p-3">
                <Activity className="h-5 w-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                <div className="flex items-center gap-1 mt-1">
                  {getGrowthIcon(stats.growth.revenue)}
                  <span className={`text-xs ${getGrowthColor(stats.growth.revenue)}`}>
                    {Math.abs(stats.growth.revenue).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="rounded-full bg-green-500/10 p-3">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Usage Trends */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Daily Usage Trends
                </CardTitle>
                <CardDescription>Users and data usage over time</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {usageData.map((day, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{day.date}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">{day.users} users</span>
                        <span className="font-medium">{day.dataUsage} GB</span>
                      </div>
                    </div>
                    <Progress value={(day.users / 70) * 100} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Peak Hours */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Peak Usage Hours
                </CardTitle>
                <CardDescription>Busiest times of the day</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {peakHours.map((hour, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{hour.hour}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">{hour.users} users</span>
                        <span className="font-medium">{hour.dataUsage} GB</span>
                      </div>
                    </div>
                    <Progress value={(hour.users / stats.peakUsers) * 100} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Package Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Package Performance
              </CardTitle>
              <CardDescription>Revenue breakdown by package type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {packageStats.map((pkg, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{pkg.name}</span>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">{pkg.count} sales</Badge>
                        <span className="font-semibold">{formatCurrency(pkg.revenue)}</span>
                      </div>
                    </div>
                    <Progress value={pkg.percentage} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {pkg.percentage.toFixed(1)}% of total revenue
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Users by Data</CardTitle>
                <CardDescription>Highest data consumption</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {topUsers.map((user, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{user.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDuration(user.sessionTime)} session time
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatBytes(user.dataUsed)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(user.lastSeen)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Statistics</CardTitle>
                <CardDescription>User behavior metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Avg Session Time</span>
                    <span className="font-semibold">{formatDuration(stats.avgSessionTime)}</span>
                  </div>
                  <Progress value={65} className="h-2" />
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Active vs Total</span>
                    <span className="font-semibold">
                      {stats.activeUsers}/{stats.totalUsers}
                    </span>
                  </div>
                  <Progress value={(stats.activeUsers / stats.totalUsers) * 100} className="h-2" />
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Avg Data per User</span>
                    <span className="font-semibold">
                      {formatBytes(stats.totalData / stats.totalUsers)}
                    </span>
                  </div>
                  <Progress value={45} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Revenue</CardTitle>
              <CardDescription>Revenue breakdown over the selected period</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {usageData.map((day, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Day</p>
                      <p className="font-medium">{day.date}</p>
                    </div>
                    <Separator orientation="vertical" className="h-12" />
                    <div>
                      <p className="text-xs text-muted-foreground">Users</p>
                      <p className="font-medium">{day.users}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Data</p>
                      <p className="font-medium">{day.dataUsage} GB</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-green-600">
                      {formatCurrency(day.revenue)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {((day.revenue / stats.totalRevenue) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upload Speed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">2.5 Mbps</span>
                  </div>
                  <Progress value={62.5} className="h-2" />
                  <p className="text-xs text-muted-foreground">Average upload speed</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Download Speed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">8.3 Mbps</span>
                  </div>
                  <Progress value={83} className="h-2" />
                  <p className="text-xs text-muted-foreground">Average download speed</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Uptime</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">99.8%</span>
                  </div>
                  <Progress value={99.8} className="h-2" />
                  <p className="text-xs text-muted-foreground">Last 7 days</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}