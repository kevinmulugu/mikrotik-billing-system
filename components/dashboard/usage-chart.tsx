'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Users, Wifi, Loader2, Package } from 'lucide-react';

interface UsageData {
  activeUsers: number;
  totalUsers: number;
  activeVouchers: number;
  totalVouchers: number;
  activePppoe: number;
  totalPppoe: number;
}

export function UsageChart() {
  const [metric, setMetric] = useState<'users' | 'vouchers' | 'pppoe'>('users');
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/analytics/dashboard');
        if (!res.ok) throw new Error('Failed to fetch analytics');
        const json = await res.json();

        const overview = json?.overview || {};
        const vouchers = json?.vouchers || {};
        const pppoeUsers = json?.pppoeUsers || {};

        setData({
          activeUsers: overview.totalActiveUsers || 0,
          totalUsers: (vouchers.total || 0) + (pppoeUsers.total || 0),
          activeVouchers: vouchers.active || 0,
          totalVouchers: vouchers.total || 0,
          activePppoe: pppoeUsers.active || 0,
          totalPppoe: pppoeUsers.total || 0,
        });
      } catch (error) {
        console.error('Failed to fetch usage data:', error);
        setData({
          activeUsers: 0,
          totalUsers: 0,
          activeVouchers: 0,
          totalVouchers: 0,
          activePppoe: 0,
          totalPppoe: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading usage data...</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted/50 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  const getCurrentMetricData = () => {
    if (!data) return { current: 0, total: 0, percentage: 0 };
    
    switch (metric) {
      case 'users':
        return {
          current: data.activeUsers,
          total: data.totalUsers,
          percentage: data.totalUsers > 0 ? (data.activeUsers / data.totalUsers) * 100 : 0
        };
      case 'vouchers':
        return {
          current: data.activeVouchers,
          total: data.totalVouchers,
          percentage: data.totalVouchers > 0 ? (data.activeVouchers / data.totalVouchers) * 100 : 0
        };
      case 'pppoe':
        return {
          current: data.activePppoe,
          total: data.totalPppoe,
          percentage: data.totalPppoe > 0 ? (data.activePppoe / data.totalPppoe) * 100 : 0
        };
      default:
        return { current: 0, total: 0, percentage: 0 };
    }
  };

  const metricData = getCurrentMetricData();

  const getIcon = () => {
    switch (metric) {
      case 'users':
        return Users;
      case 'vouchers':
        return Package;
      case 'pppoe':
        return Wifi;
      default:
        return Activity;
    }
  };

  const getMetricLabel = () => {
    switch (metric) {
      case 'users':
        return 'Total Active Users';
      case 'vouchers':
        return 'Active Vouchers';
      case 'pppoe':
        return 'Active PPPoE Users';
      default:
        return 'Users';
    }
  };

  const IconComponent = getIcon();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <IconComponent className="h-5 w-5 text-blue-600" />
            User Analytics
          </CardTitle>
          <div className="flex items-center gap-3 mt-2">
            <div>
              <p className="text-xs text-muted-foreground">{getMetricLabel()}</p>
              <span className="text-2xl font-bold">
                {metricData.current}
              </span>
              <span className="text-sm text-muted-foreground ml-1">
                / {metricData.total}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {([
            { key: 'users', label: 'All Users', icon: Users },
            { key: 'vouchers', label: 'Vouchers', icon: Package },
            { key: 'pppoe', label: 'PPPoE', icon: Wifi },
          ] as const).map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              variant={metric === key ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMetric(key)}
              className="h-8 w-8 p-0"
              title={label}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Visual representation */}
        <div className="h-64 flex flex-col items-center justify-center space-y-4">
          {/* Circular progress indicator */}
          <div className="relative w-48 h-48">
            <svg className="w-full h-full transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="96"
                cy="96"
                r="80"
                stroke="currentColor"
                strokeWidth="16"
                fill="none"
                className="text-muted/20"
              />
              {/* Progress circle */}
              <circle
                cx="96"
                cy="96"
                r="80"
                stroke="currentColor"
                strokeWidth="16"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 80}`}
                strokeDashoffset={`${2 * Math.PI * 80 * (1 - metricData.percentage / 100)}`}
                className="text-primary transition-all duration-500"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold">{metricData.current}</span>
              <span className="text-sm text-muted-foreground">Active</span>
              <span className="text-xs text-muted-foreground mt-1">
                {metricData.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-lg font-semibold text-green-600">
              {metricData.current}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-lg font-semibold">
              {metricData.total}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Usage Rate</p>
            <p className="text-lg font-semibold text-blue-600">
              {metricData.percentage.toFixed(0)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}