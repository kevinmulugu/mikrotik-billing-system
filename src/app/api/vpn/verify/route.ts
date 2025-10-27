// src/app/api/vpn/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { MikroTikService } from '@/lib/services/mikrotik';

interface VerifyVPNRequest {
  setupToken: string;
  routerIP: string; // Local IP for reference
  apiUser: string;
  apiPassword: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: VerifyVPNRequest = await req.json();

    if (!body.setupToken) {
      return NextResponse.json(
        { error: 'Setup token is required' },
        { status: 400 }
      );
    }

    // Get VPN configuration from database
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    const setupToken = await db.collection('vpn_setup_tokens').findOne({
      token: body.setupToken,
      status: 'pending',
    });

    if (!setupToken) {
      return NextResponse.json(
        { error: 'Invalid or expired setup token' },
        { status: 404 }
      );
    }

    // Check if token expired
    if (new Date() > new Date(setupToken.expiresAt)) {
      return NextResponse.json(
        { error: 'Setup token has expired. Please generate a new script.' },
        { status: 410 }
      );
    }

    const vpnIP = setupToken.vpnConfig.vpnIP;

    console.log(`[VPN Verify] Testing connection to router via VPN IP: ${vpnIP}`);
    console.log(`[VPN Verify] Waiting for VPN handshake to establish...`);

    // Initial wait for tunnel establishment (30 seconds)
    // WireGuard needs time for initial handshake, especially with NAT traversal
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Test connection to router via VPN IP
    const connectionConfig = {
      ipAddress: vpnIP,
      port: 8728,
      username: body.apiUser || 'admin',
      password: body.apiPassword,
    };

    let connectionAttempts = 0;
    let connected = false;
    let routerInfo: any = null;

    // Try up to 6 times with 10 second delays (60 seconds total)
    // Extended from 3x5s to 6x10s to allow proper VPN handshake time
    const MAX_ATTEMPTS = 6;
    const RETRY_DELAY = 10000; // 10 seconds

    while (connectionAttempts < MAX_ATTEMPTS && !connected) {
      connectionAttempts++;
      
      console.log(`[VPN Verify] Connection attempt ${connectionAttempts}/${MAX_ATTEMPTS}...`);

      try {
        const testResult = await MikroTikService.testConnection(connectionConfig);
        
        if (testResult.success) {
          connected = true;
          routerInfo = testResult.data?.routerInfo;
          console.log(`[VPN Verify] ✓ Connection successful via VPN on attempt ${connectionAttempts}`);
          break;
        }
      } catch (error) {
        console.log(`[VPN Verify] Attempt ${connectionAttempts} failed:`, error instanceof Error ? error.message : 'Unknown error');
      }

      // Wait before retry (except on last attempt)
      if (connectionAttempts < MAX_ATTEMPTS && !connected) {
        console.log(`[VPN Verify] Waiting ${RETRY_DELAY / 1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }

    if (!connected) {
      console.error(`[VPN Verify] ❌ Failed to connect after ${MAX_ATTEMPTS} attempts`);
      
      return NextResponse.json(
        {
          success: false,
          error: 'Could not connect to router via VPN',
          troubleshooting: {
            checks: [
              'Ensure you pasted the complete script into the router terminal',
              'Verify the script executed without errors',
              'Check that router has internet connectivity',
              'Wait 1-2 minutes for VPN handshake to establish',
              'Verify router admin password is correct',
            ],
            vpnIP,
            attempts: connectionAttempts,
            canRetry: true,
          },
        },
        { status: 503 }
      );
    }

    // Get router MAC address for identification
    let macAddress = 'Unknown';
    let identity = 'Unknown';
    
    try {
      macAddress = await MikroTikService.getRouterMacAddress(connectionConfig);
      identity = await MikroTikService.getIdentity(connectionConfig);
      console.log(`[VPN Verify] Router details - MAC: ${macAddress}, Identity: ${identity}`);
    } catch (error) {
      console.warn('[VPN Verify] Could not get router details:', error);
    }

    // Update token status
    await db.collection('vpn_setup_tokens').updateOne(
      { token: body.setupToken },
      {
        $set: {
          status: 'verified',
          verifiedAt: new Date(),
          routerDetails: {
            macAddress,
            identity,
            routerInfo,
          },
        },
      }
    );

    console.log(`[VPN Verify] ✅ VPN verified successfully - Token: ${body.setupToken.substring(0, 16)}...`);

    return NextResponse.json({
      success: true,
      message: 'VPN connection verified successfully!',
      data: {
        vpnIP,
        connected: true,
        routerInfo: {
          macAddress,
          identity,
          version: routerInfo?.version || 'Unknown',
          boardName: routerInfo?.boardName || 'Unknown',
        },
        vpnConfig: {
          publicKey: setupToken.vpnConfig.clientPublicKey,
          vpnIP: setupToken.vpnConfig.vpnIP,
        },
      },
    });

  } catch (error) {
    console.error('[VPN Verify] ❌ Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to verify VPN connection',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}