import { z } from 'zod';

// Common validation patterns
const phoneNumberRegex = /^(\+254|254|0)(7|1)\d{8}$/;
const ipAddressRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const macAddressRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

// Helper functions
const preprocessPhone = (val: string) => {
  if (!val) return val;
  let cleaned = val.replace(/\s+/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.slice(1);
  }
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
};

// Authentication Schemas
export const signInSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

export const signUpSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .transform(preprocessPhone)
    .refine((val) => phoneNumberRegex.test(val), {
      message: 'Please enter a valid Kenyan phone number',
    }),
  businessType: z.enum(['homeowner', 'isp', 'business'], {
    message: 'Please select your business type',
  }),
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, {
      message: 'You must accept the terms and conditions',
    }),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

// Router Management Schemas
export const addRouterSchema = z.object({
  name: z
    .string()
    .min(1, 'Router name is required')
    .max(50, 'Router name must be less than 50 characters'),
  model: z
    .string()
    .min(1, 'Router model is required')
    .max(30, 'Router model must be less than 30 characters'),
  serialNumber: z
    .string()
    .optional(),
  ipAddress: z
    .string()
    .min(1, 'IP address is required')
    .refine((val) => ipAddressRegex.test(val), {
      message: 'Please enter a valid IP address',
    }),
  apiPort: z
    .number()
    .int()
    .min(1, 'Port must be at least 1')
    .max(65535, 'Port must be less than 65536')
    .default(8728),
  apiUser: z
    .string()
    .min(1, 'API username is required')
    .max(20, 'Username must be less than 20 characters'),
  apiPassword: z
    .string()
    .min(1, 'API password is required')
    .min(6, 'Password must be at least 6 characters'),
  location: z.object({
    name: z
      .string()
      .min(1, 'Location name is required')
      .max(100, 'Location name must be less than 100 characters'),
    address: z
      .string()
      .max(200, 'Address must be less than 200 characters')
      .optional(),
    coordinates: z.object({
      latitude: z
        .number()
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90')
        .optional(),
      longitude: z
        .number()
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180')
        .optional(),
    }).optional(),
  }),
  hotspotConfig: z.object({
    enabled: z.boolean().default(true),
    ssid: z
      .string()
      .min(1, 'SSID is required when hotspot is enabled')
      .max(32, 'SSID must be less than 32 characters')
      .optional(),
    password: z
      .string()
      .min(8, 'WiFi password must be at least 8 characters')
      .optional(),
    interface: z
      .string()
      .default('wlan1'),
    ipPool: z
      .string()
      .default('192.168.10.100-192.168.10.200'),
    dnsServers: z
      .array(z.string().refine(val => ipAddressRegex.test(val), { message: 'Please enter a valid IP address' }))
      .default(['8.8.8.8', '8.8.4.4']),
    maxUsers: z
      .number()
      .int()
      .min(1, 'Max users must be at least 1')
      .max(1000, 'Max users cannot exceed 1000')
      .default(50),
  }).optional(),
  pppoeConfig: z.object({
    enabled: z.boolean().default(false),
    interface: z
      .string()
      .default('ether1'),
    ipPool: z
      .string()
      .default('192.168.1.100-192.168.1.200'),
    dnsServers: z
      .array(z.string().refine(val => ipAddressRegex.test(val), { message: 'Please enter a valid IP address' }))
      .default(['8.8.8.8', '8.8.4.4']),
    defaultProfile: z
      .string()
      .default('default'),
  }).optional(),
});

export const updateRouterSchema = addRouterSchema.partial();

export type AddRouterInput = z.infer<typeof addRouterSchema>;
export type UpdateRouterInput = z.infer<typeof updateRouterSchema>;

// User Management Schemas
export const addPPPoEUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be less than 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(50, 'Password must be less than 50 characters'),
  fullName: z
    .string()
    .min(1, 'Full name is required')
    .max(100, 'Full name must be less than 100 characters'),
  email: z
    .string()
    .email('Please enter a valid email address')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .transform(preprocessPhone)
    .refine((val) => phoneNumberRegex.test(val), {
      message: 'Please enter a valid Kenyan phone number',
    }),
  address: z
    .string()
    .max(200, 'Address must be less than 200 characters')
    .optional(),
  idNumber: z
    .string()
    .max(20, 'ID number must be less than 20 characters')
    .optional(),
  packageType: z
    .string()
    .min(1, 'Package type is required'),
  bandwidth: z.object({
    upload: z
      .number()
      .int()
      .min(1, 'Upload speed must be at least 1 kbps')
      .max(1000000, 'Upload speed cannot exceed 1 Gbps'),
    download: z
      .number()
      .int()
      .min(1, 'Download speed must be at least 1 kbps')
      .max(1000000, 'Download speed cannot exceed 1 Gbps'),
  }),
  dataLimit: z
    .number()
    .int()
    .min(0, 'Data limit cannot be negative')
    .default(0), // 0 = unlimited
  price: z
    .number()
    .min(1, 'Price must be at least KSh 1')
    .max(100000, 'Price cannot exceed KSh 100,000'),
  billingCycle: z
    .enum(['daily', 'weekly', 'monthly'])
    .default('monthly'),
  gracePeriod: z
    .number()
    .int()
    .min(0, 'Grace period cannot be negative')
    .max(30, 'Grace period cannot exceed 30 days')
    .default(3),
  autoDisconnect: z
    .boolean()
    .default(true),
  staticIp: z
    .string()
    .refine((val) => ipAddressRegex.test(val), {
      message: 'Please enter a valid IP address',
    })
    .optional()
    .or(z.literal('')),
});

