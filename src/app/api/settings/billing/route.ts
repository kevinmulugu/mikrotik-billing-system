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

    const customerId = session.user.id;
    if (!customerId) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Read global system config values
    const systemConfig = await db.collection('system_config').findOne({}) || {};
    const commissionRates = systemConfig.commission_rates || {};
    const subscriptionFees = systemConfig.subscription_fees || {};

    // Read customer-specific data
    const customer = await db
      .collection('customers')
      .findOne({ userId: new ObjectId(customerId) });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customerCommission =
      customer.paymentSettings?.commissionRate ?? commissionRates.personal ?? commissionRates.homeowner ?? 20;

    const result = {
      commissionRates,
      subscriptionFees,
      customer: {
        id: customer._id.toString(),
        name: customer.businessInfo?.name || null,
        type: customer.businessInfo?.type || null,
        plan: customer.subscription?.plan || null,
        commissionRate: customerCommission,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Billing settings API error:', error);
    return NextResponse.json({ error: 'Failed to fetch billing settings' }, { status: 500 });
  }
}
