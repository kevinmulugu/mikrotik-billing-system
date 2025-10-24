// src/app/api/vpn/generate-script/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { VPNProvisioner } from '@/lib/services/vpn-provisioner';

interface GenerateScriptRequest {
  routerName: string;
  routerModel: string;
  ipAddress: string;
}

/**
 * POST /api/vpn/generate-script
 * 
 * Generate a VPN setup script for manual router configuration.
 * This endpoint:
 * 1. Generates real WireGuard keypair using system tools
 * 2. Allocates a VPN IP from the database-tracked pool
 * 3. Registers the peer on the actual VPN server via SSH
 * 4. Creates a setup token with 30-minute expiration
 * 5. Returns a MikroTik script that users can paste into their router terminal
 * 
 * The script contains all necessary WireGuard configuration commands
 * to establish a secure management tunnel to the central VPN server.
 */
export async function POST(req: NextRequest) {
  try {
    // Step 1: Authenticate user
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Step 2: Validate request body
    const body: GenerateScriptRequest = await req.json();

    if (!body.routerName || !body.ipAddress) {
      return NextResponse.json(
        { error: 'Router name and IP address are required' },
        { status: 400 }
      );
    }

    // Step 3: Call VPNProvisioner service to generate the setup script
    // This handles all the heavy lifting:
    // - Generates real WireGuard keypair using 'wg genkey' and 'wg pubkey'
    // - Allocates VPN IP from database pool with collision detection
    // - Registers peer on VPN server via SSH
    // - Stores setup token in MongoDB with 30-minute expiration
    // - Generates MikroTik configuration script
    console.log(`[API] Generating VPN script for router: ${body.routerName}`);
    
    const result = await VPNProvisioner.generateVPNSetupScript({
      routerName: body.routerName,
      routerModel: body.routerModel,
      ipAddress: body.ipAddress,
      userId: session.user.id,
    });

    // Step 4: Handle service response
    if (!result.success) {
      console.error('[API] VPN script generation failed:', result.error);
      return NextResponse.json(
        {
          error: result.error || 'Failed to generate VPN script',
          details: result.details,
        },
        { status: 500 }
      );
    }

    // Step 5: Return successful response with script and metadata
    console.log(`[API] ✅ VPN script generated successfully - Token: ${result.setupToken}`);
    
    return NextResponse.json({
      success: true,
      data: {
        setupToken: result.setupToken,
        script: result.script,
        vpnIP: result.vpnIP,
        expiresIn: result.expiresIn,
        instructions: result.instructions,
      },
    });

  } catch (error) {
    console.error('[API] Generate VPN Script Error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to generate VPN script',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}