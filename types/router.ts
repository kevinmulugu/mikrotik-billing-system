// types/router.ts
import { Package } from './package';

export interface RouterHealth {
  lastSeen?: Date;
  uptime: number;
  cpuUsage: number;
  memoryUsage: number;
  temperature: number;
  connectedUsers: number;
}

export interface RouterStatistics {
  totalUsers: number;
  activeUsers: number;
  dailyRevenue: number;
  monthlyRevenue: number;
  totalRevenue: number;
}

export interface RouterConfiguration {
  hotspotEnabled: boolean;
  pppoeEnabled: boolean;
}

// Extended to include package information
export interface RouterPackages {
  hotspot: Package[];
  pppoe?: Package[];  // Future support for PPPoE packages
}

export interface Router {
  id: string;
  name: string;
  model: string;
  serialNumber?: string;
  location: string;
  ipAddress?: string;
  status: 'online' | 'offline' | 'warning' | 'error';
  health: RouterHealth;
  statistics: RouterStatistics;
  configuration: RouterConfiguration;
  packages?: RouterPackages;  // Added: Package information
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RoutersStatistics {
  totalRouters: number;
  onlineRouters: number;
  offlineRouters: number;
  totalActiveUsers: number;
}

export interface RoutersResponse {
  statistics: RoutersStatistics;
  routers: Router[];
}