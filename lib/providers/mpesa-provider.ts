// lib/providers/mpesa-provider.ts

import { 
  PaymentProvider, 
  PaymentProviderType, 
  WebhookProcessingResult,
  WebhookAction,
  PaymentInitiationParams,
  PaymentInitiationResult,
  PaymentVerificationResult,
} from '@/lib/interfaces/payment-provider.interface';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

/**
 * M-Pesa Payment Provider
 * 
 * Handles M-Pesa Daraja API integrations including:
 * - C2B confirmation webhooks
 * - STK Push payment initiation
 * - Payment verification
 */
export class MpesaProvider implements PaymentProvider {
  readonly type: PaymentProviderType = 'mpesa';

  private consumerKey: string;
  private consumerSecret: string;
  private shortCode: string;
  private passkey: string;
  private environment: 'sandbox' | 'production';
  private callbackUrl: string;

  constructor(config?: {
    consumerKey?: string;
    consumerSecret?: string;
    shortCode?: string;
    passkey?: string;
    environment?: 'sandbox' | 'production';
    callbackUrl?: string;
  }) {
    // Load from environment variables or use provided config
    this.consumerKey = config?.consumerKey || process.env.MPESA_CONSUMER_KEY || '';
    this.consumerSecret = config?.consumerSecret || process.env.MPESA_CONSUMER_SECRET || '';
    this.shortCode = config?.shortCode || process.env.MPESA_SHORT_CODE || '';
    this.passkey = config?.passkey || process.env.MPESA_PASSKEY || '';
    this.environment = config?.environment || (process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';
    this.callbackUrl = config?.callbackUrl || process.env.MPESA_CALLBACK_URL || '';
  }

  // ============================================
  // WEBHOOK HANDLING
  // ============================================

  /**
   * Handle M-Pesa C2B Confirmation webhook
   * 
   * Processes M-Pesa payment confirmations and determines the action to take:
   * - voucher_assignment: Assign voucher from pool
   * - sms_credits: Add SMS credits to user account
   * - none: Log only (manual handling required)
   */
  async handleWebhook(payload: any): Promise<WebhookProcessingResult> {
    try {
      console.log('[MpesaProvider] Processing webhook:', {
        TransID: payload.TransID,
        TransAmount: payload.TransAmount,
        BillRefNumber: payload.BillRefNumber,
      });

      // Extract payment details
      const {
        TransID,
        TransAmount,
        MSISDN,
        BillRefNumber,
        TransTime,
      } = payload;

      // Validate required fields
      if (!TransID || !TransAmount || !BillRefNumber) {
        throw new Error('Missing required fields in M-Pesa webhook payload');
      }

      const db = await getDatabase();
      const purchaseTime = new Date();

      // Determine the action based on BillRefNumber pattern
      const action = this.determineWebhookAction(BillRefNumber);

      // SMS CREDITS PURCHASE DETECTION
      if (action === 'sms_credits') {
        return await this.handleSMSCreditsPurchase(payload, purchaseTime);
      }

      // VOUCHER PURCHASE - Try to find STK initiation first (for STK Push payments)
      const stkInitiation = await db.collection('stk_initiations').findOne({
        AccountReference: BillRefNumber,
      });

      let packageInfo: any = null;
      let phoneNumber = MSISDN;
      let isSTKPayment = false;

      if (stkInitiation) {
        isSTKPayment = true;

        // Check if already processed (duplicate webhook)
        if (stkInitiation.status === 'completed' && stkInitiation.voucherId) {
          console.log('[MpesaProvider] Already processed - voucher:', stkInitiation.voucherId);
          
          return {
            success: true,
            action: 'none',
            data: {
              transactionId: TransID,
              amount: TransAmount,
              phoneNumber,
              reference: BillRefNumber,
              voucherId: stkInitiation.voucherId,
            },
          };
        }

        // Use STK data for voucher assignment
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

        console.log('[MpesaProvider] Using STK data for voucher assignment');
      } else {
        // Manual payment - look up voucher by reference field
        console.log('[MpesaProvider] Manual payment - looking up by reference:', BillRefNumber);
        
        const voucher = await db.collection('vouchers').findOne({
          reference: BillRefNumber,
          status: 'active',
        });

        if (!voucher) {
          throw new Error(`No voucher found for reference: ${BillRefNumber}`);
        }

        console.log('[MpesaProvider] Found voucher by reference:', voucher._id);
        
        // For manual payments, packageInfo comes from voucher
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
          transactionId: TransID,
          amount: TransAmount,
          phoneNumber,
          reference: BillRefNumber,
          routerId: packageInfo.routerId,
          packageId: packageInfo.packageId,
          customerId: packageInfo.customerId,
        },
      };
    } catch (error: any) {
      console.error('[MpesaProvider] Webhook processing error:', error);
      return {
        success: false,
        action: 'none',
        data: {
          transactionId: payload.TransID || '',
          amount: payload.TransAmount || 0,
          reference: payload.BillRefNumber || '',
        },
        error: error.message,
      };
    }
  }

  /**
   * Verify M-Pesa webhook signature
   * 
   * TODO: Implement actual signature verification for production
   */
  async verifyWebhookSignature(payload: any, signature: string): Promise<boolean> {
    // TODO: Implement M-Pesa signature verification
    // For now, accept all webhooks (development mode)
    console.warn('[MpesaProvider] Webhook signature verification not implemented');
    return true;
  }

