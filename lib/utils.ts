import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ===== CORE UTILITIES =====

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ===== FORMATTING UTILITIES =====

export function formatCurrency(
  amount: number, 
  currency: string = 'KES',
  locale: string = 'en-KE'
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    // Fallback for unsupported locales
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function formatNumber(
  value: number,
  options?: {
    decimals?: number;
    compact?: boolean;
    locale?: string;
  }
): string {
  const { decimals = 0, compact = false, locale = 'en-KE' } = options || {};

  if (compact) {
    return new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: decimals,
    }).format(value);
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(
  date: string | Date, 
  format: 'short' | 'long' | 'relative' | 'time' | 'datetime' = 'short',
  locale: string = 'en-KE'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (!dateObj || isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }
  
  if (format === 'relative') {
    return formatRelativeTime(dateObj);
  }
  
  const options: Intl.DateTimeFormatOptions = {
    short: { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    },
    long: { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    },
    time: { 
      hour: '2-digit', 
      minute: '2-digit' 
    },
    datetime: { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    },
  }[format] as Intl.DateTimeFormatOptions || {};

  return dateObj.toLocaleDateString(locale, options);
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 0) return 'In the future';
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  
  return `${Math.floor(diffInSeconds / 31536000)} years ago`;
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export function formatPercentage(
  value: number, 
  total: number, 
  decimals: number = 1
): string {
  if (total === 0) return '0%';
  const percentage = (value / total) * 100;
  return `${percentage.toFixed(decimals)}%`;
}

// ===== VALIDATION UTILITIES =====

export function validatePhoneNumber(phone: string): boolean {
  // Kenyan phone number validation
  const kenyaPhoneRegex = /^(\+254|254|0)(7|1)\d{8}$/;
  return kenyaPhoneRegex.test(phone.replace(/\s+/g, ''));
}

export function formatPhoneNumber(phone: string): string {
  // Format to +254 format
  let cleaned = phone.replace(/\s+/g, '');
  
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.slice(1);
  }
  
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateIPAddress(ip: string): boolean {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
}

export function validateMACAddress(mac: string): boolean {
  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  return macRegex.test(mac);
}

// ===== STRING UTILITIES =====

export function truncateString(str: string, length: number, suffix: string = '...'): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + suffix;
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function generateRandomString(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateVoucherCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ===== FUNCTION UTILITIES =====

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map();
  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// ===== ARRAY UTILITIES =====

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

export function sortBy<T>(array: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

export function removeEmpty<T>(array: (T | null | undefined)[]): T[] {
  return array.filter((item): item is T => item != null);
}

// ===== OBJECT UTILITIES =====

export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(key => delete result[key]);
  return result;
}

export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

export function isEmpty(value: any): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (a == null || b == null) return false;
  
  if (typeof a !== typeof b) return false;
  
  if (typeof a !== 'object') return false;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  return true;
}

// ===== UTILITY FUNCTIONS =====

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function retry<T>(
  fn: () => Promise<T>,
  attempts: number = 3,
  delay: number = 1000
): Promise<T> {
  return fn().catch(err => {
    if (attempts <= 1) throw err;
    return sleep(delay).then(() => retry(fn, attempts - 1, delay * 2));
  });
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomChoice<T>(array: T[]): T {
  if (array.length === 0) {
    throw new Error('Cannot select a random element from an empty array');
  }
  const idx = Math.floor(Math.random() * array.length);
  // The check above guarantees idx is valid, so this cast is safe
  return array[idx] as T;
}

export function getRandomColor(): string {
  const colors = [
    'bg-red-500', 'bg-yellow-500', 'bg-green-500', 'bg-blue-500',
    'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500',
    'bg-teal-500', 'bg-cyan-500', 'bg-lime-500', 'bg-emerald-500'
  ];
  return randomChoice(colors);
}

// ===== FILE UTILITIES =====

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
}

export function getFileExtension(filename: string): string {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

export function formatFileSize(bytes: number): string {
  return formatBytes(bytes);
}

export function isImageFile(filename: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const extension = getFileExtension(filename).toLowerCase();
  return imageExtensions.includes(extension);
}

// ===== DOWNLOAD UTILITIES =====

export function downloadAsJSON(data: any, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, `${filename}.json`);
}

export function downloadAsCSV(data: any[], filename: string): void {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  downloadBlob(blob, `${filename}.csv`);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ===== URL UTILITIES =====

export function buildURL(base: string, params: Record<string, any>): string {
  const url = new URL(base, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

export function parseQueryString(query: string): Record<string, string> {
  const params = new URLSearchParams(query);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

// ===== ERROR UTILITIES =====

export function safeParseJSON<T = any>(json: string): T | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function safeParseNumber(value: string | number): number | null {
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

// ===== BUSINESS LOGIC UTILITIES =====

export function calculateCommission(amount: number, rate: number): number {
  return Math.round((amount * rate / 100) * 100) / 100; // Round to 2 decimal places
}

export function calculateVoucherPrice(
  duration: number, 
  basePrice: number = 10, 
  pricePerHour: number = 10
): number {
  const hours = Math.ceil(duration / 60);
  return Math.max(basePrice, hours * pricePerHour);
}

export function getPackageColor(packageType: string): string {
  const colorMap: Record<string, string> = {
    '1hour': 'bg-blue-100 text-blue-800',
    '3hours': 'bg-green-100 text-green-800',
    '5hours': 'bg-yellow-100 text-yellow-800',
    '12hours': 'bg-orange-100 text-orange-800',
    '1day': 'bg-purple-100 text-purple-800',
    '3days': 'bg-pink-100 text-pink-800',
    '1week': 'bg-indigo-100 text-indigo-800',
    '1month': 'bg-red-100 text-red-800',
  };
  return colorMap[packageType] || 'bg-gray-100 text-gray-800';
}

export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    online: 'bg-green-100 text-green-800',
    offline: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-800',
    used: 'bg-blue-100 text-blue-800',
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800';
}

// ===== PERFORMANCE UTILITIES =====

export function measurePerformance<T extends (...args: any[]) => any>(
  fn: T,
  label?: string
): T {
  return ((...args: any[]) => {
    const start = performance.now();
    const result = fn(...args);
    const end = performance.now();
    
    if (label) {
      console.log(`${label} took ${(end - start).toFixed(2)}ms`);
    }
    
    return result;
  }) as T;
}

// ===== TYPE GUARDS =====

export function isString(value: any): value is string {
  return typeof value === 'string';
}

export function isNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: any): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isArray(value: any): value is any[] {
  return Array.isArray(value);
}

// ===== DEVELOPMENT UTILITIES =====

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function debugLog(message: string, data?: any): void {
  if (isDevelopment()) {
    console.log(`[DEBUG] ${message}`, data);
  }
}

// Calculate data usage display
export function formatDataUsage(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}

// Validate Kenyan phone number
export function isValidKenyanPhone(phone: string): boolean {
  if (!phone) return false
  
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '')
  
  // Check various Kenyan phone number formats
  // +254XXXXXXXXX (12 digits total)
  if (cleaned.startsWith('254') && cleaned.length === 12) {
    const number = cleaned.substring(3) // Remove 254
    return number.startsWith('7') || number.startsWith('1') // Mobile (7xx) or landline (1xx)
  }
  
  // 0XXXXXXXXX (10 digits starting with 0)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    const number = cleaned.substring(1) // Remove leading 0
    return number.startsWith('7') || number.startsWith('1') // Mobile (07xx) or landline (01xx)
  }
  
  // 7XXXXXXXX (9 digits starting with 7 - mobile without country code/leading 0)
  if (cleaned.length === 9 && cleaned.startsWith('7')) {
    return true
  }
  
  // 1XXXXXXXX (9 digits starting with 1 - landline without country code/leading 0)
  if (cleaned.length === 9 && cleaned.startsWith('1')) {
    return true
  }
  
  return false
}

// Export all utilities as default for convenience
export default {
  cn,
  formatCurrency,
  formatNumber,
  formatDate,
  formatRelativeTime,
  formatBytes,
  formatDuration,
  formatPercentage,
  validatePhoneNumber,
  formatPhoneNumber,
  validateEmail,
  validateIPAddress,
  validateMACAddress,
  truncateString,
  capitalize,
  capitalizeWords,
  slugify,
  getInitials,
  generateRandomString,
  generateVoucherCode,
  debounce,
  throttle,
  memoize,
  chunk,
  groupBy,
  sortBy,
  unique,
  removeEmpty,
  omit,
  pick,
  isEmpty,
  deepEqual,
  sleep,
  retry,
  randomBetween,
  randomChoice,
  getRandomColor,
  sanitizeFilename,
  getFileExtension,
  formatFileSize,
  isImageFile,
  downloadAsJSON,
  downloadAsCSV,
  downloadBlob,
  buildURL,
  parseQueryString,
  safeParseJSON,
  safeParseNumber,
  calculateCommission,
  calculateVoucherPrice,
  getPackageColor,
  getStatusColor,
  measurePerformance,
  isString,
  isNumber,
  isBoolean,
  isObject,
  isArray,
  isDevelopment,
  isProduction,
  debugLog,
  formatDataUsage,
  isValidKenyanPhone
};