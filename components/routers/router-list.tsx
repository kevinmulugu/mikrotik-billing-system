'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wifi, 
  MapPin, 
  Users, 
  TrendingUp, 
  Settings, 
  Activity,
  Clock,
  Cpu,
  HardDrive,
  Thermometer
} from 'lucide-react';
import Link from 'next/link';

interface Router {
  id: string;
  name: string;
  model: string;
  serialNumber?: string;
  location: string;
  ipAddress?: string;
  status: 'online' | 'offline' | 'warning' | 'error';
  health: {
    lastSeen?: Date;
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
    temperature: number;
    connectedUsers: number;
  };
  statistics: {
    totalUsers: number;
    activeUsers: number;
    dailyRevenue: number;
    monthlyRevenue: number;
    totalRevenue: number;
  };
  configuration: {
    hotspotEnabled: boolean;
    pppoeEnabled: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

interface RouterListProps {
  routers: Router[];
}

export function RouterList({ routers }: RouterListProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge className="bg-green-500">Online</Badge>;
      case 'offline':
        return <Badge variant="destructive">Offline</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">Warning</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatLastSeen = (date?: Date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {routers.map((router) => (
        <Card key={router.id} className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-blue-600" />
                  {router.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {router.model}
                </p>
              </div>
              {getStatusBadge(router.status)}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Location & IP */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{router.location}</span>
              </div>
              {router.ipAddress && (
                <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs">
                  <Activity className="h-4 w-4" />
                  <span>{router.ipAddress}</span>
                </div>
              )}
            </div>

            {/* Health Metrics */}
            {router.status === 'online' && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {formatUptime(router.health.uptime)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {router.health.connectedUsers} users
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Cpu className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    CPU {router.health.cpuUsage}%
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    RAM {router.health.memoryUsage}%
                  </span>
                </div>
              </div>
            )}

            {/* Last Seen (for offline routers) */}
            {router.status === 'offline' && (
              <div className="text-sm text-muted-foreground">
                Last seen: {formatLastSeen(router.health.lastSeen)}
              </div>
            )}

            {/* Revenue Stats */}
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Daily Revenue</span>
                <span className="font-semibold">
                  KES {router.statistics.dailyRevenue}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Monthly Revenue</span>
                <span className="font-semibold">
                  KES {router.statistics.monthlyRevenue.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Configuration Badges */}
            <div className="flex gap-2 flex-wrap">
              {router.configuration.hotspotEnabled && (
                <Badge variant="outline" className="text-xs">
                  Hotspot
                </Badge>
              )}
              {router.configuration.pppoeEnabled && (
                <Badge variant="outline" className="text-xs">
                  PPPoE
                </Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button asChild size="sm" className="flex-1">
                <Link href={`/routers/${router.id}`}>
                  View Details
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/routers/${router.id}/settings`}>
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}