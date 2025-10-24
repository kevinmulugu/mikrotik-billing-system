import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import VPNMonitor from '@/lib/services/vpn-monitor';

/**
 * POST /api/vpn/health-check
 * Trigger manual health check of all VPN tunnels
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Optional: Add admin role check
    // const user = await getUserById(session.user.id);
    // if (user.role !== 'admin' && user.role !== 'superadmin') {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    console.log('[VPN Health Check] Manual health check triggered by:', session.user.email);

    const checkResults = await VPNMonitor.checkAllTunnels();
    const reconnectResults = await VPNMonitor.reconnectStaleTunnels();
    const alertResults = await VPNMonitor.checkAndAlert();

    return NextResponse.json({
      success: true,
      message: 'Health check completed',
      data: {
        tunnels: checkResults,
        reconnection: reconnectResults,
        alerts: alertResults,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('VPN Health Check API Error:', error);
    return NextResponse.json(
      {
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/vpn/health-check
 * Get last health check results
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
      data: {
        ...stats,
        lastCheck: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('VPN Health Check GET API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get health check data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}