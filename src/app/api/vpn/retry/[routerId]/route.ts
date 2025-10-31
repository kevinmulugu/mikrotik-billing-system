import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import VPNProvisioner from '@/lib/services/vpn-provisioner';
import { MikroTikService } from '@/lib/services/mikrotik';
import { getRouterConnectionConfig } from '@/lib/services/router-connection';

interface RouteContext {
  params: Promise<{
    routerId: string;
  }>;
}

/**
 * POST /api/vpn/retry/[routerId]
 * Retry VPN provisioning for a router that failed initial setup
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

    // Get router and verify ownership
    const router = await db.collection('routers').findOne({
      _id: new ObjectId(routerId),
      userId: new ObjectId(session.user.id),
    });

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    // Check if VPN is already enabled
    if (router.vpnTunnel?.enabled && router.vpnTunnel?.status === 'connected') {
      return NextResponse.json(
        {
          error: 'VPN is already configured and connected',
          message: 'No need to retry',
        },
        { status: 400 }
      );
    }

    // Check if VPN provisioning is in progress
    if (router.vpnTunnel?.status === 'setup') {
      return NextResponse.json(
        {
          error: 'VPN provisioning is already in progress',
          message: 'Please wait for current setup to complete',
        },
        { status: 409 }
      );
    }

    console.log(`[VPN Retry] Retrying VPN provisioning for router ${routerId}`);

    // Mark as in progress
    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $set: {
          'vpnTunnel.status': 'setup',
          'vpnTunnel.lastAttempt': new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Prepare connection config
    // const connectionConfig = {
    //   ipAddress: router.connection?.localIP || router.connection?.ipAddress,
    //   port: router.connection?.port || 8728,
    //   username: router.connection?.apiUser || 'admin',
    //   password: router.connection?.apiPassword, // Already encrypted
    // };

    const connectionConfig = getRouterConnectionConfig(router, {
      forceLocal: true,  // Force local IP for retry
      forceVPN: false,   // Do not use VPN IP for retry
    });

    // Decrypt password
    connectionConfig.password = MikroTikService.decryptPassword(connectionConfig.password);

    // Attempt VPN provisioning
    const vpnResult = await VPNProvisioner.provisionRouterVPN({
      routerId,
      customerId: new ObjectId(session.user.id), // userId for compatibility
      localConnection: connectionConfig,
    });

    if (vpnResult.success && vpnResult.vpnConfig) {
      // Update router with VPN configuration
      await db.collection('routers').updateOne(
        { _id: new ObjectId(routerId) },
        {
          $set: {
            'vpnTunnel.enabled': true,
            'vpnTunnel.clientPublicKey': vpnResult.vpnConfig.clientPublicKey,
            'vpnTunnel.serverPublicKey': vpnResult.vpnConfig.serverPublicKey,
            'vpnTunnel.assignedVPNIP': vpnResult.vpnIP,
            'vpnTunnel.status': 'connected',
            'vpnTunnel.provisionedAt': new Date(),
            'vpnTunnel.error': null,
            'connection.vpnIP': vpnResult.vpnIP,
            'connection.preferVPN': true,
            'connection.ipAddress': vpnResult.vpnIP,
            updatedAt: new Date(),
          },
        }
      );

      console.log(`[VPN Retry] ✅ VPN provisioned successfully for router ${routerId}`);

      return NextResponse.json({
        success: true,
        message: 'VPN provisioned successfully',
        data: {
          vpnIP: vpnResult.vpnIP,
          status: 'connected',
        },
      });

    } else {
      // Update with failure status
      await db.collection('routers').updateOne(
        { _id: new ObjectId(routerId) },
        {
          $set: {
            'vpnTunnel.status': 'failed',
            'vpnTunnel.error': vpnResult.error,
            updatedAt: new Date(),
          },
        }
      );

      console.log(`[VPN Retry] ❌ VPN provisioning failed for router ${routerId}: ${vpnResult.error}`);

      return NextResponse.json(
        {
          success: false,
          error: 'VPN provisioning failed',
          details: vpnResult.error,
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('VPN Retry API Error:', error);
    
    // Update router status on exception
    try {
      const { routerId } = await context.params;
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');
      
      await db.collection('routers').updateOne(
        { _id: new ObjectId(routerId) },
        {
          $set: {
            'vpnTunnel.status': 'failed',
            'vpnTunnel.error': error instanceof Error ? error.message : 'Unknown error',
            updatedAt: new Date(),
          },
        }
      );
    } catch (updateError) {
      console.error('Failed to update router status:', updateError);
    }

    return NextResponse.json(
      {
        error: 'Failed to retry VPN provisioning',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}