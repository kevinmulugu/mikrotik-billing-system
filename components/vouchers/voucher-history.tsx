// components/vouchers/voucher-history.tsx
"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Badge,
  BadgeProps,
} from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CalendarDays,
  Clock,
  CreditCard,
  Download,
  Eye,
  Filter,
  RefreshCw,
  Search,
  Ticket,
  Users,
  Wifi,
} from "lucide-react"
import { formatCurrency, formatDataUsage, formatDuration, debounce } from "@/lib/utils"

// Types
interface VoucherHistory {
  _id: string
  voucherInfo: {
    code: string
    packageType: string
    duration: number
    dataLimit: number
    bandwidth: {
      upload: number
      download: number
    }
    price: number
    currency: string
  }
  usage: {
    used: boolean
    userId?: string
    deviceMac?: string
    startTime?: Date
    endTime?: Date
    dataUsed?: number
    timeUsed?: number
    maxDurationMinutes?: number
    expectedEndTime?: Date
    timedOnPurchase?: boolean
    purchaseExpiresAt?: Date
  }
  payment: {
    method: string
    transactionId?: string
    phoneNumber?: string
    amount: number
    commission: number
    paymentDate: Date
  }
  batch?: {
    batchId: string
    batchSize: number
  }
  status: "active" | "paid" | "used" | "expired" | "cancelled"
  createdAt: Date
  updatedAt: Date
}

interface VoucherHistoryProps {
  routerId: string
}

interface FilterOptions {
  status: string
  packageType: string
  dateRange: string
  search: string
}

// Voucher status badge variant mapping
const getStatusVariant = (status: string): BadgeProps["variant"] => {
  switch (status) {
    case "active":
      return "default"
    case "paid":
      return "default" // Blue for paid
    case "used":
      return "secondary"
    case "expired":
      return "destructive"
    case "cancelled":
      return "outline"
    default:
      return "outline"
  }
}

