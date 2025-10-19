import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // TODO: Verify webhook signature
    const signature = headers().get('x-safaricom-signature');
    
    console.log('M-Pesa webhook received:', {
      TransactionType: body.TransactionType,
      TransID: body.TransID,
      TransAmount: body.TransAmount,
      MSISDN: body.MSISDN,
      BillRefNumber: body.BillRefNumber,
      TransTime: body.TransTime,
    });

    // TODO: Process payment and update database
    // - Find voucher/user by BillRefNumber
    // - Update payment status
    // - Send confirmation SMS/email
    // - Calculate and record commission

    // Respond to Safaricom
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Accepted',
    });
  } catch (error) {
    console.error('M-Pesa webhook error:', error);
    
    return NextResponse.json(
      {
        ResultCode: 1,
        ResultDesc: 'Failed to process payment',
      },
      { status: 500 }
    );
  }
}