import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');

    // TODO: Fetch payments from database with pagination
    const payments = [
      {
        id: '1',
        amount: 100,
        currency: 'KES',
        type: 'voucher_purchase',
        status: 'completed',
        mpesaTransactionId: 'QA74HSJDKS',
        phoneNumber: '+254712345678',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        amount: 500,
        currency: 'KES',
        type: 'pppoe_payment',
        status: 'completed',
        mpesaTransactionId: 'QA74HSJDKT',
        phoneNumber: '+254712345679',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ];

    const totalPayments = payments.length;
    const totalPages = Math.ceil(totalPayments / limit);

    return NextResponse.json({
      payments,
      pagination: {
        page,
        limit,
        totalPages,
        totalPayments,
      },
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}