export function VoucherHistory({ routerId }: VoucherHistoryProps) {
  const { data: session } = useSession()
  const [vouchers, setVouchers] = useState<VoucherHistory[]>([])
  const [filteredVouchers, setFilteredVouchers] = useState<VoucherHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherHistory | null>(null)
  const [packages, setPackages] = useState<Array<{ name: string; displayName: string }>>([])
  const [filters, setFilters] = useState<FilterOptions>({
    status: "all",
    packageType: "all",
    dateRange: "all",
    search: ""
  })

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    paid: 0,
    used: 0,
    expired: 0,
    cancelled: 0,
    totalRevenue: 0,
    totalCommission: 0
  })

  // Get package display name from fetched packages or fallback to packageType
  const getPackageDisplay = (packageType: string): string => {
    const pkg = packages.find(p => p.name === packageType)
    if (pkg) {
      return pkg.displayName
    }
    
    // Fallback to hardcoded map for backwards compatibility
    const packageMap: Record<string, string> = {
      "1hour": "1 Hour",
      "3hours": "3 Hours", 
      "5hours": "5 Hours",
      "12hours": "12 Hours",
      "1day": "1 Day",
      "3days": "3 Days",
      "1week": "1 Week",
      "1month": "1 Month"
    }
    return packageMap[packageType] || packageType
  }

  // Fetch packages from router
  const fetchPackages = async () => {
    try {
      const response = await fetch(`/api/routers/${routerId}/packages`, {
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch packages')
      }

      const data = await response.json()
      setPackages(data.packages || [])
    } catch (error) {
      console.error('Error fetching packages:', error)
      // Don't show error toast for packages, just use empty array
    }
  }

  // Fetch voucher history
  const fetchVoucherHistory = async () => {
    try {
      setLoading(true)
      
      // Build query parameters from filters
      const params = new URLSearchParams()
      if (filters.status !== 'all') params.append('status', filters.status)
      if (filters.packageType !== 'all') params.append('packageType', filters.packageType)
      if (filters.dateRange !== 'all') params.append('dateRange', filters.dateRange)
      if (filters.search) params.append('search', filters.search)
      
      const url = `/api/routers/${routerId}/vouchers/history${params.toString() ? `?${params.toString()}` : ''}`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch voucher history')
      }

      const data = await response.json()
      setVouchers(data.vouchers || [])
      setFilteredVouchers(data.vouchers || [])
      setStats(data.stats || stats)
    } catch (error) {
      console.error('Error fetching voucher history:', error)
      toast.error('Failed to load voucher history')
    } finally {
      setLoading(false)
    }
  }

  // Filter vouchers based on criteria (kept for potential client-side enhancements)
  // Server-side filtering is now primary, this is backup/fallback
  const filterVouchers = () => {
    let filtered = [...vouchers]

    // Status filter
    if (filters.status !== "all") {
      filtered = filtered.filter(v => v.status === filters.status)
    }

    // Package type filter
    if (filters.packageType !== "all") {
      filtered = filtered.filter(v => v.voucherInfo.packageType === filters.packageType)
    }

    // Date range filter
    if (filters.dateRange !== "all") {
      const now = new Date()
      const filterDate = new Date()
      
      switch (filters.dateRange) {
        case "today":
          filterDate.setHours(0, 0, 0, 0)
          break
        case "week":
          filterDate.setDate(now.getDate() - 7)
          break
        case "month":
          filterDate.setMonth(now.getMonth() - 1)
          break
        case "3months":
          filterDate.setMonth(now.getMonth() - 3)
          break
      }
      
      filtered = filtered.filter(v => new Date(v.createdAt) >= filterDate)
    }

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      filtered = filtered.filter(v => 
        v.voucherInfo.code.toLowerCase().includes(searchTerm) ||
        v.payment.phoneNumber?.includes(searchTerm) ||
        v.payment.transactionId?.toLowerCase().includes(searchTerm) ||
        v.usage.userId?.toLowerCase().includes(searchTerm)
      )
    }

    setFilteredVouchers(filtered)
  }

  // Debounced search
  const debouncedSearch = debounce((searchTerm: string) => {
    setFilters(prev => ({ ...prev, search: searchTerm }))
  }, 300)

  // Export voucher history
  const exportHistory = async () => {
    try {
      // Build query params from filters
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.packageType !== 'all') params.append('packageType', filters.packageType);
      params.append('format', 'csv');

      const response = await fetch(
        `/api/routers/${routerId}/vouchers/export?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.user?.id}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `voucher-history-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Voucher history exported successfully');
    } catch (error) {
      console.error('Error exporting history:', error);
      toast.error('Failed to export voucher history');
    }
  }

  // Effects
  useEffect(() => {
    if (session && routerId) {
      fetchPackages()
      fetchVoucherHistory()
    }
  }, [session, routerId, filters])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Ticket className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Total Vouchers</p>
                <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-4 w-4 text-green-600" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Used Vouchers</p>
                <p className="text-2xl font-bold text-green-600">{stats.used.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CreditCard className="h-4 w-4 text-blue-600" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Wifi className="h-4 w-4 text-purple-600" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Commission Earned</p>
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(stats.totalCommission)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Voucher History</CardTitle>
              <CardDescription>
                Complete history of all generated and used vouchers
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={fetchVoucherHistory}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" onClick={exportHistory}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by voucher code, phone, transaction ID..."
                  className="pl-9"
                  onChange={(e) => debouncedSearch(e.target.value)}
                />
              </div>
            </div>

            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="used">Used</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.packageType}
              onValueChange={(value) => setFilters(prev => ({ ...prev, packageType: value }))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Package" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Packages</SelectItem>
                {packages.map((pkg) => (
                  <SelectItem key={pkg.name} value={pkg.name}>
                    {pkg.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.dateRange}
              onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
                <SelectItem value="3months">Last 3 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Voucher History Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voucher Code</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVouchers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {vouchers.length === 0 ? "No vouchers generated yet" : "No vouchers match the current filters"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVouchers.map((voucher) => (
                    <TableRow key={voucher._id}>
                      <TableCell className="font-mono font-medium">
                        {voucher.voucherInfo.code}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{getPackageDisplay(voucher.voucherInfo.packageType)}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDuration(voucher.voucherInfo.duration)}
                            {voucher.voucherInfo.dataLimit > 0 && 
                              ` • ${formatDataUsage(voucher.voucherInfo.dataLimit)}`
                            }
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(voucher.voucherInfo.price)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(voucher.status)}>
                          {voucher.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{voucher.payment.method.toUpperCase()}</div>
                          {voucher.payment.phoneNumber && (
                            <div className="text-muted-foreground">{voucher.payment.phoneNumber}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {voucher.usage.used ? (
                          <div className="text-sm">
                            <div className="text-green-600">Used</div>
                            {voucher.usage.dataUsed && (
                              <div className="text-muted-foreground">
                                {formatDataUsage(voucher.usage.dataUsed)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">Unused</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{new Date(voucher.createdAt).toLocaleDateString()}</div>
                          <div className="text-muted-foreground">
                            {new Date(voucher.createdAt).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedVoucher(voucher)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Voucher Details</DialogTitle>
                              <DialogDescription>
                                Complete information for voucher {selectedVoucher?.voucherInfo.code}
                              </DialogDescription>
                            </DialogHeader>
                            
                            {selectedVoucher && (
                              <div className="space-y-6">
                                {/* Voucher Information */}
                                <div>
                                  <h4 className="font-medium mb-3">Voucher Information</h4>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Code:</span>
                                      <div className="font-mono font-medium">{selectedVoucher.voucherInfo.code}</div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Package:</span>
                                      <div>{getPackageDisplay(selectedVoucher.voucherInfo.packageType)}</div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Duration:</span>
                                      <div>{formatDuration(selectedVoucher.voucherInfo.duration)}</div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Data Limit:</span>
                                      <div>
                                        {selectedVoucher.voucherInfo.dataLimit > 0 
                                          ? formatDataUsage(selectedVoucher.voucherInfo.dataLimit)
                                          : "Unlimited"
                                        }
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Bandwidth:</span>
                                      <div>
                                        ↑{selectedVoucher.voucherInfo.bandwidth.upload}K / 
                                        ↓{selectedVoucher.voucherInfo.bandwidth.download}K
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Price:</span>
                                      <div>{formatCurrency(selectedVoucher.voucherInfo.price)}</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Payment Information */}
                                <div>
                                  <h4 className="font-medium mb-3">Payment Information</h4>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Method:</span>
                                      <div>{selectedVoucher.payment.method.toUpperCase()}</div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Amount:</span>
                                      <div>{formatCurrency(selectedVoucher.payment.amount)}</div>
                                    </div>
                                    {selectedVoucher.payment.phoneNumber && (
                                      <div>
                                        <span className="text-muted-foreground">Phone:</span>
                                        <div>{selectedVoucher.payment.phoneNumber}</div>
                                      </div>
                                    )}
                                    {selectedVoucher.payment.transactionId && (
                                      <div>
                                        <span className="text-muted-foreground">Transaction ID:</span>
                                        <div className="font-mono text-xs">{selectedVoucher.payment.transactionId}</div>
                                      </div>
                                    )}
                                    <div>
                                      <span className="text-muted-foreground">Commission:</span>
                                      <div>{formatCurrency(selectedVoucher.payment.commission)}</div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Payment Date:</span>
                                      <div>{new Date(selectedVoucher.payment.paymentDate).toLocaleString()}</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Usage Information */}
                                {selectedVoucher.usage.used && (
                                  <div>
                                    <h4 className="font-medium mb-3">Usage Information</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      {selectedVoucher.usage.userId && (
                                        <div>
                                          <span className="text-muted-foreground">User ID:</span>
                                          <div className="font-mono text-xs">{selectedVoucher.usage.userId}</div>
                                        </div>
                                      )}
                                      {selectedVoucher.usage.deviceMac && (
                                        <div>
                                          <span className="text-muted-foreground">Device MAC:</span>
                                          <div className="font-mono text-xs">{selectedVoucher.usage.deviceMac}</div>
                                        </div>
                                      )}
                                      {selectedVoucher.usage.startTime && (
                                        <div>
                                          <span className="text-muted-foreground">Start Time:</span>
                                          <div>{new Date(selectedVoucher.usage.startTime).toLocaleString()}</div>
                                        </div>
                                      )}
                                      {selectedVoucher.usage.endTime && (
                                        <div>
                                          <span className="text-muted-foreground">End Time:</span>
                                          <div>{new Date(selectedVoucher.usage.endTime).toLocaleString()}</div>
                                        </div>
                                      )}
                                      {selectedVoucher.usage.dataUsed && (
                                        <div>
                                          <span className="text-muted-foreground">Data Used:</span>
                                          <div>{formatDataUsage(selectedVoucher.usage.dataUsed)}</div>
                                        </div>
                                      )}
                                      {selectedVoucher.usage.timeUsed && (
                                        <div>
                                          <span className="text-muted-foreground">Time Used:</span>
                                          <div>{formatDuration(selectedVoucher.usage.timeUsed)}</div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Batch Information */}
                                {selectedVoucher.batch && (
                                  <div>
                                    <h4 className="font-medium mb-3">Batch Information</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">Batch ID:</span>
                                        <div className="font-mono text-xs">{selectedVoucher.batch.batchId}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Batch Size:</span>
                                        <div>{selectedVoucher.batch.batchSize} vouchers</div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Results Summary */}
          {filteredVouchers.length > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>
                Showing {filteredVouchers.length} voucher{filteredVouchers.length !== 1 ? 's' : ''}
                {(filters.status !== 'all' || filters.packageType !== 'all' || filters.dateRange !== 'all' || filters.search) && 
                  ` (filtered from ${stats.total} total)`
                }
              </div>
              <div>
                Total Value: {formatCurrency(
                  filteredVouchers.reduce((sum, v) => sum + v.voucherInfo.price, 0)
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}