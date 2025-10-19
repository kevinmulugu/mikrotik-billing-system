//src/app/api/routers/test-connection/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { MikroTikService } from '@/lib/services/mikrotik';

interface TestConnectionRequest {
  ipAddress: string;
  port: string;
  apiUser: string;
  apiPassword: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: TestConnectionRequest = await req.json();

    // Validate required fields
    if (!body.ipAddress || !body.port || !body.apiUser || !body.apiPassword) {
      return NextResponse.json(
        { error: 'Missing required connection parameters' },
        { status: 400 }
      );
    }

    // Validate IP address format
    if (!MikroTikService.validateIpAddress(body.ipAddress)) {
      return NextResponse.json(
        { error: 'Invalid IP address format' },
        { status: 400 }
      );
    }

    // Validate port number
    const port = parseInt(body.port);
    if (isNaN(port) || port < 1 || port > 65535) {
      return NextResponse.json(
        { error: 'Invalid port number. Must be between 1 and 65535.' },
        { status: 400 }
      );
    }

    // Test connection to MikroTik router
    const result = await MikroTikService.testConnection({
      ipAddress: body.ipAddress,
      port: port,
      username: body.apiUser,
      password: body.apiPassword,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Successfully connected to router',
        data: result.data,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Connection test failed',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Test Connection API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test connection',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}