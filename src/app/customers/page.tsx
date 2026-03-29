'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Wifi,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  phone: string | null;
  name: string | null;
  email: string | null;
  routerId: string;
  routerName: string;
  createdAt: string;
  lastPurchaseDate: string;
  totalPurchases: number;
  totalSpent: number;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Stats {
  totalCustomers: number;
  totalSpent: number;
  totalPurchases: number;
  recentCustomers: number;
}

interface Router {
  id: string;
  name: string;
}

interface ApiResponse {
  customers: Customer[];
  pagination: Pagination;
  stats: Stats;
  routers: Router[];
}

type SortField = 'lastPurchaseDate' | 'totalSpent' | 'totalPurchases' | 'createdAt';
type SortOrder = 'asc' | 'desc';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount);

const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const displayName = (c: Customer) => c.name || c.phone || c.email || 'Unknown';

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4 shrink-0" />
          <span>{sub}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sort button ──────────────────────────────────────────────────────────────

function SortButton({
  field,
  label,
  sortBy,
  sortOrder,
  onSort,
}: {
  field: SortField;
  label: string;
  sortBy: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
}) {
  const active = sortBy === field;
  const Icon = active ? (sortOrder === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 text-xs font-medium select-none ${
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label} <Icon className="h-3 w-3" />
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [routerId, setRouterId] = useState('all');
  const [sortBy, setSortBy] = useState<SortField>('lastPurchaseDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        sortBy,
        sortOrder,
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (routerId !== 'all') params.set('routerId', routerId);

      const res = await fetch(`/api/customers?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, debouncedSearch, routerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filter/sort changes (except page itself)
  const handleRouterChange = (val: string) => {
    setRouterId(val);
    setPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const stats = data?.stats;
  const pagination = data?.pagination;
  const customers = data?.customers ?? [];
  const routers = data?.routers ?? [];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats ? (
          <>
            <StatCard
              label="Total Customers"
              value={stats.totalCustomers.toLocaleString()}
              sub="Across all routers"
              icon={Users}
            />
            <StatCard
              label="Total Revenue"
              value={formatCurrency(stats.totalSpent)}
              sub="All-time purchases"
              icon={DollarSign}
            />
            <StatCard
              label="Total Purchases"
              value={stats.totalPurchases.toLocaleString()}
              sub="Vouchers sold"
              icon={ShoppingCart}
            />
            <StatCard
              label="Active (7 days)"
              value={stats.recentCustomers.toLocaleString()}
              sub="Recent customers"
              icon={TrendingUp}
            />
          </>
        ) : (
          [...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-16 mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone or email…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={routerId} onValueChange={handleRouterChange}>
          <SelectTrigger className="w-full sm:w-52">
            <Wifi className="h-4 w-4 mr-2 text-muted-foreground" />
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
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Customers
              {pagination && (
                <Badge variant="secondary" className="ml-1">
                  {pagination.total.toLocaleString()}
                </Badge>
              )}
            </CardTitle>
            {pagination && pagination.totalPages > 1 && (
              <p className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </p>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-2 border-b bg-muted/40 text-xs font-medium text-muted-foreground hidden md:grid">
            <span>Customer</span>
            <SortButton field="lastPurchaseDate" label="Last Purchase" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
            <SortButton field="totalPurchases" label="Purchases" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
            <SortButton field="totalSpent" label="Total Spent" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
            <span>Router</span>
          </div>

          {loading ? (
            <div className="divide-y">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-3 hidden md:grid">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
              ))}
              {/* Mobile skeleton */}
              <div className="md:hidden divide-y">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-4 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))}
              </div>
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Users className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm font-medium">
                {debouncedSearch || routerId !== 'all' ? 'No customers match your filters' : 'No customers yet'}
              </p>
              <p className="text-xs mt-1">
                {debouncedSearch || routerId !== 'all'
                  ? 'Try adjusting your search or router filter'
                  : 'Customers appear here when they purchase vouchers'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {customers.map((c) => (
                <div key={c.id}>
                  {/* Desktop row */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-3 hover:bg-muted/30 transition-colors hidden md:grid">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{displayName(c)}</p>
                      {c.name && c.phone && (
                        <p className="text-xs text-muted-foreground font-mono">{c.phone}</p>
                      )}
                      {c.email && !c.name && !c.phone && (
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(c.lastPurchaseDate)}
                    </span>
                    <span className="text-sm text-center tabular-nums">
                      {c.totalPurchases}
                    </span>
                    <span className="text-sm font-medium tabular-nums whitespace-nowrap">
                      {formatCurrency(c.totalSpent)}
                    </span>
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      {c.routerName}
                    </Badge>
                  </div>

                  {/* Mobile row */}
                  <div className="p-4 space-y-1 md:hidden hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{displayName(c)}</p>
                        {c.name && c.phone && (
                          <p className="text-xs text-muted-foreground font-mono">{c.phone}</p>
                        )}
                      </div>
                      <span className="text-sm font-semibold shrink-0">
                        {formatCurrency(c.totalSpent)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <Badge variant="outline" className="text-xs">{c.routerName}</Badge>
                      <span>{c.totalPurchases} purchase{c.totalPurchases !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span>{formatDate(c.lastPurchaseDate)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, pagination.total)} of{' '}
            {pagination.total.toLocaleString()} customers
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
