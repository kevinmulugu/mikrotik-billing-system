// src/components/vouchers/voucher-list.tsx
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
import { Badge, BadgeProps } from "@/components/ui/badge"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Copy,
  Eye,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Types
interface Voucher {
  _id: string
  voucherInfo: {
    code: string
    password: string
    packageType: string
    packageDisplayName?: string
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
  expiry: {
    expiresAt: Date
    autoDelete: boolean
  }
  status: "active" | "paid" | "used" | "expired" | "cancelled"
  createdAt: Date
  updatedAt: Date
}

interface Package {
  name: string
  displayName: string
  price: number
  duration: number
}

interface VoucherListProps {
  routerId: string
  filterStatus?: string
}

// Voucher status badge variant mapping
const getStatusVariant = (status: string): BadgeProps["variant"] => {
  switch (status) {
    case "active":
      return "default"
    case "paid":
      return "secondary"
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

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount)
}

// Format duration
const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} minutes`
  if (minutes < 1440) {
    const hours = minutes / 60
    return hours === 1 ? '1 hour' : `${hours} hours`
  }
  if (minutes < 10080) {
    const days = minutes / 1440
    return days === 1 ? '1 day' : `${days} days`
  }
  const weeks = minutes / 10080
  return weeks === 1 ? '1 week' : `${weeks} weeks`
}

// Format data usage
const formatDataUsage = (bytes: number) => {
  if (bytes === 0) return 'Unlimited'
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) return `${mb.toFixed(0)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(2)} GB`
}

export function VoucherList({ routerId, filterStatus = "all" }: VoucherListProps) {
  const { data: session } = useSession()
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null)
  const [filters, setFilters] = useState({
    status: filterStatus,
    packageType: "all",
    search: ""
  })

  // Fetch vouchers
  const fetchVouchers = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        status: filters.status,
        packageType: filters.packageType,
        search: filters.search,
        limit: '100'
      })

      const response = await fetch(`/api/routers/${routerId}/vouchers?${params}`, {
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch vouchers')
      }

      const data = await response.json()
      setVouchers(data.vouchers || [])
    } catch (error) {
      console.error('Error fetching vouchers:', error)
      toast.error('Failed to load vouchers')
    } finally {
      setLoading(false)
    }
  }

  // Fetch router packages for filter options
  const fetchPackages = async () => {
    try {
      const response = await fetch(`/api/routers/${routerId}`, {
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch router packages')
      }

      const data = await response.json()
      setPackages(data.router?.packages?.hotspot || [])
    } catch (error) {
      console.error('Error fetching packages:', error)
    }
  }

  // Copy voucher code to clipboard
  const copyVoucherCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Voucher code copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy voucher code')
    }
  }

  // Cancel voucher
  const cancelVoucher = async (voucherId: string) => {
    try {
      const response = await fetch(
        `/api/routers/${routerId}/vouchers/${voucherId}/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.user?.id}`,
          },
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to cancel voucher')
      }

      const data = await response.json()
      
      if (data.mikrotikSync?.error) {
        toast.warning(
          `Voucher cancelled but sync failed: ${data.mikrotikSync.error}`
        )
      } else {
        toast.success('Voucher cancelled successfully')
      }
      
      fetchVouchers()
    } catch (error) {
      console.error('Error cancelling voucher:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to cancel voucher')
    }
  }

  // Check if voucher is expired (considering all expiry types)
  const isExpired = (voucher: Voucher): boolean => {
    const now = new Date()
    
    // Check activation expiry (for unpurchased vouchers)
    if (voucher.expiry.expiresAt && new Date(voucher.expiry.expiresAt) < now) {
      return true
    }
    
    // Check purchase expiry (for time-after-purchase vouchers)
    if (voucher.usage?.purchaseExpiresAt && new Date(voucher.usage.purchaseExpiresAt) < now) {
      return true
    }
    
    // Check usage expiry (for active sessions)
    if (voucher.usage?.expectedEndTime && new Date(voucher.usage.expectedEndTime) < now) {
      return true
    }
    
    return false
  }

  // Effects
  useEffect(() => {
    if (session && routerId) {
      fetchVouchers()
      fetchPackages()
    }
  }, [session, routerId])

  useEffect(() => {
    if (session && routerId) {
      fetchVouchers()
    }
  }, [filters])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle>Vouchers</CardTitle>
            <CardDescription>
              Manage your generated vouchers and track their usage
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={fetchVouchers}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, phone, or transaction..."
                className="pl-9"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
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
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Package" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Packages</SelectItem>
              {packages.map(pkg => (
                <SelectItem key={pkg.name} value={pkg.name}>
                  {pkg.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Vouchers Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher Code</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vouchers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No vouchers found
                  </TableCell>
                </TableRow>
              ) : (
                vouchers.map((voucher) => (
                  <TableRow key={voucher._id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{voucher.voucherInfo.code}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyVoucherCode(voucher.voucherInfo.code)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {voucher.voucherInfo.packageDisplayName || voucher.voucherInfo.packageType}
                        </div>
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
                        {isExpired(voucher) && voucher.status === 'active' && ' (Expired)'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{new Date(voucher.expiry.expiresAt).toLocaleDateString()}</div>
                        <div className="text-muted-foreground">
                          {new Date(voucher.expiry.expiresAt).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {voucher.usage.used ? (
                        <div className="text-sm">
                          <div className="text-green-600">Used</div>
                          {voucher.usage.dataUsed && voucher.usage.dataUsed > 0 && (
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedVoucher(voucher)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyVoucherCode(voucher.voucherInfo.code)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Code
                          </DropdownMenuItem>
                          {voucher.status === 'active' && !voucher.usage.used && (
                            <>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                                    <span className="text-red-500">Cancel Voucher</span>
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancel Voucher</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to cancel voucher {voucher.voucherInfo.code}? 
                                      This action cannot be undone and the voucher will no longer be usable.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Keep Voucher</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => cancelVoucher(voucher._id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Cancel Voucher
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Results Summary */}
        {vouchers.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Showing {vouchers.length} vouchers
            </div>
            <div>
              Total Value: {formatCurrency(
                vouchers.reduce((sum, v) => sum + v.voucherInfo.price, 0)
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Voucher Details Dialog */}
      {selectedVoucher && (
        <Dialog open={!!selectedVoucher} onOpenChange={() => setSelectedVoucher(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Voucher Details</DialogTitle>
              <DialogDescription>
                Complete information for voucher {selectedVoucher.voucherInfo.code}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Voucher Information */}
              <div>
                <h4 className="font-medium mb-3">Voucher Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Code:</span>
                    <div className="font-mono font-medium flex items-center gap-2">
                      {selectedVoucher.voucherInfo.code}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyVoucherCode(selectedVoucher.voucherInfo.code)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Password:</span>
                    <div className="font-mono">{selectedVoucher.voucherInfo.password}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Package:</span>
                    <div>
                      {selectedVoucher.voucherInfo.packageDisplayName || 
                       selectedVoucher.voucherInfo.packageType}
                    </div>
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
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div>
                      <Badge variant={getStatusVariant(selectedVoucher.status)}>
                        {selectedVoucher.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

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

              {/* Expiry Information */}
              <div>
                <h4 className="font-medium mb-3">Expiry Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Expires At:</span>
                    <div>{new Date(selectedVoucher.expiry.expiresAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Auto Delete:</span>
                    <div>{selectedVoucher.expiry.autoDelete ? "Yes" : "No"}</div>
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
                    {selectedVoucher.usage.dataUsed && selectedVoucher.usage.dataUsed > 0 && (
                      <div>
                        <span className="text-muted-foreground">Data Used:</span>
                        <div>{formatDataUsage(selectedVoucher.usage.dataUsed)}</div>
                      </div>
                    )}
                    {selectedVoucher.usage.timeUsed && selectedVoucher.usage.timeUsed > 0 && (
                      <div>
                        <span className="text-muted-foreground">Time Used:</span>
                        <div>{formatDuration(selectedVoucher.usage.timeUsed)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Information */}
              {selectedVoucher.payment.transactionId && (
                <div>
                  <h4 className="font-medium mb-3">Payment Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Method:</span>
                      <div className="uppercase">{selectedVoucher.payment.method}</div>
                    </div>
                    {selectedVoucher.payment.phoneNumber && (
                      <div>
                        <span className="text-muted-foreground">Phone Number:</span>
                        <div>{selectedVoucher.payment.phoneNumber}</div>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Transaction ID:</span>
                      <div className="font-mono text-xs">{selectedVoucher.payment.transactionId}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Amount:</span>
                      <div>{formatCurrency(selectedVoucher.payment.amount)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Commission:</span>
                      <div className="text-green-600">
                        {formatCurrency(selectedVoucher.payment.commission)}
                      </div>
                    </div>
                    {selectedVoucher.payment.paymentDate && (
                      <div>
                        <span className="text-muted-foreground">Payment Date:</span>
                        <div>{new Date(selectedVoucher.payment.paymentDate).toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div>
                <h4 className="font-medium mb-3">Timestamps</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <div>{new Date(selectedVoucher.createdAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Updated:</span>
                    <div>{new Date(selectedVoucher.updatedAt).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedVoucher(null)}>
                Close
              </Button>
              <Button onClick={() => copyVoucherCode(selectedVoucher.voucherInfo.code)}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Code
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}