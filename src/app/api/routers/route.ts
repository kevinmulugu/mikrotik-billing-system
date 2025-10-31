// app/api/routers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(req: NextRequest) {
  try {
    // Get authenticated session
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get all routers for this user
    const routers = await db
      .collection('routers')
      .find({ userId: new ObjectId(userId) })
      .toArray();

    // Get statistics
    const totalRouters = routers.length;
    const onlineRouters = routers.filter(r => r.health?.status === 'online').length;
    const offlineRouters = routers.filter(r => r.health?.status === 'offline').length;
    const totalActiveUsers = routers.reduce((sum, r) => sum + (r.health?.connectedUsers || 0), 0);

    // Format routers for response
    const formattedRouters = routers.map((router) => ({
      id: router._id.toString(),
      name: router.routerInfo?.name || 'Unnamed Router',
      model: router.routerInfo?.model || 'Unknown',
      serialNumber: router.routerInfo?.serialNumber,
      location: router.routerInfo?.location?.name || 'Unknown Location',
      ipAddress: router.connection?.ipAddress,
      status: router.health?.status || 'offline',
      health: {
        lastSeen: router.health?.lastSeen,
        uptime: router.health?.uptime || 0,
        cpuUsage: router.health?.cpuUsage || 0,
        memoryUsage: router.health?.memoryUsage || 0,
        temperature: router.health?.temperature || 0,
        connectedUsers: router.health?.connectedUsers || 0,
      },
      statistics: {
        totalUsers: router.statistics?.totalUsers || 0,
        activeUsers: router.statistics?.activeUsers || 0,
        dailyRevenue: router.statistics?.revenue?.daily || 0,
        monthlyRevenue: router.statistics?.revenue?.monthly || 0,
        totalRevenue: router.statistics?.revenue?.total || 0,
      },
      configuration: {
        hotspotEnabled: router.configuration?.hotspot?.enabled || false,
        pppoeEnabled: router.configuration?.pppoe?.enabled || false,
      },
      createdAt: router.createdAt,
      updatedAt: router.updatedAt,
    }));

    return NextResponse.json({
      statistics: {
        totalRouters,
        onlineRouters,
        offlineRouters,
        totalActiveUsers,
      },
      routers: formattedRouters,
    });
  } catch (error) {
    console.error('Routers API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch routers' },
      { status: 500 }
    );
  }
}