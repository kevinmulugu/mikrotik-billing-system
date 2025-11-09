// src/app/notifications/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCircle,
  Clock,
  DollarSign,
  Info,
  Loader2,
  Router,
  Server,
  ShieldAlert,
  Ticket,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Notification {
  _id: string;
  notification: {
    type: 'success' | 'error' | 'warning' | 'info';
    category: 'payment' | 'voucher' | 'router' | 'vpn' | 'sms' | 'support' | 'system';
    priority: 'urgent' | 'high' | 'normal' | 'low';
    title: string;
    message: string;
  };
  status: {
    read: boolean;
    readAt?: string;
  };
  metadata?: {
    resourceType?: string;
    resourceId?: string;
    action?: string;
    link?: string;
    amount?: number;
    transactionId?: string;
  };
  createdAt: string;
}

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchNotifications();
    }
  }, [status, router, activeTab, categoryFilter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (activeTab === 'unread') {
        params.append('unreadOnly', 'true');
      }
      
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }
      
      const response = await fetch(`/api/notifications?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      setMarkingRead(notificationId);
      
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark as read');
      }
      
      // Update local state
      setNotifications((prev) =>
        prev.map((notif) =>
          notif._id === notificationId
            ? {
                ...notif,
                status: { ...notif.status, read: true, readAt: new Date().toISOString() },
              }
            : notif
        )
      );
      
      // Dispatch event to update header
      window.dispatchEvent(new Event('notificationRead'));
    } catch (error) {
      console.error('Failed to mark as read:', error);
      toast.error('Failed to mark notification as read');
    } finally {
      setMarkingRead(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark all as read');
      }
      
      const data = await response.json();
      toast.success(data.message || 'All notifications marked as read');
      
      // Refresh notifications
      await fetchNotifications();
      
      // Dispatch event to update header
      window.dispatchEvent(new Event('notificationRead'));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark all notifications as read');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      setDeleting(notificationId);
      
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }
      
      // Remove from local state
      setNotifications((prev) => prev.filter((notif) => notif._id !== notificationId));
      
      toast.success('Notification deleted');
      
      // Dispatch event to update header
      window.dispatchEvent(new Event('notificationRead'));
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error('Failed to delete notification');
    } finally {
      setDeleting(null);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.status.read) {
      await markAsRead(notification._id);
    }
    
    // Navigate to link if available
    if (notification.metadata?.link) {
      router.push(notification.metadata.link);
    }
  };

  const getNotificationIcon = (type: string, category: string) => {
    if (type === 'error') return <AlertCircle className="h-5 w-5" />;
    if (type === 'warning') return <ShieldAlert className="h-5 w-5" />;
    if (type === 'success') return <CheckCircle className="h-5 w-5" />;
    
    switch (category) {
      case 'payment':
      case 'voucher':
        return <DollarSign className="h-5 w-5" />;
      case 'router':
        return <Router className="h-5 w-5" />;
      case 'vpn':
        return <Server className="h-5 w-5" />;
      case 'sms':
        return <Wifi className="h-5 w-5" />;
      case 'support':
        return <Ticket className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-red-500 bg-red-50 dark:bg-red-950';
      case 'warning':
        return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-950';
      case 'success':
        return 'text-green-500 bg-green-50 dark:bg-green-950';
      default:
        return 'text-blue-500 bg-blue-50 dark:bg-blue-950';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'high':
        return <Badge variant="secondary">High</Badge>;
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter((n) => !n.status.read).length;

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Stay updated with important alerts and system events
          </p>
        </div>
        
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline">
            <CheckCircle className="mr-2 h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">
            All
            {notifications.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {notifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant={categoryFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setCategoryFilter('all')}
          >
            All Categories
          </Button>
          <Button
            size="sm"
            variant={categoryFilter === 'payment' ? 'default' : 'outline'}
            onClick={() => setCategoryFilter('payment')}
          >
            <DollarSign className="mr-1 h-3 w-3" />
            Payments
          </Button>
          <Button
            size="sm"
            variant={categoryFilter === 'router' ? 'default' : 'outline'}
            onClick={() => setCategoryFilter('router')}
          >
            <Router className="mr-1 h-3 w-3" />
            Routers
          </Button>
          <Button
            size="sm"
            variant={categoryFilter === 'vpn' ? 'default' : 'outline'}
            onClick={() => setCategoryFilter('vpn')}
          >
            <Server className="mr-1 h-3 w-3" />
            VPN
          </Button>
          <Button
            size="sm"
            variant={categoryFilter === 'support' ? 'default' : 'outline'}
            onClick={() => setCategoryFilter('support')}
          >
            <Ticket className="mr-1 h-3 w-3" />
            Support
          </Button>
        </div>

        <TabsContent value={activeTab} className="mt-6 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                {activeTab === 'unread' ? <BellOff className="h-12 w-12 text-muted-foreground mb-4" /> : <Bell className="h-12 w-12 text-muted-foreground mb-4" />}
                <p className="text-lg font-medium text-muted-foreground">
                  {activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTab === 'unread' 
                    ? "You're all caught up!" 
                    : "You'll see important alerts and updates here"}
                </p>
              </CardContent>
            </Card>
          ) : (
            notifications.map((notification) => (
              <Card
                key={notification._id}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md',
                  !notification.status.read && 'border-l-4 border-l-primary bg-muted/30'
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div
                      className={cn(
                        'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
                        getNotificationColor(notification.notification.type)
                      )}
                    >
                      {getNotificationIcon(
                        notification.notification.type,
                        notification.notification.category
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm">
                              {notification.notification.title}
                            </h3>
                            {getPriorityBadge(notification.notification.priority)}
                            {!notification.status.read && (
                              <Badge variant="outline" className="text-xs">
                                New
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.notification.message}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimestamp(notification.createdAt)}
                            </span>
                            {notification.metadata?.amount && (
                              <span className="font-medium text-green-600">
                                KES {notification.metadata.amount.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-1">
                          {!notification.status.read && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification._id);
                              }}
                              disabled={markingRead === notification._id}
                            >
                              {markingRead === notification._id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification._id);
                            }}
                            disabled={deleting === notification._id}
                          >
                            {deleting === notification._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
