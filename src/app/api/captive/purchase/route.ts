// src/app/api/captive/purchase/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

// Helper function: Validate and normalize Kenyan phone number
function validateAndNormalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;
  
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle different formats
  if (cleaned.startsWith('0')) {
    // 0712345678 -> 254712345678
    cleaned = '254' + cleaned.slice(1);
  } else if (cleaned.startsWith('254')) {
    // Already in correct format
  } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    // 712345678 -> 254712345678
    cleaned = '254' + cleaned;
  } else {
    return null; // Invalid format
  }
  
  // Validate Kenyan phone number (254 followed by 7/1 and 8 more digits)
  if (!/^254[71]\d{8}$/.test(cleaned)) {
    return null;
  }
  
  return cleaned;
}

// Helper function: Normalize MAC address
function normalizeMacAddress(mac: string): string {
  if (!mac) return '';
  
  const cleaned = mac.replace(/[^a-fA-F0-9]/g, '');
  const upper = cleaned.toUpperCase();
  const formatted = upper.match(/.{1,2}/g)?.join(':');
  
  return formatted || mac;
}

// Helper function: Generate voucher code
function generateVoucherCode(): string {
  // Use only unambiguous characters (exclude I, O, 0, 1, L)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  
  for (let i = 0; i < 10; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    code += chars.charAt(randomIndex);
  }
  
  return code;
}

// Helper function: Generate unique voucher code
async function generateUniqueVoucherCode(db: any): Promise<string> {
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    const code = generateVoucherCode();
    
    // Check if code already exists
    const existing = await db.collection('vouchers').findOne({
      'voucherInfo.code': code,
    });
    
    if (!existing) {
      return code;
    }
    
    attempts++;
  }
  
  // Fallback: use timestamp-based code if collision after 3 attempts
  const timestamp = Date.now().toString(36).toUpperCase();
  return `V${timestamp}`;
}

// Helper function: Get M-Pesa access token
async function getMpesaAccessToken(
  consumerKey: string,
  consumerSecret: string
): Promise<string> {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  
  const response = await fetch(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
      },
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to get M-Pesa access token');
  }
  
  const data = await response.json();
  return data.access_token;
}

// Helper function: Initiate STK Push
async function initiateSTKPush(params: {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  paybillNumber: string;
  passkey: string;
  consumerKey: string;
  consumerSecret: string;
  callbackUrl: string;
}): Promise<any> {
  // Get access token
  const accessToken = await getMpesaAccessToken(
    params.consumerKey,
    params.consumerSecret
  );
  
  // Generate timestamp
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14);
  
  // Generate password
  const password = Buffer.from(
    `${params.paybillNumber}${params.passkey}${timestamp}`
  ).toString('base64');
  
  // Prepare request body
  const requestBody = {
    BusinessShortCode: params.paybillNumber,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(params.amount), // Ensure integer
    PartyA: params.phoneNumber,
    PartyB: params.paybillNumber,
    PhoneNumber: params.phoneNumber,
    CallBackURL: params.callbackUrl,
    AccountReference: params.accountReference,
    TransactionDesc: params.transactionDesc,
  };
  
  // Make STK Push request
  const response = await fetch(
    'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );
  
  const data = await response.json();
  
  // Check response
  if (data.ResponseCode !== '0') {
    throw new Error(data.ResponseDescription || data.errorMessage || 'STK Push failed');
  }
  
  return data;
}

