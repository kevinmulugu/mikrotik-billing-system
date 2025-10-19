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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { RefreshCw, Router } from "lucide-react"

// Import tab components
import { GeneralTab } from "./tabs/general-tab"
import { ConnectionTab } from "./tabs/connection-tab"
import { HotspotTab } from "./tabs/hotspot-tab"
import { PPPoETab } from "./tabs/pppoe-tab"
import { NetworkTab } from "./tabs/network-tab"

interface RouterSettingsProps {
  routerId: string
}

interface RouterData {
  id: string
  name: string
  model: string
  serialNumber: string
  macAddress: string
  firmwareVersion: string
  status: string
  ipAddress: string
  location: {
    name: string
    address: string
    coordinates: {
      latitude: number
      longitude: number
    }
  }
  connection: {
    ipAddress: string
    port: number
    apiUser: string
    apiPassword: string
    restApiEnabled: boolean
    sshEnabled: boolean
  }
  configuration: {
    hotspot: {
      enabled: boolean
      ssid: string
      password: string
      interface: string
      ipPool: string
      dnsServers: string[]
      maxUsers: number
    }
    pppoe: {
      enabled: boolean
      interface: string
      ipPool: string
      dnsServers: string[]
      defaultProfile: string
    }
    network: {
      lanInterface: string
      wanInterface: string
      lanSubnet: string
      dhcpRange: string
    }
  }
  health: {
    status: string
    lastSeen: Date
    uptime: number
    cpuUsage: number
    memoryUsage: number
    diskUsage: number
    temperature: number
    connectedUsers: number
  }
  statistics: {
    totalDataUsage: number
    monthlyDataUsage: number
    totalUsers: number
    activeUsers: number
    monthlyRevenue: number
    todayRevenue: number
    totalRevenue: number
  }
  createdAt?: Date
  updatedAt?: Date
}

