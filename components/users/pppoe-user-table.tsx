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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import {
  CheckCircle,
  Edit,
  Eye,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Wifi,
  WifiOff,
} from "lucide-react"
import { formatDataUsage, formatCurrency, debounce } from "@/lib/utils"

// Types
interface PPPoEUser {
  _id: string
  userInfo: {
    username: string
    fullName?: string
    email?: string
    phone?: string
    address?: string
    idNumber?: string
  }
  service: {
    profile: string
    ipAddress?: string
    packageType: string
    bandwidth: {
      upload: number
      download: number
    }
    dataLimit: number
    price: number
    currency: string
  }
  billing: {
    billingCycle: string
    nextBillingDate: Date
    lastPaymentDate?: Date
    outstandingAmount: number
    gracePeriod: number
    autoDisconnect: boolean
  }
  usage: {
    currentMonth: {
      dataUsed: number
      timeUsed: number
      lastSession?: Date
    }
    history: Array<{
      month: string
      dataUsed: number
      timeUsed: number
      billingAmount: number
    }>
  }
  connection: {
    isOnline: boolean
    lastLogin?: Date
    sessionTime: number
    ipAddress?: string
    macAddress?: string
  }
  status: "active" | "suspended" | "terminated" | "grace_period"
  createdAt: Date
  updatedAt: Date
}

interface PPPoEUserTableProps {
  routerId: string
}

interface FilterOptions {
  status: string
  search: string
  connectionStatus: string
  billingStatus: string
}

interface UserStats {
  total: number
  online: number
  active: number
  suspended: number
  overdue: number
  totalDataUsage: number
  monthlyRevenue: number
}

// User status badge variant mapping
const getStatusVariant = (status: string): BadgeProps["variant"] => {
  switch (status) {
    case "active":
      return "default"
    case "suspended":
      return "secondary"
    case "terminated":
      return "destructive"
    case "grace_period":
      return "outline"
    default:
      return "outline"
  }
}

// Connection status variant mapping
const getConnectionVariant = (isOnline: boolean): BadgeProps["variant"] => {
  return isOnline ? "default" : "secondary"
}

