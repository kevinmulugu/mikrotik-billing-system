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
  CreditCard,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';

interface Payment {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  status: string;
  mpesaTransactionId: string | null;
  phoneNumber: string | null;
  customerName: string | null;
  resultDesc: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalPayments: number;
  totalPages: number;
  hasMore: boolean;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

const TYPE_LABELS: Record<string, string> = {
  voucher_purchase: 'Voucher',
  pppoe_payment: 'PPPoE',
  sms_credits_purchase: 'SMS Credits',
};

const statusVariant = (
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'completed') return 'default';
  if (status === 'pending' || status === 'pending_voucher' || status === 'pending_confirmation')
    return 'secondary';
  if (status === 'failed') return 'destructive';
  return 'outline';
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-yellow-600" />;
};

const maskPhone = (phone: string | null): string => {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return phone;
  return digits.slice(0, 3) + '***' + digits.slice(-3);
};

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function PaymentsList() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchPayments = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({ page: String(page), limit: '20' });
        if (statusFilter !== 'all') params.set('status', statusFilter);

        const res = await fetch(`/api/payments?${params}`);
        if (!res.ok) throw new Error('Failed to fetch payments');
        const json = await res.json();
        setPayments(json.payments ?? []);
        setPagination(json.pagination ?? null);
      } catch {
        setPayments([]);
        setPagination(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, statusFilter],
  );

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            Transactions
            {pagination && (
              <Badge variant="secondary" className="ml-1">
                {pagination.totalPayments}
              </Badge>
            )}
          </CardTitle>

          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={handleStatusChange}>
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
              onClick={() => fetchPayments(true)}
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
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-40" />
                </div>
                <div className="text-right space-y-1.5">
                  <Skeleton className="h-4 w-16 ml-auto" />
                  <Skeleton className="h-3 w-24 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <CreditCard className="mb-3 h-12 w-12 opacity-40" />
            <p className="text-sm font-medium">No transactions found</p>
            <p className="text-xs mt-1">
              {statusFilter !== 'all'
                ? 'Try adjusting your filter'
                : 'Payments from customers will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-accent/30 transition-colors">
                <div className="shrink-0">
                  <StatusIcon status={p.status} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      KES {p.amount.toLocaleString()}
                    </span>
                    <Badge variant={statusVariant(p.status)} className="text-xs capitalize">
                      {p.status === 'pending_voucher' || p.status === 'pending_confirmation'
                        ? 'pending'
                        : p.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {TYPE_LABELS[p.type] ?? p.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {p.customerName && (
                      <span className="font-medium text-foreground/80">{p.customerName}</span>
                    )}
                    {p.customerName && (p.mpesaTransactionId || p.phoneNumber) && <span>·</span>}
                    {p.mpesaTransactionId && (
                      <span className="font-mono">{p.mpesaTransactionId}</span>
                    )}
                    {p.mpesaTransactionId && p.phoneNumber && <span>·</span>}
                    {p.phoneNumber && <span>{maskPhone(p.phoneNumber)}</span>}
                    {p.status === 'failed' && p.resultDesc && (
                      <span className="text-destructive truncate">{p.resultDesc}</span>
                    )}
                  </div>
                </div>

                <div className="text-right text-xs text-muted-foreground shrink-0">
                  {formatDate(p.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.totalPayments)} of{' '}
              {pagination.totalPayments}
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