export function RouterSettings({ routerId }: RouterSettingsProps) {
  const { data: session } = useSession()
  const [router, setRouter] = useState<RouterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [activeTab, setActiveTab] = useState("general")

  // Fetch router data
  const fetchRouter = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/routers/${routerId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch router data')
      }

      const data = await response.json()
      setRouter(data.router)
    } catch (error) {
      console.error('Error fetching router:', error)
      toast.error('Failed to load router settings')
    } finally {
      setLoading(false)
    }
  }

  // Save router info
  const saveRouterInfo = async (data: any) => {
    try {
      setSaving(true)
      const response = await fetch(`/api/routers/${routerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to save router info')
      }

      toast.success('Router information saved successfully')
      fetchRouter()
    } catch (error: any) {
      console.error('Error saving router info:', error)
      toast.error(error.message || 'Failed to save router info')
    } finally {
      setSaving(false)
    }
  }

  // Test connection
  const testConnection = async (data: any) => {
    try {
      setTesting(true)
      
      const response = await fetch('/api/routers/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Connection test failed')
      }

      toast.success('Connection test successful')
    } catch (error: any) {
      console.error('Connection test error:', error)
      toast.error(error.message || 'Connection test failed')
    } finally {
      setTesting(false)
    }
  }

  // Save connection settings
  const saveConnection = async (data: any) => {
    try {
      setSaving(true)
      const response = await fetch(`/api/routers/${routerId}/connection`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to save connection settings')
      }

      toast.success('Connection settings saved successfully')
      fetchRouter()
    } catch (error: any) {
      console.error('Error saving connection:', error)
      toast.error(error.message || 'Failed to save connection settings')
    } finally {
      setSaving(false)
    }
  }

  // Save hotspot configuration
  const saveHotspot = async (data: any) => {
    try {
      setSaving(true)
      const response = await fetch(`/api/routers/${routerId}/hotspot`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to save hotspot configuration')
      }

      toast.success('Hotspot configuration saved successfully')
      fetchRouter()
    } catch (error: any) {
      console.error('Error saving hotspot config:', error)
      toast.error(error.message || 'Failed to save hotspot configuration')
    } finally {
      setSaving(false)
    }
  }

  // Save PPPoE configuration
  const savePPPoE = async (data: any) => {
    try {
      setSaving(true)
      const response = await fetch(`/api/routers/${routerId}/pppoe`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to save PPPoE configuration')
      }

      toast.success('PPPoE configuration saved successfully')
      fetchRouter()
    } catch (error: any) {
      console.error('Error saving PPPoE config:', error)
      toast.error(error.message || 'Failed to save PPPoE configuration')
    } finally {
      setSaving(false)
    }
  }

  // Save network configuration
  const saveNetwork = async (data: any) => {
    try {
      setSaving(true)
      const response = await fetch(`/api/routers/${routerId}/network`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to save network configuration')
      }

      toast.success('Network configuration saved successfully')
      fetchRouter()
    } catch (error: any) {
      console.error('Error saving network config:', error)
      toast.error(error.message || 'Failed to save network configuration')
    } finally {
      setSaving(false)
    }
  }

  // Restart router
  const restartRouter = async () => {
    try {
      setSaving(true)
      const response = await fetch(`/api/routers/${routerId}/restart`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to restart router')
      }

      toast.success('Router restart initiated')
    } catch (error: any) {
      console.error('Error restarting router:', error)
      toast.error(error.message || 'Failed to restart router')
    } finally {
      setSaving(false)
    }
  }

  // Format uptime from seconds
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  useEffect(() => {
    if (session && routerId) {
      fetchRouter()
    }
  }, [session, routerId])

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!router) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Router not found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Router Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Router className="h-5 w-5 mr-2" />
                {router.name}
              </CardTitle>
              <CardDescription>
                {router.model} {router.location?.name && ` • ${router.location.name}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={router.status === "online" ? "default" : "secondary"}>
                {router.status}
              </Badge>
              <Button variant="outline" size="sm" onClick={fetchRouter}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">CPU Usage</div>
              <div className="font-medium">{router.health.cpuUsage}%</div>
              <Progress value={router.health.cpuUsage} className="h-1 mt-1" />
            </div>
            <div>
              <div className="text-muted-foreground">Memory Usage</div>
              <div className="font-medium">{router.health.memoryUsage}%</div>
              <Progress value={router.health.memoryUsage} className="h-1 mt-1" />
            </div>
            <div>
              <div className="text-muted-foreground">Temperature</div>
              <div className="font-medium">{router.health.temperature}°C</div>
            </div>
            <div>
              <div className="text-muted-foreground">Connected Users</div>
              <div className="font-medium">{router.health.connectedUsers}</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Uptime</div>
              <div className="font-medium">{formatUptime(router.health.uptime)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total Users</div>
              <div className="font-medium">{router.statistics.totalUsers}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Active Users</div>
              <div className="font-medium">{router.statistics.activeUsers}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Monthly Revenue</div>
              <div className="font-medium">KSh {router.statistics.monthlyRevenue.toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Tabs */}
      <Card>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="connection">Connection</TabsTrigger>
              <TabsTrigger value="hotspot">Hotspot</TabsTrigger>
              <TabsTrigger value="pppoe">PPPoE</TabsTrigger>
              <TabsTrigger value="network">Network</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <GeneralTab
                router={{
                  name: router.name,
                  model: router.model,
                  serialNumber: router.serialNumber,
                  location: router.location,
                }}
                onSave={saveRouterInfo}
                onRestart={restartRouter}
                saving={saving}
              />
            </TabsContent>

            <TabsContent value="connection" className="space-y-6">
              <ConnectionTab
                connection={router.connection}
                onSave={saveConnection}
                onTest={testConnection}
                saving={saving}
                testing={testing}
              />
            </TabsContent>

            <TabsContent value="hotspot" className="space-y-6">
              <HotspotTab
                hotspot={router.configuration.hotspot}
                onSave={saveHotspot}
                saving={saving}
              />
            </TabsContent>

            <TabsContent value="pppoe" className="space-y-6">
              <PPPoETab
                pppoe={router.configuration.pppoe}
                onSave={savePPPoE}
                saving={saving}
              />
            </TabsContent>

            <TabsContent value="network" className="space-y-6">
              <NetworkTab
                network={router.configuration.network}
                onSave={saveNetwork}
                saving={saving}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}