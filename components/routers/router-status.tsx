"use client";

import React, { useState, useEffect } from "react";
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  Users,
  Activity,
  HardDrive,
  Cpu,
  Thermometer,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Settings,
  BarChart3,
  Download,
  Upload,
  Signal,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

interface RouterHealth {
  status: "online" | "offline" | "warning" | "error";
  lastSeen: Date;
  uptime: number; // seconds
  cpu: {
    usage: number; // percentage
    temperature: number; // celsius
  };
  memory: {
    total: number; // bytes
    used: number; // bytes
    usage: number; // percentage
  };
  disk: {
    total: number; // bytes
    used: number; // bytes
    usage: number; // percentage
  };
}

interface NetworkStats {
  connectedUsers: number;
  activeUsers: number;
  bandwidth: {
    upload: number; // kbps current
    download: number; // kbps current
  };
  dataTransfer: {
    upload: number; // bytes total
    download: number; // bytes total
  };
  signalStrength: number; // percentage
}

interface RouterStatusProps {
  routerId: string;
  routerName: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  onManage?: () => void;
  onViewAnalytics?: () => void;
}

export const RouterStatus: React.FC<RouterStatusProps> = ({
  routerId,
  routerName,
  autoRefresh = true,
  refreshInterval = 30000,
  onManage,
  onViewAnalytics,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Sample data - replace with API calls
  const [health, setHealth] = useState<RouterHealth>({
    status: "online",
    lastSeen: new Date(),
    uptime: 2592000, // 30 days in seconds
    cpu: {
      usage: 35,
      temperature: 48,
    },
    memory: {
      total: 536870912, // 512MB
      used: 268435456, // 256MB
      usage: 50,
    },
    disk: {
      total: 134217728, // 128MB
      used: 53687091, // 51.2MB
      usage: 40,
    },
  });

  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    connectedUsers: 24,
    activeUsers: 18,
    bandwidth: {
      upload: 2048, // 2 Mbps
      download: 5120, // 5 Mbps
    },
    dataTransfer: {
      upload: 5368709120, // 5GB
      download: 21474836480, // 20GB
    },
    signalStrength: 85,
  });

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        handleRefresh();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [autoRefresh, refreshInterval]);

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      // API call to fetch router status
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulate slight changes in stats
      setHealth((prev) => ({
        ...prev,
        cpu: {
          usage: Math.min(100, Math.max(0, prev.cpu.usage + (Math.random() - 0.5) * 10)),
          temperature: Math.min(80, Math.max(30, prev.cpu.temperature + (Math.random() - 0.5) * 5)),
        },
      }));

      setNetworkStats((prev) => ({
        ...prev,
        connectedUsers: Math.max(0, prev.connectedUsers + Math.floor((Math.random() - 0.5) * 4)),
        activeUsers: Math.max(0, prev.activeUsers + Math.floor((Math.random() - 0.5) * 3)),
      }));

      setLastRefresh(new Date());
      toast.success("Router status updated");
    } catch (error) {
      toast.error("Failed to refresh router status");
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusColor = (status: RouterHealth["status"]) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "offline":
        return "bg-gray-500";
      case "warning":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusBadge = (status: RouterHealth["status"]) => {
    switch (status) {
      case "online":
        return "default";
      case "offline":
        return "secondary";
      case "warning":
        return "outline";
      case "error":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusIcon = (status: RouterHealth["status"]) => {
    switch (status) {
      case "online":
        return <Wifi className="h-4 w-4" />;
      case "offline":
        return <WifiOff className="h-4 w-4" />;
      case "warning":
      case "error":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Wifi className="h-4 w-4" />;
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatSpeed = (kbps: number): string => {
    if (kbps >= 1024) {
      return (kbps / 1024).toFixed(1) + " Mbps";
    }
    return kbps.toFixed(0) + " Kbps";
  };

  const getHealthLevel = (usage: number): { color: string; label: string } => {
    if (usage >= 90) return { color: "text-red-500", label: "Critical" };
    if (usage >= 75) return { color: "text-yellow-500", label: "High" };
    if (usage >= 50) return { color: "text-blue-500", label: "Moderate" };
    return { color: "text-green-500", label: "Good" };
  };

  const cpuHealth = getHealthLevel(health.cpu.usage);
  const memoryHealth = getHealthLevel(health.memory.usage);
  const diskHealth = getHealthLevel(health.disk.usage);

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={`rounded-full p-3 ${getStatusColor(health.status)}/10`}>
                <div className={`${getStatusColor(health.status)} rounded-full p-2`}>
                  {getStatusIcon(health.status)}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <CardTitle className="text-xl">{routerName}</CardTitle>
                  <Badge variant={getStatusBadge(health.status)}>
                    {health.status.toUpperCase()}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Uptime: {formatUptime(health.uptime)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Last seen: {health.lastSeen.toLocaleTimeString()}
                  </span>
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {onManage && (
                <Button variant="outline" size="sm" onClick={onManage}>
                  <Settings className="h-4 w-4 mr-2" />
                  Manage
                </Button>
              )}
              {onViewAnalytics && (
                <Button size="sm" onClick={onViewAnalytics}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Network Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Network Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Connected Users</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold">{networkStats.connectedUsers}</p>
                  <p className="text-sm text-muted-foreground">total</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Active Users</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold">{networkStats.activeUsers}</p>
                  <p className="text-sm text-muted-foreground">online</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Download className="h-4 w-4 text-muted-foreground" />
                  <span>Download</span>
                </div>
                <span className="font-semibold">{formatSpeed(networkStats.bandwidth.download)}</span>
              </div>
              <Progress value={(networkStats.bandwidth.download / 10240) * 100} />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span>Upload</span>
                </div>
                <span className="font-semibold">{formatSpeed(networkStats.bandwidth.upload)}</span>
              </div>
              <Progress value={(networkStats.bandwidth.upload / 10240) * 100} />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Downloaded</span>
                <span className="font-medium">{formatBytes(networkStats.dataTransfer.download)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Uploaded</span>
                <span className="font-medium">{formatBytes(networkStats.dataTransfer.upload)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Signal Strength</span>
                <div className="flex items-center gap-2">
                  <Signal className="h-4 w-4" />
                  <span className="font-medium">{networkStats.signalStrength}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* CPU Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">CPU Usage</span>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className={cpuHealth.color}>
                        {health.cpu.usage.toFixed(1)}%
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Status: {cpuHealth.label}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Progress value={health.cpu.usage} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Temperature: {health.cpu.temperature}°C</span>
                <span>{health.cpu.usage < 50 ? <TrendingDown className="h-3 w-3 inline" /> : <TrendingUp className="h-3 w-3 inline" />}</span>
              </div>
            </div>

            {/* Memory Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Memory</span>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className={memoryHealth.color}>
                        {health.memory.usage.toFixed(1)}%
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Status: {memoryHealth.label}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Progress value={health.memory.usage} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatBytes(health.memory.used)} / {formatBytes(health.memory.total)}</span>
              </div>
            </div>

            {/* Disk Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Storage</span>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className={diskHealth.color}>
                        {health.disk.usage.toFixed(1)}%
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Status: {diskHealth.label}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Progress value={health.disk.usage} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatBytes(health.disk.used)} / {formatBytes(health.disk.total)}</span>
              </div>
            </div>

            {/* Temperature Warning */}
            {health.cpu.temperature > 70 && (
              <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 p-3">
                <Thermometer className="h-4 w-4 text-yellow-500" />
                <p className="text-xs text-yellow-500">
                  High temperature detected. Consider improving ventilation.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <div className="flex items-center justify-center text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3 mr-1" />
          Auto-refreshing every {refreshInterval / 1000} seconds • Last update:{" "}
          {lastRefresh.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};