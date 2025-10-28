// components/dashboard/stats-cards.tsx - Dashboard Statistics Cards
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DollarSign,
  Users,
  Wifi,
  TrendingUp,
  Activity
} from 'lucide-react';
import { useDashboardStats } from '@/lib/hooks';
import { formatCurrency } from '@/lib/utils';

export function StatsCards() {
  const { stats, loading, error } = useDashboardStats();

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-muted rounded w-20"></div>
              <div className="h-4 w-4 bg-muted rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16 mb-2"></div>
              <div className="h-3 bg-muted rounded w-24"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="col-span-2 md:col-span-4 border-destructive">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-destructive">Failed to load dashboard stats</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default values if stats is null
  const safeStats = stats || {
    totalRevenue: 0,
    activeUsers: 0,
    onlineRouters: 0,
    totalRouters: 0,
    commission: 0,
    revenueChange: 0,
    userChange: 0,
    routerUptime: 0,
    commissionChange: 0,
  };

  const statCards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(safeStats.totalRevenue),
      change: safeStats.revenueChange,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Active Users',
      value: safeStats.activeUsers.toString(),
      change: safeStats.userChange,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Online Routers',
      value: `${safeStats.onlineRouters}/${safeStats.totalRouters}`,
      change: safeStats.routerUptime,
      icon: Wifi,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Commission',
      value: formatCurrency(safeStats.commission),
      change: safeStats.commissionChange,
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statCards.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground mb-1">
              {stat.value}
            </div>
            <div className="flex items-center text-xs">
              {stat.change > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : stat.change < 0 ? (
                <TrendingUp className="h-3 w-3 text-red-500 mr-1 rotate-180" />
              ) : (
                <Activity className="h-3 w-3 text-muted-foreground mr-1" />
              )}
              <span className={`${stat.change > 0 ? 'text-green-600' :
                stat.change < 0 ? 'text-red-600' : 'text-muted-foreground'
                }`}>
                {stat.change > 0 ? '+' : ''}{stat.change}%
              </span>
              <span className="text-muted-foreground ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}