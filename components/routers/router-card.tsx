"use client"

import { useState } from "react"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Progress } from "@/components/ui/progress"
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  Edit,
  Eye,
  MapPin,
  MoreHorizontal,
  Power,
  RefreshCw,
  Router,
  Settings,
  Signal,
  Trash2,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react"
import { formatCurrency, formatDataUsage } from "@/lib/utils"

// Types
interface RouterHealth {
  status: "online" | "offline" | "warning" | "error"
  lastSeen: Date
  uptime: number
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  temperature: number
  connectedUsers: number
}

interface RouterStatistics {
  totalDataUsage: number
  monthlyDataUsage: number
  totalUsers: number
  activeUsers: number
  revenue: {
    total: number
    monthly: number
    daily: number
  }
}

interface RouterInfo {
  name: string
  model: string
  serialNumber: string
  macAddress: string
  firmwareVersion: string
  location: {
    name: string
    coordinates?: {
      latitude: number
      longitude: number
    }
    address: string
  }
}

interface Router {
  _id: string
  customerId: string
  routerType?: 'mikrotik' | 'unifi'; // NEW: Router vendor type
  routerInfo: RouterInfo
  connection: {
    ipAddress: string
    port: number
    apiUser: string
    restApiEnabled: boolean
    sshEnabled: boolean
  }
  configuration: {
    hotspot: {
      enabled: boolean
      ssid: string
      interface: string
      ipPool: string
      maxUsers: number
    }
    pppoe: {
      enabled: boolean
      interface: string
      ipPool: string
      defaultProfile: string
    }
  }
  services?: {
    hotspot?: {
      enabled: boolean
    }
    pppoe?: {
      enabled: boolean
    }
  }
  health: RouterHealth
  statistics: RouterStatistics
  status: "active" | "inactive" | "maintenance"
  createdAt: Date
  updatedAt: Date
}

interface RouterCardProps {
  router: Router
  onUpdate?: () => void
  onDelete?: (routerId: string) => void
}

// Status badge variant mapping
const getStatusVariant = (status: string): BadgeProps["variant"] => {
  switch (status) {
    case "online":
      return "default"
    case "offline":
      return "secondary"
    case "warning":
      return "outline"
    case "error":
      return "destructive"
    default:
      return "secondary"
  }
}

// Health status colors
const getHealthColor = (status: string): string => {
  switch (status) {
    case "online":
      return "text-green-600"
    case "offline":
      return "text-gray-500"
    case "warning":
      return "text-yellow-600"
    case "error":
      return "text-red-600"
    default:
      return "text-gray-500"
  }
}

