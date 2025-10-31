// types/customer.ts
import { ObjectId } from 'mongodb';

/**
 * WiFi Customer (Voucher Purchaser)
 * 
 * This represents customers who purchase WiFi vouchers from a specific router.
 * These are NOT the same as router owners (stored in users collection).
 * 
 * Key Fields:
 * - routerId: Which router they purchased vouchers from
 * - phone: Their M-Pesa phone number (can be null if created via webhook)
 * - sha256Phone: SHA-256 hash of phone for M-Pesa webhook matching
 * 
 * Customer Creation Flow:
 * 1. Via Captive Portal: We get plain phone, create customer with both phone & sha256Phone
 * 2. Via M-Pesa Webhook: We get sha256Phone only, create customer with null phone
 *    - Phone will be populated when they purchase again via captive portal
 */

export interface Customer {
  _id: ObjectId;
  routerId: ObjectId; // The router they purchased vouchers from
  phone: string | null; // M-Pesa phone number (e.g., "254712345678"), null if created via webhook
  sha256Phone: string; // SHA-256 hash of phone number for webhook matching (always present)
  name: string | null; // Customer name (optional, may be collected later)
  email: string | null; // Customer email (optional)
  createdAt: Date; // First purchase date
  updatedAt: Date; // Last update
  lastPurchaseDate: Date; // Last voucher purchase
  totalPurchases?: number; // Total number of vouchers purchased
  totalSpent?: number; // Total amount spent (KES)
}

export interface CustomerWithStats extends Omit<Customer, '_id' | 'routerId' | 'sha256Phone'> {
  id: string;
  statistics: {
    totalPurchases: number;
    totalSpent: number;
    lastPurchase: {
      packageType: string;
      amount: number;
      date: Date;
    } | null;
  };
}

export interface CustomerListResponse {
  customers: CustomerWithStats[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
