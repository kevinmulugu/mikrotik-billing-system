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

    // Try up to 3 times with 5 second delays (VPN might take a moment)
    while (connectionAttempts < 3 && !connected) {
      connectionAttempts++;
      
      console.log(`[VPN Verify] Connection attempt ${connectionAttempts}/3...`);

      try {
        const testResult = await MikroTikService.testConnection(connectionConfig);
        
        if (testResult.success) {
          connected = true;
          routerInfo = testResult.data?.routerInfo;
          console.log(`[VPN Verify] ✓ Connection successful via VPN`);
          break;
        }
      } catch (error) {
        console.log(`[VPN Verify] Attempt ${connectionAttempts} failed:`, error);
      }

      // Wait before retry (except on last attempt)
      if (connectionAttempts < 3 && !connected) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    if (!connected) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not connect to router via VPN. Please check:\n' +
                 '1. You pasted the complete script\n' +
                 '2. Script executed without errors\n' +
                 '3. Wait 10-15 seconds and try again',
          vpnIP,
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

    console.log(`[VPN Verify] ✅ VPN verified successfully for token: ${body.setupToken}`);

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
    console.error('VPN Verify Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to verify VPN connection',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}