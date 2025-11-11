// lib/interfaces/payment-provider.interface.ts

import { ObjectId } from 'mongodb';

/**
 * Payment provider types
 */
export type PaymentProviderType = 'mpesa' | 'kopokopo';

/**
 * Webhook action types
 */
export type WebhookAction = 
  | 'voucher_assignment' 
  | 'sms_credits' 
  | 'refund' 
  | 'none';

/**
 * Payment initiation parameters (for STK Push)
 */
export interface PaymentInitiationParams {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  // Optional metadata
  routerId?: ObjectId;
  userId?: ObjectId;
  packageId?: string;
  packageName?: string;
}

/**
 * Payment initiation result
 */
export interface PaymentInitiationResult {
  success: boolean;
  data?: {
    checkoutRequestId?: string;
    merchantRequestId?: string;
    responseCode?: string;
    responseDescription?: string;
    customerMessage?: string;
  };
  error?: string;
}

/**
 * Webhook processing result
 */
export interface WebhookProcessingResult {
  success: boolean;
  action: WebhookAction;
  data: {
    transactionId: string;
    amount: number;
    phoneNumber?: string;
    reference: string;
    // Voucher-specific
    voucherId?: ObjectId;
    customerId?: ObjectId;
    routerId?: ObjectId;
    packageId?: string;
    // SMS credits-specific
    creditsAdded?: number;
    newBalance?: number;
    userId?: ObjectId;
  };
  error?: string;
}

/**
 * Payment verification result
 */
export interface PaymentVerificationResult {
  success: boolean;
  verified: boolean;
  data?: {
    transactionId: string;
    amount: number;
    phoneNumber?: string;
    timestamp?: Date;
    status: 'completed' | 'pending' | 'failed' | 'cancelled';
  };
  error?: string;
}

/**
 * Main PaymentProvider interface
 * 
 * This interface abstracts payment operations across different providers
 * (M-Pesa, Kopo Kopo, etc.)
 */
export interface PaymentProvider {
  /**
   * Payment provider type
   */
  readonly type: PaymentProviderType;

  // ============================================
  // WEBHOOK HANDLING
  // ============================================

  /**
   * Handle incoming webhook from payment provider
   * 
   * This method processes the webhook payload and returns structured data
   * that can be used for voucher assignment, SMS credits, etc.
   */
  handleWebhook(payload: any): Promise<WebhookProcessingResult>;

  /**
   * Verify webhook signature/authenticity
   * 
   * This method verifies that the webhook is genuinely from the payment provider
   */
  verifyWebhookSignature(payload: any, signature: string): Promise<boolean>;

  // ============================================
  // PAYMENT INITIATION (Optional - for STK Push)
  // ============================================

  /**
   * Initiate payment (e.g., M-Pesa STK Push)
   * 
   * Optional: Only implemented by providers that support payment initiation
   */
  initiatePayment?(params: PaymentInitiationParams): Promise<PaymentInitiationResult>;

  // ============================================
  // PAYMENT VERIFICATION
  // ============================================

  /**
   * Verify payment status
   * 
   * Query the payment provider to verify a transaction
   */
  verifyPayment(transactionId: string): Promise<PaymentVerificationResult>;

  // ============================================
  // PROVIDER INFORMATION
  // ============================================

  /**
   * Get provider name (human-readable)
   */
  getProviderName(): string;

  /**
   * Check if provider supports payment initiation (STK Push)
   */
  supportsPaymentInitiation(): boolean;
}
