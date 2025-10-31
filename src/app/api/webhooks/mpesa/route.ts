// src/app/api/webhooks/mpesa/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import MikroTikService from '@/lib/services/mikrotik';
import { getRouterConnectionConfig } from '@/lib/services/router-connection';

/**
 * M-Pesa C2B Confirmation Webhook
 * 
 * This endpoint handles M-Pesa payment confirmations for voucher purchases.
 * It's called by Safaricom when a payment is successfully made to the paybill/till number.
 * 
 * Expected Flow:
 * 1. User pays to paybill with BillRefNumber = payment reference (NOT voucher code/password)
 * 2. Safaricom calls this webhook with payment details
 * 3. We find the voucher by reference, update payment info, set expiry timers
 * 4. We respond to Safaricom with success/failure
 * 
 * Security Note:
 * - BillRefNumber should be the voucher.reference field (public payment reference)
 * - NOT voucherInfo.code (which is also the password and should remain private)
 * 
 * BillRefNumber examples:
 * - Payment reference: VCH1A2B3C4D (safe to share for payment)
 * - Transaction reference: TXN-xxxxx (from pending transaction table)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let voucherCode: string | null = null;

  try {
    const body = await request.json();

    // TODO: Verify webhook signature for production
    // const signature = headers().get('x-safaricom-signature');
    // await verifyMpesaSignature(body, signature);

    console.log('[M-Pesa Webhook] Payment received:', {
      TransactionType: body.TransactionType,
      TransID: body.TransID,
      TransAmount: body.TransAmount,
      MSISDN: body.MSISDN,
      BillRefNumber: body.BillRefNumber,
      TransTime: body.TransTime,
    });

    // Extract payment details
    const {
      TransID,
      TransAmount,
      MSISDN,
      BillRefNumber,
      TransTime,
      BusinessShortCode,
      OrgAccountBalance,
    } = body;

    // Validate required fields
    if (!TransID || !TransAmount || !BillRefNumber) {
      console.error('[M-Pesa Webhook] Missing required fields:', body);
      return NextResponse.json({
        ResultCode: 1,
        ResultDesc: 'Missing required fields',
      });
    }

    const db = await getDatabase();
    const purchaseTime = new Date();
    const paymentReference = BillRefNumber; // Payment reference (NOT voucher code/password)

    // Find voucher by payment reference (NOT by code for security)
    const voucher = await db.collection('vouchers').findOne({
      reference: paymentReference,
      status: { $in: ['active', 'pending'] }, // Allow pending vouchers to be purchased
    });

    if (!voucher) {
      console.error(`[M-Pesa Webhook] Voucher not found for reference: ${paymentReference}`);

      // Log failed webhook attempt
      await db.collection('webhook_logs').insertOne({
        type: 'mpesa_confirmation',
        status: 'failed',
        reason: 'voucher_not_found',
        payload: body,
        paymentReference: paymentReference,
        timestamp: purchaseTime,
      });

      return NextResponse.json({
        ResultCode: 1,
        ResultDesc: `Voucher not found for reference: ${paymentReference}`,
      });
    }

    // Get voucher code for logging (keep it private in logs)
    voucherCode = voucher.voucherInfo.code;

    // Check if voucher already purchased
    if (voucher.payment?.transactionId) {
      console.warn(`[M-Pesa Webhook] Voucher already purchased. Reference: ${paymentReference}`);

      // Log duplicate webhook
      await db.collection('webhook_logs').insertOne({
        type: 'mpesa_confirmation',
        status: 'duplicate',
        payload: body,
        voucherId: voucher._id,
        paymentReference: paymentReference,
        timestamp: purchaseTime,
      });

      // Still return success to Safaricom
      return NextResponse.json({
        ResultCode: 0,
        ResultDesc: 'Voucher already purchased',
      });
    }

    // Validate payment amount matches voucher price
    const expectedAmount = voucher.voucherInfo.price;
    const paidAmount = parseFloat(TransAmount);

    if (Math.abs(paidAmount - expectedAmount) > 0.01) {
      console.error(`[M-Pesa Webhook] Amount mismatch. Expected: ${expectedAmount}, Paid: ${paidAmount}`);

      await db.collection('webhook_logs').insertOne({
        type: 'mpesa_confirmation',
        status: 'failed',
        reason: 'amount_mismatch',
        payload: body,
        voucherId: voucher._id,
        paymentReference: paymentReference,
        expectedAmount,
        paidAmount,
        timestamp: purchaseTime,
      });

      return NextResponse.json({
        ResultCode: 1,
        ResultDesc: `Amount mismatch. Expected ${expectedAmount}, received ${paidAmount}`,
      });
    }

    // Calculate commission
    const routerOwner = await db.collection('users').findOne({
      _id: voucher.userId,
    });

    const systemConfig = await db.collection('system_config').findOne({
      key: 'commission_rates',
    });

    const commissionRates = systemConfig?.value || {
      homeowner: 20.0,
      personal: 20.0,
      isp: 0.0,
      enterprise: 0.0,
    };

    const userType = routerOwner?.businessInfo?.type || 'personal';
    const commissionRate = routerOwner?.paymentSettings?.commissionRate ?? commissionRates[userType] ?? 20.0;
    const commissionAmount = paidAmount * (commissionRate / 100);

    // Calculate expiry timestamps based on voucher configuration
    let purchaseExpiresAt: Date | null = null;
    let expectedEndTime: Date | null = null;

    // If voucher has purchase expiry enabled, calculate purchaseExpiresAt
    // based on the package duration (maxDurationMinutes)
    if (voucher.usage?.timedOnPurchase && voucher.usage?.maxDurationMinutes) {
      const minutesToAdd = voucher.usage.maxDurationMinutes;
      purchaseExpiresAt = new Date(purchaseTime.getTime() + minutesToAdd * 60 * 1000);
      console.log(`[M-Pesa Webhook] Purchase expiry set to: ${purchaseExpiresAt.toISOString()} (${minutesToAdd} minutes from purchase)`);
    }

    // expectedEndTime will be set when the voucher is actually activated/used
    // For now, we log the package duration for reference
    if (voucher.usage?.maxDurationMinutes) {
      console.log(`[M-Pesa Webhook] Voucher has max duration: ${voucher.usage.maxDurationMinutes} minutes`);
    }

    // Update voucher with payment information and purchase timestamps
    const updateResult = await db.collection('vouchers').updateOne(
      { _id: voucher._id },
      {
        $set: {
          'payment.method': 'mpesa',
          'payment.transactionId': TransID,
          'payment.phoneNumber': MSISDN,
          'payment.amount': paidAmount,
          'payment.commission': commissionAmount,
          'payment.paymentDate': purchaseTime,
          'usage.purchaseExpiresAt': purchaseExpiresAt,
          status: 'paid', // Mark as paid (will become 'used' when activated)
          updatedAt: purchaseTime,
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      throw new Error('Failed to update voucher');
    }

    console.log(`[M-Pesa Webhook] Voucher purchased successfully. Reference: ${paymentReference}, Commission: KES ${commissionAmount.toFixed(2)}`);

    // Record commission in transactions
    await db.collection('transactions').insertOne({
      userId: voucher.userId,
      routerId: voucher.routerId,
      voucherId: voucher._id,
      type: 'voucher_sale',
      amount: paidAmount,
      commission: commissionAmount,
      commissionRate: commissionRate,
      paymentMethod: 'mpesa',
      transactionId: TransID,
      phoneNumber: MSISDN,
      status: 'completed',
      metadata: {
        paymentReference: paymentReference,
        packageType: voucher.voucherInfo.packageType,
        purchaseExpiresAt: purchaseExpiresAt?.toISOString() || null,
        webhookProcessingTime: Date.now() - startTime,
      },
      createdAt: purchaseTime,
    });

    // Create audit log
    await db.collection('audit_logs').insertOne({
      userId: voucher.userId,
      action: 'voucher_purchased',
      resourceType: 'voucher',
      resourceId: voucher._id,
      details: {
        paymentReference,
        transactionId: TransID,
        amount: paidAmount,
        commission: commissionAmount,
        phoneNumber: MSISDN,
        purchaseExpiresAt: purchaseExpiresAt?.toISOString() || null,
        processingTime: Date.now() - startTime,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'mpesa-webhook',
      userAgent: 'Safaricom M-Pesa',
      timestamp: purchaseTime,
    });

    // Log successful webhook
    await db.collection('webhook_logs').insertOne({
      type: 'mpesa_confirmation',
      status: 'success',
      payload: body,
      voucherId: voucher._id,
      paymentReference: paymentReference,
      transactionId: TransID,
      amount: paidAmount,
      commission: commissionAmount,
      timestamp: purchaseTime,
      processingTime: Date.now() - startTime,
    });

    // TODO: Send confirmation SMS/email to customer
    // - Payment reference (NOT voucher code for security)
    // - Package details
    // - Expiry information
    // - Instructions to contact merchant for voucher code
    // - Activation instructions

    // Respond to Safaricom
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Payment processed successfully',
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[M-Pesa Webhook] Error processing payment:', error);

    const db = await getDatabase();

    // Log error
    await db.collection('webhook_logs').insertOne({
      type: 'mpesa_confirmation',
      status: 'error',
      error: errorMessage,
      paymentReference: voucherCode, // May be null if error before finding voucher
      timestamp: new Date(),
      processingTime: Date.now() - startTime,
    }).catch(err => {
      console.error('[M-Pesa Webhook] Failed to log error:', err);
    });

    return NextResponse.json(
      {
        ResultCode: 1,
        ResultDesc: 'Failed to process payment',
      },
      { status: 500 }
    );
  }
}