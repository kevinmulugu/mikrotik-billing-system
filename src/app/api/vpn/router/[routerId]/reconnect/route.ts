// src/app/api/vpn/router/[routerId]/reconnect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface RouteContext {
  params: Promise<{
    routerId: string;
  }>;
}

/**
 * POST /api/vpn/router/[routerId]/reconnect
 * Attempt to reconnect router VPN
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { routerId } = await context.params;

    // Validate ObjectId
    if (!ObjectId.isValid(routerId)) {
      return NextResponse.json({ error: 'Invalid router ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get customer
    const customer = await db.collection('customers').findOne({
      userId: new ObjectId(session.user.id),
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Verify router belongs to customer
    const router = await db.collection('routers').findOne({
      _id: new ObjectId(routerId),
      customerId: customer._id,
    });

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    // Check if router has VPN configured
    if (!router.vpnTunnel?.enabled) {
      return NextResponse.json(
        { error: 'VPN is not configured for this router' },
        { status: 400 }
      );
    }

    // Attempt reconnection
    const vpnIP = router.connection?.vpnIP;
    const sshHost = process.env.VPN_SSH_HOST || 'root@vpn.qebol.co.ke';
    const sshKey = process.env.VPN_SSH_KEY || '';
    const sshKeyOption = sshKey ? `-i ${sshKey}` : '';

    try {
      // Ping router via VPN
      await execAsync(
        `ssh ${sshKeyOption} ${sshHost} 'ping -c 3 -W 2 ${vpnIP}'`
      );

      // Update status to connected
      await db.collection('vpn_tunnels').updateOne(
        { routerId: new ObjectId(routerId) },
        {
          $set: {
            'connection.status': 'connected',
            'connection.lastSeen': new Date(),
            updatedAt: new Date(),
          },
        }
      );

      await db.collection('routers').updateOne(
        { _id: new ObjectId(routerId) },
        {
          $set: {
            'vpnTunnel.status': 'connected',
            'health.status': 'online',
            'health.lastSeen': new Date(),
            updatedAt: new Date(),
          },
        }
      );

      return NextResponse.json({
        success: true,
        message: 'Router reconnected successfully',
        data: {
          status: 'connected',
          vpnIP,
        },
      });

    } catch (pingError) {
      // Reconnection failed
      return NextResponse.json(
        {
          success: false,
          error: 'Router is not responding',
          message: 'Failed to reach router via VPN. Please check if router is online.',
        },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('Router VPN Reconnect API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to reconnect router',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}