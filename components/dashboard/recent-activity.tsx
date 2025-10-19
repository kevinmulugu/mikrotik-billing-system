'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, 
  Users, 
  Wifi, 
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Plus
} from 'lucide-react';
import Link from 'next/link';

interface ActivityItem {
  id: string;
  type: 'payment' | 'user' | 'router' | 'system';
  title: string;
  description: string;
  timestamp: string;
  metadata?: {
    amount?: number;
    routerName?: string;
    userName?: string;
    status?: string;
  };
}

const formatCurrency = (amount: number) => {
  return amount.toLocaleString('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0
  });
};

const formatRelativeTime = (timestamp: string) => {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return past.toLocaleDateString('en-KE', { 
    month: 'short', 
    day: 'numeric' 
  });
};

export function RecentActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      setLoading(true);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // Mock activity data - Replace with actual API call
        setActivities([
          {
            id: '1',
            type: 'payment',
            title: 'Payment Received',
            description: 'Voucher purchase via M-Pesa',
            timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            metadata: { amount: 100, status: 'completed' },
          },
          {
            id: '2',
            type: 'user',
            title: 'New User Connected',
            description: 'PPPoE user logged in',
            timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            metadata: { userName: 'user123', routerName: 'Home Router' },
          },
          {
            id: '3',
            type: 'router',
            title: 'Router Back Online',
            description: 'Connection restored after maintenance',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            metadata: { routerName: 'Office Router', status: 'online' },
          },
          {
            id: '4',
            type: 'payment',
            title: 'Commission Earned',
            description: 'Monthly commission payout',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            metadata: { amount: 2250, status: 'pending' },
          },
          {
            id: '5',
            type: 'system',
            title: 'Vouchers Running Low',
            description: 'Only 5 active vouchers remaining',
            timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            metadata: { routerName: 'Home Router' },
          },
        ]);
      } catch (error) {
        console.error('Failed to fetch activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  const getActivityIcon = (type: string, status?: string) => {
    switch (type) {
      case 'payment':
        return status === 'completed' ? 
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" /> :
          <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      case 'user':
        return <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'router':
        return status === 'online' ?
          <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" /> :
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case 'system':
        return <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityBorderColor = (type: string) => {
    switch (type) {
      case 'payment':
        return 'border-l-green-500';
      case 'user':
        return 'border-l-blue-500';
      case 'router':
        return 'border-l-purple-500';
      case 'system':
        return 'border-l-orange-500';
      default:
        return 'border-l-gray-500';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-muted-foreground" />
          Recent Activity
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/activity">
            View All
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="mb-3 h-12 w-12 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </div>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className={`flex items-start gap-3 rounded-lg border-l-4 bg-muted/50 p-3 transition-colors hover:bg-muted ${getActivityBorderColor(activity.type)}`}
              >
                <div className="mt-0.5 shrink-0">
                  {getActivityIcon(activity.type, activity.metadata?.status)}
                </div>
                
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {activity.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {activity.description}
                      </p>
                      
                      {/* Additional metadata */}
                      {(activity.metadata?.amount || 
                        activity.metadata?.routerName || 
                        activity.metadata?.userName) && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {activity.metadata?.amount && (
                            <Badge variant="secondary" className="text-xs">
                              {formatCurrency(activity.metadata.amount)}
                            </Badge>
                          )}
                          {activity.metadata?.routerName && (
                            <Badge variant="outline" className="text-xs">
                              {activity.metadata.routerName}
                            </Badge>
                          )}
                          {activity.metadata?.userName && (
                            <Badge variant="outline" className="text-xs">
                              {activity.metadata.userName}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick Actions - Removed voucher generation */}
        <div className="mt-6 border-t pt-4">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/routers/add">
              <Plus className="mr-2 h-4 w-4" />
              Add New Router
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}