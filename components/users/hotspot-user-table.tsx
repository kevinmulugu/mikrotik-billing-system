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
import { Progress } from "@/components/ui/progress"
import {
  Clock,
  Eye,
  Globe,
  HardDrive,
  MoreHorizontal,
  RefreshCw,
  Router,
  Search,
  Ticket,
  Trash2,
  UserX,
  Wifi,
  WifiOff,
} from "lucide-react"
import { formatDataUsage, formatCurrency, formatDuration, debounce } from "@/lib/utils"

// Types
interface HotspotUser {
  _id: string
  sessionInfo: {
    username: string
    macAddress: string
    ipAddress: string
    sessionId: string
    loginTime: Date
    sessionTime: number
    idleTime: number
    callingStationId: string
  }
  voucherInfo?: {
    code: string
    packageType: string
    duration: number
    dataLimit: number
    price: number
    expiresAt: Date
  }
  usage: {
    dataUsed: number
    timeUsed: number
    bytesIn: number
    bytesOut: number
    packetsIn: number
    packetsOut: number
  }
  bandwidth: {
    upload: number
    download: number
    uploadLimit: number
    downloadLimit: number
  }
  status: "active" | "idle" | "expired" | "terminated"
  connection: {
    isOnline: boolean
    signalStrength?: number
    connectionType: "wifi" | "ethernet"
    userAgent?: string
  }
  location?: {
    coordinates?: {
      latitude: number
      longitude: number
    }
    address?: string
  }
  createdAt: Date
  updatedAt: Date
}

interface HotspotUserTableProps {
  routerId: string
}

interface FilterOptions {
  status: string
  search: string
  connectionStatus: string
  sessionType: string
}

interface UserStats {
  total: number
  online: number
  active: number
  idle: number
  totalDataUsage: number
  totalSessionTime: number
  revenue: number
}

// User status badge variant mapping
const getStatusVariant = (status: string): BadgeProps["variant"] => {
  switch (status) {
    case "active":
      return "default"
    case "idle":
      return "secondary"
    case "expired":
      return "destructive"
    case "terminated":
      return "outline"
    default:
      return "outline"
  }
}

// Connection status variant mapping
const getConnectionVariant = (isOnline: boolean): BadgeProps["variant"] => {
  return isOnline ? "default" : "secondary"
}

