// src/app/api/customer/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get customer profile
    const customer = await db
      .collection('customers')
      .findOne({ userId: new ObjectId(userId) });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer profile not found' },
        { status: 404 }
      );
    }

    // Return customer data
    return NextResponse.json({
      success: true,
      customer: {
        id: customer._id.toString(),
        businessInfo: customer.businessInfo,
        subscription: customer.subscription,
        paymentSettings: customer.paymentSettings,
        statistics: customer.statistics,
        status: customer.status,
      },
    });

  } catch (error) {
    console.error('[Customer Profile] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer profile' },
      { status: 500 }
    );
  }
}
