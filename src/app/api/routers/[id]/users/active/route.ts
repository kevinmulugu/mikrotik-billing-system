// src/app/api/routers/[id]/users/active/route.ts
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // 'all', 'hotspot', 'pppoe'

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get router and verify ownership
    const router = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        userId: new ObjectId(userId),
      });

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    // Check if router is online
    if (router.health?.status !== 'online') {
      return NextResponse.json({
        success: true,
        message: 'Router is offline',
        hotspotUsers: [],
        pppoeUsers: [],
        totalUsers: 0,
      });
    }

    // Get connection config
    const connectionConfig = {
      ipAddress: router.connection?.ipAddress || '',
      port: router.connection?.port || 8728,
      username: router.connection?.apiUser || 'admin',
      password: MikroTikService.decryptPassword(router.connection?.apiPassword || ''),
    };

    let hotspotUsers: any[] = [];
    let pppoeUsers: any[] = [];

    // Fetch hotspot users if requested
    if (type === 'all' || type === 'hotspot') {
      if (router.configuration?.hotspot?.enabled) {
        const activeHotspot = await MikroTikService.getActiveHotspotUsers(connectionConfig);
        
        hotspotUsers = activeHotspot.map((user: any) => ({
          id: user['.id'],
          username: user.user || 'Unknown',
          address: user.address || '',
          macAddress: user['mac-address'] || '',
          uptime: user.uptime || '0s',
          sessionTime: MikroTikService.parseUptimeToSeconds(user.uptime || '0s'),
          bytesIn: parseInt(user['bytes-in'] || '0'),
          bytesOut: parseInt(user['bytes-out'] || '0'),
          packetsIn: parseInt(user['packets-in'] || '0'),
          packetsOut: parseInt(user['packets-out'] || '0'),
          loginBy: user['login-by'] || '',
          type: 'hotspot',
          server: user.server || 'hotspot1',
        }));
      }
    }

    // Fetch PPPoE users if requested
    if (type === 'all' || type === 'pppoe') {
      if (router.configuration?.pppoe?.enabled) {
        const activePPPoE = await MikroTikService.getActivePPPoEUsers(connectionConfig);
        
        pppoeUsers = activePPPoE.map((user: any) => ({
          id: user['.id'],
          username: user.name || 'Unknown',
          address: user.address || '',
          uptime: user.uptime || '0s',
          sessionTime: MikroTikService.parseUptimeToSeconds(user.uptime || '0s'),
          service: user.service || 'pppoe',
          callerID: user['caller-id'] || '',
          encoding: user.encoding || '',
          limitBytesIn: parseInt(user['limit-bytes-in'] || '0'),
          limitBytesOut: parseInt(user['limit-bytes-out'] || '0'),
          type: 'pppoe',
        }));
      }
    }

    // Calculate totals
    const totalBytesIn = [
      ...hotspotUsers.map(u => u.bytesIn || 0),
      ...pppoeUsers.map(u => u.limitBytesIn || 0)
    ].reduce((sum, val) => sum + val, 0);

    const totalBytesOut = [
      ...hotspotUsers.map(u => u.bytesOut || 0),
      ...pppoeUsers.map(u => u.limitBytesOut || 0)
    ].reduce((sum, val) => sum + val, 0);

    // Update router statistics
    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $set: {
          'health.connectedUsers': hotspotUsers.length + pppoeUsers.length,
          'health.lastSeen': new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      hotspotUsers,
      pppoeUsers,
      totalUsers: hotspotUsers.length + pppoeUsers.length,
      statistics: {
        hotspotCount: hotspotUsers.length,
        pppoeCount: pppoeUsers.length,
        totalBytesIn,
        totalBytesOut,
        totalDataUsage: totalBytesIn + totalBytesOut,
      },
    });
  } catch (error) {
    console.error('Error fetching active users:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch active users',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const type = searchParams.get('type') as 'hotspot' | 'pppoe';

    if (!sessionId || !type) {
      return NextResponse.json(
        { error: 'sessionId and type are required' },
        { status: 400 }
      );
    }

    if (type !== 'hotspot' && type !== 'pppoe') {
      return NextResponse.json(
        { error: 'type must be either "hotspot" or "pppoe"' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get router
    const router = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        userId: new ObjectId(userId),
      });

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    // Check if router is online
    if (router.health?.status !== 'online') {
      return NextResponse.json(
        { error: 'Router is offline. Cannot disconnect user.' },
        { status: 400 }
      );
    }

    // Get connection config
    const connectionConfig = {
      ipAddress: router.connection?.ipAddress || '',
      port: router.connection?.port || 8728,
      username: router.connection?.apiUser || 'admin',
      password: MikroTikService.decryptPassword(router.connection?.apiPassword || ''),
    };

    // Get user session details before disconnecting
    const sessionDetails = await MikroTikService.getUserSession(
      connectionConfig,
      sessionId,
      type
    );

    // Disconnect the user
    const success = await MikroTikService.disconnectUser(
      connectionConfig,
      sessionId,
      type
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to disconnect user' },
        { status: 500 }
      );
    }

    // Log audit entry
    await db.collection('audit_logs').insertOne({
      user: {
        userId: new ObjectId(userId),
        email: session.user.email || '',
        role: 'homeowner',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
      action: {
        type: 'delete',
        resource: 'active_user_session',
        resourceId: new ObjectId(routerId),
        description: `Disconnected ${type} user: ${sessionDetails?.user || sessionDetails?.name || 'Unknown'}`,
      },
      changes: {
        before: sessionDetails,
        after: null,
        fields: ['user_session'],
      },
      metadata: {
        sessionId: sessionId,
        correlationId: `disconnect-user-${routerId}`,
        source: 'web',
        severity: 'warning',
      },
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'User disconnected successfully',
      sessionId,
      type,
      username: sessionDetails?.user || sessionDetails?.name || 'Unknown',
    });
  } catch (error) {
    console.error('Error disconnecting user:', error);
    return NextResponse.json(
      {
        error: 'Failed to disconnect user',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}