export const updatePPPoEUserSchema = addPPPoEUserSchema.partial().extend({
  status: z
    .enum(['active', 'suspended', 'terminated', 'grace_period'])
    .optional(),
});

export type AddPPPoEUserInput = z.infer<typeof addPPPoEUserSchema>;
export type UpdatePPPoEUserInput = z.infer<typeof updatePPPoEUserSchema>;

// Voucher Management Schemas
export const generateVouchersSchema = z.object({
  routerId: z
    .string()
    .min(1, 'Router ID is required'),
  packageType: z
    .string()
    .min(1, 'Package type is required'),
  quantity: z
    .number()
    .int()
    .min(1, 'Quantity must be at least 1')
    .max(1000, 'Cannot generate more than 1000 vouchers at once'),
  duration: z
    .number()
    .int()
    .min(1, 'Duration must be at least 1 minute')
    .max(43200, 'Duration cannot exceed 30 days (43,200 minutes)'),
  dataLimit: z
    .number()
    .int()
    .min(0, 'Data limit cannot be negative')
    .default(0), // 0 = unlimited
  bandwidth: z.object({
    upload: z
      .number()
      .int()
      .min(1, 'Upload speed must be at least 1 kbps')
      .max(100000, 'Upload speed cannot exceed 100 Mbps'),
    download: z
      .number()
      .int()
      .min(1, 'Download speed must be at least 1 kbps')
      .max(100000, 'Download speed cannot exceed 100 Mbps'),
  }),
  price: z
    .number()
    .min(1, 'Price must be at least KSh 1')
    .max(10000, 'Price cannot exceed KSh 10,000'),
  expiryDays: z
    .number()
    .int()
    .min(1, 'Vouchers must expire in at least 1 day')
    .max(365, 'Vouchers cannot expire after 1 year')
    .default(30),
  prefix: z
    .string()
    .max(10, 'Prefix must be less than 10 characters')
    .regex(/^[A-Z0-9]*$/, 'Prefix can only contain uppercase letters and numbers')
    .optional(),
});

export type GenerateVouchersInput = z.infer<typeof generateVouchersSchema>;

// Payment and Billing Schemas
export const paymentSetupSchema = z.object({
  paymentMethod: z
    .enum(['company_paybill', 'customer_paybill'])
    .refine((val) => !!val, { message: 'Please select a payment method' }),
  paybillNumber: z
    .string()
    .min(5, 'Paybill number must be at least 5 digits')
    .max(10, 'Paybill number must be less than 10 digits')
    .regex(/^\d+$/, 'Paybill number must contain only digits')
    .optional(),
  accountNumber: z
    .string()
    .max(20, 'Account number must be less than 20 characters')
    .optional(),
  apiConfig: z.object({
    consumerKey: z
      .string()
      .min(1, 'Consumer key is required')
      .optional(),
    consumerSecret: z
      .string()
      .min(1, 'Consumer secret is required')
      .optional(),
    passkey: z
      .string()
      .min(1, 'Passkey is required')
      .optional(),
    environment: z
      .enum(['sandbox', 'production'])
      .default('sandbox')
      .optional(),
  }).optional(),
}).refine((data) => {
  if (data.paymentMethod === 'customer_paybill') {
    return data.paybillNumber && data.apiConfig?.consumerKey && data.apiConfig?.consumerSecret;
  }
  return true;
}, {
  message: 'Customer paybill requires paybill number and API configuration',
  path: ['paybillNumber'],
});

export type PaymentSetupInput = z.infer<typeof paymentSetupSchema>;

// Support Ticket Schemas
export const createTicketSchema = z.object({
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(100, 'Title must be less than 100 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must be less than 2000 characters'),
  category: z
    .enum(['technical', 'billing', 'general', 'feature_request'], {
      message: 'Please select a category',
    }),
  priority: z
    .enum(['low', 'medium', 'high', 'urgent'])
    .default('medium'),
  routerId: z
    .string()
    .optional(),
  attachments: z
    .array(z.object({
      name: z.string(),
      url: z.string().url(),
      size: z.number(),
    }))
    .max(5, 'Maximum 5 attachments allowed')
    .optional(),
});

