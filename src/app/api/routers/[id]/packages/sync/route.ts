// src/app/api/routers/[id]/packages/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { MikroTikService } from '@/lib/services/mikrotik';
import { getRouterConnectionConfig } from '@/lib/services/router-connection';
import { NotificationService } from '@/lib/services/notification';
import { RouterProviderFactory } from '@/lib/factories/router-provider.factory';
import type { ServiceType } from '@/lib/interfaces/router-provider.interface';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/routers/[id]/packages/sync
 * 
 * Sync packages from router for a specific service type (hotspot or pppoe)
 * Uses RouterProvider abstraction for multi-router support
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: routerId } = await params;
    
    // Get service type from query params (defaults to hotspot)
    const { searchParams } = new URL(request.url);
    const serviceType = (searchParams.get('service') || 'hotspot') as ServiceType;

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

    // Get router type (defaults to mikrotik for backward compatibility)
    const routerType = router.routerType || 'mikrotik';

    // Check if service is enabled
    const serviceConfig = router.services?.[serviceType];
    if (!serviceConfig?.enabled) {
      return NextResponse.json(
        { error: `${serviceType} service is not enabled on this router` },
        { status: 400 }
      );
    }

    // Get connection config
    const connectionConfig = getRouterConnectionConfig(router, {
      forceLocal: false,
      forceVPN: true,
    });

    // Create router provider instance
    const provider = RouterProviderFactory.create(routerType, connectionConfig);

    // Check if provider supports this service
    if (!provider.supportsService(serviceType)) {
      return NextResponse.json(
        { error: `${routerType} router does not support ${serviceType} service` },
        { status: 400 }
      );
    }

    // Sync packages from router using provider
    let syncResult;
    try {
      syncResult = await provider.syncPackagesFromRouter!(serviceType);
    } catch (error) {
      console.error('Failed to sync packages from router:', error);
      return NextResponse.json(
        {
          error: 'Failed to connect to router',
          details: error instanceof Error ? error.message : 'Could not retrieve packages from router',
        },
        { status: 500 }
      );
    }

    if (!syncResult.success) {
      return NextResponse.json(
        { error: syncResult.error || 'Package sync failed' },
        { status: 500 }
      );
    }

    // Update router packages in database (service-aware)
    const updatePath = `services.${serviceType}.packages`;
    const lastSyncedPath = `services.${serviceType}.lastSynced`;
    
    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $set: {
          [updatePath]: syncResult.packages,
          [lastSyncedPath]: new Date(),
          // Also update legacy packages for backward compatibility
          ...(serviceType === 'hotspot' && {
            'packages.hotspot': syncResult.packages,
            'packages.lastSynced': new Date(),
          }),
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
        description: `Synced ${serviceType} packages for router: ${router.routerInfo?.name}`,
      },
      changes: {
        before: { packageCount: serviceConfig.packages?.length || 0 },
        after: { packageCount: syncResult.packages.length },
        fields: ['packages', serviceType],
      },
      metadata: {
        sessionId: '',
        correlationId: `sync-packages-${routerId}-${serviceType}`,
        source: 'web',
        severity: 'info',
        routerType,
        serviceType,
      },
      timestamp: new Date(),
    });

    // Create notification for user if there are changes
    try {
      if (syncResult.added > 0 || syncResult.updated > 0) {
        const routerName = router.routerInfo?.name || 'Router';
        const changes: string[] = [];
        if (syncResult.added > 0) changes.push(`${syncResult.added} new`);
        if (syncResult.updated > 0) changes.push(`${syncResult.updated} updated`);
        
        await NotificationService.createNotification({
          userId,
          type: 'info',
          category: 'router',
          priority: 'low',
          title: 'Packages Synced',
          message: `${routerName} (${serviceType}): ${changes.join(', ')} package(s) synced.`,
          metadata: {
            resourceType: 'router',
            resourceId: routerId,
            link: `/routers/${routerId}`,
            serviceType,
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
      message: `${serviceType} packages synced successfully`,
      serviceType,
      routerType,
      results: {
        total: syncResult.packages.length,
        added: syncResult.added,
        updated: syncResult.updated,
        removed: syncResult.removed,
        packages: syncResult.packages,
      },
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