export function HotspotUserTable({ routerId }: HotspotUserTableProps) {
  const { data: session } = useSession()
  const [users, setUsers] = useState<HotspotUser[]>([])
  const [filteredUsers, setFilteredUsers] = useState<HotspotUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<HotspotUser | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterOptions>({
    status: "all",
    search: "",
    connectionStatus: "all",
    sessionType: "all"
  })

  // Statistics
  const [stats, setStats] = useState<UserStats>({
    total: 0,
    online: 0,
    active: 0,
    idle: 0,
    totalDataUsage: 0,
    totalSessionTime: 0,
    revenue: 0
  })

  // Fetch hotspot users
  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/routers/${routerId}/users/hotspot`, {
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch hotspot users')
      }

      const data = await response.json()
      setUsers(data.users || [])
      setStats(data.stats || stats)
    } catch (error) {
      console.error('Error fetching hotspot users:', error)
      toast.error('Failed to load hotspot users')
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

    // Session type filter
    if (filters.sessionType !== "all") {
      if (filters.sessionType === "voucher") {
        filtered = filtered.filter(u => u.voucherInfo !== undefined)
      } else if (filters.sessionType === "direct") {
        filtered = filtered.filter(u => u.voucherInfo === undefined)
      }
    }

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      filtered = filtered.filter(u => 
        u.sessionInfo.username.toLowerCase().includes(searchTerm) ||
        u.sessionInfo.macAddress.toLowerCase().includes(searchTerm) ||
        u.sessionInfo.ipAddress.includes(searchTerm) ||
        u.voucherInfo?.code.toLowerCase().includes(searchTerm) ||
        u.sessionInfo.callingStationId.toLowerCase().includes(searchTerm)
      )
    }

    setFilteredUsers(filtered)
  }

  // Debounced search
  const debouncedSearch = debounce((searchTerm: string) => {
    setFilters(prev => ({ ...prev, search: searchTerm }))
  }, 300)

  // User actions
  const disconnectUser = async (userId: string) => {
    try {
      setActionLoading(userId)
      const response = await fetch(`/api/routers/${routerId}/users/hotspot/${userId}/disconnect`, {
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

  const blockUser = async (userId: string) => {
    try {
      setActionLoading(userId)
      const response = await fetch(`/api/routers/${routerId}/users/hotspot/${userId}/block`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to block user')
      }

      toast.success('User blocked successfully')
      fetchUsers()
    } catch (error) {
      console.error('Error blocking user:', error)
      toast.error('Failed to block user')
    } finally {
      setActionLoading(null)
    }
  }

  const removeUser = async (userId: string) => {
    try {
      setActionLoading(userId)
      const response = await fetch(`/api/routers/${routerId}/users/hotspot/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to remove user')
      }

      toast.success('User removed successfully')
      fetchUsers()
    } catch (error) {
      console.error('Error removing user:', error)
      toast.error('Failed to remove user')
    } finally {
      setActionLoading(null)
    }
  }

  // Calculate session progress for voucher users
  const getSessionProgress = (user: HotspotUser): number => {
    if (!user.voucherInfo) return 0
    return Math.min((user.usage.timeUsed / user.voucherInfo.duration) * 100, 100)
  }

  // Calculate data usage progress for voucher users
  const getDataProgress = (user: HotspotUser): number => {
    if (!user.voucherInfo || user.voucherInfo.dataLimit === 0) return 0
    return Math.min((user.usage.dataUsed / user.voucherInfo.dataLimit) * 100, 100)
  }

  // Check if user is approaching limits
  const isApproachingLimits = (user: HotspotUser): boolean => {
    if (!user.voucherInfo) return false
    const timeProgress = getSessionProgress(user)
    const dataProgress = getDataProgress(user)
    return timeProgress > 80 || dataProgress > 80
  }

  // Format session time
  const formatSessionTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  // Effects
  useEffect(() => {
    if (session && routerId) {
      fetchUsers()
      // Set up auto-refresh every 30 seconds for real-time data
      const interval = setInterval(fetchUsers, 30000)
      return () => clearInterval(interval)
    }
    return undefined
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
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Hotspot Users</CardTitle>
              <CardDescription>
                Monitor active hotspot sessions and voucher usage in real-time
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

        <CardContent className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-sm text-muted-foreground">Total Sessions</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.online}</div>
                  <div className="text-sm text-muted-foreground">Online Now</div>
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
                  <div className="text-2xl font-bold text-orange-600">{stats.idle}</div>
                  <div className="text-sm text-muted-foreground">Idle</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-lg font-bold">{formatDataUsage(stats.totalDataUsage)}</div>
                  <div className="text-sm text-muted-foreground">Data Used</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">
                    {formatCurrency(stats.revenue)}
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
                  placeholder="Search by username, MAC, IP, voucher code..."
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
                <SelectItem value="idle">Idle</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
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
              value={filters.sessionType}
              onValueChange={(value) => setFilters(prev => ({ ...prev, sessionType: value }))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="voucher">Voucher</SelectItem>
                <SelectItem value="direct">Direct</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Session Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Connection</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Session Time</TableHead>
                  <TableHead>Data Transfer</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {users.length === 0 ? "No active hotspot sessions" : "No users match the current filters"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user._id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.sessionInfo.username}</div>
                          <div className="text-sm text-muted-foreground font-mono">
                            {user.sessionInfo.macAddress}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {user.sessionInfo.ipAddress}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {user.voucherInfo ? (
                          <div>
                            <div className="flex items-center gap-1">
                              <Ticket className="h-3 w-3" />
                              <Badge variant="outline">{user.voucherInfo.code}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {user.voucherInfo.packageType}
                            </div>
                            <div className="text-sm font-medium text-green-600">
                              {formatCurrency(user.voucherInfo.price)}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <Badge variant="secondary">Direct Access</Badge>
                            <div className="text-sm text-muted-foreground">No voucher</div>
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant={getStatusVariant(user.status)}>
                            {user.status}
                          </Badge>
                          {isApproachingLimits(user) && (
                            <Badge variant="outline" className="text-xs text-orange-600">
                              Near Limit
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
                          {user.connection.signalStrength && (
                            <div className="text-xs text-muted-foreground">
                              Signal: {user.connection.signalStrength}%
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {user.connection.connectionType}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {formatDataUsage(user.usage.dataUsed)}
                          </div>
                          {user.voucherInfo && user.voucherInfo.dataLimit > 0 && (
                            <div className="space-y-1">
                              <Progress 
                                value={getDataProgress(user)} 
                                className="h-1"
                              />
                              <div className="text-xs text-muted-foreground">
                                {getDataProgress(user).toFixed(0)}% of {formatDataUsage(user.voucherInfo.dataLimit)}
                              </div>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            ↓{formatDataUsage(user.usage.bytesIn)} ↑{formatDataUsage(user.usage.bytesOut)}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {formatSessionTime(user.usage.timeUsed)}
                          </div>
                          {user.voucherInfo && (
                            <div className="space-y-1">
                              <Progress 
                                value={getSessionProgress(user)} 
                                className="h-1"
                              />
                              <div className="text-xs text-muted-foreground">
                                {getSessionProgress(user).toFixed(0)}% of {formatDuration(user.voucherInfo.duration)}
                              </div>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Idle: {formatSessionTime(user.sessionInfo.idleTime)}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">
                          <div>↓ {user.bandwidth.download} Kbps</div>
                          <div>↑ {user.bandwidth.upload} Kbps</div>
                          <div className="text-xs text-muted-foreground">
                            Started: {new Date(user.sessionInfo.loginTime).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>
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
                            <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            
                            {user.connection.isOnline && (
                              <DropdownMenuItem 
                                onClick={() => disconnectUser(user._id)}
                                disabled={actionLoading === user._id}
                              >
                                <WifiOff className="h-4 w-4 mr-2" />
                                Disconnect
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuItem 
                              onClick={() => blockUser(user._id)}
                              disabled={actionLoading === user._id}
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Block User
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                                  <span className="text-red-500">Remove Session</span>
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove User Session</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove session for "{user.sessionInfo.username}"? 
                                    This will terminate their connection and clear session data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => removeUser(user._id)}
                                    className="bg-red-600 hover:bg-red-700"
                                    disabled={actionLoading === user._id}
                                  >
                                    {actionLoading === user._id ? "Removing..." : "Remove Session"}
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
                Showing {filteredUsers.length} of {users.length} sessions
              </div>
              <div className="flex items-center gap-4">
                <div>
                  Online: <span className="font-medium text-green-600">
                    {filteredUsers.filter(u => u.connection.isOnline).length}
                  </span>
                </div>
                <div>
                  Data Used: <span className="font-medium text-blue-600">
                    {formatDataUsage(filteredUsers.reduce((sum, u) => sum + u.usage.dataUsed, 0))}
                  </span>
                </div>
                <div>
                  Revenue: <span className="font-medium text-purple-600">
                    {formatCurrency(filteredUsers.reduce((sum, u) => sum + (u.voucherInfo?.price || 0), 0))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Hotspot Session Details</DialogTitle>
              <DialogDescription>
                Complete session information for {selectedUser.sessionInfo.username}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Session Information */}
              <div>
                <h4 className="font-medium mb-3">Session Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Username:</span>
                    <div className="font-medium">{selectedUser.sessionInfo.username}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Session ID:</span>
                    <div className="font-mono text-xs">{selectedUser.sessionInfo.sessionId}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">MAC Address:</span>
                    <div className="font-mono">{selectedUser.sessionInfo.macAddress}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">IP Address:</span>
                    <div className="font-mono">{selectedUser.sessionInfo.ipAddress}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Login Time:</span>
                    <div>{new Date(selectedUser.sessionInfo.loginTime).toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Session Duration:</span>
                    <div>{formatSessionTime(selectedUser.sessionInfo.sessionTime)}</div>
                  </div>
                </div>
              </div>

              {/* Voucher Information */}
              {selectedUser.voucherInfo && (
                <div>
                  <h4 className="font-medium mb-3">Voucher Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Voucher Code:</span>
                      <div className="font-mono font-medium">{selectedUser.voucherInfo.code}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Package Type:</span>
                      <div>{selectedUser.voucherInfo.packageType}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <div>{formatDuration(selectedUser.voucherInfo.duration)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data Limit:</span>
                      <div>
                        {selectedUser.voucherInfo.dataLimit > 0 
                          ? formatDataUsage(selectedUser.voucherInfo.dataLimit)
                          : "Unlimited"
                        }
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Price:</span>
                      <div className="font-medium text-green-600">
                        {formatCurrency(selectedUser.voucherInfo.price)}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expires At:</span>
                      <div>{new Date(selectedUser.voucherInfo.expiresAt).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Usage Statistics */}
              <div>
                <h4 className="font-medium mb-3">Usage Statistics</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Data Used:</span>
                    <div className="font-medium">{formatDataUsage(selectedUser.usage.dataUsed)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Time Used:</span>
                    <div className="font-medium">{formatSessionTime(selectedUser.usage.timeUsed)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data Downloaded:</span>
                    <div>{formatDataUsage(selectedUser.usage.bytesIn)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data Uploaded:</span>
                    <div>{formatDataUsage(selectedUser.usage.bytesOut)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Packets In:</span>
                    <div>{selectedUser.usage.packetsIn.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Packets Out:</span>
                    <div>{selectedUser.usage.packetsOut.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Connection Details */}
              <div>
                <h4 className="font-medium mb-3">Connection Details</h4>
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
                    <span className="text-muted-foreground">Connection Type:</span>
                    <div className="capitalize">{selectedUser.connection.connectionType}</div>
                  </div>
                  {selectedUser.connection.signalStrength && (
                    <div>
                      <span className="text-muted-foreground">Signal Strength:</span>
                      <div>{selectedUser.connection.signalStrength}%</div>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Calling Station ID:</span>
                    <div className="font-mono text-xs">{selectedUser.sessionInfo.callingStationId}</div>
                  </div>
                </div>
              </div>

              {/* Bandwidth Information */}
              <div>
                <h4 className="font-medium mb-3">Bandwidth Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Current Upload:</span>
                    <div className="font-medium">{selectedUser.bandwidth.upload} Kbps</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Current Download:</span>
                    <div className="font-medium">{selectedUser.bandwidth.download} Kbps</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Upload Limit:</span>
                    <div>{selectedUser.bandwidth.uploadLimit} Kbps</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Download Limit:</span>
                    <div>{selectedUser.bandwidth.downloadLimit} Kbps</div>
                  </div>
                </div>
              </div>

              {/* User Agent */}
              {selectedUser.connection.userAgent && (
                <div>
                  <h4 className="font-medium mb-3">Device Information</h4>
                  <div className="text-sm">
                    <span className="text-muted-foreground">User Agent:</span>
                    <div className="font-mono text-xs bg-muted p-2 rounded mt-1">
                      {selectedUser.connection.userAgent}
                    </div>
                  </div>
                </div>
              )}

              {/* Location Information */}
              {selectedUser.location && (
                <div>
                  <h4 className="font-medium mb-3">Location Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {selectedUser.location.coordinates && (
                      <>
                        <div>
                          <span className="text-muted-foreground">Latitude:</span>
                          <div>{selectedUser.location.coordinates.latitude}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Longitude:</span>
                          <div>{selectedUser.location.coordinates.longitude}</div>
                        </div>
                      </>
                    )}
                    {selectedUser.location.address && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Address:</span>
                        <div>{selectedUser.location.address}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Progress Indicators */}
              {selectedUser.voucherInfo && (
                <div>
                  <h4 className="font-medium mb-3">Session Progress</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Time Usage</span>
                        <span>{getSessionProgress(selectedUser).toFixed(1)}%</span>
                      </div>
                      <Progress value={getSessionProgress(selectedUser)} className="h-2" />
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatSessionTime(selectedUser.usage.timeUsed)} of {formatDuration(selectedUser.voucherInfo.duration)}
                      </div>
                    </div>
                    
                    {selectedUser.voucherInfo.dataLimit > 0 && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Data Usage</span>
                          <span>{getDataProgress(selectedUser).toFixed(1)}%</span>
                        </div>
                        <Progress value={getDataProgress(selectedUser)} className="h-2" />
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDataUsage(selectedUser.usage.dataUsed)} of {formatDataUsage(selectedUser.voucherInfo.dataLimit)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <div className="flex gap-2">
                {selectedUser.connection.isOnline && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      disconnectUser(selectedUser._id)
                      setSelectedUser(null)
                    }}
                  >
                    <WifiOff className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => {
                    blockUser(selectedUser._id)
                    setSelectedUser(null)
                  }}
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Block User
                </Button>
                <Button variant="outline" onClick={() => setSelectedUser(null)}>
                  Close
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}