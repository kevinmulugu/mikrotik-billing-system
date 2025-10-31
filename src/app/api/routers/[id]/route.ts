// src/app/api/routers/[id]/route.ts - Enhanced with Complete Network Data

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { RouterSyncService } from '@/lib/services/router-sync';

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

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Fetch router from database and verify ownership
    const routerDoc = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        userId: new ObjectId(userId),
      });

    if (!routerDoc) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    // Auto-sync router status in background (don't await)
    RouterSyncService.syncRouter(routerId)
      .then((syncResult) => {
        if (!syncResult.success) {
          console.warn(`Failed to sync router ${routerId}:`, syncResult.error);
        } else if (syncResult.discrepancies && syncResult.discrepancies.length > 0) {
          console.warn(`Configuration discrepancies found on router ${routerId}:`, syncResult.discrepancies);
        }
      })
      .catch((error) => {
        console.error(`Error syncing router ${routerId}:`, error);
      });

    // Format response matching the database structure with complete network data
    const router = {
      id: routerDoc._id.toString(),
      name: routerDoc.routerInfo?.name || 'Unknown',
      model: routerDoc.routerInfo?.model || 'Unknown',
      serialNumber: routerDoc.routerInfo?.serialNumber || '',
      macAddress: routerDoc.routerInfo?.macAddress || '',
      firmwareVersion: routerDoc.routerInfo?.firmwareVersion || '',
      status: routerDoc.health?.status || 'offline',
      ipAddress: routerDoc.connection?.ipAddress || '',
      location: {
        name: routerDoc.routerInfo?.location?.name || '',
        address: routerDoc.routerInfo?.location?.address || '',
        coordinates: routerDoc.routerInfo?.location?.coordinates || {
          latitude: 0,
          longitude: 0,
        },
      },
      connection: {
        ipAddress: routerDoc.connection?.ipAddress || '',
        port: routerDoc.connection?.port || 8728,
        apiUser: routerDoc.connection?.apiUser || 'admin',
        restApiEnabled: routerDoc.connection?.restApiEnabled ?? true,
        sshEnabled: routerDoc.connection?.sshEnabled ?? false,
      },
      configuration: {
        hotspot: {
          enabled: routerDoc.configuration?.hotspot?.enabled ?? false,
          ssid: routerDoc.configuration?.hotspot?.ssid || '',
          interface: routerDoc.configuration?.hotspot?.interface || 'wlan1',
          ipPool: routerDoc.configuration?.hotspot?.ipPool || '10.5.50.0/24',
          dnsServers: routerDoc.configuration?.hotspot?.dnsServers || ['8.8.8.8', '8.8.4.4'],
          maxUsers: routerDoc.configuration?.hotspot?.maxUsers || 50,
          // Enhanced: IP Pool Usage
          ipPoolUsage: routerDoc.configuration?.hotspot?.ipPoolUsage || {
            total: 0,
            used: 0,
            available: 0,
            percentage: 0,
            lastSynced: null,
          },
          // Enhanced: Server Status
          serverStatus: routerDoc.configuration?.hotspot?.serverStatus || {
            isRunning: false,
            disabled: true,
            keepaliveTimeout: 'none',
            idleTimeout: '5m',
            lastSynced: null,
          },
        },
        pppoe: {
          enabled: routerDoc.configuration?.pppoe?.enabled ?? false,
          interface: routerDoc.configuration?.pppoe?.interface || 'ether1',
          ipPool: routerDoc.configuration?.pppoe?.ipPool || '10.10.10.0/24',
          dnsServers: routerDoc.configuration?.pppoe?.dnsServers || ['8.8.8.8', '8.8.4.4'],
          defaultProfile: routerDoc.configuration?.pppoe?.defaultProfile || 'default',
        },
        network: {
          lanInterface: routerDoc.configuration?.network?.lanInterface || 'bridge',
          wanInterface: routerDoc.configuration?.network?.wanInterface || 'ether1',
          lanSubnet: routerDoc.configuration?.network?.lanSubnet || '192.168.88.0/24',
          dhcpRange: routerDoc.configuration?.network?.dhcpRange || '192.168.88.10-192.168.88.254',
          // Enhanced: Bridge Ports Configuration
          bridgePorts: routerDoc.configuration?.network?.bridgePorts || [],
          // Enhanced: WAN Status Details
          wanStatus: routerDoc.configuration?.network?.wanStatus || {
            isConnected: false,
            externalIP: null,
            gateway: null,
            dnsServers: [],
            lastConnected: null,
          },
        },
      },
      health: {
        status: routerDoc.health?.status || 'offline',
        lastSeen: routerDoc.health?.lastSeen || new Date(),
        uptime: routerDoc.health?.uptime || 0,
        cpuUsage: routerDoc.health?.cpuUsage || 0,
        memoryUsage: routerDoc.health?.memoryUsage || 0,
        diskUsage: routerDoc.health?.diskUsage || 0,
        temperature: routerDoc.health?.temperature || 0,
        connectedUsers: routerDoc.health?.connectedUsers || 0,
        // Enhanced: Internet Connectivity Status
        internetConnectivity: routerDoc.health?.internetConnectivity || {
          isConnected: false,
          lastChecked: null,
        },
      },
      statistics: {
        totalDataUsage: routerDoc.statistics?.totalDataUsage || 0,
        monthlyDataUsage: routerDoc.statistics?.monthlyDataUsage || 0,
        totalUsers: routerDoc.statistics?.totalUsers || 0,
        activeUsers: routerDoc.statistics?.activeUsers || 0,
        monthlyRevenue: routerDoc.statistics?.revenue?.monthly || 0,
        dailyRevenue: routerDoc.statistics?.revenue?.daily || 0,
        totalRevenue: routerDoc.statistics?.revenue?.total || 0,
      },
      // Enhanced: Complete Packages Data
      packages: routerDoc.packages || { hotspot: [], pppoe: [] },
      // Enhanced: DHCP Status
      dhcpStatus: routerDoc.dhcpStatus || {
        hotspot: {
          serverName: '',
          isActive: false,
          totalLeases: 0,
          activeLeases: 0,
          lastSynced: null,
        },
        lan: {
          serverName: '',
          isActive: false,
          totalLeases: 0,
          activeLeases: 0,
          lastSynced: null,
        },
      },
      // Enhanced: Network Interfaces
      networkInterfaces: routerDoc.networkInterfaces || [],
      configurationStatus: routerDoc.configurationStatus || null,
      createdAt: routerDoc.createdAt,
      updatedAt: routerDoc.updatedAt,
    };

    return NextResponse.json({ router });
  } catch (error) {
    console.error('Error fetching router:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: 'Direct router modifications are not allowed',
        message: 'Router configuration must be changed through the MikroTik interface. This system monitors and syncs the configuration automatically.',
      },
      { status: 403 }
    );
  } catch (error) {
    console.error('Error updating router:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get router details before deletion for audit log and verify ownership
    const router = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        userId: new ObjectId(userId),
      });

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    // Delete router
    const result = await db.collection('routers').deleteOne({
      _id: new ObjectId(routerId),
      userId: new ObjectId(userId),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    // Update user statistics
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $inc: { 'statistics.totalRouters': -1 },
        $set: { updatedAt: new Date() },
      }
    );

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
        resource: 'router',
        resourceId: new ObjectId(routerId),
        description: `Deleted router: ${router.routerInfo?.name}`,
      },
      changes: {
        before: router,
        after: null,
        fields: ['router_deleted'],
      },
      metadata: {
        sessionId: '',
        correlationId: `delete-router-${routerId}`,
        source: 'web',
        severity: 'warning',
      },
      timestamp: new Date(),
    });

    return NextResponse.json({ message: 'Router deleted successfully' });
  } catch (error) {
    console.error('Error deleting router:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}