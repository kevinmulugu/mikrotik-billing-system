// src/app/api/sms-credits/balance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { SMSCreditsService } from '@/lib/services/sms-credits';

/**
 * GET /api/sms-credits/balance
 * Get current user's SMS credits balance
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const balance = await SMSCreditsService.getBalance(session.user.id);

    return NextResponse.json({
      success: true,
      balance: balance.balance,
      totalPurchased: balance.totalPurchased,
      totalUsed: balance.totalUsed,
      lastPurchaseDate: balance.lastPurchaseDate,
      lastPurchaseAmount: balance.lastPurchaseAmount,
    });
  } catch (error) {
    console.error('[SMS Credits API] Error fetching balance:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch SMS credits balance',
      },
      { status: 500 }
    );
  }
}
