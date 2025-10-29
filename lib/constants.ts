export const APP_CONFIG = {
  name: 'MikroTik Billing',
  description: 'Monetize your internet connection with MikroTik routers',
  version: '1.0.0',
  supportEmail: 'support@mikrotikbilling.com',
  supportPhone: '+254700000000',
  website: 'https://mikrotikbilling.com',
  company: {
    name: 'MikroTik Billing Kenya',
    address: 'Nairobi, Kenya',
    paybill: '123456',
  },
} as const;

// Voucher package constants optimized for Kenya market
export const VOUCHER_PACKAGES = [
  {
    type: '1hour',
    name: '1 Hour',
    duration: 60, // minutes
    price: 10, // KSh
    bandwidth: { upload: 512, download: 1024 }, // kbps
    dataLimit: 0, // unlimited
    popular: false,
  },
  {
    type: '3hours',
    name: '3 Hours',
    duration: 180,
    price: 25,
    bandwidth: { upload: 512, download: 1024 },
    dataLimit: 0,
    popular: true,
  },
  {
    type: '5hours',
    name: '5 Hours',
    duration: 300,
    price: 40,
    bandwidth: { upload: 512, download: 1024 },
    dataLimit: 0,
    popular: false,
  },
  {
    type: '12hours',
    name: '12 Hours',
    duration: 720,
    price: 70,
    bandwidth: { upload: 512, download: 1024 },
    dataLimit: 0,
    popular: false,
  },
  {
    type: '1day',
    name: '1 Day',
    duration: 1440,
    price: 100,
    bandwidth: { upload: 512, download: 1024 },
    dataLimit: 0,
    popular: true,
  },
  {
    type: '3days',
    name: '3 Days',
    duration: 4320,
    price: 250,
    bandwidth: { upload: 512, download: 1024 },
    dataLimit: 0,
    popular: false,
  },
  {
    type: '1week',
    name: '1 Week',
    duration: 10080,
    price: 400,
    bandwidth: { upload: 512, download: 1024 },
    dataLimit: 0,
    popular: false,
  },
  {
    type: '1month',
    name: '1 Month',
    duration: 43200,
    price: 1200,
    bandwidth: { upload: 512, download: 1024 },
    dataLimit: 0,
    popular: true,
  },
] as const;

// PPPoE package constants
export const PPPOE_PACKAGES = [
  {
    type: '1mbps',
    name: '1 Mbps',
    bandwidth: { upload: 1024, download: 1024 },
    price: 1500,
    dataLimit: 0,
    popular: false,
  },
  {
    type: '2mbps',
    name: '2 Mbps',
    bandwidth: { upload: 2048, download: 2048 },
    price: 2500,
    dataLimit: 0,
    popular: true,
  },
  {
    type: '5mbps',
    name: '5 Mbps',
    bandwidth: { upload: 5120, download: 5120 },
    price: 4000,
    dataLimit: 0,
    popular: true,
  },
  {
    type: '10mbps',
    name: '10 Mbps',
    bandwidth: { upload: 10240, download: 10240 },
    price: 6000,
    dataLimit: 0,
    popular: false,
  },
  {
    type: '20mbps',
    name: '20 Mbps',
    bandwidth: { upload: 20480, download: 20480 },
    price: 10000,
    dataLimit: 0,
    popular: false,
  },
] as const;

// Commission rates by customer type
export const COMMISSION_RATES = {
  homeowner: 20.0, // 20%
  isp: 0.0, // 0% (ISPs pay subscription fees)
  business: 0.0, // 0%
} as const;

// Status constants
export const ROUTER_STATUSES = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  WARNING: 'warning',
  ERROR: 'error',
  MAINTENANCE: 'maintenance',
} as const;

export const USER_STATUSES = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  TERMINATED: 'terminated',
  GRACE_PERIOD: 'grace_period',
} as const;

export const VOUCHER_STATUSES = {
  ACTIVE: 'active',
  USED: 'used',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

export const TICKET_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  WAITING_CUSTOMER: 'waiting_customer',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

export const TICKET_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

// Theme constants
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const;

// Language constants
export const LANGUAGES = {
  EN: 'en',
  SW: 'sw',
} as const;

// Notification types
export const NOTIFICATION_TYPES = {
  ROUTER_OFFLINE: 'router_offline',
  ROUTER_ONLINE: 'router_online',
  PAYMENT_RECEIVED: 'payment_received',
  PAYMENT_FAILED: 'payment_failed',
  VOUCHER_LOW: 'voucher_low',
  USER_LIMIT_REACHED: 'user_limit_reached',
  SUPPORT_TICKET: 'support_ticket',
  SYSTEM_MAINTENANCE: 'system_maintenance',
} as const;

// File upload limits
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: {
    IMAGES: ['image/jpeg', 'image/png', 'image/gif'],
    DOCUMENTS: ['application/pdf', 'text/csv'],
    SPREADSHEETS: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
} as const;

// API endpoints
export const API_ENDPOINTS = {
  AUTH: '/api/auth',
  ROUTERS: '/api/routers',
  USERS: '/api/users',
  VOUCHERS: '/api/vouchers',
  PAYMENTS: '/api/payments',
  TICKETS: '/api/support/tickets',
  ANALYTICS: '/api/analytics',
  SETTINGS: '/api/settings',
  UPLOAD: '/api/upload',
  EXPORT: '/api/export',
  WEBHOOKS: {
    MPESA: '/api/webhooks/mpesa',
    MIKROTIK: '/api/webhooks/mikrotik',
  },
} as const;

// External service URLs
export const EXTERNAL_URLS = {
  SAFARICOM_DARAJA: {
    SANDBOX: 'https://sandbox.safaricom.co.ke',
    PRODUCTION: 'https://api.safaricom.co.ke',
  },
  KOPOKOPO: {
    SANDBOX: 'https://sandbox.kopokopo.com',
    PRODUCTION: 'https://api.kopokopo.com',
  },
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// Chart colors for analytics
export const CHART_COLORS = {
  PRIMARY: '#3B82F6',
  SUCCESS: '#10B981',
  WARNING: '#F59E0B',
  DANGER: '#EF4444',
  INFO: '#8B5CF6',
  SECONDARY: '#6B7280',
} as const;