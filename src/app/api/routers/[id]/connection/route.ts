//src/app/api/routers/[id]/connection/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { MikroTikService } from '@/lib/services/mikrotik';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

interface UpdateConnectionRequest {
  ipAddress: string;
  port: number;
  apiUser: string;
  apiPassword: string;
  restApiEnabled: boolean;
  sshEnabled: boolean;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  const userId = session.user.id;
  const { id: routerId } = await params;
    const body: UpdateConnectionRequest = await request.json();

    // Validate ObjectId
    if (!ObjectId.isValid(routerId)) {
      return NextResponse.json({ error: 'Invalid router ID' }, { status: 400 });
    }

    // Validate required fields
    if (!body.ipAddress) {
      return NextResponse.json({ error: 'IP address is required' }, { status: 400 });
    }

    if (!MikroTikService.validateIpAddress(body.ipAddress)) {
      return NextResponse.json({ error: 'Invalid IP address format' }, { status: 400 });
    }

    if (!body.port || body.port < 1 || body.port > 65535) {
      return NextResponse.json({ error: 'Invalid port number' }, { status: 400 });
    }

    if (!body.apiUser) {
      return NextResponse.json({ error: 'API username is required' }, { status: 400 });
    }

    if (!body.apiPassword) {
      return NextResponse.json({ error: 'API password is required' }, { status: 400 });
    }

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Verify router belongs to user
    const existingRouter = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        userId: new ObjectId(userId),
      });

    if (!existingRouter) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    // Encrypt API password
    const encryptedPassword = MikroTikService.encryptPassword(body.apiPassword);

    // Update connection settings in database
    const updateResult = await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $set: {
          'connection.ipAddress': body.ipAddress,
          'connection.port': body.port,
          'connection.apiUser': body.apiUser,
          'connection.apiPassword': encryptedPassword,
          'connection.restApiEnabled': body.restApiEnabled ?? true,
          'connection.sshEnabled': body.sshEnabled ?? false,
          updatedAt: new Date(),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: 'Failed to update router' }, { status: 500 });
    }

    // Fetch updated router
    const updatedRouter = await db
      .collection('routers')
      .findOne({ _id: new ObjectId(routerId) });

    return NextResponse.json({
      success: true,
      message: 'Connection settings updated successfully',
      connection: {
        ipAddress: updatedRouter?.connection?.ipAddress,
        port: updatedRouter?.connection?.port,
        apiUser: updatedRouter?.connection?.apiUser,
        restApiEnabled: updatedRouter?.connection?.restApiEnabled,
        sshEnabled: updatedRouter?.connection?.sshEnabled,
      },
    });
  } catch (error) {
    console.error('Update Connection API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update connection settings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  const userId = session.user.id;
  const { id: routerId } = await params;

    // Validate ObjectId
    if (!ObjectId.isValid(routerId)) {
      return NextResponse.json({ error: 'Invalid router ID' }, { status: 400 });
    }

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Fetch router
    const router = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        userId: new ObjectId(userId),
      });

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    return NextResponse.json({
      connection: {
        ipAddress: router.connection?.ipAddress || '',
        port: router.connection?.port || 8728,
        apiUser: router.connection?.apiUser || 'admin',
        apiPassword: router.connection?.apiPassword || '',
        restApiEnabled: router.connection?.restApiEnabled ?? true,
        sshEnabled: router.connection?.sshEnabled ?? false,
      },
    });
  } catch (error) {
    console.error('Get Connection API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch connection settings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}