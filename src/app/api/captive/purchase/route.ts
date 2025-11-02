// src/app/api/captive/purchase/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { mpesaService } from '@/lib/services/mpesa';

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
  console.log('🚀 [Captive Purchase] Request received');
  
  try {
    // Parse request body
    const body = await request.json();
    const { router_id, package_id, phone_number, mac_address } = body;
    
    console.log('📝 [Captive Purchase] Request body:', {
      router_id,
      package_id,
      phone_number,
      mac_address,
    });

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
      console.log('❌ [Captive Purchase] Validation errors:', errors);
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
    console.log('📱 [Captive Purchase] Phone normalized:', { raw: phone_number, normalized: normalizedPhone });
    
    if (!normalizedPhone) {
      console.log('❌ [Captive Purchase] Invalid phone number format');
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
    console.log('💻 [Captive Purchase] MAC normalized:', { raw: mac_address, normalized: normalizedMac });

    // Connect to database
    console.log('🔌 [Captive Purchase] Connecting to database...');
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');
    console.log('✅ [Captive Purchase] Database connected');

    // Check rate limiting - max 3 purchases per MAC per 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    console.log('⏱️  [Captive Purchase] Checking rate limit...');
    const recentPurchases = await db.collection('purchase_attempts').countDocuments({
      mac_address: normalizedMac,
      timestamp: { $gte: fiveMinutesAgo },
    });
    console.log(`📊 [Captive Purchase] Recent purchases: ${recentPurchases}/3`);

    if (recentPurchases >= 3) {
      console.log('🚫 [Captive Purchase] Rate limit exceeded');

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
    console.log('🔍 [Captive Purchase] Finding router:', router_id);
    const router = await db.collection('routers').findOne({
      _id: new ObjectId(router_id),
    });

    if (!router) {
      console.log('❌ [Captive Purchase] Router not found:', router_id);
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
    
    console.log('✅ [Captive Purchase] Router found:', router.routerInfo?.name);

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
    console.log('📦 [Captive Purchase] Finding package:', package_id);
    const selectedPackage = router.packages?.hotspot?.find(
      (pkg: any) => pkg.name === package_id
    );

    if (!selectedPackage) {
      console.log('❌ [Captive Purchase] Package not found:', package_id);
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
    
    console.log('✅ [Captive Purchase] Package found:', {
      name: selectedPackage.displayName,
      price: selectedPackage.price,
      duration: selectedPackage.duration,
      syncStatus: selectedPackage.syncStatus,
    });

    // Check if package is synced
    if (selectedPackage.syncStatus !== 'synced') {
      console.log('❌ [Captive Purchase] Package not synced:', selectedPackage.syncStatus);
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
    console.log('🔍 [Captive Purchase] Checking for pending payments...');
    const existingPendingPayment = await db.collection('payments').findOne({
      routerId: new ObjectId(router_id),
      'mpesa.phoneNumber': normalizedPhone,
      status: 'pending',
      createdAt: { $gte: fiveMinutesAgo },
    });

    if (existingPendingPayment) {
      console.log('⚠️  [Captive Purchase] Existing pending payment found:', existingPendingPayment._id);
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
    console.log('👤 [Captive Purchase] Finding router owner:', router.userId);
    const routerOwner = await db.collection('users').findOne({
      _id: router.userId,
    });

    if (!routerOwner) {
      console.log('❌ [Captive Purchase] Router owner not found:', router.userId);
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
    
    console.log('✅ [Captive Purchase] Router owner found:', routerOwner.email);

    // Generate unique voucher code that will be used as AccountReference
    console.log('🎫 [Captive Purchase] Generating voucher code...');
    const voucherCode = await generateUniqueVoucherCode(db);
    console.log('✅ [Captive Purchase] Voucher code generated:', voucherCode);
    const voucherPassword = voucherCode; // Password same as code for vouchers
    const accountReference = voucherCode; // Use voucher code as account reference

    // Get router owner's paybill from paymentSettings
    let paybillNumber: string | null = null;
    
    if (routerOwner.paymentSettings?.paybillNumber) {
      paybillNumber = routerOwner.paymentSettings.paybillNumber;
    }
    
    console.log('💳 [Captive Purchase] Paybill number:', paybillNumber || 'NOT CONFIGURED');

    // If no paybill configured, return error
    if (!paybillNumber) {
      console.log('❌ [Captive Purchase] No paybill configured for owner');
      return NextResponse.json(
        {
          success: false,
          error: 'payment_not_configured',
          message: 'Payment method not configured. Please contact the WiFi provider.',
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

    // Verify paybill exists in database
    console.log('🔍 [Captive Purchase] Verifying paybill in database...');
    const paybill = await db.collection('paybills').findOne({
      'paybillInfo.number': paybillNumber,
      status: 'active',
    });

    if (!paybill) {
      console.log('❌ [Captive Purchase] Paybill not found in database:', paybillNumber);
      return NextResponse.json(
        {
          success: false,
          error: 'paybill_not_found',
          message: 'Payment configuration not found or inactive. Please contact support.',
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }
    
    console.log('✅ [Captive Purchase] Paybill verified:', paybill.paybillInfo.name);

    // Prepare STK Push parameters using mpesaService
    const callbackUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/webhooks/mpesa/callback`;
    
    console.log('🚀 [Captive Purchase] Initiating STK Push with params:', {
      paybillNumber,
      phoneNumber: normalizedPhone,
      amount: selectedPackage.price,
      accountReference,
      callbackUrl,
    });

    // Initiate STK Push using mpesaService
    let stkPushResponse;
    try {
      stkPushResponse = await mpesaService.initiateSTKPush({
        paybillNumber: paybillNumber,
        phoneNumber: normalizedPhone,
        amount: selectedPackage.price,
        accountReference: accountReference, // Use voucher code
        transactionDesc: `${selectedPackage.displayName}`,
        callbackUrl: callbackUrl,
      });

      if (!stkPushResponse.success) {
        console.log('❌ [Captive Purchase] STK Push failed:', stkPushResponse);
        throw new Error(stkPushResponse.error || 'STK Push failed');
      }
      
      console.log('✅ [Captive Purchase] STK Push successful:', {
        checkoutRequestId: stkPushResponse.checkoutRequestId,
        merchantRequestId: stkPushResponse.merchantRequestId,
      });
    } catch (stkError) {
      console.error('❌ [Captive Purchase] STK Push error:', stkError);
      
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
    console.log('💾 [Captive Purchase] Creating payment record...');
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
        merchantRequestId: stkPushResponse.merchantRequestId || '',
        checkoutRequestId: stkPushResponse.checkoutRequestId || '',
        transactionId: null as string | null,
        resultCode: null as number | null,
        resultDesc: null as string | null,
      },
      paybill: {
        paybillNumber: paybillNumber,
        accountNumber: accountReference,
        type: paybill.paybillInfo.type || 'paybill',
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
    console.log('✅ [Captive Purchase] Payment record created:', paymentId);

    // Create pending voucher
    console.log('🎫 [Captive Purchase] Creating voucher record...');
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
    console.log('✅ [Captive Purchase] Voucher record created:', voucherId);

    // Create or update WiFi customer record
    console.log('👥 [Captive Purchase] Managing customer record...');
    // This is where we have the plain phone number from captive portal
    // We save both plain phone and SHA-256 hash for M-Pesa webhook matching
    const sha256Phone = crypto.createHash('sha256').update(normalizedPhone).digest('hex');

    let wifiCustomer = await db.collection('customers').findOne({
      $or: [
        { phone: normalizedPhone },
        { sha256Phone: sha256Phone }
      ]
    });

    if (!wifiCustomer) {
      // Create new WiFi customer with both plain and hashed phone
      const customerResult = await db.collection('customers').insertOne({
        routerId: router._id,
        phone: normalizedPhone, // Plain phone number
        sha256Phone: sha256Phone, // SHA-256 hash for M-Pesa webhook matching
        name: null, // Will be collected later if needed
        email: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastPurchaseDate: new Date(),
        totalPurchases: 1,
        totalSpent: selectedPackage.price,
      });
      wifiCustomer = { _id: customerResult.insertedId };
      console.log(`[Captive Purchase] Created new WiFi customer: ${normalizedPhone} for router: ${router._id}`);
    } else {
      // Update existing customer with plain phone if missing
      const updateFields: any = {
        lastPurchaseDate: new Date(),
        updatedAt: new Date(),
      };
      
      // If we don't have plain phone yet (customer was created via webhook), add it now
      if (!wifiCustomer.phone) {
        updateFields.phone = normalizedPhone;
        console.log(`[Captive Purchase] Updated customer with plain phone number`);
      }

      await db.collection('customers').updateOne(
        { _id: wifiCustomer._id },
        {
          $set: updateFields,
          $inc: {
            totalPurchases: 1,
            totalSpent: selectedPackage.price,
          }
        }
      );
      console.log(`[Captive Purchase] Updated existing WiFi customer: ${normalizedPhone}`);
    }

    // Link voucher to customer
    await db.collection('vouchers').updateOne(
      { _id: voucherId },
      {
        $set: {
          customerId: wifiCustomer._id,
        }
      }
    );

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

    // Save STK initiation data for callback matching
    await db.collection('stk_initiations').insertOne({
      CheckoutRequestID: stkPushResponse.checkoutRequestId || '',
      MerchantRequestID: stkPushResponse.merchantRequestId || '',
      AccountReference: accountReference, // Voucher code
      PhoneNumber: normalizedPhone, // Raw phone number
      Amount: selectedPackage.price,
      paybillNumber: paybillNumber,
      routerId: router._id,
      voucherId: voucherId,
      paymentId: paymentId,
      status: 'initiated',
      createdAt: new Date(),
    });

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
      checkout_request_id: stkPushResponse.checkoutRequestId,
      timestamp: new Date(),
    });

    console.log('✅ [Captive Purchase] All records created successfully');

    // Build successful response
    const response = {
      success: true,
      checkout: {
        checkout_request_id: stkPushResponse.checkoutRequestId,
        merchant_request_id: stkPushResponse.merchantRequestId,
        response_code: stkPushResponse.responseCode,
        response_description: stkPushResponse.responseDescription,
        customer_message: stkPushResponse.customerMessage || 'Please enter your M-Pesa PIN on your phone to complete payment',
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
        checkout_id: stkPushResponse.checkoutRequestId,
        interval: 3000, // Poll every 3 seconds
        timeout: 60000, // Timeout after 60 seconds
      },
      instructions: {
        step_1: 'Check your phone for M-Pesa prompt',
        step_2: 'Enter your M-Pesa PIN',
        step_3: 'Wait for confirmation',
      },
    };

    console.log('🎉 [Captive Purchase] Request completed successfully');
    return NextResponse.json(response, {
      status: 200,
      headers: {
        ...corsHeaders,
        'X-RateLimit-Limit': '3',
        'X-RateLimit-Remaining': String(3 - recentPurchases - 1),
      },
    });
  } catch (error) {
    console.error('💥 [Captive Purchase] Fatal error:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');

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