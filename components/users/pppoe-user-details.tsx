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
  Badge,
  BadgeProps,
} from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Activity,
  Calendar,
  Clock,
  CreditCard,
  Edit,
  Globe,
  History,
  Mail,
  Pause,
  Phone,
  Play,
  RefreshCw,
  Router,
  Trash2,
  User,
  Wifi,
  WifiOff,
} from "lucide-react"
import { formatDataUsage, formatCurrency, formatDuration } from "@/lib/utils"

// Types
interface PPPoEUser {
  _id: string
  routerId: string
  customerId: string
  userInfo: {
    username: string
    password: string
    fullName: string
    email: string
    phone: string
    address: string
    idNumber: string
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

interface PPPoEUserDetailsProps {
  userId: string
  routerId: string
  onUserUpdated?: () => void
  onUserDeleted?: () => void
}

// Status badge variant mapping
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

export function PPPoEUserDetails({ userId, routerId, onUserUpdated, onUserDeleted }: PPPoEUserDetailsProps) {
  const { data: session } = useSession()
  const [user, setUser] = useState<PPPoEUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Fetch user details
  const fetchUserDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/routers/${routerId}/users/pppoe/${userId}`, {
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch user details')
      }

      const data = await response.json()
      setUser(data.user)
    } catch (error) {
      console.error('Error fetching user details:', error)
      toast.error('Failed to load user details')
    } finally {
      setLoading(false)
    }
  }

  // User actions
  const suspendUser = async () => {
    try {
      setActionLoading(true)
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
      fetchUserDetails()
      onUserUpdated?.()
    } catch (error) {
      console.error('Error suspending user:', error)
      toast.error('Failed to suspend user')
    } finally {
      setActionLoading(false)
    }
  }

  const activateUser = async () => {
    try {
      setActionLoading(true)
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
      fetchUserDetails()
      onUserUpdated?.()
    } catch (error) {
      console.error('Error activating user:', error)
      toast.error('Failed to activate user')
    } finally {
      setActionLoading(false)
    }
  }

  const disconnectUser = async () => {
    try {
      setActionLoading(true)
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
      fetchUserDetails()
      onUserUpdated?.()
    } catch (error) {
      console.error('Error disconnecting user:', error)
      toast.error('Failed to disconnect user')
    } finally {
      setActionLoading(false)
    }
  }

  const deleteUser = async () => {
    try {
      setActionLoading(true)
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
      onUserDeleted?.()
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Failed to delete user')
    } finally {
      setActionLoading(false)
    }
  }

  // Calculate data usage percentage
  const getDataUsagePercentage = (): number => {
    if (!user || user.service.dataLimit === 0) return 0
    return Math.min((user.usage.currentMonth.dataUsed / user.service.dataLimit) * 100, 100)
  }

  // Check if user is approaching data limit
  const isApproachingDataLimit = (): boolean => {
    return getDataUsagePercentage() > 80
  }

  // Calculate days until next billing
  const getDaysUntilBilling = (): number => {
    if (!user) return 0
    const now = new Date()
    const nextBilling = new Date(user.billing.nextBillingDate)
    const diffTime = nextBilling.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // Effects
  useEffect(() => {
    if (session && routerId && userId) {
      fetchUserDetails()
    }
  }, [session, routerId, userId])

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">User not found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {user.userInfo.fullName || user.userInfo.username}
              </CardTitle>
              <CardDescription>
                PPPoE User • {user.userInfo.username} • {user.service.packageType}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusVariant(user.status)}>
                {user.status.replace('_', ' ')}
              </Badge>
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
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={fetchUserDetails}
              disabled={actionLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${actionLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <Button variant="outline" asChild>
              <a href={`/routers/${routerId}/users/pppoe/${userId}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit User
              </a>
            </Button>

            {user.status === "active" ? (
              <Button
                variant="outline"
                onClick={suspendUser}
                disabled={actionLoading}
              >
                <Pause className="h-4 w-4 mr-2" />
                Suspend
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={activateUser}
                disabled={actionLoading}
              >
                <Play className="h-4 w-4 mr-2" />
                Activate
              </Button>
            )}

            {user.connection.isOnline && (
              <Button
                variant="outline"
                onClick={disconnectUser}
                disabled={actionLoading}
              >
                <WifiOff className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete PPPoE User</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete user "{user.userInfo.username}"? 
                    This action cannot be undone and will remove all user data and billing history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={deleteUser}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Deleting..." : "Delete User"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-4 w-4 text-blue-600" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Data Used</p>
                <p className="text-2xl font-bold">{formatDataUsage(user.usage.currentMonth.dataUsed)}</p>
                {user.service.dataLimit > 0 && (
                  <Progress 
                    value={getDataUsagePercentage()} 
                    className="mt-2"
                    // @ts-ignore
                    color={isApproachingDataLimit() ? "destructive" : "default"}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-4 w-4 text-green-600" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Session Time</p>
                <p className="text-2xl font-bold">
                  {Math.floor(user.connection.sessionTime / 60)}h {user.connection.sessionTime % 60}m
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CreditCard className="h-4 w-4 text-purple-600" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Monthly Fee</p>
                <p className="text-2xl font-bold">{formatCurrency(user.service.price)}</p>
                {user.billing.outstandingAmount > 0 && (
                  <p className="text-sm text-red-600">
                    Due: {formatCurrency(user.billing.outstandingAmount)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 text-orange-600" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Next Billing</p>
                <p className="text-2xl font-bold">{getDaysUntilBilling()}d</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(user.billing.nextBillingDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Information Tabs */}
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="service">Service</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">User Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Username</p>
                        <p className="font-medium font-mono">{user.userInfo.username}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Full Name</p>
                        <p className="font-medium">{user.userInfo.fullName || "Not provided"}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{user.userInfo.email || "Not provided"}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{user.userInfo.phone || "Not provided"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Current IP Address</p>
                        <p className="font-medium font-mono">
                          {user.connection.ipAddress || "Not assigned"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Router className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">MAC Address</p>
                        <p className="font-medium font-mono text-xs">
                          {user.connection.macAddress || "Unknown"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Last Login</p>
                        <p className="font-medium">
                          {user.connection.lastLogin 
                            ? new Date(user.connection.lastLogin).toLocaleString()
                            : "Never"
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">ID Number</p>
                        <p className="font-medium">{user.userInfo.idNumber || "Not provided"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {user.userInfo.address && (
                  <>
                    <Separator className="my-6" />
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Address</p>
                      <p className="font-medium">{user.userInfo.address}</p>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            {/* Service Tab */}
            <TabsContent value="service" className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Service Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Package Type</p>
                      <p className="font-medium text-lg">{user.service.packageType}</p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">MikroTik Profile</p>
                      <p className="font-medium font-mono">{user.service.profile}</p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Static IP Address</p>
                      <p className="font-medium font-mono">
                        {user.service.ipAddress || "Dynamic IP"}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Price</p>
                      <p className="font-medium text-lg text-green-600">
                        {formatCurrency(user.service.price)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Bandwidth Limit</p>
                      <div className="space-y-1">
                        <p className="font-medium">
                          ↓ Download: {user.service.bandwidth.download} Kbps
                        </p>
                        <p className="font-medium">
                          ↑ Upload: {user.service.bandwidth.upload} Kbps
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Data Limit</p>
                      <p className="font-medium">
                        {user.service.dataLimit > 0 
                          ? formatDataUsage(user.service.dataLimit)
                          : "Unlimited"
                        }
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Account Status</p>
                      <Badge variant={getStatusVariant(user.status)} className="mt-1">
                        {user.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Billing Tab */}
            <TabsContent value="billing" className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Billing Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Billing Cycle</p>
                      <p className="font-medium capitalize">{user.billing.billingCycle}</p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Next Billing Date</p>
                      <p className="font-medium">
                        {new Date(user.billing.nextBillingDate).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ({getDaysUntilBilling()} days remaining)
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Last Payment</p>
                      <p className="font-medium">
                        {user.billing.lastPaymentDate 
                          ? new Date(user.billing.lastPaymentDate).toLocaleDateString()
                          : "No payments recorded"
                        }
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Outstanding Amount</p>
                      <p className={`font-medium text-lg ${
                        user.billing.outstandingAmount > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(user.billing.outstandingAmount)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Grace Period</p>
                      <p className="font-medium">{user.billing.gracePeriod} days</p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Auto Disconnect</p>
                      <Badge variant={user.billing.autoDisconnect ? "default" : "secondary"}>
                        {user.billing.autoDisconnect ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {user.billing.outstandingAmount > 0 && (
                  <>
                    <Separator className="my-6" />
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <h4 className="font-medium text-red-800 mb-2">Payment Required</h4>
                      <p className="text-sm text-red-700">
                        This user has an outstanding balance of {formatCurrency(user.billing.outstandingAmount)}. 
                        {user.billing.autoDisconnect && (
                          ` The account will be automatically suspended if payment is not received within ${user.billing.gracePeriod} days of the due date.`
                        )}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            {/* Usage Tab */}
            <TabsContent value="usage" className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Current Month Usage</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Data Consumption</p>
                          <p className="text-2xl font-bold">
                            {formatDataUsage(user.usage.currentMonth.dataUsed)}
                          </p>
                          {user.service.dataLimit > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Used</span>
                                <span>{getDataUsagePercentage().toFixed(1)}%</span>
                              </div>
                              <Progress 
                                value={getDataUsagePercentage()}
                                className="h-2"
                              />
                              <p className="text-xs text-muted-foreground">
                                Limit: {formatDataUsage(user.service.dataLimit)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Time Online</p>
                          <p className="text-2xl font-bold">
                            {Math.floor(user.usage.currentMonth.timeUsed / 60)}h {user.usage.currentMonth.timeUsed % 60}m
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-muted-foreground">Current Session</p>
                          <p className="font-medium">
                            {user.connection.isOnline 
                              ? `${Math.floor(user.connection.sessionTime / 60)}h ${user.connection.sessionTime % 60}m`
                              : "Not connected"
                            }
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-muted-foreground">Last Session</p>
                          <p className="font-medium">
                            {user.usage.currentMonth.lastSession 
                              ? new Date(user.usage.currentMonth.lastSession).toLocaleString()
                              : "No sessions this month"
                            }
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Usage History */}
                {user.usage.history.length > 0 && (
                  <>
                    <Separator className="my-6" />
                    <div>
                      <h4 className="font-medium mb-4 flex items-center">
                        <History className="h-4 w-4 mr-2" />
                        Usage History
                      </h4>
                      <div className="space-y-3">
                        {user.usage.history.slice(0, 6).map((record, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{record.month}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatDataUsage(record.dataUsed)} • {formatDuration(record.timeUsed)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatCurrency(record.billingAmount)}</p>
                              <p className="text-sm text-muted-foreground">Billed</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {user.usage.history.length > 6 && (
                        <Button variant="outline" className="mt-4 w-full">
                          View All History ({user.usage.history.length} months)
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Alerts and Warnings */}
      <div className="space-y-4">
        {/* Data Limit Warning */}
        {isApproachingDataLimit() && user.service.dataLimit > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center">
                <Activity className="h-4 w-4 text-orange-600 mr-2" />
                <div>
                  <p className="font-medium text-orange-800">Data Limit Warning</p>
                  <p className="text-sm text-orange-700">
                    User has consumed {getDataUsagePercentage().toFixed(1)}% of their monthly data allowance.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Outstanding Payment Warning */}
        {user.billing.outstandingAmount > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center">
                <CreditCard className="h-4 w-4 text-red-600 mr-2" />
                <div>
                  <p className="font-medium text-red-800">Payment Overdue</p>
                  <p className="text-sm text-red-700">
                    Outstanding balance: {formatCurrency(user.billing.outstandingAmount)}
                    {user.billing.autoDisconnect && (
                      ` • Account will be suspended in ${user.billing.gracePeriod} days if unpaid.`
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grace Period Warning */}
        {user.status === "grace_period" && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="flex items-center">
                <Clock className="h-4 w-4 text-yellow-600 mr-2" />
                <div>
                  <p className="font-medium text-yellow-800">Grace Period Active</p>
                  <p className="text-sm text-yellow-700">
                    This account is in grace period. Service may be suspended if payment is not received soon.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Suspended Account Info */}
        {user.status === "suspended" && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center">
                <Pause className="h-4 w-4 text-red-600 mr-2" />
                <div>
                  <p className="font-medium text-red-800">Account Suspended</p>
                  <p className="text-sm text-red-700">
                    This account has been suspended. User cannot access the internet until reactivated.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Account Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-4 w-4 mr-2" />
            Account Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4 p-3 border-l-4 border-blue-500 bg-blue-50">
              <div className="flex-1">
                <p className="font-medium">Account Created</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString()} at {new Date(user.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>

            {user.connection.lastLogin && (
              <div className="flex items-center space-x-4 p-3 border-l-4 border-green-500 bg-green-50">
                <div className="flex-1">
                  <p className="font-medium">Last Login</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(user.connection.lastLogin).toLocaleDateString()} at {new Date(user.connection.lastLogin).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            )}

            {user.billing.lastPaymentDate && (
              <div className="flex items-center space-x-4 p-3 border-l-4 border-purple-500 bg-purple-50">
                <div className="flex-1">
                  <p className="font-medium">Last Payment</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(user.billing.lastPaymentDate).toLocaleDateString()} at {new Date(user.billing.lastPaymentDate).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-4 p-3 border-l-4 border-orange-500 bg-orange-50">
              <div className="flex-1">
                <p className="font-medium">Next Billing Due</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(user.billing.nextBillingDate).toLocaleDateString()} 
                  ({getDaysUntilBilling()} days remaining)
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4 p-3 border-l-4 border-gray-500 bg-gray-50">
              <div className="flex-1">
                <p className="font-medium">Last Updated</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(user.updatedAt).toLocaleDateString()} at {new Date(user.updatedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}