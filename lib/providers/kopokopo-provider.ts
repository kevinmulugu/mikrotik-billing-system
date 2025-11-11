// lib/providers/kopokopo-provider.ts

import { 
  PaymentProvider, 
  PaymentProviderType, 
  WebhookProcessingResult,
  WebhookAction,
  PaymentVerificationResult,
} from '@/lib/interfaces/payment-provider.interface';
import { getDatabase } from '@/lib/database';
import crypto from 'crypto';

/**
 * Kopo Kopo Payment Provider
 * 
 * Handles Kopo Kopo API integrations including:
 * - Webhook notifications for received payments
 * - Payment verification
 * - Till and paybill number support
 */
export class KopoKopoProvider implements PaymentProvider {
  readonly type: PaymentProviderType = 'kopokopo';

  private clientId: string;
  private clientSecret: string;
  private apiKey: string;
  private environment: 'sandbox' | 'production';
  private webhookSecret: string;

  constructor(config?: {
    clientId?: string;
    clientSecret?: string;
    apiKey?: string;
    environment?: 'sandbox' | 'production';
    webhookSecret?: string;
  }) {
    // Load from environment variables or use provided config
    this.clientId = config?.clientId || process.env.KOPOKOPO_CLIENT_ID || '';
    this.clientSecret = config?.clientSecret || process.env.KOPOKOPO_CLIENT_SECRET || '';
    this.apiKey = config?.apiKey || process.env.KOPOKOPO_API_KEY || '';
    this.environment = config?.environment || (process.env.KOPOKOPO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';
    this.webhookSecret = config?.webhookSecret || process.env.KOPOKOPO_WEBHOOK_SECRET || '';
  }

  // ============================================
  // WEBHOOK HANDLING
  // ============================================

  /**
   * Handle Kopo Kopo webhook notification
   * 
   * Kopo Kopo sends webhook notifications when payments are received
   * to your till or paybill number.
   */
  async handleWebhook(payload: any): Promise<WebhookProcessingResult> {
    try {
      console.log('[KopoKopoProvider] Processing webhook:', {
        id: payload.id,
        type: payload.type,
        event: payload.event,
      });

      // Kopo Kopo webhook structure:
      // {
      //   id: "unique-event-id",
      //   type: "Buygoods Transaction",
      //   event: {
      //     resource: {
      //       id: "transaction-id",
      //       amount: "100.00",
      //       currency: "KES",
      //       reference: "BillRefNumber or account reference",
      //       sender_phone_number: "+2547XXXXXXXX",
      //       till_number: "123456",
      //       status: "Success"
      //     }
      //   }
      // }

      const event = payload.event;
      const resource = event?.resource;

      if (!resource) {
        throw new Error('Missing resource in Kopo Kopo webhook payload');
      }

      const {
        id: transactionId,
        amount,
        reference,
        sender_phone_number,
        status,
      } = resource;

      // Validate required fields
      if (!transactionId || !amount || !reference) {
        throw new Error('Missing required fields in Kopo Kopo webhook payload');
      }

      if (status !== 'Success') {
        console.log('[KopoKopoProvider] Payment not successful:', status);
        return {
          success: false,
          action: 'none',
          data: {
            transactionId,
            amount: parseFloat(amount),
            reference,
          },
          error: `Payment status: ${status}`,
        };
      }

      const db = await getDatabase();
      const purchaseTime = new Date();

      // Determine the action based on reference pattern
      const action = this.determineWebhookAction(reference);

      // SMS CREDITS PURCHASE DETECTION
      if (action === 'sms_credits') {
        return await this.handleSMSCreditsPurchase(resource, purchaseTime);
      }

      // VOUCHER PURCHASE - Try to find STK initiation first
      const stkInitiation = await db.collection('stk_initiations').findOne({
        AccountReference: reference,
      });

      let packageInfo: any = null;
      let phoneNumber = sender_phone_number?.replace(/^\+254/, '254') || '';

      if (stkInitiation) {
        // Check if already processed
        if (stkInitiation.status === 'completed' && stkInitiation.voucherId) {
          console.log('[KopoKopoProvider] Already processed - voucher:', stkInitiation.voucherId);
          
          return {
            success: true,
            action: 'none',
            data: {
              transactionId,
              amount: parseFloat(amount),
              phoneNumber,
              reference,
              voucherId: stkInitiation.voucherId,
            },
          };
        }

        // Use STK data
        phoneNumber = stkInitiation.PhoneNumber;
        packageInfo = {
          routerId: stkInitiation.routerId,
          userId: stkInitiation.userId,
          packageId: stkInitiation.packageId,
          packageDisplayName: stkInitiation.packageDisplayName,
          packageDuration: stkInitiation.packageDuration,
          packagePrice: stkInitiation.packagePrice,
          macAddress: stkInitiation.macAddress,
          customerId: stkInitiation.customerId,
          paymentId: stkInitiation.paymentId,
        };

        console.log('[KopoKopoProvider] Using STK data for voucher assignment');
      } else {
        // Manual payment - look up voucher by reference
        console.log('[KopoKopoProvider] Manual payment - looking up by reference:', reference);
        
        const voucher = await db.collection('vouchers').findOne({
          reference: reference,
          status: 'active',
        });

        if (!voucher) {
          throw new Error(`No voucher found for reference: ${reference}`);
        }

        console.log('[KopoKopoProvider] Found voucher by reference:', voucher._id);
        
        packageInfo = {
          routerId: voucher.routerId,
          userId: voucher.userId,
          packageId: voucher.voucherInfo.packageType,
          packageDisplayName: voucher.voucherInfo.packageDisplayName,
          packageDuration: voucher.voucherInfo.duration,
          packagePrice: voucher.voucherInfo.price,
          macAddress: null,
          customerId: null,
          paymentId: null,
        };
      }

      // Return structured data for voucher assignment
      return {
        success: true,
        action: 'voucher_assignment',
        data: {
          transactionId,
          amount: parseFloat(amount),
          phoneNumber,
          reference,
          routerId: packageInfo.routerId,
          packageId: packageInfo.packageId,
          customerId: packageInfo.customerId,
        },
      };
    } catch (error: any) {
      console.error('[KopoKopoProvider] Webhook processing error:', error);
      return {
        success: false,
        action: 'none',
        data: {
          transactionId: payload.event?.resource?.id || '',
          amount: parseFloat(payload.event?.resource?.amount || '0'),
          reference: payload.event?.resource?.reference || '',
        },
        error: error.message,
      };
    }
  }

  /**
   * Verify Kopo Kopo webhook signature
   * 
   * Kopo Kopo signs webhooks with HMAC-SHA256
   */
  async verifyWebhookSignature(payload: any, signature: string): Promise<boolean> {
    try {
      if (!this.webhookSecret) {
        console.warn('[KopoKopoProvider] Webhook secret not configured');
        return false;
      }

      // Kopo Kopo sends signature in X-KopoKopo-Signature header
      const payloadString = JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payloadString)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!isValid) {
        console.error('[KopoKopoProvider] Invalid webhook signature');
      }

      return isValid;
    } catch (error: any) {
      console.error('[KopoKopoProvider] Signature verification error:', error);
      return false;
    }
  }

  // ============================================
  // PAYMENT VERIFICATION
  // ============================================

  /**
   * Verify Kopo Kopo payment status
   */
  async verifyPayment(transactionId: string): Promise<PaymentVerificationResult> {
    try {
      const accessToken = await this.getAccessToken();
      
      const apiUrl = this.environment === 'sandbox'
        ? `https://sandbox.kopokopo.com/api/v1/payments/${transactionId}`
        : `https://api.kopokopo.com/api/v1/payments/${transactionId}`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Kopo Kopo API error: ${response.statusText}`);
      }

      const data = await response.json();

      const payment = data.data;
      const amount = parseFloat(payment.amount.value);
      const status = this.mapKopoKopoStatus(payment.status);

      return {
        success: true,
        verified: status === 'completed',
        data: {
          transactionId: payment.id,
          amount,
          phoneNumber: payment.sender?.phone_number,
          timestamp: new Date(payment.created_at),
          status,
        },
      };
    } catch (error: any) {
      console.error('[KopoKopoProvider] Payment verification error:', error);
      return {
        success: false,
        verified: false,
        error: error.message,
      };
    }
  }

  // ============================================
  // PROVIDER INFORMATION
  // ============================================

  getProviderName(): string {
    return 'Kopo Kopo';
  }

  supportsPaymentInitiation(): boolean {
    return false; // Kopo Kopo doesn't support STK Push
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Determine webhook action based on reference pattern
   */
  private determineWebhookAction(reference: string): WebhookAction {
    if (reference.startsWith('SMS-')) {
      return 'sms_credits';
    }
    return 'voucher_assignment';
  }

  /**
   * Handle SMS credits purchase
   */
  private async handleSMSCreditsPurchase(resource: any, purchaseTime: Date): Promise<WebhookProcessingResult> {
    const { id: transactionId, amount, reference, sender_phone_number } = resource;

    try {
      // Extract userId from reference (format: SMS-{userId})
      const userId = reference.replace('SMS-', '');
      
      if (!userId) {
        throw new Error(`Invalid userId in reference: ${reference}`);
      }

      // Calculate credits: 1 KES = 1 credit
      const creditsToAdd = Math.floor(parseFloat(amount));

      console.log('[KopoKopoProvider] SMS credits purchase:', {
        userId,
        amount,
        credits: creditsToAdd,
      });

      return {
        success: true,
        action: 'sms_credits',
        data: {
          transactionId,
          amount: parseFloat(amount),
          phoneNumber: sender_phone_number?.replace(/^\+254/, '254') || '',
          reference,
          creditsAdded: creditsToAdd,
        },
      };
    } catch (error: any) {
      console.error('[KopoKopoProvider] SMS credits error:', error);
      throw error;
    }
  }

  /**
   * Get Kopo Kopo access token
   */
  private async getAccessToken(): Promise<string> {
    const apiUrl = this.environment === 'sandbox'
      ? 'https://sandbox.kopokopo.com/oauth/token'
      : 'https://api.kopokopo.com/oauth/token';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      }),
    });

    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('Failed to get Kopo Kopo access token');
    }

    return data.access_token;
  }

  /**
   * Map Kopo Kopo status to our standard status
   */
  private mapKopoKopoStatus(kopokopoStatus: string): 'completed' | 'pending' | 'failed' | 'cancelled' {
    switch (kopokopoStatus.toLowerCase()) {
      case 'success':
      case 'completed':
        return 'completed';
      case 'pending':
      case 'processing':
        return 'pending';
      case 'failed':
      case 'rejected':
        return 'failed';
      case 'cancelled':
      case 'reversed':
        return 'cancelled';
      default:
        return 'pending';
    }
  }
}

export default KopoKopoProvider;
