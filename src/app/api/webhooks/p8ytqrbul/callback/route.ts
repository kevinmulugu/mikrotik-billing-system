// src/app/api/webhooks/p8ytqrbul/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

/**
 * M-Pesa STK Push Callback Webhook
 * 
 * This endpoint receives callbacks from Safaricom after an STK Push transaction
 * is completed (either successful or failed).
 * 
 * ARCHITECTURE: FAILURE HANDLER ONLY
 * - This webhook ONLY handles payment failures
 * - Successful payments are marked as 'pending_confirmation'
 * - C2B Confirmation webhook handles all voucher assignments
 * - This prevents race conditions and double voucher assignments
 * 
 * Expected Flow:
 * 1. Customer receives STK Push on their phone
 * 2. Customer enters PIN and confirms (or cancels)
 * 3. Safaricom calls this webhook with the result
 * 4. If failure: Update payment/STK status to 'failed'
 * 5. If success: Mark STK as 'pending_confirmation', wait for C2B
 * 6. C2B Confirmation arrives → Assigns voucher from pool
 * 
 * Benefits:
 * - No race conditions (only C2B assigns vouchers)
 * - Clean separation: STK = status updates, C2B = voucher assignment
 * - Duplicate webhook protection (C2B checks if already completed)
 * 
 * Callback Structure:
 * {
 *   "Body": {
 *     "stkCallback": {
 *       "MerchantRequestID": "29115-34620561-1",
 *       "CheckoutRequestID": "ws_CO_191220191020363925",
 *       "ResultCode": 0,  // 0 = success, non-zero = failure
 *       "ResultDesc": "The service request is processed successfully.",
 *       "CallbackMetadata": {
 *         "Item": [
 *           { "Name": "Amount", "Value": 1 },
 *           { "Name": "MpesaReceiptNumber", "Value": "NLJ7RT61SV" },
 *           { "Name": "TransactionDate", "Value": 20191219102115 },
 *           { "Name": "PhoneNumber", "Value": 254708374149 }
 *         ]
 *       }
 *     }
 *   }
 * }
 */

interface STKCallbackItem {
  Name: string;
  Value: string | number;
}

interface STKCallbackMetadata {
  Item: STKCallbackItem[];
}

interface STKCallback {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: STKCallbackMetadata;
}

interface CallbackBody {
  Body: {
    stkCallback: STKCallback;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: CallbackBody = await request.json();

    console.log('[STK Callback] Received:', JSON.stringify(body, null, 2));

    const stkCallback = body.Body?.stkCallback;

    if (!stkCallback) {
      console.error('[STK Callback] Invalid payload structure');
      return NextResponse.json(
        { ResultCode: 1, ResultDesc: 'Invalid callback structure' },
        { status: 400 }
      );
    }

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata,
    } = stkCallback;

    // Connect to database
    const db = await getDatabase();

    // Find the payment record
    const payment = await db.collection('payments').findOne({
      'mpesa.checkoutRequestId': CheckoutRequestID,
    });

    if (!payment) {
      console.error('[STK Callback] Payment not found:', CheckoutRequestID);
      
      // Log the callback even if payment not found
      await db.collection('webhook_logs').insertOne({
        source: 'mpesa_stk_callback',
        type: 'stk_callback',
        status: 'payment_not_found',
        payload: body,
        metadata: {
          CheckoutRequestID,
          MerchantRequestID,
          ResultCode,
          ResultDesc,
        },
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
      });

      // Still return success to Safaricom
      return NextResponse.json({
        ResultCode: 0,
        ResultDesc: 'Accepted',
      });
    }

    // Update STK initiation status
    await db.collection('stk_initiations').updateOne(
      { CheckoutRequestID: CheckoutRequestID },
      {
        $set: {
          status: ResultCode === 0 ? 'completed' : 'failed',
          ResultCode: ResultCode,
          ResultDesc: ResultDesc,
          CallbackMetadata: CallbackMetadata,
          updatedAt: new Date(),
        },
      }
    );

    // Extract metadata if payment was successful
    let mpesaReceiptNumber: string | null = null;
    let transactionDate: string | null = null;
    let phoneNumber: string | null = null;
    let amount: number | null = null;

