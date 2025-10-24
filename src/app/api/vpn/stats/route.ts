// src/app/api/vpn/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';

/**
 * GET /api/vpn/stats
 * Get detailed VPN statistics for dashboard
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get comprehensive statistics
    const [
      totalTunnels,
      connectedTunnels,
      disconnectedTunnels,
      failedTunnels,
      setupTunnels,
      ipPool,
      recentTunnels,
      topTransfer,
    ] = await Promise.all([
      // Total tunnels
      db.collection('vpn_tunnels').countDocuments(),
      
      // Connected tunnels
      db.collection('vpn_tunnels').countDocuments({ 'connection.status': 'connected' }),
      
      // Disconnected tunnels
      db.collection('vpn_tunnels').countDocuments({ 'connection.status': 'disconnected' }),
      
      // Failed tunnels
      db.collection('vpn_tunnels').countDocuments({ 'connection.status': 'failed' }),
      
      // In setup
      db.collection('vpn_tunnels').countDocuments({ 'connection.status': 'setup' }),
      
      // IP pool info
      db.collection('vpn_ip_pool').findOne({ network: '10.99.0.0/16' }),
      
      // Recent tunnels (last 10)
      db.collection('vpn_tunnels')
        .find()
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),
      
      // Top data transfer
      db.collection('vpn_tunnels')
        .find({ 'connection.status': 'connected' })
        .sort({ 'connection.bytesReceived': -1 })
        .limit(5)
        .toArray(),
    ]);

    // Calculate uptime percentage
    const uptimePercentage = totalTunnels > 0
      ? ((connectedTunnels / totalTunnels) * 100).toFixed(2)
      : '0.00';

    // Format response
    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total: totalTunnels,
          connected: connectedTunnels,
          disconnected: disconnectedTunnels,
          failed: failedTunnels,
          setup: setupTunnels,
          uptimePercentage: parseFloat(uptimePercentage),
        },
        ipPool: {
          network: ipPool?.network || '10.99.0.0/16',
          used: ipPool?.usedCount || 0,
          capacity: ipPool?.totalCapacity || 65534,
          available: (ipPool?.totalCapacity || 65534) - (ipPool?.usedCount || 0),
          nextAvailable: ipPool?.nextAvailable || '10.99.1.1',
        },
        recent: recentTunnels.map(tunnel => ({
          routerId: tunnel.routerId,
          vpnIP: tunnel.vpnConfig?.assignedIP,
          status: tunnel.connection?.status,
          createdAt: tunnel.createdAt,
        })),
        topTransfer: topTransfer.map(tunnel => ({
          routerId: tunnel.routerId,
          vpnIP: tunnel.vpnConfig?.assignedIP,
          bytesReceived: tunnel.connection?.bytesReceived || 0,
          bytesSent: tunnel.connection?.bytesSent || 0,
        })),
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('VPN Stats API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get VPN statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}