export function RouterCard({ router, onUpdate, onDelete }: RouterCardProps) {
  const [loading, setLoading] = useState(false)

  // Calculate uptime display
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) {
      return `${days}d ${hours}h`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  // Restart router
  const restartRouter = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/routers/${router._id}/restart`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to restart router')
      }

      toast.success('Router restart initiated')
      onUpdate?.()
    } catch (error) {
      console.error('Error restarting router:', error)
      toast.error('Failed to restart router')
    } finally {
      setLoading(false)
    }
  }

  // Update router status
  const updateRouterStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/routers/${router._id}/status`, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error('Failed to update router status')
      }

      toast.success('Router status updated')
      onUpdate?.()
    } catch (error) {
      console.error('Error updating router status:', error)
      toast.error('Failed to update router status')
    } finally {
      setLoading(false)
    }
  }

  // Check if router needs attention
  const needsAttention = (): boolean => {
    return (
      router.health.status === "error" ||
      router.health.status === "warning" ||
      router.health.cpuUsage > 80 ||
      router.health.memoryUsage > 90 ||
      router.health.temperature > 70
    )
  }

  return (
    <Card className={`relative ${needsAttention() ? 'border-orange-200 bg-orange-50/50' : ''}`}>
      {needsAttention() && (
        <div className="absolute top-2 right-2">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{router.routerInfo.name}</CardTitle>
            <CardDescription>
              {router.routerInfo.model} • {router.routerInfo.location.name}
            </CardDescription>
            {/* Router Type and Services */}
            <div className="flex flex-wrap gap-1 mt-2">
              <Badge variant="outline" className="text-xs">
                {router.routerType === 'unifi' ? (
                  <>
                    <Wifi className="h-3 w-3 mr-1" />
                    UniFi
                  </>
                ) : (
                  <>
                    <Router className="h-3 w-3 mr-1" />
                    MikroTik
                  </>
                )}
              </Badge>
              {(router.services?.hotspot?.enabled || router.configuration?.hotspot?.enabled) && (
                <Badge variant="outline" className="text-xs bg-blue-50">
                  <Wifi className="h-3 w-3 mr-1" />
                  Hotspot
                </Badge>
              )}
              {(router.services?.pppoe?.enabled || router.configuration?.pppoe?.enabled) && (
                <Badge variant="outline" className="text-xs bg-green-50">
                  <Signal className="h-3 w-3 mr-1" />
                  PPPoE
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusVariant(router.health.status)}>
              {router.health.status === "online" ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Online
                </>
              ) : router.health.status === "offline" ? (
                <>
                  <WifiOff className="h-3 w-3 mr-1" />
                  Offline
                </>
              ) : router.health.status === "warning" ? (
                <>
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Warning
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Error
                </>
              )}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={loading}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a href={`/routers/${router._id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/routers/${router._id}/settings`}>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={updateRouterStatus}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Status
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={restartRouter}>
                  <Power className="h-4 w-4 mr-2" />
                  Restart Router
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                      <span className="text-red-500">Delete Router</span>
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Router</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{router.routerInfo.name}"? 
                        This will remove all users, vouchers, and configuration data. 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete?.(router._id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete Router
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Users className="h-3 w-3 mr-1" />
              Users
            </div>
            <div className="text-lg font-semibold">
              {router.health.connectedUsers} / {router.statistics.totalUsers}
            </div>
            <div className="text-xs text-muted-foreground">
              {router.statistics.activeUsers} active
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <CreditCard className="h-3 w-3 mr-1" />
              Revenue
            </div>
            <div className="text-lg font-semibold text-green-600">
              {formatCurrency(router.statistics.revenue.monthly)}
            </div>
            <div className="text-xs text-muted-foreground">
              This month
            </div>
          </div>
        </div>

        {/* Health Metrics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">CPU Usage</span>
            <span className={router.health.cpuUsage > 80 ? 'text-red-600' : 'text-foreground'}>
              {router.health.cpuUsage}%
            </span>
          </div>
          <Progress 
            value={router.health.cpuUsage} 
            className="h-2"
          />

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Memory Usage</span>
            <span className={router.health.memoryUsage > 90 ? 'text-red-600' : 'text-foreground'}>
              {router.health.memoryUsage}%
            </span>
          </div>
          <Progress 
            value={router.health.memoryUsage} 
            className="h-2"
          />
        </div>

        {/* Services Status */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              router.configuration.hotspot.enabled ? 'bg-green-500' : 'bg-gray-300'
            }`} />
            <span className="text-sm">Hotspot</span>
            {router.configuration.hotspot.enabled && (
              <Badge variant="outline" className="text-xs">
                {router.configuration.hotspot.maxUsers} max
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              router.configuration.pppoe.enabled ? 'bg-green-500' : 'bg-gray-300'
            }`} />
            <span className="text-sm">PPPoE</span>
            {router.configuration.pppoe.enabled && (
              <Badge variant="outline" className="text-xs">
                Enabled
              </Badge>
            )}
          </div>
        </div>

        {/* Connection Info */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center text-muted-foreground">
              <Router className="h-3 w-3 mr-1" />
              IP Address
            </div>
            <span className="font-mono text-xs">{router.connection.ipAddress}</span>
          </div>

          <div className="flex items-center justify-between text-sm mt-1">
            <div className="flex items-center text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              Uptime
            </div>
            <span className="text-xs">
              {router.health.status === "online" ? formatUptime(router.health.uptime) : "Offline"}
            </span>
          </div>

          {router.routerInfo.location.address && (
            <div className="flex items-center justify-between text-sm mt-1">
              <div className="flex items-center text-muted-foreground">
                <MapPin className="h-3 w-3 mr-1" />
                Location
              </div>
              <span className="text-xs truncate max-w-[150px]">
                {router.routerInfo.location.address}
              </span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" asChild className="flex-1">
            <a href={`/routers/${router._id}`}>
              <Eye className="h-3 w-3 mr-1" />
              View
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild className="flex-1">
            <a href={`/routers/${router._id}/users`}>
              <Users className="h-3 w-3 mr-1" />
              Users
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild className="flex-1">
            <a href={`/routers/${router._id}/settings`}>
              <Settings className="h-3 w-3 mr-1" />
              Settings
            </a>
          </Button>
        </div>

        {/* Alert Messages */}
        {needsAttention() && (
          <div className="pt-2 border-t">
            <div className="flex items-start space-x-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
              <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-medium text-orange-800">Attention Required</div>
                <div className="text-orange-700 text-xs mt-1">
                  {router.health.status === "error" && "Router has errors"}
                  {router.health.status === "warning" && "Router warnings detected"}
                  {router.health.cpuUsage > 80 && "High CPU usage detected"}
                  {router.health.memoryUsage > 90 && "Memory usage critical"}
                  {router.health.temperature > 70 && "High temperature warning"}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}