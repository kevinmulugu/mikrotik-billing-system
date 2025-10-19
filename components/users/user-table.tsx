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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Edit,
  Eye,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserX,
  Wifi,
  WifiOff,
} from "lucide-react"
import { formatDataUsage, formatCurrency, debounce } from "@/lib/utils"

// Types
interface User {
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
  type: "hotspot" | "pppoe"
  createdAt: Date
  updatedAt: Date
}

interface UserTableProps {
  routerId: string
  userType?: "hotspot" | "pppoe" | "all"
}

interface FilterOptions {
  status: string
  type: string
  search: string
  connectionStatus: string
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

export function UserTable({ routerId, userType = "all" }: UserTableProps) {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [filters, setFilters] = useState<FilterOptions>({
    status: "all",
    type: userType === "all" ? "all" : userType,
    search: "",
    connectionStatus: "all"
  })

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    online: 0,
    active: 0,
    suspended: 0,
    totalDataUsage: 0,
    totalRevenue: 0
  })

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true)
      const endpoint = userType === "all" 
        ? `/api/routers/${routerId}/users`
        : `/api/routers/${routerId}/users/${userType}`
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const data = await response.json()
      setUsers(data.users || [])
      setStats(data.stats || stats)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to load users')
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

    // Type filter
    if (filters.type !== "all") {
      filtered = filtered.filter(u => u.type === filters.type)
    }

    // Connection status filter
    if (filters.connectionStatus !== "all") {
      const isOnlineFilter = filters.connectionStatus === "online"
      filtered = filtered.filter(u => u.connection.isOnline === isOnlineFilter)
    }

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      filtered = filtered.filter(u => 
        u.userInfo.username.toLowerCase().includes(searchTerm) ||
        u.userInfo.fullName?.toLowerCase().includes(searchTerm) ||
        u.userInfo.email?.toLowerCase().includes(searchTerm) ||
        u.userInfo.phone?.includes(searchTerm) ||
        u.connection.ipAddress?.includes(searchTerm)
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
      const response = await fetch(`/api/routers/${routerId}/users/${userId}/suspend`, {
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
    }
  }

  const activateUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/routers/${routerId}/users/${userId}/activate`, {
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
    }
  }

  const disconnectUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/routers/${routerId}/users/${userId}/disconnect`, {
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
    }
  }

  const deleteUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/routers/${routerId}/users/${userId}`, {
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
    }
  }

  // Effects
  useEffect(() => {
    if (session && routerId) {
      fetchUsers()
    }
  }, [session, routerId, userType])

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
            <CardTitle>
              {userType === "all" ? "All Users" : `${userType.toUpperCase()} Users`}
            </CardTitle>
            <CardDescription>
              Manage your internet users and monitor their usage
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={fetchUsers}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">Total Users</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">Online</div>
            <div className="text-2xl font-bold text-green-600">{stats.online}</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">Data Usage</div>
            <div className="text-2xl font-bold">{formatDataUsage(stats.totalDataUsage)}</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">Revenue</div>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
          </div>
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

          {userType === "all" && (
            <Select
              value={filters.type}
              onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="hotspot">Hotspot</SelectItem>
                <SelectItem value="pppoe">PPPoE</SelectItem>
              </SelectContent>
            </Select>
          )}

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
        </div>

        {/* Users Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Connection</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {users.length === 0 ? "No users found" : "No users match the current filters"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.userInfo.username}</div>
                        <div className="text-sm text-muted-foreground">
                          {user.userInfo.fullName || user.userInfo.email || "No name"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {user.type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.service.packageType}</div>
                        <div className="text-sm text-muted-foreground">
                          {user.service.bandwidth.download}K/
                          {user.service.bandwidth.upload}K
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(user.status)}>
                        {user.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
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
                      </div>
                      {user.connection.ipAddress && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {user.connection.ipAddress}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{formatDataUsage(user.usage.currentMonth.dataUsed)}</div>
                        <div className="text-muted-foreground">
                          {Math.floor(user.usage.currentMonth.timeUsed / 60)}h {user.usage.currentMonth.timeUsed % 60}m
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{formatCurrency(user.service.price)}</div>
                        {user.billing.outstandingAmount > 0 && (
                          <div className="text-red-600 text-xs">
                            Due: {formatCurrency(user.billing.outstandingAmount)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit User
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          
                          {user.status === "active" ? (
                            <DropdownMenuItem onClick={() => suspendUser(user._id)}>
                              <Pause className="h-4 w-4 mr-2" />
                              Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => activateUser(user._id)}>
                              <Play className="h-4 w-4 mr-2" />
                              Activate
                            </DropdownMenuItem>
                          )}
                          
                          {user.connection.isOnline && (
                            <DropdownMenuItem onClick={() => disconnectUser(user._id)}>
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
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
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
                                >
                                  Delete User
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
              Showing {filteredUsers.length} of {users.length} users
            </div>
            <div>
              Monthly Revenue: {formatCurrency(
                filteredUsers.reduce((sum, u) => sum + u.service.price, 0)
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* User Details Dialog */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>User Details - {selectedUser.userInfo.username}</DialogTitle>
              <DialogDescription>
                Complete information for {selectedUser.type} user
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* User Information */}
              <div>
                <h4 className="font-medium mb-3">User Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Username:</span>
                    <div className="font-medium">{selectedUser.userInfo.username}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Full Name:</span>
                    <div>{selectedUser.userInfo.fullName || "Not provided"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <div>{selectedUser.userInfo.email || "Not provided"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <div>{selectedUser.userInfo.phone || "Not provided"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Address:</span>
                    <div>{selectedUser.userInfo.address || "Not provided"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ID Number:</span>
                    <div>{selectedUser.userInfo.idNumber || "Not provided"}</div>
                  </div>
                </div>
              </div>

              {/* Service Information */}
              <div>
                <h4 className="font-medium mb-3">Service Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Package:</span>
                    <div>{selectedUser.service.packageType}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Profile:</span>
                    <div>{selectedUser.service.profile}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Bandwidth:</span>
                    <div>
                      ↓{selectedUser.service.bandwidth.download}K / 
                      ↑{selectedUser.service.bandwidth.upload}K
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data Limit:</span>
                    <div>
                      {selectedUser.service.dataLimit > 0 
                        ? formatDataUsage(selectedUser.service.dataLimit)
                        : "Unlimited"
                      }
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Price:</span>
                    <div>{formatCurrency(selectedUser.service.price)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">IP Address:</span>
                    <div className="font-mono">
                      {selectedUser.service.ipAddress || "Dynamic"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Connection Status */}
              <div>
                <h4 className="font-medium mb-3">Connection Status</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div>
                      <Badge variant={getConnectionVariant(selectedUser.connection.isOnline)}>
                        {selectedUser.connection.isOnline ? "Online" : "Offline"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Session Time:</span>
                    <div>
                      {Math.floor(selectedUser.connection.sessionTime / 60)}h {selectedUser.connection.sessionTime % 60}m
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Current IP:</span>
                    <div className="font-mono">
                      {selectedUser.connection.ipAddress || "Not assigned"}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">MAC Address:</span>
                    <div className="font-mono text-xs">
                      {selectedUser.connection.macAddress || "Unknown"}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Login:</span>
                    <div>
                      {selectedUser.connection.lastLogin 
                        ? new Date(selectedUser.connection.lastLogin).toLocaleString()
                        : "Never"
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Billing Information */}
              <div>
                <h4 className="font-medium mb-3">Billing Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Billing Cycle:</span>
                    <div>{selectedUser.billing.billingCycle}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Next Billing:</span>
                    <div>{new Date(selectedUser.billing.nextBillingDate).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Payment:</span>
                    <div>
                      {selectedUser.billing.lastPaymentDate 
                        ? new Date(selectedUser.billing.lastPaymentDate).toLocaleDateString()
                        : "No payments"
                      }
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Outstanding:</span>
                    <div className={selectedUser.billing.outstandingAmount > 0 ? "text-red-600" : ""}>
                      {formatCurrency(selectedUser.billing.outstandingAmount)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Grace Period:</span>
                    <div>{selectedUser.billing.gracePeriod} days</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Auto Disconnect:</span>
                    <div>{selectedUser.billing.autoDisconnect ? "Enabled" : "Disabled"}</div>
                  </div>
                </div>
              </div>

              {/* Usage Statistics */}
              <div>
                <h4 className="font-medium mb-3">Usage Statistics</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Data Used (This Month):</span>
                    <div>{formatDataUsage(selectedUser.usage.currentMonth.dataUsed)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Time Used (This Month):</span>
                    <div>
                      {Math.floor(selectedUser.usage.currentMonth.timeUsed / 60)}h {selectedUser.usage.currentMonth.timeUsed % 60}m
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Session:</span>
                    <div>
                      {selectedUser.usage.currentMonth.lastSession 
                        ? new Date(selectedUser.usage.currentMonth.lastSession).toLocaleString()
                        : "No sessions"
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedUser(null)}>
                Close
              </Button>
              <Button onClick={() => {
                // Navigate to edit user page
                window.location.href = `/routers/${routerId}/users/${selectedUser.type}/${selectedUser._id}/edit`
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Edit User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
    </Card>
  )
}