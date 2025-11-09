// src/app/api/routers/[id]/packages/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { MikroTikService } from '@/lib/services/mikrotik';
import { getRouterConnectionConfig } from '@/lib/services/router-connection';
import { NotificationService } from '@/lib/services/notification';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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
      return NextResponse.json(
        { error: 'Router is offline. Please ensure router is connected.' },
        { status: 400 }
      );
    }

    // Get connection config
    // const connectionConfig = {
    //   ipAddress: router.connection?.ipAddress || '',
    //   port: router.connection?.port || 8728,
    //   username: router.connection?.apiUser || 'admin',
    //   password: MikroTikService.decryptPassword(router.connection?.apiPassword || ''),
    // };
    const connectionConfig = getRouterConnectionConfig(router, {
      forceLocal: false,
      forceVPN: true,
    });

    // Fetch hotspot user profiles from router with error handling
    let routerProfiles: any[] = [];
    try {
      routerProfiles = await MikroTikService.getHotspotUserProfiles(connectionConfig);
    } catch (error) {
      console.error('Failed to fetch hotspot profiles:', error);
      return NextResponse.json(
        {
          error: 'Failed to connect to router',
          details: error instanceof Error ? error.message : 'Could not retrieve packages from router',
        },
        { status: 500 }
      );
    }

    if (!routerProfiles || routerProfiles.length === 0) {
      return NextResponse.json(
        { error: 'No packages found on router' },
        { status: 404 }
      );
    }

    // Get current packages from database
    const dbPackages = router.packages?.hotspot || [];

    // Sync results
    const syncResults = {
      synced: 0,
      newOnRouter: 0,
      outOfSync: 0,
      notOnRouter: 0,
      packages: [] as any[],
    };

    // Process each router profile
    for (const profile of routerProfiles) {
      const profileName = profile.name;

      // Skip default profiles
      if (profileName === 'default' || profileName === 'default-encryption') {
        continue;
      }

      // Find matching package in database
      const dbPackage = dbPackages.find((pkg: any) => pkg.name === profileName);

      if (dbPackage) {
        // Ensure disabled field exists (migration for old packages)
        if (dbPackage.disabled === undefined) {
          dbPackage.disabled = false;
        }

        // Package exists in database - check for discrepancies
        const hasDiscrepancy =
          dbPackage.sessionTimeout !== profile['session-timeout'] ||
          dbPackage.rateLimit !== profile['rate-limit'] ||
          dbPackage.idleTimeout !== profile['idle-timeout'];

        if (hasDiscrepancy) {
          syncResults.outOfSync++;
          syncResults.packages.push({
            name: profileName,
            syncStatus: 'out_of_sync',
            routerConfig: profile,
            dbConfig: dbPackage,
          });
        } else {
          syncResults.synced++;
          syncResults.packages.push({
            name: profileName,
            syncStatus: 'synced',
          });
        }
      } else {
        // New package found on router
        syncResults.newOnRouter++;

        // Extract pricing from profile name (e.g., "1hour-10ksh" -> 10)
        const priceMatch = profileName.match(/(\d+)ksh/i);
        const price = priceMatch ? parseInt(priceMatch[1]) : 0;

        // Extract duration from profile name and session-timeout
        let duration = 0;
        const durationStr = profile['session-timeout'] || '0';

        if (durationStr.includes('h')) {
          duration = parseInt(durationStr) * 60;
        } else if (durationStr.includes('d')) {
          duration = parseInt(durationStr) * 1440;
        } else if (durationStr.includes('w')) {
          duration = parseInt(durationStr) * 10080;
        } else {
          duration = parseInt(durationStr);
        }

        // Extract bandwidth from rate-limit
        const rateLimit = profile['rate-limit'] || '';
        const [upload, download] = rateLimit.split('/').map((s: string) => {
          const match = s.match(/(\d+)([KMG]?)/i);
          if (!match) return 0;
          const value = parseInt(match[1] || '0');
          const unit = match[2]?.toUpperCase();
          if (unit === 'M') return value * 1024;
          if (unit === 'G') return value * 1024 * 1024;
          return value;
        });

        const newPackage = {
          mikrotikId: profile['.id'],
          name: profileName,
          displayName: profileName.replace(/-/g, ' ').toUpperCase(),
          price: price,
          duration: duration,
          bandwidth: {
            upload: upload || 0,
            download: download || 0,
          },
          sessionTimeout: profile['session-timeout'],
          idleTimeout: profile['idle-timeout'],
          rateLimit: profile['rate-limit'],
          addressPool: profile['address-pool'] || 'hotspot-pool',
          sharedUsers: profile['shared-users'] || '1',
          transparentProxy: profile['transparent-proxy'] || 'yes',
          disabled: false, // Allow purchases by default
          syncStatus: 'synced',
          lastSynced: new Date(),
        };

        syncResults.packages.push({
          ...newPackage,
          syncStatus: 'new_on_router',
        });

        // Add to database
        dbPackages.push(newPackage);
      }
    }

    // Check for packages in DB that are not on router
    for (const dbPackage of dbPackages) {
      const exists = routerProfiles.find((p: any) => p.name === dbPackage.name);
      if (!exists && dbPackage.name !== 'default') {
        syncResults.notOnRouter++;
        syncResults.packages.push({
          name: dbPackage.name,
          syncStatus: 'not_on_router',
          dbConfig: dbPackage,
        });
      }
    }

    // Update router packages in database
    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $set: {
          'packages.hotspot': dbPackages,
          'packages.lastSynced': new Date(),
          updatedAt: new Date(),
        },
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
        type: 'update',
        resource: 'router_packages',
        resourceId: new ObjectId(routerId),
        description: `Synced packages for router: ${router.routerInfo?.name}`,
      },
      changes: {
        before: { packageCount: router.packages?.hotspot?.length || 0 },
        after: { packageCount: dbPackages.length },
        fields: ['packages'],
      },
      metadata: {
        sessionId: '',
        correlationId: `sync-packages-${routerId}`,
        source: 'web',
        severity: 'info',
      },
      timestamp: new Date(),
    });

    // Create notification for user if there are changes
    try {
      if (syncResults.newOnRouter > 0 || syncResults.outOfSync > 0) {
        const routerName = router.routerInfo?.name || 'Router';
        const changes: string[] = [];
        if (syncResults.newOnRouter > 0) changes.push(`${syncResults.newOnRouter} new`);
        if (syncResults.outOfSync > 0) changes.push(`${syncResults.outOfSync} updated`);
        
        await NotificationService.createNotification({
          userId,
          type: 'info',
          category: 'router',
          priority: 'low',
          title: 'Packages Synced',
          message: `${routerName}: ${changes.join(', ')} package(s) synced from MikroTik.`,
          metadata: {
            resourceType: 'router',
            resourceId: routerId,
            link: `/routers/${routerId}`,
          },
          sendEmail: false, // Background operation, no email needed
        });
      }
    } catch (notifError) {
      console.error('Failed to create package sync notification:', notifError);
      // Don't fail the sync if notification fails
    }

    return NextResponse.json({
      success: true,
      message: 'Packages synced successfully',
      results: syncResults,
    });
  } catch (error) {
    console.error('Error syncing packages:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync packages',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}