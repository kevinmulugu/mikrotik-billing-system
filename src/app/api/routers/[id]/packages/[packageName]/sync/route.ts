// src/app/api/routers/[id]/packages/[packageName]/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { MikroTikService } from '@/lib/services/mikrotik';
import { getRouterConnectionConfig } from '@/lib/services/router-connection';

interface RouteContext {
  params: Promise<{
    id: string;
    packageName: string;
  }>;
}

// POST /api/routers/[id]/packages/[packageName]/sync - Sync package to router
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: routerId, packageName } = await context.params;
    const userId = session.user.id;
    const decodedPackageName = decodeURIComponent(packageName);

    // Validate router ID
    if (!ObjectId.isValid(routerId)) {
      return NextResponse.json({ error: 'Invalid router ID' }, { status: 400 });
    }

    // Connect to database
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Verify router ownership
    const router = await db.collection('routers').findOne({
      _id: new ObjectId(routerId),
      userId: new ObjectId(userId),
    });

    if (!router) {
      return NextResponse.json(
        { error: 'Router not found or access denied' },
        { status: 404 }
      );
    }

    // Find package
    const packageIndex = router.packages?.hotspot?.findIndex(
      (pkg: any) => pkg.name === decodedPackageName
    );

    if (packageIndex === undefined || packageIndex === -1) {
      return NextResponse.json(
        { error: `Package "${decodedPackageName}" not found` },
        { status: 404 }
      );
    }

    const packageData = router.packages.hotspot[packageIndex];

    // Check if router is online
    if (router.health?.status !== 'online') {
      return NextResponse.json(
        {
          error: 'Router is offline. Cannot sync package.',
          routerStatus: router.health?.status || 'unknown',
        },
        { status: 400 }
      );
    }

    // Sync package to router
    let mikrotikSyncResult;
    try {
      console.log(`Syncing package "${decodedPackageName}" to router...`);

      const routerConfig = getRouterConnectionConfig(router, {
        forceLocal: false,
        forceVPN: true,
      });

      // Check if package already exists on router (has mikrotikId)
      if (packageData.mikrotikId) {
        console.log(
          `Updating existing MikroTik profile with ID: ${packageData.mikrotikId}`
        );

        // Update existing profile
        const mikrotikProfile = {
          'address-pool': packageData.addressPool,
          'session-timeout': packageData.sessionTimeout,
          'idle-timeout': packageData.idleTimeout,
          'keepalive-timeout': packageData.keepaliveTimeout,
          'status-autorefresh': packageData.statusAutorefresh,
          'shared-users': packageData.sharedUsers,
          'rate-limit': packageData.rateLimit,
          'transparent-proxy': packageData.transparentProxy,
        };

        const result = await MikroTikService.updateHotspotUserProfileById(
          routerConfig,
          packageData.mikrotikId,
          mikrotikProfile
        );

        console.log('MikroTik profile updated successfully:', result);

        mikrotikSyncResult = {
          success: true,
          mikrotikId: packageData.mikrotikId,
          action: 'updated',
          message: 'Package updated on router successfully',
        };
      } else {
        // Create new profile on router
        console.log('Package not found on router, creating new profile...');

        const mikrotikProfile = {
          name: packageData.name,
          'address-pool': packageData.addressPool,
          'session-timeout': packageData.sessionTimeout,
          'idle-timeout': packageData.idleTimeout,
          'keepalive-timeout': packageData.keepaliveTimeout,
          'status-autorefresh': packageData.statusAutorefresh,
          'shared-users': packageData.sharedUsers,
          'rate-limit': packageData.rateLimit,
          'transparent-proxy': packageData.transparentProxy,
        };

        const result = await MikroTikService.createHotspotUserProfile(
          routerConfig,
          mikrotikProfile
        );

        console.log('MikroTik profile created successfully:', result);

        const newMikrotikId = result?.['.id'] || null;

        mikrotikSyncResult = {
          success: true,
          mikrotikId: newMikrotikId,
          action: 'created',
          message: 'Package created on router successfully',
        };

        // Update package with mikrotikId
        packageData.mikrotikId = newMikrotikId;
      }

      // Update sync status in database
      await db.collection('routers').updateOne(
        {
          _id: new ObjectId(routerId),
          'packages.hotspot.name': decodedPackageName,
        },
        {
          $set: {
            'packages.hotspot.$.syncStatus': 'synced',
            'packages.hotspot.$.lastSynced': new Date(),
            'packages.hotspot.$.syncError': null,
            'packages.hotspot.$.mikrotikId': packageData.mikrotikId,
            'packages.lastSynced': new Date(),
            updatedAt: new Date(),
          },
        }
      );

      console.log(`Package "${decodedPackageName}" synced successfully`);

      return NextResponse.json({
        success: true,
        message: mikrotikSyncResult.message,
        sync: {
          action: mikrotikSyncResult.action,
          mikrotikId: mikrotikSyncResult.mikrotikId,
          syncedAt: new Date().toISOString(),
          syncStatus: 'synced',
        },
      });
    } catch (mikrotikError) {
      console.error('Failed to sync package to MikroTik:', mikrotikError);

      // Update sync status to failed
      await db.collection('routers').updateOne(
        {
          _id: new ObjectId(routerId),
          'packages.hotspot.name': decodedPackageName,
        },
        {
          $set: {
            'packages.hotspot.$.syncStatus': 'failed',
            'packages.hotspot.$.syncError':
              mikrotikError instanceof Error ? mikrotikError.message : 'Unknown error',
            'packages.lastSynced': new Date(),
            updatedAt: new Date(),
          },
        }
      );

      return NextResponse.json(
        {
          error: 'Failed to sync package to router',
          details: mikrotikError instanceof Error ? mikrotikError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error syncing package:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}