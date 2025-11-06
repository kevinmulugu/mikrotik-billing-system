// src/app/api/sms-credits/purchase/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { mpesaService } from '@/lib/services/mpesa';
import { SMSCreditsService } from '@/lib/services/sms-credits';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * POST /api/sms-credits/purchase
 * Initiate SMS credits purchase via M-Pesa STK Push
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { packageId, customAmount, customCredits } = body;

    if (!packageId) {
      return NextResponse.json(
        { success: false, error: 'Package ID is required' },
        { status: 400 }
      );
    }

    // Get user details from database
    const client = await clientPromise;
    const db = client.db();
    
    const user = await db.collection('users').findOne({
      _id: new ObjectId(session.user.id),
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Get phone number from user's business info
    const phoneNumber = user.businessInfo?.contact?.phone;
    
    if (!phoneNumber) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Phone number not found. Please update your profile with a phone number.' 
        },
        { status: 400 }
      );
    }

    // Fetch plan from database and verify purchase
    let plan;
    let credits;
    let amount;
    let totalCredits;

    try {
      if (packageId === 'enterprise' && customAmount) {
        // Enterprise plan with custom amount
        credits = customCredits || Math.floor(customAmount / 0.40);
        amount = customAmount;
        
        // Verify against database
        plan = await SMSCreditsService.verifyPurchase(packageId, credits, amount);
        totalCredits = credits;
      } else {
        // Fixed plan - need to determine credits and amount from frontend
        // For now, we'll fetch the plan and validate
        const dbPlan = await SMSCreditsService.getPlanFromDatabase(packageId);
        
        if (!dbPlan) {
          return NextResponse.json(
            { success: false, error: 'Invalid package ID' },
            { status: 400 }
          );
        }

        // For fixed plans, use the values sent from frontend but verify them
        credits = customCredits;
        amount = customAmount;

        if (!credits || !amount) {
          return NextResponse.json(
            { success: false, error: 'Credits and amount are required' },
            { status: 400 }
          );
        }

        // Verify the purchase
        plan = await SMSCreditsService.verifyPurchase(packageId, credits, amount);
        totalCredits = credits;
      }
    } catch (error: any) {
      return NextResponse.json(
        { 
          success: false, 
          error: error.message || 'Invalid purchase details' 
        },
        { status: 400 }
      );
    }

    // Create package object for STK Push
    const pkg = {
      id: plan.planId,
      name: plan.name,
      credits: totalCredits,
      price: amount,
      bonus: 0, // No bonus in new system
    };

    // Generate unique account reference
    const accountReference = packageId === 'enterprise' 
      ? `SMS-ENTERPRISE-${Date.now()}`
      : `SMS-${packageId.toUpperCase()}-${Date.now()}`;

    // Get company paybill
    const paybillNumber = process.env.MPESA_SHORTCODE || '';
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/${process.env.WEBHOOK_SECRET_PATH}`;

    // Initiate STK Push
    const stkResult = await mpesaService.initiateSTKPush({
      paybillNumber,
      phoneNumber,
      amount: pkg.price,
      accountReference,
      transactionDesc: `SMS Credits: ${pkg.name} (${totalCredits} credits)`,
      callbackUrl,
    });

    if (!stkResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: stkResult.error || 'Failed to initiate M-Pesa payment',
        },
        { status: 500 }
      );
    }

    // Store the initiation details with metadata for webhook processing
    await db.collection('stk_initiations').insertOne({
      CheckoutRequestID: stkResult.checkoutRequestId,
      MerchantRequestID: stkResult.merchantRequestId,
      AccountReference: accountReference,
      PhoneNumber: phoneNumber,
      Amount: pkg.price,
      paybillNumber: paybillNumber,
      status: 'pending',
      userId: new ObjectId(session.user.id),
      metadata: {
        type: 'sms_credits_purchase',
        packageId: pkg.id,
        packageName: pkg.name,
        credits: pkg.credits,
        bonus: pkg.bonus,
        totalCredits: pkg.credits, // No bonus in new system
        pricePerCredit: plan.pricePerCredit,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('[SMS Credits] STK Push initiated:', {
      user: session.user.email,
      package: pkg.name,
      amount: pkg.price,
      credits: pkg.credits,
      CheckoutRequestID: stkResult.checkoutRequestId,
    });

    return NextResponse.json({
      success: true,
      message: 'STK Push sent to your phone',
      CheckoutRequestID: stkResult.checkoutRequestId,
      MerchantRequestID: stkResult.merchantRequestId,
      package: {
        name: pkg.name,
        credits: pkg.credits,
        price: pkg.price,
      },
    });
  } catch (error) {
    console.error('[SMS Credits API] Error initiating purchase:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initiate SMS credits purchase',
      },
      { status: 500 }
    );
  }
}
