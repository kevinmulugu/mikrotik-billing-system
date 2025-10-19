// src/app/api/captive/payment-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper function: Validate M-Pesa checkout ID format
function validateCheckoutId(checkoutId: string): boolean {
  if (!checkoutId || typeof checkoutId !== 'string') return false;
  
  // M-Pesa checkout IDs start with "ws_CO_" followed by datetime and random chars
  // Format: ws_CO_DDMMYYYYHHMMSSxxxxxxxxxx
  if (!checkoutId.startsWith('ws_CO_')) return false;
  
  // Length should be around 30-35 characters
  if (checkoutId.length < 25 || checkoutId.length > 40) return false;
  
  return true;
}

// Helper function: Calculate elapsed time since payment creation
function calculateElapsedTime(createdAt: Date): number {
  const now = new Date();
  const elapsed = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
  return elapsed; // seconds
}

// Helper function: Interpret M-Pesa result codes
function interpretMpesaResultCode(resultCode: number | null): string {
  if (resultCode === null) return 'Payment processing';
  
  const resultCodeMessages: Record<number, string> = {
    0: 'Payment successful',
    1: 'Insufficient funds in your account',
    1032: 'Payment cancelled by user',
    1037: 'Payment timeout - PIN not entered',
    // 1: 'Insufficient balance',
    2001: 'Invalid initiator information',
    9999: 'Request failed',
    1001: 'Unable to lock subscriber',
    1019: 'Transaction expired',
  };
  
  return resultCodeMessages[resultCode] || `Payment failed (Error code: ${resultCode})`;
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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/captive/payment-status - Check payment status for STK Push
export async function GET(request: NextRequest) {
  try {
    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const checkoutId = searchParams.get('checkout_id');
    const routerId = searchParams.get('router_id'); // Optional

    // Validate checkout_id parameter
    if (!checkoutId) {
      return NextResponse.json(
        {
          success: false,
          error: 'missing_checkout_id',
          message: 'Checkout ID is required',
        },
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    // Validate checkout_id format
    if (!validateCheckoutId(checkoutId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_checkout_id',
          message: 'Invalid checkout ID format',
        },
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    // Connect to database
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Find payment by checkout request ID
    const payment = await db.collection('payments').findOne({
      'mpesa.checkoutRequestId': checkoutId,
    });

    // Payment not found
    if (!payment) {
      return NextResponse.json(
        {
          success: false,
          status: 'not_found',
          error: 'payment_not_found',
          message: 'Payment request not found. Please start a new purchase.',
        },
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    // Optional: Validate router_id if provided
    if (routerId && ObjectId.isValid(routerId)) {
      if (payment.routerId?.toString() !== routerId) {
        return NextResponse.json(
          {
            success: false,
            status: 'not_found',
            error: 'payment_not_found',
            message: 'Payment not found for this router.',
          },
          {
            status: 404,
            headers: {
              ...corsHeaders,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          }
        );
      }
    }

    // Calculate elapsed time
    const elapsedTime = calculateElapsedTime(payment.createdAt);

    // Check if payment has timed out (>10 minutes and still pending)
    const tenMinutes = 10 * 60; // 600 seconds
    if (payment.status === 'pending' && elapsedTime > tenMinutes) {
      return NextResponse.json(
        {
          success: true,
          status: 'timeout',
          error: 'payment_timeout',
          message: 'Payment request expired. Please start a new purchase if you were not charged.',
          payment: {
            payment_id: payment._id.toString(),
            checkout_id: checkoutId,
            amount: payment.transaction.amount,
            created_at: payment.createdAt,
            elapsed_time: elapsedTime,
          },
          instructions: {
            check_sms: 'Check your M-Pesa messages for a transaction code',
            manual_entry: 'If you received a transaction code, use the "I paid via M-Pesa" option',
            support: 'Contact support if money was deducted but you did not receive internet',
          },
        },
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    // Handle payment status: COMPLETED
    if (payment.status === 'completed') {
      // Find linked voucher
      const voucherLink = payment.linkedItems?.find(
        (item: any) => item.type === 'voucher'
      );

      if (!voucherLink || !voucherLink.itemId) {
        return NextResponse.json(
          {
            success: true,
            status: 'completed',
            error: 'voucher_not_found',
            message: 'Payment successful but voucher not found. Please contact support.',
            payment: {
              payment_id: payment._id.toString(),
              transaction_id: payment.mpesa?.transactionId,
              amount: payment.transaction.amount,
              payment_date: payment.createdAt,
            },
          },
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
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
            status: 'completed',
            error: 'voucher_not_found',
            message: 'Payment successful but voucher details not found. Please contact support.',
            payment: {
              payment_id: payment._id.toString(),
              transaction_id: payment.mpesa?.transactionId,
              amount: payment.transaction.amount,
              payment_date: payment.createdAt,
            },
          },
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          }
        );
      }

      // Return successful response with voucher details
      return NextResponse.json(
        {
          success: true,
          status: 'completed',
          payment: {
            payment_id: payment._id.toString(),
            transaction_id: payment.mpesa?.transactionId || 'N/A',
            amount: payment.transaction.amount,
            payment_date: payment.createdAt,
          },
          voucher: {
            code: voucher.voucherInfo.code,
            password: voucher.voucherInfo.password,
            package_name: voucher.voucherInfo.packageDisplayName || voucher.voucherInfo.packageType,
            duration: voucher.voucherInfo.duration,
            duration_display: formatDuration(voucher.voucherInfo.duration),
            bandwidth: formatBandwidth(voucher.voucherInfo.bandwidth),
            expires_at: voucher.expiry.expiresAt,
          },
          message: 'Payment successful! You can now login with your voucher code.',
          auto_login: {
            username: voucher.voucherInfo.code,
            password: voucher.voucherInfo.password,
          },
        },
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    // Handle payment status: FAILED
    if (payment.status === 'failed') {
      const resultCode = payment.mpesa?.resultCode;
      const resultDescription = payment.mpesa?.resultDesc || interpretMpesaResultCode(resultCode);

      return NextResponse.json(
        {
          success: true,
          status: 'failed',
          error: 'payment_failed',
          message: 'Payment was not successful. Please try again.',
          payment: {
            payment_id: payment._id.toString(),
            amount: payment.transaction.amount,
            result_code: resultCode,
            result_description: resultDescription,
          },
          suggestion: 'You can try purchasing again. Contact support if you were charged but did not receive internet.',
        },
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    // Handle payment status: CANCELLED
    if (payment.status === 'cancelled') {
      return NextResponse.json(
        {
          success: true,
          status: 'cancelled',
          error: 'payment_cancelled',
          message: 'Payment was cancelled.',
          payment: {
            payment_id: payment._id.toString(),
            amount: payment.transaction.amount,
          },
        },
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    // Handle payment status: PENDING (default)
    if (payment.status === 'pending') {
      return NextResponse.json(
        {
          success: true,
          status: 'pending',
          message: 'Payment is being processed. Please wait...',
          payment: {
            payment_id: payment._id.toString(),
            amount: payment.transaction.amount,
            created_at: payment.createdAt,
          },
          elapsed_time: elapsedTime,
          instructions: elapsedTime < 10 
            ? 'Please enter your M-Pesa PIN if you haven\'t already'
            : 'Still waiting for M-Pesa confirmation. This may take up to 60 seconds.',
        },
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    // Handle unexpected status
    return NextResponse.json(
      {
        success: true,
        status: 'unknown',
        error: 'unknown_status',
        message: 'Payment status is unknown. Please contact support.',
        payment: {
          payment_id: payment._id.toString(),
          amount: payment.transaction.amount,
          status: payment.status,
        },
      },
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Error checking payment status:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'server_error',
        message: 'Unable to check payment status. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}