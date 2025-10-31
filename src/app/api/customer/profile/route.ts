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

    // Get user profile
    const user = await db
      .collection('users')
      .findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Return user data
    return NextResponse.json({
      success: true,
      customer: {
        id: user._id.toString(),
        businessInfo: user.businessInfo,
        subscription: user.subscription,
        paymentSettings: user.paymentSettings,
        statistics: user.statistics,
        status: user.status,
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
