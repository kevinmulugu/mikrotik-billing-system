// src/app/api/sms-credits/plans/route.ts
import { NextResponse } from 'next/server';
import { SMSCreditsService } from '@/lib/services/sms-credits';

/**
 * GET /api/sms-credits/plans
 * Fetch all active SMS plans from database
 */
export async function GET() {
  try {
    const plans = await SMSCreditsService.getPlansFromDatabase();

    return NextResponse.json({
      success: true,
      plans: plans.map(plan => ({
        planId: plan.planId,
        name: plan.name,
        description: plan.description,
        pricePerCredit: plan.pricePerCredit,
        minimumCredits: plan.minimumCredits,
        maximumCredits: plan.maximumCredits,
        bonusPercentage: plan.bonusPercentage,
        isCustom: plan.isCustom,
        features: plan.features,
      })),
    });
  } catch (error) {
    console.error('[SMS Plans API] Error fetching plans:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch SMS plans',
      },
      { status: 500 }
    );
  }
}
