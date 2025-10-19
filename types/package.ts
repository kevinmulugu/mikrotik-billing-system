// types/package.ts

export interface PackageBandwidth {
  upload: number;   // Mbps
  download: number; // Mbps
}

export interface PackageStats {
  count: number;          // Total vouchers sold
  revenue: number;        // Total revenue generated
  lastPurchased?: Date;   // Last voucher purchase timestamp
}

export type PackageSyncStatus = 'synced' | 'out_of_sync' | 'not_on_router';

export interface Package {
  _id?: string;
  name: string;              // Technical name (immutable)
  displayName: string;       // Customer-facing name
  description?: string;      // Marketing description
  price: number;             // Price in KSh
  duration: number;          // Duration in minutes
  dataLimit: number;         // Data limit in MB (0 = unlimited)
  bandwidth: PackageBandwidth;
  validity: number;          // Validity period in days
  enabled: boolean;          // Package is active/disabled
  syncStatus: PackageSyncStatus;
  activeUsers?: number;      // Currently connected users using this package
  stats?: PackageStats;      // Sales and revenue statistics
  createdAt?: Date;
  updatedAt?: Date;
  lastSyncedAt?: Date;       // Last sync to router timestamp
}

// Form data for creating packages
export interface CreatePackageFormData {
  name: string;
  displayName: string;
  description?: string;
  price: string;             // String for form input
  duration: string;          // String for form input
  dataLimit: string;         // String for form input
  uploadSpeed: string;       // String for form input
  downloadSpeed: string;     // String for form input
  validity: string;          // String for form input
}

// Form data for editing packages (name excluded)
export interface EditPackageFormData {
  displayName: string;
  description?: string;
  price: string;
  duration: string;
  dataLimit: string;
  uploadSpeed: string;
  downloadSpeed: string;
  validity: string;
}

// API request body for creating package
export interface CreatePackageRequest {
  name: string;
  displayName: string;
  description?: string;
  price: number;
  duration: number;
  dataLimit: number;
  bandwidth: PackageBandwidth;
  validity: number;
  syncToRouter?: boolean;    // Whether to sync immediately after creation
}

// API request body for updating package
export interface UpdatePackageRequest {
  displayName?: string;
  description?: string;
  price?: number;
  duration?: number;
  dataLimit?: number;
  bandwidth?: Partial<PackageBandwidth>;
  validity?: number;
}

// API response for package operations
export interface PackageResponse {
  success: boolean;
  package?: Package;
  message?: string;
  syncRequired?: boolean;    // Whether router sync is needed
}

// API response for package list
export interface PackageListResponse {
  success: boolean;
  packages: Package[];
}

// API response for sync operation
export interface PackageSyncResponse {
  success: boolean;
  message: string;
  syncDetails: {
    syncedAt: string;
    profileCreated: boolean;
    syncStatus: PackageSyncStatus;
  };
}

// API response for status toggle
export interface PackageStatusResponse {
  success: boolean;
  package: Package;
  message: string;
}

// Validation errors for package forms
export interface PackageValidationErrors {
  name?: string;
  displayName?: string;
  description?: string;
  price?: string;
  duration?: string;
  dataLimit?: string;
  uploadSpeed?: string;
  downloadSpeed?: string;
  validity?: string;
}

// Package filter/sort options
export interface PackageFilterOptions {
  enabled?: boolean;
  syncStatus?: PackageSyncStatus;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'name' | 'price' | 'revenue' | 'sold' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}