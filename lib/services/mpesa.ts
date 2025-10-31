// lib/services/mpesa.ts
/**
 * M-Pesa Daraja API Service
 * Handles all M-Pesa API operations including:
 * - Token generation
 * - STK Push initiation
 * - Transaction status queries
 */

import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';

interface STKPushParams {
  paybillNumber: string;
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  callbackUrl: string;
}

interface STKPushResponse {
  success: boolean;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  responseCode?: string;
  responseDescription?: string;
  customerMessage?: string;
  error?: string;
}

interface AccessTokenResponse {
  access_token: string;
  expires_in: string;
}

export class MpesaService {
  private static instance: MpesaService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = process.env.MPESA_ENV === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  public static getInstance(): MpesaService {
    if (!MpesaService.instance) {
      MpesaService.instance = new MpesaService();
    }
    return MpesaService.instance;
  }

  /**
   * Generate M-Pesa access token
   */
  async generateAccessToken(paybillNumber: string): Promise<{ token: string; expiresAt: Date } | null> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

      // Get paybill credentials from database
      const paybill = await db.collection('paybills').findOne({
        'paybillInfo.number': paybillNumber,
        status: 'active',
      });

      if (!paybill) {
        throw new Error(`Paybill ${paybillNumber} not found or inactive`);
      }

      const consumerKey = paybill.credentials?.consumerKey;
      const consumerSecret = paybill.credentials?.consumerSecret;

      if (!consumerKey || !consumerSecret) {
        throw new Error(`Missing credentials for paybill ${paybillNumber}`);
      }

      // Generate auth string
      const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

      const response = await fetch(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to generate token: ${response.statusText}`);
      }

      const data: AccessTokenResponse = await response.json();
      
      // Token expires in seconds (usually 3599 seconds = ~1 hour)
      const expiresIn = parseInt(data.expires_in);
      const expiresAt = new Date(Date.now() + (expiresIn * 1000));

      // Update paybill with new token
      await db.collection('paybills').updateOne(
        { _id: paybill._id },
        {
          $set: {
            'credentials.accessToken': data.access_token,
            'credentials.tokenExpiresAt': expiresAt,
            'credentials.lastTokenRefresh': new Date(),
            updatedAt: new Date(),
          },
        }
      );

      console.log(`✅ Generated access token for paybill ${paybillNumber}, expires at ${expiresAt}`);

      return {
        token: data.access_token,
        expiresAt,
      };
    } catch (error) {
      console.error('Error generating M-Pesa access token:', error);
      return null;
    }
  }

  /**
   * Get valid access token (generates new if expired)
   */
  async getValidAccessToken(paybillNumber: string): Promise<string | null> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

      const paybill = await db.collection('paybills').findOne({
        'paybillInfo.number': paybillNumber,
        status: 'active',
      });

      if (!paybill) {
        console.error(`Paybill ${paybillNumber} not found`);
        return null;
      }

      const tokenExpiresAt = paybill.credentials?.tokenExpiresAt;
      const accessToken = paybill.credentials?.accessToken;

      // Check if token exists and is still valid (with 5 min buffer)
      if (accessToken && tokenExpiresAt) {
        const now = new Date();
        const expiryBuffer = new Date(tokenExpiresAt.getTime() - (5 * 60 * 1000)); // 5 min before expiry

        if (now < expiryBuffer) {
          console.log(`✅ Using cached token for paybill ${paybillNumber}`);
          return accessToken;
        }
      }

      // Token expired or doesn't exist, generate new one
      console.log(`🔄 Token expired/missing for paybill ${paybillNumber}, generating new token...`);
      const result = await this.generateAccessToken(paybillNumber);
      return result?.token || null;
    } catch (error) {
      console.error('Error getting valid access token:', error);
      return null;
    }
  }

  /**
   * Initiate STK Push
   */
  async initiateSTKPush(params: STKPushParams): Promise<STKPushResponse> {
    try {
      const accessToken = await this.getValidAccessToken(params.paybillNumber);

      if (!accessToken) {
        return {
          success: false,
          error: 'Failed to get access token',
        };
      }

      // Get paybill details for passkey
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

      const paybill = await db.collection('paybills').findOne({
        'paybillInfo.number': params.paybillNumber,
        status: 'active',
      });

      if (!paybill) {
        return {
          success: false,
          error: 'Paybill not found',
        };
      }

      const passKey = paybill.credentials?.passKey;
      const shortcode = paybill.paybillInfo.number;

      if (!passKey) {
        return {
          success: false,
          error: 'Paybill passkey not configured',
        };
      }

      // Generate timestamp
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);

      // Generate password
      const password = Buffer.from(`${shortcode}${passKey}${timestamp}`).toString('base64');

      // Format phone number (remove leading 0 or +, ensure 254 prefix)
      let phone = params.phoneNumber.replace(/\s/g, '');
      if (phone.startsWith('0')) phone = '254' + phone.slice(1);
      if (phone.startsWith('+')) phone = phone.slice(1);
      if (!phone.startsWith('254')) phone = '254' + phone;

      const stkPayload = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: paybill.paybillInfo.type === 'till' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
        Amount: Math.ceil(params.amount), // Ensure integer
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: params.callbackUrl,
        AccountReference: params.accountReference,
        TransactionDesc: params.transactionDesc,
      };

      console.log('📱 Initiating STK Push:', {
        shortcode,
        phone,
        amount: params.amount,
        reference: params.accountReference,
      });

      const response = await fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stkPayload),
      });

      const data = await response.json();

      if (data.ResponseCode === '0') {
        return {
          success: true,
          checkoutRequestId: data.CheckoutRequestID,
          merchantRequestId: data.MerchantRequestID,
          responseCode: data.ResponseCode,
          responseDescription: data.ResponseDescription,
          customerMessage: data.CustomerMessage,
        };
      } else {
        return {
          success: false,
          responseCode: data.ResponseCode,
          responseDescription: data.ResponseDescription,
          customerMessage: data.CustomerMessage,
          error: data.errorMessage || data.ResponseDescription,
        };
      }
    } catch (error) {
      console.error('Error initiating STK Push:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate STK Push',
      };
    }
  }

  /**
   * Query STK Push status
   */
  async queryStkPushStatus(paybillNumber: string, checkoutRequestId: string): Promise<any> {
    try {
      const accessToken = await this.getValidAccessToken(paybillNumber);

      if (!accessToken) {
        throw new Error('Failed to get access token');
      }

      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

      const paybill = await db.collection('paybills').findOne({
        'paybillInfo.number': paybillNumber,
      });

      if (!paybill) {
        throw new Error('Paybill not found');
      }

      const passKey = paybill.credentials?.passKey;
      const shortcode = paybill.paybillInfo.number;
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = Buffer.from(`${shortcode}${passKey}${timestamp}`).toString('base64');

      const queryPayload = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      };

      const response = await fetch(`${this.baseUrl}/mpesa/stkpushquery/v1/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryPayload),
      });

      return await response.json();
    } catch (error) {
      console.error('Error querying STK Push status:', error);
      throw error;
    }
  }
}

export const mpesaService = MpesaService.getInstance();
