// components/routers/customer-list.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Mail, Phone, MessageSquare, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { CustomerWithStats } from '@/types/customer';

interface CustomerListProps {
  routerId: string;
}

export function CustomerList({ routerId }: CustomerListProps) {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchCustomers();
  }, [routerId, page, search]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search,
      });

      const response = await fetch(`/api/routers/${routerId}/customers?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch customers');
      }

      setCustomers(data.customers);
      setTotalPages(data.pagination.totalPages);
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      toast.error(error.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleSendSMS = (phone: string | null) => {
    if (!phone) {
      toast.error('Phone number not available for this customer');
      return;
    }
    // TODO: Implement SMS sending functionality
    toast.info(`SMS feature coming soon for ${phone}`);
  };

  const handleSendEmail = (email: string | null) => {
    if (!email) {
      toast.error('No email address available for this customer');
      return;
    }
    // TODO: Implement email sending functionality
    toast.info(`Email feature coming soon for ${email}`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading && customers.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              WiFi Customers
            </CardTitle>
            <CardDescription>
              Customers who purchased vouchers from this router
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {customers.length} customer{customers.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Button onClick={fetchCustomers} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {/* Customers Table */}
        {customers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No customers yet</p>
            <p className="text-sm">
              Customers will appear here when they purchase vouchers
            </p>
          </div>
        ) : (
          <>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Last Purchase</TableHead>
                    <TableHead className="text-right">Total Spent</TableHead>
                    <TableHead className="text-right">Purchases</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {customer.name || 'Unknown'}
                          </p>
                          {customer.email && (
                            <p className="text-xs text-muted-foreground">
                              {customer.email}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {customer.phone || (
                          <span className="text-muted-foreground italic">
                            Phone hidden
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">
                            {customer.statistics.lastPurchase
                              ? formatDate(customer.statistics.lastPurchase.date)
                              : 'N/A'}
                          </p>
                          {customer.statistics.lastPurchase && (
                            <p className="text-xs text-muted-foreground">
                              {customer.statistics.lastPurchase.packageType}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(customer.statistics.totalSpent)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">
                          {customer.statistics.totalPurchases}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {customer.phone && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSendSMS(customer.phone)}
                              title="Send SMS"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          )}
                          {customer.email && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSendEmail(customer.email)}
                              title="Send Email"
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          )}
                          {!customer.phone && !customer.email && (
                            <span className="text-xs text-muted-foreground px-2">
                              No contact
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
