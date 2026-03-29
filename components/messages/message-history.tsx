'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquare,
  Users,
  Router,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

interface Message {
  id: string;
  recipientType: string;
  routerId?: string;
  routerName?: string | null;
  message: string;
  recipientCount: number;
  successfulDeliveries?: number;
  failedDeliveries?: number;
  status: string;
  sentAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalMessages: number;
  totalPages: number;
  hasMore: boolean;
}

interface RouterOption {
  id: string;
  name: string;
}

interface MessageHistoryProps {
  routers: RouterOption[];
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partial' },
  { value: 'failed', label: 'Failed' },
];

const statusVariant = (
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'sent') return 'default';
  if (status === 'partial') return 'secondary';
  if (status === 'failed') return 'destructive';
  return 'outline';
};

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function MessageHistory({ routers }: MessageHistoryProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [routerFilter, setRouterFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchHistory = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '15',
        });
        if (routerFilter !== 'all') params.set('routerId', routerFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);

        const res = await fetch(`/api/messages/history?${params}`);
        if (!res.ok) throw new Error('Failed to fetch history');
        const json = await res.json();
        setMessages(json.messages ?? []);
        setPagination(json.pagination ?? null);
      } catch {
        setMessages([]);
        setPagination(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, routerFilter, statusFilter],
  );

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFilterChange = (setter: (v: string) => void) => (val: string) => {
    setter(val);
    setPage(1);
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Message History
            {pagination && (
              <Badge variant="secondary" className="ml-1">
                {pagination.totalMessages}
              </Badge>
            )}
          </CardTitle>

          <div className="flex flex-wrap items-center gap-2">
            {/* Router filter */}
            <Select value={routerFilter} onValueChange={handleFilterChange(setRouterFilter)}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="All Routers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Routers</SelectItem>
                {routers.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => fetchHistory(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="divide-y">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-3">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <MessageSquare className="mb-3 h-12 w-12 opacity-40" />
            <p className="text-sm font-medium">No messages found</p>
            <p className="text-xs mt-1">
              {routerFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Messages you send will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="p-4 hover:bg-accent/30 transition-colors space-y-2"
              >
                {/* Top row: recipient + badge */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    {msg.recipientType === 'all' ? (
                      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Router className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">
                      {msg.recipientType === 'all' ? 'All Customers' : msg.routerName}
                    </span>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {msg.recipientCount} recipient{msg.recipientCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <Badge variant={statusVariant(msg.status)} className="text-xs shrink-0 capitalize">
                    {msg.status}
                  </Badge>
                </div>

                {/* Message preview */}
                <p className="text-sm text-foreground break-words line-clamp-2">
                  {msg.message}
                </p>

                {/* Delivery stats + timestamp */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(msg.sentAt)}
                  </div>
                  {msg.successfulDeliveries !== undefined && msg.successfulDeliveries > 0 && (
                    <span className="text-green-600 dark:text-green-400">
                      ✓ {msg.successfulDeliveries} delivered
                    </span>
                  )}
                  {msg.failedDeliveries !== undefined && msg.failedDeliveries > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      ✗ {msg.failedDeliveries} failed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {((page - 1) * 15) + 1}–{Math.min(page * 15, pagination.totalMessages)} of{' '}
              {pagination.totalMessages} messages
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={!pagination.hasMore || loading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