// CORS headers for captive portal access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST /api/captive/purchase - Initiate package purchase with M-Pesa
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { router_id, package_id, phone_number, mac_address } = body;

    // Validate required fields
    const errors: any = {};

    if (!router_id) {
      errors.router_id = 'Router ID is required';
    } else if (!ObjectId.isValid(router_id)) {
      errors.router_id = 'Invalid router identifier format';
    }

    if (!package_id) {
      errors.package_id = 'Package ID is required';
    }

    if (!phone_number) {
      errors.phone_number = 'Phone number is required';
    }

    if (!mac_address) {
      errors.mac_address = 'MAC address is required';
    }

    // Return validation errors
    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_input',
          message: 'Invalid request parameters',
          details: errors,
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Validate and normalize phone number
    const normalizedPhone = validateAndNormalizePhoneNumber(phone_number);
    
    if (!normalizedPhone) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_phone_number',
          message: 'Invalid phone number format. Use format: 254712345678 or 0712345678',
          example: '254712345678',
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Normalize MAC address
    const normalizedMac = normalizeMacAddress(mac_address);

    // Connect to database
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Check rate limiting - max 3 purchases per MAC per 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const recentPurchases = await db.collection('purchase_attempts').countDocuments({
      mac_address: normalizedMac,
      timestamp: { $gte: fiveMinutesAgo },
    });

    if (recentPurchases >= 3) {
      return NextResponse.json(
        {
          success: false,
          error: 'rate_limit_exceeded',
          message: 'Too many purchase attempts. Please wait 5 minutes before trying again.',
          retry_after: 300,
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'X-RateLimit-Limit': '3',
            'X-RateLimit-Remaining': '0',
            'Retry-After': '300',
          },
        }
      );
    }

    // Find router
    const router = await db.collection('routers').findOne({
      _id: new ObjectId(router_id),
    });

    if (!router) {
      return NextResponse.json(
        {
          success: false,
          error: 'router_not_found',
          message: 'Router not found. Please contact support.',
        },
        {
          status: 404,
          headers: corsHeaders,
        }
      );
    }

    // Check router status (optional: prevent purchases if router offline)
    // Commenting out to allow offline purchases
    // if (router.health?.status !== 'online') {
    //   return NextResponse.json(
    //     {
    //       success: false,
    //       error: 'router_offline',
    //       message: 'WiFi router is currently offline. Please try again later.',
    //       router_status: router.health?.status || 'unknown',
    //     },
    //     {
    //       status: 503,
    //       headers: corsHeaders,
    //     }
    //   );
    // }

    // Find package
    const selectedPackage = router.packages?.hotspot?.find(
      (pkg: any) => pkg.name === package_id
    );

    if (!selectedPackage) {
      return NextResponse.json(
        {
          success: false,
          error: 'package_not_found',
          message: 'Selected package is not available. Please choose another package.',
          available_packages_url: `/api/captive/packages?routerId=${router_id}`,
        },
        {
          status: 404,
          headers: corsHeaders,
        }
      );
    }

    // Check if package is synced
    if (selectedPackage.syncStatus !== 'synced') {
      return NextResponse.json(
        {
          success: false,
          error: 'package_not_ready',
          message: 'This package is not ready for purchase. Please contact support.',
          support: {
            phone: '+254712345678',
            email: 'support@example.com',
          },
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Check for existing pending payment (prevent duplicate purchases)
    const existingPendingPayment = await db.collection('payments').findOne({
      routerId: new ObjectId(router_id),
      'mpesa.phoneNumber': normalizedPhone,
      status: 'pending',
      createdAt: { $gte: fiveMinutesAgo },
    });

    if (existingPendingPayment) {
      return NextResponse.json(
        {
          success: false,
          error: 'duplicate_purchase',
          message: 'You already have a pending payment. Please complete or wait for it to expire.',
          existing_payment: {
            checkout_id: existingPendingPayment.mpesa?.checkoutRequestId,
            amount: existingPendingPayment.transaction.amount,
            created_at: existingPendingPayment.createdAt,
          },
          polling_url: `/api/captive/payment-status?checkout_id=${existingPendingPayment.mpesa?.checkoutRequestId}`,
        },
        {
          status: 409,
          headers: corsHeaders,
        }
      );
    }

    // Get router owner (ISP) for payment settings
    const routerOwner = await db.collection('users').findOne({
      _id: router.userId,
    });

    if (!routerOwner) {
      return NextResponse.json(
        {
          success: false,
          error: 'owner_not_found',
          message: 'Router owner configuration not found. Please contact support.',
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    // Determine payment method (company vs ISP paybill)
    let paybillNumber: string;
    let paybillPasskey: string;
    let consumerKey: string;
    let consumerSecret: string;
    let accountReference: string;
    let paymentType: string;

    if (routerOwner.paymentSettings?.preferredMethod === 'customer_paybill' &&
        routerOwner.paymentSettings?.paybillNumber) {
      // Use ISP's own paybill
      paybillNumber = routerOwner.paymentSettings.paybillNumber;
      paybillPasskey = routerOwner.paymentSettings.passkey || process.env.MPESA_PASSKEY!;
      consumerKey = routerOwner.paymentSettings.consumerKey || process.env.MPESA_CONSUMER_KEY!;
      consumerSecret = routerOwner.paymentSettings.consumerSecret || process.env.MPESA_CONSUMER_SECRET!;
      accountReference = `ROUTER_${router._id.toString()}`;
      paymentType = 'customer_paybill';
    } else {
      // Use company paybill (default)
      paybillNumber = process.env.COMPANY_PAYBILL_NUMBER || process.env.MPESA_SHORTCODE!;
      paybillPasskey = process.env.COMPANY_PAYBILL_PASSKEY || process.env.MPESA_PASSKEY!;
      consumerKey = process.env.MPESA_CONSUMER_KEY!;
      consumerSecret = process.env.MPESA_CONSUMER_SECRET!;
      // Create short account reference from router ID and MAC
      const shortRouterId = router._id.toString().slice(-8);
      const shortMac = normalizedMac.replace(/:/g, '').slice(-6);
      accountReference = `${shortRouterId}_${shortMac}`;
      paymentType = 'company_paybill';
    }

    // Generate unique voucher code
    const voucherCode = await generateUniqueVoucherCode(db);
    const voucherPassword = voucherCode; // Password same as code for vouchers

    // Prepare STK Push parameters
    const stkPushParams = {
      phoneNumber: normalizedPhone,
      amount: selectedPackage.price,
      accountReference: accountReference.slice(0, 13), // M-Pesa limit
      transactionDesc: `${selectedPackage.displayName}`,
      paybillNumber: paybillNumber,
      passkey: paybillPasskey,
      consumerKey: consumerKey,
      consumerSecret: consumerSecret,
      callbackUrl: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/webhooks/mpesa`,
    };

    // Initiate STK Push
    let stkPushResponse;
    try {
      stkPushResponse = await initiateSTKPush(stkPushParams);
    } catch (stkError) {
      console.error('STK Push failed:', stkError);
      
      return NextResponse.json(
        {
          success: false,
          error: 'payment_initiation_failed',
          message: 'Unable to initiate payment. Please try again or contact support.',
          error_details: stkError instanceof Error ? stkError.message : 'M-Pesa service error',
          support: {
            phone: routerOwner.businessInfo?.contact?.phone || '+254700000000',
            email: routerOwner.businessInfo?.contact?.email || 'support@example.com',
          },
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    // Create payment record
    const paymentDoc = {
      userId: router.userId, // Router owner's user ID
      routerId: router._id,
      transaction: {
        type: 'voucher_purchase' as const,
        amount: selectedPackage.price,
        currency: 'KES',
        description: `${selectedPackage.displayName} voucher`,
        reference: `${router._id}_${Date.now()}`,
      },
      mpesa: {
        phoneNumber: normalizedPhone,
        merchantRequestId: stkPushResponse.MerchantRequestID,
        checkoutRequestId: stkPushResponse.CheckoutRequestID,
        transactionId: null as string | null,
        resultCode: null as number | null,
        resultDesc: null as string | null,
      },
      paybill: {
        paybillNumber: paybillNumber,
        accountNumber: accountReference,
        type: paymentType,
      },
      reconciliation: {
        isReconciled: false,
        reconciledAt: null as Date | null,
        reconciledBy: null as ObjectId | null,
        matchedTransactionId: null as string | null,
        discrepancy: 0,
      },
      linkedItems: [] as Array<{ type: string; itemId: ObjectId; quantity: number }>,
      metadata: {
        mac_address: normalizedMac,
        package_id: selectedPackage.name,
        router_name: router.routerInfo?.name,
      },
      status: 'pending' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const paymentResult = await db.collection('payments').insertOne(paymentDoc);
    const paymentId = paymentResult.insertedId;

    // Create pending voucher
    const voucherDoc = {
      routerId: router._id,
      userId: router.userId, // Router owner's user ID
      voucherInfo: {
        code: voucherCode,
        password: voucherPassword,
        packageType: selectedPackage.name,
        packageDisplayName: selectedPackage.displayName,
        duration: selectedPackage.duration,
        dataLimit: selectedPackage.dataLimit || 0,
        bandwidth: {
          upload: selectedPackage.bandwidth.upload,
          download: selectedPackage.bandwidth.download,
        },
        price: selectedPackage.price,
        currency: 'KES',
      },
      usage: {
        used: false,
        userId: null as string | null,
        deviceMac: null as string | null,
        startTime: null as Date | null,
        endTime: null as Date | null,
        dataUsed: 0,
        timeUsed: 0,
      },
      payment: {
        method: 'mpesa' as const,
        transactionId: null as string | null,
        phoneNumber: normalizedPhone,
        amount: selectedPackage.price,
        paymentDate: null as Date | null,
      },
      batch: {
        batchId: null as string | null,
        batchSize: 1,
        generatedBy: null as ObjectId | null,
      },
      expiry: {
        expiresAt: new Date(
          Date.now() + (selectedPackage.validity || 30) * 24 * 60 * 60 * 1000
        ),
        autoDelete: true,
      },
      status: 'pending_payment' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const voucherResult = await db.collection('vouchers').insertOne(voucherDoc);
    const voucherId = voucherResult.insertedId;

    // Link voucher to payment
    await db.collection('payments').updateOne(
      { _id: paymentId },
      {
        $push: {
          linkedItems: {
            type: 'voucher',
            itemId: voucherId,
            quantity: 1,
          },
        } as any,
      }
    );

    // Log purchase attempt
    await db.collection('purchase_attempts').insertOne({
      mac_address: normalizedMac,
      router_id: router._id,
      owner_user_id: router.userId, // Router owner's user ID
      package_id: selectedPackage.name,
      phone_number: normalizedPhone,
      amount: selectedPackage.price,
      payment_id: paymentId,
      voucher_id: voucherId,
      checkout_request_id: stkPushResponse.CheckoutRequestID,
      timestamp: new Date(),
    });

    // Build successful response
    const response = {
      success: true,
      checkout: {
        checkout_request_id: stkPushResponse.CheckoutRequestID,
        merchant_request_id: stkPushResponse.MerchantRequestID,
        response_code: stkPushResponse.ResponseCode,
        response_description: stkPushResponse.ResponseDescription,
        customer_message: 'Please enter your M-Pesa PIN on your phone to complete payment',
      },
      payment: {
        payment_id: paymentId.toString(),
        amount: selectedPackage.price,
        currency: 'KSh',
        phone_number: normalizedPhone,
      },
      package: {
        name: selectedPackage.displayName,
        duration: `${selectedPackage.duration} minutes`,
        price: selectedPackage.price,
      },
      polling: {
        url: '/api/captive/payment-status',
        checkout_id: stkPushResponse.CheckoutRequestID,
        interval: 3000, // Poll every 3 seconds
        timeout: 60000, // Timeout after 60 seconds
      },
      instructions: {
        step_1: 'Check your phone for M-Pesa prompt',
        step_2: 'Enter your M-Pesa PIN',
        step_3: 'Wait for confirmation',
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        ...corsHeaders,
        'X-RateLimit-Limit': '3',
        'X-RateLimit-Remaining': String(3 - recentPurchases - 1),
      },
    });
  } catch (error) {
    console.error('Error processing purchase:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'server_error',
        message: 'Unable to process purchase. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}