  // ============================================
  // PAYMENT INITIATION (STK Push)
  // ============================================

  /**
   * Initiate M-Pesa STK Push payment
   */
  async initiatePayment(params: PaymentInitiationParams): Promise<PaymentInitiationResult> {
    try {
      const accessToken = await this.getAccessToken();
      
      const timestamp = this.getTimestamp();
      const password = this.generatePassword(timestamp);

      const apiUrl = this.environment === 'sandbox'
        ? 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
        : 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

      const requestBody = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: params.amount,
        PartyA: params.phoneNumber,
        PartyB: this.shortCode,
        PhoneNumber: params.phoneNumber,
        CallBackURL: this.callbackUrl,
        AccountReference: params.accountReference,
        TransactionDesc: params.transactionDesc,
      };

      console.log('[MpesaProvider] Initiating STK Push:', {
        phoneNumber: params.phoneNumber,
        amount: params.amount,
        reference: params.accountReference,
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.ResponseCode === '0') {
        return {
          success: true,
          data: {
            checkoutRequestId: data.CheckoutRequestID,
            merchantRequestId: data.MerchantRequestID,
            responseCode: data.ResponseCode,
            responseDescription: data.ResponseDescription,
            customerMessage: data.CustomerMessage,
          },
        };
      } else {
        return {
          success: false,
          error: data.ResponseDescription || data.errorMessage || 'STK Push failed',
        };
      }
    } catch (error: any) {
      console.error('[MpesaProvider] STK Push error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================
  // PAYMENT VERIFICATION
  // ============================================

  /**
   * Verify M-Pesa payment status
   */
  async verifyPayment(transactionId: string): Promise<PaymentVerificationResult> {
    try {
      const accessToken = await this.getAccessToken();
      
      const apiUrl = this.environment === 'sandbox'
        ? 'https://sandbox.safaricom.co.ke/mpesa/transactionstatus/v1/query'
        : 'https://api.safaricom.co.ke/mpesa/transactionstatus/v1/query';

      const timestamp = this.getTimestamp();
      const password = this.generatePassword(timestamp);

      const requestBody = {
        Initiator: process.env.MPESA_INITIATOR_NAME || '',
        SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL || '',
        CommandID: 'TransactionStatusQuery',
        TransactionID: transactionId,
        PartyA: this.shortCode,
        IdentifierType: '4',
        ResultURL: this.callbackUrl,
        QueueTimeOutURL: this.callbackUrl,
        Remarks: 'Transaction status query',
        Occasion: 'Payment verification',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      // Transaction status query is asynchronous - result comes via callback
      // For now, return pending status
      return {
        success: true,
        verified: false,
        data: {
          transactionId,
          amount: 0,
          timestamp: new Date(),
          status: 'pending',
        },
      };
    } catch (error: any) {
      console.error('[MpesaProvider] Payment verification error:', error);
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
    return 'M-Pesa (Safaricom)';
  }

  supportsPaymentInitiation(): boolean {
    return true;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Determine webhook action based on BillRefNumber pattern
   */
  private determineWebhookAction(billRefNumber: string): WebhookAction {
    if (billRefNumber.startsWith('SMS-')) {
      return 'sms_credits';
    }
    // Default to voucher assignment
    return 'voucher_assignment';
  }

  /**
   * Handle SMS credits purchase
   */
  private async handleSMSCreditsPurchase(payload: any, purchaseTime: Date): Promise<WebhookProcessingResult> {
    const { TransID, TransAmount, MSISDN, BillRefNumber } = payload;

    try {
      // Extract userId from BillRefNumber (format: SMS-{userId})
      const userId = BillRefNumber.replace('SMS-', '');
      
      if (!ObjectId.isValid(userId)) {
        throw new Error(`Invalid userId in BillRefNumber: ${BillRefNumber}`);
      }

      const userObjectId = new ObjectId(userId);

      // Calculate credits: 1 KES = 1 credit
      const creditsToAdd = Math.floor(TransAmount);

      console.log('[MpesaProvider] SMS credits purchase:', {
        userId,
        amount: TransAmount,
        credits: creditsToAdd,
      });

      return {
        success: true,
        action: 'sms_credits',
        data: {
          transactionId: TransID,
          amount: TransAmount,
          phoneNumber: MSISDN,
          reference: BillRefNumber,
          userId: userObjectId,
          creditsAdded: creditsToAdd,
        },
      };
    } catch (error: any) {
      console.error('[MpesaProvider] SMS credits error:', error);
      throw error;
    }
  }

  /**
   * Get M-Pesa access token
   */
  private async getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    
    const apiUrl = this.environment === 'sandbox'
      ? 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
      : 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('Failed to get M-Pesa access token');
    }

    return data.access_token;
  }

  /**
   * Generate timestamp in M-Pesa format (YYYYMMDDHHmmss)
   */
  private getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Generate M-Pesa password
   */
  private generatePassword(timestamp: string): string {
    const passwordString = `${this.shortCode}${this.passkey}${timestamp}`;
    return Buffer.from(passwordString).toString('base64');
  }
}

export default MpesaProvider;
