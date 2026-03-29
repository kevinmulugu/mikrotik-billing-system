// src/app/api/payments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const status = searchParams.get('status');

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    type PaymentQuery = {
      userId: ObjectId;
      status?: string;
    };

    const query: PaymentQuery = {
      userId: new ObjectId(session.user.id),
    };

    if (status && status !== 'all') {
      query.status = status;
    }

    const [totalPayments, payments] = await Promise.all([
      db.collection('payments').countDocuments(query),
      db
        .collection('payments')
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    const formatted = payments.map((p) => ({
      id: p._id.toString(),
      amount: p.transaction?.amount ?? 0,
      type: p.transaction?.type ?? 'unknown',
      description: p.transaction?.description ?? null,
      status: p.status,
      mpesaTransactionId: p.mpesa?.transactionId ?? null,
      phoneNumber: p.mpesa?.phoneNumber ?? null,
      customerName: p.mpesa?.customerName ?? null,
      resultDesc: p.mpesa?.resultDesc ?? null,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({
      success: true,
      payments: formatted,
      pagination: {
        page,
        limit,
        totalPayments,
        totalPages: Math.ceil(totalPayments / limit),
        hasMore: page * limit < totalPayments,
      },
    });
  } catch (error) {
    console.error('[Payments] Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}
