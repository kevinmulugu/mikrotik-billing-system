'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  DollarSign,
  Wifi,
  AlertTriangle,
  Clock,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

interface ActivityItem {
  id: string;
  type: string;
  amount?: number;
  description: string;
  timestamp: string;
  status: string;
}

interface AlertItem {
  id?: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
}

type FeedItem = ActivityItem & { source: 'activity' | 'alert' };

const formatCurrency = (amount: number) =>
  amount.toLocaleString('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  });

const formatRelativeTime = (timestamp: string) => {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return past.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getActivityIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'payment':
      return DollarSign;
    case 'user':
    case 'voucher':
      return Activity;
    case 'router':
      return Wifi;
    case 'alert':
    case 'system':
    case 'warning':
    case 'info':
      return AlertTriangle;
    default:
      return Activity;
  }
};

const getActivityColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'success':
      return 'text-green-500 bg-green-50 dark:bg-green-950';
    case 'pending':
    case 'processing':
      return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-950';
    case 'failed':
    case 'error':
      return 'text-red-500 bg-red-50 dark:bg-red-950';
    case 'warning':
      return 'text-orange-500 bg-orange-50 dark:bg-orange-950';
    default:
      return 'text-blue-500 bg-blue-50 dark:bg-blue-950';
  }
};

const getStatusBadgeVariant = (
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'success':
      return 'default';
    case 'pending':
    case 'processing':
      return 'secondary';
    case 'failed':
    case 'error':
      return 'destructive';
    default:
      return 'outline';
  }
};

const FILTER_TABS = ['all', 'payment', 'voucher', 'router', 'alert'] as const;
type FilterTab = (typeof FILTER_TABS)[number];

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch('/api/analytics/dashboard');
      if (!res.ok) throw new Error('Failed to fetch activity data');
      const json = await res.json();
      setActivities(json.recentActivity || []);
      setAlerts(json.alerts || []);
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const feed: FeedItem[] = [
    ...activities.map((a) => ({ ...a, source: 'activity' as const })),
    ...alerts.map((a) => ({
      id: a.id || `alert-${a.timestamp}`,
      type: a.type,
      description: a.message,
      timestamp: a.timestamp,
      status: a.type === 'warning' ? 'warning' : 'info',
      source: 'alert' as const,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filtered =
    activeFilter === 'all'
      ? feed
      : feed.filter((item) => {
          if (activeFilter === 'alert') return item.source === 'alert';
          return item.type.toLowerCase() === activeFilter;
        });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
            <p className="text-sm text-muted-foreground">
              All recent events across your routers and payments
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <Button
            key={tab}
            variant={activeFilter === tab ? 'default' : 'outline'}
            size="sm"
            className="capitalize"
            onClick={() => setActiveFilter(tab)}
          >
            {tab}
          </Button>
        ))}
      </div>

      {/* Activity list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            {activeFilter === 'all' ? 'All Activity' : `${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Events`}
            <Badge variant="secondary" className="ml-auto">
              {filtered.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm font-medium">No activity found</p>
              <p className="text-xs mt-1">
                {activeFilter === 'all'
                  ? 'Activity will appear here as it happens'
                  : `No ${activeFilter} events yet`}
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {filtered.map((item) => {
                const Icon = getActivityIcon(item.type);
                const colorClass = getActivityColor(item.status);

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 py-4 border-b last:border-0"
                  >
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {item.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant={getStatusBadgeVariant(item.status)} className="text-xs">
                              {item.status}
                            </Badge>
                            {item.amount !== undefined && (
                              <span className="text-xs font-semibold text-green-600">
                                {formatCurrency(item.amount)}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground capitalize">
                              {item.type}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
