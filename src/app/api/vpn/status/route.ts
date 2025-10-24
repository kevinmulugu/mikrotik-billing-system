// src/app/api/vpn/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import VPNMonitor from '@/lib/services/vpn-monitor';

/**
 * GET /api/vpn/status
 * Get overall VPN system statistics
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await VPNMonitor.getStatistics();

    return NextResponse.json({
      success: true,
      data: stats,
    });

  } catch (error) {
    console.error('VPN Status API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get VPN status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}