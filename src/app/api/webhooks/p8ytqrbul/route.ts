// src/app/api/webhooks/p8ytqrbul/route.ts
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
 * ARCHITECTURE: SINGLE POINT OF VOUCHER ASSIGNMENT
 * - STK Callback: Only marks failures, does NOT assign vouchers
 * - C2B Confirmation (THIS FILE): Handles ALL successful voucher assignments
 * 
 * Benefits:
 * - No race conditions (only one webhook assigns vouchers)
 * - STK data available: Uses STK initiation for customer/package details
 * - Manual payments work: Falls back to voucher reference lookup
 * - Clean separation: STK = failure handling, C2B = success handling
 * 
 * Expected Flow:
 * 1. STK Push initiated → Payment pending
 * 2. Customer enters PIN
 * 3. STK Callback arrives → Updates payment (failure) OR marks pending_confirmation (success)
 * 4. C2B Confirmation arrives → Assigns voucher from pool
 * 5. Customer receives voucher code
 * 
 * Manual Payment Flow:
 * 1. Customer pays directly to paybill with BillRefNumber = voucher.reference
 * 2. C2B Confirmation arrives → Looks up voucher by reference
 * 3. Assigns voucher from pool (same as STK)
 * 
 * Security Note:
 * - BillRefNumber should be the voucher.reference field (public payment reference)
 * - NOT voucherInfo.code (which is also the password and should remain private)
 * 
 * BillRefNumber examples:
 * - Transaction reference: TXN-1730556789-A3F2 (from STK Push)
 * - Voucher reference: VCH1A2B3C4D (for manual payments)
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

    // C2B Confirmation is the PRIMARY voucher assignment handler
    // STK Callback only marks failures - this ensures no race conditions
    console.log('[M-Pesa Webhook] C2B Confirmation received for:', BillRefNumber);

    // Try to find STK initiation first (for STK Push payments)
    const stkInitiation = await db.collection('stk_initiations').findOne({
      AccountReference: BillRefNumber,
    });

    let voucher = null;
    let phoneNumber = MSISDN ? String(MSISDN) : null;
    let isSTKPayment = false;
    let packageInfo: any = null;

    if (stkInitiation) {
      // Found STK initiation - this is an STK Push payment
      isSTKPayment = true;
      console.log('[M-Pesa Webhook] STK payment detected:', {
        AccountReference: stkInitiation.AccountReference,
        PhoneNumber: stkInitiation.PhoneNumber,
        CheckoutRequestID: stkInitiation.CheckoutRequestID,
        currentStatus: stkInitiation.status,
      });

      // Check if already processed (duplicate webhook)
      if (stkInitiation.status === 'completed' && stkInitiation.voucherId) {
        console.log('[M-Pesa Webhook] Already processed - voucher:', stkInitiation.voucherId);
        
        await db.collection('webhook_logs').insertOne({
          source: 'mpesa_confirmation',
          type: 'c2b_confirmation',
          status: 'duplicate_already_processed',
          payload: body,
          metadata: {
            BillRefNumber,
            TransID,
            voucherId: stkInitiation.voucherId,
            stkStatus: stkInitiation.status,
          },
          timestamp: purchaseTime,
        });

        return NextResponse.json({
          ResultCode: 0,
          ResultDesc: 'Payment already processed',
        });
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

      console.log('[M-Pesa Webhook] Using STK data for voucher assignment');
    } else {
      // No STK initiation found - this is a manual payment
      console.log('[M-Pesa Webhook] Manual payment - looking up by reference:', BillRefNumber);
      
      // Look up voucher by reference field
      voucher = await db.collection('vouchers').findOne({
        reference: BillRefNumber,
        status: 'active',
      });

      if (voucher) {
        console.log('[M-Pesa Webhook] Found voucher by reference:', voucher._id);
        
        // For manual payments, packageInfo comes from voucher
        packageInfo = {
          routerId: voucher.routerId,
          userId: voucher.userId,
          packageId: voucher.voucherInfo.packageType,
          packageDisplayName: voucher.voucherInfo.packageDisplayName,
          packageDuration: voucher.voucherInfo.duration,
          packagePrice: voucher.voucherInfo.price,
          macAddress: null, // No MAC for manual payments
          customerId: null, // Will create customer if needed
          paymentId: null, // No pre-existing payment
        };
      }
    }

    // VOUCHER ASSIGNMENT FROM POOL - Handles both STK and manual payments
    if (!voucher && !isSTKPayment) {
      // Manual payment with no matching voucher reference
      console.error(`[M-Pesa Webhook] No voucher found for manual payment reference: ${BillRefNumber}`);

      await db.collection('webhook_logs').insertOne({
        source: 'mpesa_confirmation',
        type: 'c2b_confirmation',
        status: 'failed',
        reason: 'voucher_not_found',
        payload: body,
        metadata: {
          BillRefNumber,
          TransID,
          MSISDN,
          paymentType: 'manual',
        },
        timestamp: purchaseTime,
      });

      return NextResponse.json({
        ResultCode: 1,
        ResultDesc: `No voucher found for reference: ${BillRefNumber}. Please contact support.`,
      });
    }

    if (!voucher && isSTKPayment) {
      // STK payment - ALWAYS assign from pool (STK callback doesn't assign vouchers)
      console.log('[M-Pesa Webhook] STK payment - assigning voucher from pool...');

      const voucherResult = await db.collection('vouchers').findOneAndUpdate(
        {
          routerId: packageInfo.routerId,
          'voucherInfo.packageType': packageInfo.packageId,
          status: 'active',
        },
        {
          $set: {
            status: 'assigned',
            'payment.transactionId': TransID,
            'payment.phoneNumber': phoneNumber,
            'payment.paymentDate': purchaseTime,
            'usage.deviceMac': packageInfo.macAddress,
            customerId: packageInfo.customerId,
            updatedAt: purchaseTime,
          },
        },
        {
          returnDocument: 'after',
        }
      );

      if (voucherResult) {
        voucher = voucherResult;
        console.log('✅ [M-Pesa Webhook] Voucher assigned from pool:', voucher._id);

        // Update STK initiation with voucher ID
        await db.collection('stk_initiations').updateOne(
          { AccountReference: BillRefNumber },
          {
            $set: {
              voucherId: voucher._id,
              status: 'completed',
            },
          }
        );

        // Link voucher to payment
        if (packageInfo.paymentId) {
          await db.collection('payments').updateOne(
            { _id: packageInfo.paymentId },
            {
              $push: {
                linkedItems: {
                  type: 'voucher',
                  itemId: voucher._id,
                  quantity: 1,
                },
              } as any,
            }
          );
        }

        // Update purchase attempt with voucher ID
        await db.collection('purchase_attempts').updateOne(
          { transaction_reference: BillRefNumber },
          {
            $set: {
              voucher_id: voucher._id,
            },
          }
        );

        console.log('✅ [M-Pesa Webhook] Voucher successfully linked to payment and STK');

        // TODO: SMS NOTIFICATION - VOUCHER CODE TO CUSTOMER
        console.log('📱 [SMS TODO] Send voucher code to customer');
        console.log('Phone:', phoneNumber);
        console.log('Voucher Code:', voucher.voucherInfo.code);
        console.log('Package:', packageInfo.packageDisplayName);
        console.log('Duration:', packageInfo.packageDuration, 'minutes');
        // TODO: Integrate SMS provider (Africa's Talking)
        // Message: "Your WiFi voucher: {code}. Package: {name}. Valid for {duration} minutes. Thank you!"
      } else {
        // OUT OF STOCK - No active vouchers available
        console.error('🚨 [M-Pesa Webhook] OUT OF STOCK - No active vouchers!');

        // Update payment status to pending_voucher
        if (packageInfo.paymentId) {
          await db.collection('payments').updateOne(
            { _id: packageInfo.paymentId },
            {
              $set: {
                status: 'pending_voucher',
                'metadata.outOfStock': true,
                'metadata.outOfStockDetectedAt': purchaseTime,
                updatedAt: purchaseTime,
              },
            }
          );
        }

        // Update STK initiation
        await db.collection('stk_initiations').updateOne(
          { AccountReference: BillRefNumber },
          {
            $set: {
              status: 'pending_voucher',
            },
          }
        );

        await db.collection('webhook_logs').insertOne({
          source: 'mpesa_confirmation',
          type: 'c2b_confirmation',
          status: 'out_of_stock',
          payload: body,
          metadata: {
            BillRefNumber,
            TransID,
            routerId: packageInfo.routerId,
            packageId: packageInfo.packageId,
          },
          timestamp: purchaseTime,
        });

        // TODO: ADMIN ALERT - OUT OF STOCK NOTIFICATION
        console.log('🚨 [ADMIN ALERT TODO] Send out-of-stock notification to admin');
        console.log('Router ID:', packageInfo.routerId);
        console.log('Package:', packageInfo.packageDisplayName);
        console.log('Payment ID:', packageInfo.paymentId);
        console.log('Transaction:', TransID);
        console.log('Customer Phone:', phoneNumber);
        // TODO: Send email/SMS to router owner
        // Message: "URGENT: Router '{name}' is out of {package} vouchers. Payment received: {transactionId}. Customer: {phone}. Please generate vouchers or refund."

        // TODO: SMS NOTIFICATION - CUSTOMER OUT-OF-STOCK MESSAGE
        console.log('📱 [SMS TODO] Send out-of-stock message to customer');
        console.log('Phone:', phoneNumber);
        console.log('Amount:', TransAmount);
        console.log('Transaction:', TransID);
        // TODO: Send SMS to customer
        // Message: "Payment of KES {amount} received successfully. Your voucher code will be sent within 24 hours. Ref: {transactionId}. Thank you for your patience!"

        return NextResponse.json({
          ResultCode: 0,
          ResultDesc: 'Payment received. Voucher code will be sent shortly.',
        });
      }
    }

    // Final null check - voucher must be assigned at this point
    if (!voucher) {
      console.error('[M-Pesa Webhook] CRITICAL: Voucher is null after all lookup attempts');
      await db.collection('webhook_logs').insertOne({
        source: 'mpesa_confirmation',
        type: 'c2b_confirmation',
        status: 'failed',
        reason: 'voucher_null_after_lookup',
        payload: body,
        metadata: {
          BillRefNumber,
          TransID,
          isSTKPayment,
        },
        timestamp: purchaseTime,
      });

      return NextResponse.json({
        ResultCode: 1,
        ResultDesc: 'Unable to process payment. Please contact support.',
      });
    }

    // Get voucher code for logging (keep it private in logs)
    voucherCode = voucher.voucherInfo.code;

    // Check if voucher already purchased with THIS transaction ID
    if (voucher.payment?.transactionId === TransID) {
      console.warn(`[M-Pesa Webhook] Duplicate webhook - voucher already purchased with this TransID: ${TransID}`);

      // Log duplicate webhook
      await db.collection('webhook_logs').insertOne({
        source: 'mpesa_confirmation',
        type: 'c2b_confirmation',
        status: 'duplicate_transid',
        payload: body,
        metadata: {
          voucherId: voucher._id,
          BillRefNumber: BillRefNumber,
          TransID: TransID,
          existingTransID: voucher.payment.transactionId,
        },
        timestamp: purchaseTime,
      });

      // Still return success to Safaricom
      return NextResponse.json({
        ResultCode: 0,
        ResultDesc: 'Duplicate transaction - already processed',
      });
    }

    // Check if voucher already purchased with DIFFERENT transaction ID
    if (voucher.payment?.transactionId && voucher.payment.transactionId !== TransID) {
      console.warn(`[M-Pesa Webhook] Voucher already purchased with different transaction. Existing: ${voucher.payment.transactionId}, New: ${TransID}`);

      // Log duplicate webhook
      await db.collection('webhook_logs').insertOne({
        source: 'mpesa_confirmation',
        type: 'c2b_confirmation',
        status: 'duplicate',
        payload: body,
        metadata: {
          voucherId: voucher._id,
          BillRefNumber: BillRefNumber,
          TransID: TransID,
        },
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
        source: 'mpesa_confirmation',
        type: 'c2b_confirmation',
        status: 'failed',
        reason: 'amount_mismatch',
        payload: body,
        metadata: {
          voucherId: voucher._id,
          BillRefNumber: BillRefNumber,
          expectedAmount,
          paidAmount,
          TransID: TransID,
        },
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

    // Create or update WiFi customer record (person who purchased the voucher)
    // IMPORTANT: M-Pesa webhook MSISDN is already SHA-256 hashed in C2B callbacks
    // We don't need to hash it again - it's already in hashed format
    const sha256Phone = MSISDN; // MSISDN is already SHA-256 hashed from M-Pesa

    let wifiCustomer = await db.collection('customers').findOne({
      sha256Phone: sha256Phone
    });

    if (!wifiCustomer) {
      // Create new WiFi customer associated with this router
      // Note: We don't have the plain phone number from webhook, only the hash
      const customerResult = await db.collection('customers').insertOne({
        routerId: voucher.routerId,
        phone: null, // Will be updated when we get plain phone from captive portal
        sha256Phone: sha256Phone,
        name: null, // Will be updated when customer provides name
        email: null,
        createdAt: purchaseTime,
        updatedAt: purchaseTime,
        lastPurchaseDate: purchaseTime,
        totalPurchases: 1,
        totalSpent: paidAmount,
      });
      wifiCustomer = { _id: customerResult.insertedId };
      console.log(`[M-Pesa Webhook] Created new WiFi customer with hashed phone for router: ${voucher.routerId}`);
    } else {
      // Update existing customer's last purchase date and stats
      await db.collection('customers').updateOne(
        { _id: wifiCustomer._id },
        {
          $set: {
            lastPurchaseDate: purchaseTime,
            updatedAt: purchaseTime,
          },
          $inc: {
            totalPurchases: 1,
            totalSpent: paidAmount,
          }
        }
      );
      console.log(`[M-Pesa Webhook] Updated existing WiFi customer with hashed phone`);
    }

    // Calculate expiry timestamps based on voucher configuration

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
          customerId: wifiCustomer._id, // Link voucher to WiFi customer
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

    console.log(`[M-Pesa Webhook] Voucher purchased successfully. Reference: ${BillRefNumber}, Commission: KES ${commissionAmount.toFixed(2)}`);

    // Create audit log
    await db.collection('audit_logs').insertOne({
      userId: voucher.userId,
      action: 'voucher_purchased',
      resourceType: 'voucher',
      resourceId: voucher._id,
      details: {
        BillRefNumber: BillRefNumber,
        transactionId: TransID,
        amount: paidAmount,
        commission: commissionAmount,
        phoneNumber: phoneNumber || MSISDN,
        purchaseExpiresAt: purchaseExpiresAt?.toISOString() || null,
        processingTime: Date.now() - startTime,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'mpesa-webhook',
      userAgent: 'Safaricom M-Pesa',
      timestamp: purchaseTime,
    });

    // Log successful webhook
    await db.collection('webhook_logs').insertOne({
      source: 'mpesa_confirmation',
      type: 'c2b_confirmation',
      status: 'success',
      payload: body,
      metadata: {
        voucherId: voucher._id,
        BillRefNumber: BillRefNumber,
        TransID: TransID,
        amount: paidAmount,
        commission: commissionAmount,
      },
      timestamp: purchaseTime,
      processingTime: Date.now() - startTime,
    });

    // TODO: Send confirmation SMS/email to customer
    // - BillRefNumber (voucher code)
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
      source: 'mpesa_confirmation',
      type: 'c2b_confirmation',
      status: 'error',
      payload: {},
      metadata: {
        error: errorMessage,
        voucherCode: voucherCode, // May be null if error before finding voucher
      },
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