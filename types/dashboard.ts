export interface DashboardOverview {
  totalRouters: number;
  onlineRouters: number;
  totalActiveUsers: number;
  totalRevenue: number;
  monthlyRevenue: number;
  todayRevenue: number;
  totalCommission: number;
  transactionCount: number;
}

export interface RouterStatus {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning' | 'error';
  connectedUsers: number;
  cpuUsage: number;
  memoryUsage: number;
  dailyRevenue: number;
}

export interface RecentActivity {
  id: string;
  type: 'voucher_purchase' | 'pppoe_payment' | 'commission_payout';
  amount: number;
  description: string;
  timestamp: Date;
  status: string;
}

export interface RevenueChartData {
  date: string;
  revenue: number;
  transactions: number;
}

export interface VoucherStats {
  total: number;
  active: number;
  used: number;
  expired: number;
}

export interface PppoeUserStats {
  total: number;
  active: number;
  suspended: number;
  gracePeriod: number;
}

export interface TopSellingPackage {
  package: string;
  sold: number;
  revenue: number;
}

export interface DashboardAlert {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
}

export interface CustomerInfo {
  id: string;
  name: string;
  type: 'homeowner' | 'isp' | 'business';
  plan: string;
  commissionRate: number;
}

export interface DashboardData {
  overview: DashboardOverview;
  routers: RouterStatus[];
  recentActivity: RecentActivity[];
  revenueChart: RevenueChartData[];
  vouchers: VoucherStats;
  pppoeUsers: PppoeUserStats;
  topSellingPackages: TopSellingPackage[];
  alerts: DashboardAlert[];
  customer: CustomerInfo;
}