    if (ResultCode === 0 && CallbackMetadata?.Item) {
      for (const item of CallbackMetadata.Item) {
        switch (item.Name) {
          case 'Amount':
            amount = typeof item.Value === 'number' ? item.Value : parseFloat(String(item.Value));
            break;
          case 'MpesaReceiptNumber':
            mpesaReceiptNumber = String(item.Value);
            break;
          case 'TransactionDate':
            // Format: 20191219102115 -> 2019-12-19T10:21:15
            const dateStr = String(item.Value);
            transactionDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}T${dateStr.slice(8, 10)}:${dateStr.slice(10, 12)}:${dateStr.slice(12, 14)}`;
            break;
          case 'PhoneNumber':
            phoneNumber = String(item.Value);
            break;
        }
      }
    }

    // Update payment record
    const updateData: any = {
      'mpesa.resultCode': ResultCode,
      'mpesa.resultDesc': ResultDesc,
      status: ResultCode === 0 ? 'completed' : 'failed',
      updatedAt: new Date(),
    };

    if (ResultCode === 0 && mpesaReceiptNumber) {
      updateData['mpesa.transactionId'] = mpesaReceiptNumber;
      updateData['reconciliation.isReconciled'] = true;
      updateData['reconciliation.reconciledAt'] = new Date();
      updateData['reconciliation.matchedTransactionId'] = mpesaReceiptNumber;
    }

    await db.collection('payments').updateOne(
      { _id: payment._id },
      { $set: updateData }
    );

    console.log(`[STK Callback] Payment updated:`, {
      paymentId: payment._id.toString(),
      checkoutRequestId: CheckoutRequestID,
      resultCode: ResultCode,
      resultDesc: ResultDesc,
      mpesaReceiptNumber,
    });

    // SIMPLIFIED STK CALLBACK LOGIC - Only handle failures here
    // Success is handled by C2B Confirmation webhook (single point of voucher assignment)
    if (ResultCode === 0) {
      console.log('✅ [STK Callback] Payment successful - will be processed by C2B Confirmation webhook');
      
      // Update STK initiation to mark as ready for C2B processing
      await db.collection('stk_initiations').updateOne(
        { CheckoutRequestID: CheckoutRequestID },
        {
          $set: {
            status: 'pending_confirmation', // Waiting for C2B to assign voucher
            mpesaReceiptNumber: mpesaReceiptNumber,
          },
        }
      );
    } else {
      // Payment failed - update STK initiation and mark as failed
      console.log('❌ [STK Callback] Payment failed - updating records');
      await db.collection('stk_initiations').updateOne(
        { CheckoutRequestID: CheckoutRequestID },
        {
          $set: {
            status: 'failed',
            ResultCode,
            ResultDesc,
          },
        }
      );
    }

    // Log webhook
    await db.collection('webhook_logs').insertOne({
      type: 'mpesa_stk_callback',
      status: ResultCode === 0 ? 'success' : 'failed',
      payload: body,
      paymentId: payment._id,
      checkoutRequestId: CheckoutRequestID,
      merchantRequestId: MerchantRequestID,
      resultCode: ResultCode,
      resultDesc: ResultDesc,
      mpesaReceiptNumber,
      amount,
      timestamp: new Date(),
      processingTime: Date.now() - startTime,
    });

    // Create audit log if successful
    if (ResultCode === 0) {
      await db.collection('audit_logs').insertOne({
        userId: payment.userId,
        action: 'mpesa_payment_completed',
        resourceType: 'payment',
        resourceId: payment._id,
        details: {
          checkoutRequestId: CheckoutRequestID,
          transactionId: mpesaReceiptNumber,
          amount: amount || payment.transaction.amount,
          phoneNumber: phoneNumber || payment.mpesa.phoneNumber,
          processingTime: Date.now() - startTime,
        },
        ipAddress: 'mpesa-callback',
        userAgent: 'Safaricom M-Pesa STK',
        timestamp: new Date(),
      });
    }

    // Return success to Safaricom
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Accepted',
    });

  } catch (error) {
    console.error('[STK Callback] Error:', error);

    // Log error
    try {
      const db = await getDatabase();
      await db.collection('webhook_logs').insertOne({
        type: 'mpesa_stk_callback',
        status: 'error',
        payload: await request.json().catch(() => ({})),
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
      });
    } catch (logError) {
      console.error('[STK Callback] Failed to log error:', logError);
    }

    // Still return success to Safaricom to prevent retries
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Accepted',
    });
  }
}