export function PPPoEUserTable({ routerId }: PPPoEUserTableProps) {
  const { data: session } = useSession()
  const [users, setUsers] = useState<PPPoEUser[]>([])
  const [filteredUsers, setFilteredUsers] = useState<PPPoEUser[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterOptions>({
    status: "all",
    search: "",
    connectionStatus: "all",
    billingStatus: "all"
  })

  // Statistics
  const [stats, setStats] = useState<UserStats>({
    total: 0,
    online: 0,
    active: 0,
    suspended: 0,
    overdue: 0,
    totalDataUsage: 0,
    monthlyRevenue: 0
  })

  // Fetch PPPoE users
  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/routers/${routerId}/users/pppoe`, {
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch PPPoE users')
      }

      const data = await response.json()
      setUsers(data.users || [])
      setStats(data.stats || stats)
    } catch (error) {
      console.error('Error fetching PPPoE users:', error)
      toast.error('Failed to load PPPoE users')
    } finally {
      setLoading(false)
    }
  }

  // Filter users based on criteria
  const filterUsers = () => {
    let filtered = [...users]

    // Status filter
    if (filters.status !== "all") {
      filtered = filtered.filter(u => u.status === filters.status)
    }

    // Connection status filter
    if (filters.connectionStatus !== "all") {
      const isOnlineFilter = filters.connectionStatus === "online"
      filtered = filtered.filter(u => u.connection.isOnline === isOnlineFilter)
    }

    // Billing status filter
    if (filters.billingStatus !== "all") {
      if (filters.billingStatus === "overdue") {
        filtered = filtered.filter(u => u.billing.outstandingAmount > 0)
      } else if (filters.billingStatus === "current") {
        filtered = filtered.filter(u => u.billing.outstandingAmount === 0)
      }
    }

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      filtered = filtered.filter(u => 
        u.userInfo.username.toLowerCase().includes(searchTerm) ||
        u.userInfo.fullName?.toLowerCase().includes(searchTerm) ||
        u.userInfo.email?.toLowerCase().includes(searchTerm) ||
        u.userInfo.phone?.includes(searchTerm) ||
        u.connection.ipAddress?.includes(searchTerm) ||
        u.service.packageType.toLowerCase().includes(searchTerm)
      )
    }

    setFilteredUsers(filtered)
  }

  // Debounced search
  const debouncedSearch = debounce((searchTerm: string) => {
    setFilters(prev => ({ ...prev, search: searchTerm }))
  }, 300)

  // User actions
  const suspendUser = async (userId: string) => {
    try {
      setActionLoading(userId)
      const response = await fetch(`/api/routers/${routerId}/users/pppoe/${userId}/suspend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to suspend user')
      }

      toast.success('User suspended successfully')
      fetchUsers()
    } catch (error) {
      console.error('Error suspending user:', error)
      toast.error('Failed to suspend user')
    } finally {
      setActionLoading(null)
    }
  }

  const activateUser = async (userId: string) => {
    try {
      setActionLoading(userId)
      const response = await fetch(`/api/routers/${routerId}/users/pppoe/${userId}/activate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to activate user')
      }

      toast.success('User activated successfully')
      fetchUsers()
    } catch (error) {
      console.error('Error activating user:', error)
      toast.error('Failed to activate user')
    } finally {
      setActionLoading(null)
    }
  }

  const disconnectUser = async (userId: string) => {
    try {
      setActionLoading(userId)
      const response = await fetch(`/api/routers/${routerId}/users/pppoe/${userId}/disconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to disconnect user')
      }

      toast.success('User disconnected successfully')
      fetchUsers()
    } catch (error) {
      console.error('Error disconnecting user:', error)
      toast.error('Failed to disconnect user')
    } finally {
      setActionLoading(null)
    }
  }

  const deleteUser = async (userId: string) => {
    try {
      setActionLoading(userId)
      const response = await fetch(`/api/routers/${routerId}/users/pppoe/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete user')
      }

      toast.success('User deleted successfully')
      fetchUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Failed to delete user')
    } finally {
      setActionLoading(null)
    }
  }

  // Calculate data usage percentage
  const getDataUsagePercentage = (user: PPPoEUser): number => {
    if (user.service.dataLimit === 0) return 0
    return Math.min((user.usage.currentMonth.dataUsed / user.service.dataLimit) * 100, 100)
  }

  // Check if user is approaching data limit
  const isApproachingDataLimit = (user: PPPoEUser): boolean => {
    return getDataUsagePercentage(user) > 80
  }

  // Get days until next billing
  const getDaysUntilBilling = (user: PPPoEUser): number => {
    const now = new Date()
    const nextBilling = new Date(user.billing.nextBillingDate)
    const diffTime = nextBilling.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // Effects
  useEffect(() => {
    if (session && routerId) {
      fetchUsers()
    }
  }, [session, routerId])

  useEffect(() => {
    filterUsers()
  }, [users, filters])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
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
            <CardTitle>PPPoE Users</CardTitle>
            <CardDescription>
              Manage your PPPoE subscribers and monitor their usage
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={fetchUsers}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button asChild>
              <a href={`/routers/${routerId}/users/pppoe/add`}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </a>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.online}</div>
                <div className="text-sm text-muted-foreground">Online</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
                <div className="text-sm text-muted-foreground">Active</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.suspended}</div>
                <div className="text-sm text-muted-foreground">Suspended</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
                <div className="text-sm text-muted-foreground">Overdue</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-lg font-bold text-purple-600">
                  {formatCurrency(stats.monthlyRevenue)}
                </div>
                <div className="text-sm text-muted-foreground">Revenue</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
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
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
              <SelectItem value="grace_period">Grace Period</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.connectionStatus}
            onValueChange={(value) => setFilters(prev => ({ ...prev, connectionStatus: value }))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Connection" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.billingStatus}
            onValueChange={(value) => setFilters(prev => ({ ...prev, billingStatus: value }))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Billing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="current">Current</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Users Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Connection</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {users.length === 0 ? (
                      <div className="space-y-2">
                        <p>No PPPoE users found</p>
                        <Button asChild size="sm">
                          <a href={`/routers/${routerId}/users/pppoe/add`}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add First User
                          </a>
                        </Button>
                      </div>
                    ) : (
                      "No users match the current filters"
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell>
                      <div>
                        <div className="font-medium font-mono text-sm">{user.userInfo.username}</div>
                        <div className="text-sm text-muted-foreground">
                          {user.userInfo.fullName || user.userInfo.email || "No name"}
                        </div>
                        {user.userInfo.phone && (
                          <div className="text-xs text-muted-foreground">{user.userInfo.phone}</div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div>
                        <div className="font-medium">{user.service.packageType}</div>
                        <div className="text-sm text-muted-foreground">
                          ↓{user.service.bandwidth.download}K / ↑{user.service.bandwidth.upload}K
                        </div>
                        <div className="text-sm font-medium text-green-600">
                          {formatCurrency(user.service.price)}/mo
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={getStatusVariant(user.status)}>
                          {user.status.replace('_', ' ')}
                        </Badge>
                        {user.billing.outstandingAmount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            Overdue
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={getConnectionVariant(user.connection.isOnline)}>
                          {user.connection.isOnline ? (
                            <>
                              <Wifi className="h-3 w-3 mr-1" />
                              Online
                            </>
                          ) : (
                            <>
                              <WifiOff className="h-3 w-3 mr-1" />
                              Offline
                            </>
                          )}
                        </Badge>
                        {user.connection.ipAddress && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {user.connection.ipAddress}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {formatDataUsage(user.usage.currentMonth.dataUsed)}
                        </div>
                        {user.service.dataLimit > 0 && (
                          <div className="space-y-1">
                            <Progress 
                              value={getDataUsagePercentage(user)} 
                              className="h-1"
                            />
                            <div className="text-xs text-muted-foreground">
                              {getDataUsagePercentage(user).toFixed(0)}% of {formatDataUsage(user.service.dataLimit)}
                            </div>
                          </div>
                        )}
                        {isApproachingDataLimit(user) && (
                          <Badge variant="outline" className="text-xs text-orange-600">
                            Near Limit
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          {user.billing.outstandingAmount > 0 ? (
                            <span className="text-red-600 font-medium">
                              {formatCurrency(user.billing.outstandingAmount)}
                            </span>
                          ) : (
                            <span className="text-green-600">
                              <CheckCircle className="h-3 w-3 inline mr-1" />
                              Paid
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Next: {getDaysUntilBilling(user)}d
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm">
                        {user.connection.lastLogin ? (
                          <>
                            <div>{new Date(user.connection.lastLogin).toLocaleDateString()}</div>
                            <div className="text-muted-foreground text-xs">
                              {new Date(user.connection.lastLogin).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            disabled={actionLoading === user._id}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a href={`/routers/${routerId}/users/pppoe/${user._id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={`/routers/${routerId}/users/pppoe/${user._id}/edit`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit User
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          
                          {user.status === "active" ? (
                            <DropdownMenuItem 
                              onClick={() => suspendUser(user._id)}
                              disabled={actionLoading === user._id}
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem 
                              onClick={() => activateUser(user._id)}
                              disabled={actionLoading === user._id}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Activate
                            </DropdownMenuItem>
                          )}
                          
                          {user.connection.isOnline && (
                            <DropdownMenuItem 
                              onClick={() => disconnectUser(user._id)}
                              disabled={actionLoading === user._id}
                            >
                              <WifiOff className="h-4 w-4 mr-2" />
                              Disconnect
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                                <span className="text-red-500">Delete</span>
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete PPPoE User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete user "{user.userInfo.username}"? 
                                  This action cannot be undone and will remove all user data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUser(user._id)}
                                  className="bg-red-600 hover:bg-red-700"
                                  disabled={actionLoading === user._id}
                                >
                                  {actionLoading === user._id ? "Deleting..." : "Delete User"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
        {filteredUsers.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Showing {filteredUsers.length} of {users.length} PPPoE users
            </div>
            <div className="flex items-center gap-4">
              <div>
                Online: <span className="font-medium text-green-600">
                  {filteredUsers.filter(u => u.connection.isOnline).length}
                </span>
              </div>
              <div>
                Monthly Revenue: <span className="font-medium text-purple-600">
                  {formatCurrency(filteredUsers.reduce((sum, u) => sum + u.service.price, 0))}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}