export const addTicketMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message must be less than 2000 characters'),
  attachments: z
    .array(z.object({
      name: z.string(),
      url: z.string().url(),
      size: z.number(),
    }))
    .max(3, 'Maximum 3 attachments per message')
    .optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type AddTicketMessageInput = z.infer<typeof addTicketMessageSchema>;

// Settings Schemas
export const profileSettingsSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .transform(preprocessPhone)
    .refine((val) => phoneNumberRegex.test(val), {
      message: 'Please enter a valid Kenyan phone number',
    }),
  businessInfo: z.object({
    name: z
      .string()
      .min(2, 'Business name must be at least 2 characters')
      .max(100, 'Business name must be less than 100 characters'),
    type: z
      .enum(['homeowner', 'isp', 'business']),
    registrationNumber: z
      .string()
      .max(20, 'Registration number must be less than 20 characters')
      .optional(),
    taxId: z
      .string()
      .max(20, 'Tax ID must be less than 20 characters')
      .optional(),
    address: z.object({
      street: z
        .string()
        .max(100, 'Street address must be less than 100 characters')
        .optional(),
      city: z
        .string()
        .max(50, 'City must be less than 50 characters')
        .optional(),
      county: z
        .string()
        .max(50, 'County must be less than 50 characters')
        .optional(),
      country: z
        .string()
        .default('Kenya'),
      postalCode: z
        .string()
        .max(10, 'Postal code must be less than 10 characters')
        .optional(),
    }),
    contact: z.object({
      website: z
        .string()
        .url('Please enter a valid website URL')
        .optional()
        .or(z.literal('')),
    }),
  }),
});

export const notificationSettingsSchema = z.object({
  email: z.object({
    enabled: z.boolean().default(true),
    frequency: z.enum(['immediate', 'daily', 'weekly']).default('immediate'),
    types: z.object({
      routerAlerts: z.boolean().default(true),
      paymentUpdates: z.boolean().default(true),
      systemMaintenance: z.boolean().default(true),
      marketing: z.boolean().default(false),
    }),
  }),
  sms: z.object({
    enabled: z.boolean().default(true),
    types: z.object({
      criticalAlerts: z.boolean().default(true),
      paymentConfirmations: z.boolean().default(true),
      securityAlerts: z.boolean().default(true),
    }),
  }),
  push: z.object({
    enabled: z.boolean().default(true),
    types: z.object({
      routerStatus: z.boolean().default(true),
      newPayments: z.boolean().default(true),
      supportReplies: z.boolean().default(true),
    }),
  }),
});

export const securitySettingsSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z
    .string()
    .min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const twoFactorSetupSchema = z.object({
  method: z.enum(['sms', 'app'], {
    message: 'Please select a 2FA method',
  }),
  phoneNumber: z
    .string()
    .transform(preprocessPhone)
    .refine((val) => phoneNumberRegex.test(val), {
      message: 'Please enter a valid Kenyan phone number',
    })
    .optional(),
  verificationCode: z
    .string()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d+$/, 'Verification code must contain only digits'),
});

export type ProfileSettingsInput = z.infer<typeof profileSettingsSchema>;
export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;
export type SecuritySettingsInput = z.infer<typeof securitySettingsSchema>;
export type TwoFactorSetupInput = z.infer<typeof twoFactorSetupSchema>;

// File Upload Schema
export const fileUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= 10 * 1024 * 1024, {
      message: 'File size must be less than 10MB',
    })
    .refine((file) => {
      const allowedTypes = [
        'image/jpeg',
        'image/png', 
        'image/gif',
        'application/pdf',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      return allowedTypes.includes(file.type);
    }, {
      message: 'File type not supported. Please upload images, PDFs, or Excel files.',
    }),
  type: z.enum(['avatar', 'document', 'backup', 'import']),
});

export type FileUploadInput = z.infer<typeof fileUploadSchema>;

// Search and Filter Schemas
export const searchFiltersSchema = z.object({
  query: z.string().optional(),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  category: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type SearchFiltersInput = z.infer<typeof searchFiltersSchema>;

// Common validation helpers
export const validateKenyanPhone = (phone: string): boolean => {
  const cleaned = preprocessPhone(phone);
  return phoneNumberRegex.test(cleaned);
};

export const validateIPAddress = (ip: string): boolean => {
  return ipAddressRegex.test(ip);
};

export const validateMACAddress = (mac: string): boolean => {
  return macAddressRegex.test(mac);
};

export const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
};

// Password strength checker
export const checkPasswordStrength = (password: string): {
  score: number;
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else feedback.push('Use at least 8 characters');

  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Include lowercase letters');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Include uppercase letters');

  if (/\d/.test(password)) score += 1;
  else feedback.push('Include numbers');

  if (/[^a-zA-Z\d]/.test(password)) score += 1;
  else feedback.push('Include special characters');

  return { score, feedback };
};