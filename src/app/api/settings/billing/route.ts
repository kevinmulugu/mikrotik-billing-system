// src/app/api/settings/billing/route.ts
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
    if (!userId) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Read global system config values
    const systemConfig = await db.collection('system_config').findOne({}) as any || {};
    const commissionRates = systemConfig.commission_rates || {};
    const subscriptionFees = systemConfig.subscription_fees || {};

    // Read user-specific data
    const user = await db
      .collection('users')
      .findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userCommission =
      user.paymentSettings?.commissionRate ?? commissionRates.personal ?? commissionRates.homeowner ?? 20;

    // Normalize legacy plan names
    let userPlan = user.subscription?.plan || 'none';
    if (userPlan === 'basic') userPlan = 'individual';
    if (userPlan === 'isp_5_routers') userPlan = 'isp';

    const result = {
      commissionRates,
      subscriptionFees,
      customer: {
        id: user._id.toString(),
        name: user.businessInfo?.name || null,
        type: user.businessInfo?.type || null,
        plan: userPlan,
        status: user.subscription?.status || 'pending',
        monthlyFee: user.subscription?.monthlyFee || 0,
        commissionRate: userCommission,
        trialEndDate: user.subscription?.endDate || null,
        totalRouters: user.statistics?.totalRouters || 0,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Billing settings API error:', error);
    return NextResponse.json({ error: 'Failed to fetch billing settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerId = session.user.id;
    if (!customerId) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action, plan } = body;

    if (action !== 'upgrade_plan') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!plan || !['individual', 'isp', 'isp_pro'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get user
    const user = await db
      .collection('users')
      .findOne({ _id: new ObjectId(customerId) });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentPlan = user.subscription?.plan || 'none';
    const currentStatus = user.subscription?.status || 'pending';

    // Plan settings
    const planSettings = {
      individual: {
        commissionRate: 20,
        monthlyFee: 0,
        maxRouters: 1,
        name: 'Individual Plan',
        features: ['Up to 1 router', '20% commission', 'Basic support', 'Free forever']
      },
      isp: {
        commissionRate: 0,
        monthlyFee: 2500,
        maxRouters: 5,
        name: 'ISP Basic Plan',
        features: ['Up to 5 routers', '0% commission', 'Priority support', 'Advanced analytics']
      },
      isp_pro: {
        commissionRate: 0,
        monthlyFee: 3900,
        maxRouters: Infinity,
        name: 'ISP Pro Plan',
        features: ['Unlimited routers', '0% commission', 'Premium support', 'Advanced analytics', 'Custom branding']
      }
    };

    // Validate upgrade path
    const upgradePaths: Record<string, string[]> = {
      'none': ['individual', 'isp', 'isp_pro'],
      'pending': ['individual', 'isp', 'isp_pro'],
      'individual': ['isp', 'isp_pro'],
      'isp': ['isp_pro'],
      'isp_pro': []
    };

    const validUpgradePath = upgradePaths[currentPlan as string];
    if (!validUpgradePath || !validUpgradePath.includes(plan)) {
      return NextResponse.json({
        error: currentPlan === 'isp_pro'
          ? 'You are already on the highest plan'
          : 'Invalid upgrade path'
      }, { status: 400 });
    } const selectedPlanSettings = planSettings[plan as keyof typeof planSettings];
    const now = new Date();

    // Calculate new end date (keep trial end if currently on trial)
    let newEndDate: Date | null = null;
    let newStatus = 'active';

    if (currentStatus === 'trial' && user.subscription?.endDate) {
      // If upgrading during trial, keep the trial end date
      newEndDate = new Date(user.subscription.endDate);
      newStatus = 'trial';
    } else if (selectedPlanSettings.monthlyFee === 0) {
      // Free plan (individual) - no end date
      newEndDate = null;
      newStatus = 'active';
    } else {
      // Paid plan - set monthly billing cycle
      newEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      newStatus = 'active';
    }

    // Update user subscription
    await db.collection('users').updateOne(
      { _id: new ObjectId(customerId) },
      {
        $set: {
          'subscription.plan': plan,
          'subscription.status': newStatus,
          'subscription.monthlyFee': selectedPlanSettings.monthlyFee,
          'subscription.features': selectedPlanSettings.features,
          'subscription.endDate': newEndDate,
          'subscription.updatedAt': now,
          'paymentSettings.commissionRate': selectedPlanSettings.commissionRate,
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: `Successfully upgraded to ${selectedPlanSettings.name}`,
      subscription: {
        plan,
        status: newStatus,
        monthlyFee: selectedPlanSettings.monthlyFee,
        commissionRate: selectedPlanSettings.commissionRate,
        features: selectedPlanSettings.features,
        endDate: newEndDate,
      }
    });

  } catch (error) {
    console.error('Plan upgrade API error:', error);
    return NextResponse.json({ error: 'Failed to upgrade plan' }, { status: 500 });
  }
}
