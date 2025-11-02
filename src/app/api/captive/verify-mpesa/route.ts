// src/app/api/captive/verify-mpesa/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper function: Validate M-Pesa transaction code format
function validateMpesaCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  
  // Remove whitespace and convert to uppercase
  const cleaned = code.trim().toUpperCase();
  
  // M-Pesa codes are typically 10 characters, alphanumeric
  // Examples: RBK123456, RCK7A2B3C4, RDK9X8Y7Z6
  if (cleaned.length < 8 || cleaned.length > 12) return false;
  
  // Must be alphanumeric only
  if (!/^[A-Z0-9]+$/.test(cleaned)) return false;
  
  return true;
}

// Helper function: Normalize MAC address format
function normalizeMacAddress(mac: string): string {
  if (!mac) return '';
  
  // Remove all non-alphanumeric characters
  const cleaned = mac.replace(/[^a-fA-F0-9]/g, '');
  
  // Convert to uppercase
  const upper = cleaned.toUpperCase();
  
  // Format as AA:BB:CC:DD:EE:FF
  const formatted = upper.match(/.{1,2}/g)?.join(':');
  
  return formatted || mac;
}

// Helper function: Format duration to human-readable string
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return minutes === 1 ? '1 Minute' : `${minutes} Minutes`;
  }
  
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? '1 Hour' : `${hours} Hours`;
  }
  
  if (minutes < 10080) {
    const days = Math.floor(minutes / 1440);
    return days === 1 ? '1 Day' : `${days} Days`;
  }
  
  const weeks = Math.floor(minutes / 10080);
  return weeks === 1 ? '1 Week' : `${weeks} Weeks`;
}

// Helper function: Format bandwidth
function formatBandwidth(bandwidth: { upload: number; download: number }): string {
  const formatSpeed = (kbps: number): string => {
    if (kbps >= 1024) {
      return `${Math.floor(kbps / 1024)}Mbps`;
    }
    return `${kbps}kbps`;
  };
  
  return `${formatSpeed(bandwidth.upload)}/${formatSpeed(bandwidth.download)}`;
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

// POST /api/captive/verify-mpesa - Verify M-Pesa transaction and get voucher
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const {
      transaction_code,
      router_id,
      mac_address,
    } = body;

    // Validate required fields
    const errors: any = {};

    if (!transaction_code) {
      errors.transaction_code = 'M-Pesa transaction code is required';
    } else if (!validateMpesaCode(transaction_code)) {
      errors.transaction_code = 'Invalid M-Pesa transaction code format';
    }

    if (!router_id) {
      errors.router_id = 'Router ID is required';
    } else if (!ObjectId.isValid(router_id)) {
      errors.router_id = 'Invalid router identifier format';
    }

    if (!mac_address) {
      errors.mac_address = 'MAC address is required';
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'validation_error',
          message: 'Please provide all required information',
          errors,
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Normalize inputs
    const transactionCode = transaction_code.trim().toUpperCase();
    const normalizedMac = normalizeMacAddress(mac_address);

    // Connect to database
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Find router
    const router = await db.collection('routers').findOne({
      _id: new ObjectId(router_id),
    });

    if (!router) {
      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'transaction_not_found',
          message: 'M-Pesa transaction code not recognized. Please check and try again.',
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Find payment by M-Pesa transaction ID
    const payment = await db.collection('payments').findOne({
      'mpesa.transactionId': transactionCode,
      userId: router.userId,
    });

    // Payment not found or doesn't belong to this router owner
    if (!payment) {
      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'transaction_not_found',
          message: 'M-Pesa transaction code not recognized. Please check and try again.',
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Check payment status
    if (payment.status === 'pending') {
      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'payment_pending',
          message: 'Payment is still being processed. Please wait a few moments and try again.',
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    if (payment.status !== 'completed') {
      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'payment_failed',
          message: 'Payment was not successful. Please make a new purchase.',
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Get voucher from payment linked items
    const voucherLink = payment.linkedItems?.find(
      (item: any) => item.type === 'voucher'
    );

    if (!voucherLink || !voucherLink.itemId) {
      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'voucher_not_found',
          message: 'Voucher not found for this transaction. Please contact support.',
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Get voucher details
    const voucher = await db.collection('vouchers').findOne({
      _id: voucherLink.itemId,
    });

    if (!voucher) {
      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'voucher_not_found',
          message: 'Voucher details not found. Please contact support.',
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Verify voucher belongs to correct router
    if (voucher.routerId.toString() !== router_id) {
      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'voucher_mismatch',
          message: 'This voucher is not valid for this router.',
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Check if voucher is already used
    if (voucher.usage.used === true) {
      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'voucher_used',
          message: 'This voucher has already been used.',
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Check voucher expiration
    if (voucher.expiry.expiresAt && new Date(voucher.expiry.expiresAt) < new Date()) {
      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'voucher_expired',
          message: 'This voucher has expired.',
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Check voucher status - should be 'assigned' (paid but not used yet) or 'active'
    if (voucher.status !== 'assigned' && voucher.status !== 'active') {
      return NextResponse.json(
        {
          success: true,
          valid: false,
          error: 'voucher_not_available',
          message: 'This voucher is not available for use. Please contact support.',
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Return successful response with voucher details
    return NextResponse.json(
      {
        success: true,
        valid: true,
        message: 'Voucher verified successfully!',
        voucher: {
          code: voucher.voucherInfo.code,
          password: voucher.voucherInfo.password,
          package_name: voucher.voucherInfo.packageDisplayName || voucher.voucherInfo.packageType,
          duration: voucher.voucherInfo.duration,
          duration_display: formatDuration(voucher.voucherInfo.duration),
          bandwidth: formatBandwidth(voucher.voucherInfo.bandwidth),
          expires_at: voucher.expiry.expiresAt,
        },
        auto_login: {
          username: voucher.voucherInfo.code,
          password: voucher.voucherInfo.password,
        },
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error('Error verifying M-Pesa transaction:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'server_error',
        message: 'Unable to verify transaction. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
