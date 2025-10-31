// src/app/api/routers/[id]/packages/[packageName]/route.ts
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

// GET /api/routers/[id]/packages/[packageName] - Get specific package details
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: routerId, packageName } = await context.params;
    const userId = session.user.id;

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
    const packageData = router.packages?.hotspot?.find(
      (pkg: any) => pkg.name === decodeURIComponent(packageName)
    );

    if (!packageData) {
      return NextResponse.json(
        { error: `Package "${decodeURIComponent(packageName)}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      package: packageData,
    });
  } catch (error) {
    console.error('Error fetching package:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch package',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PATCH /api/routers/[id]/packages/[packageName] - Update package
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: routerId, packageName } = await context.params;
    const userId = session.user.id;
    const body = await request.json();

    // Decode package name
    const decodedPackageName = decodeURIComponent(packageName);

    // Validate that name is not being changed
    if (body.name && body.name !== decodedPackageName) {
      return NextResponse.json(
        { error: 'Package name cannot be changed' },
        { status: 400 }
      );
    }

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

    // Find existing package
    const existingPackageIndex = router.packages?.hotspot?.findIndex(
      (pkg: any) => pkg.name === decodedPackageName
    );

    if (existingPackageIndex === undefined || existingPackageIndex === -1) {
      return NextResponse.json(
        { error: `Package with name "${decodedPackageName}" not found` },
        { status: 404 }
      );
    }

    const existingPackage = router.packages.hotspot[existingPackageIndex];

    // Build updated package data (merge with existing)
    const updatedFields: any = {
      updatedAt: new Date(),
    };

    if (body.displayName !== undefined) updatedFields.displayName = body.displayName.trim();
    if (body.description !== undefined) updatedFields.description = body.description.trim();
    if (body.price !== undefined) updatedFields.price = parseFloat(body.price.toString());
    if (body.dataLimit !== undefined)
      updatedFields.dataLimit = parseInt(body.dataLimit.toString());
    if (body.validity !== undefined) updatedFields.validity = parseInt(body.validity.toString());
    if (body.disabled !== undefined) updatedFields.disabled = body.disabled === true;

    // Handle duration update
    if (body.duration !== undefined) {
      updatedFields.duration = parseInt(body.duration.toString());
      // Convert to MikroTik format
      const duration = updatedFields.duration;
      if (duration < 60) {
        updatedFields.sessionTimeout = `${duration}m`;
      } else if (duration < 1440) {
        const hours = Math.floor(duration / 60);
        const remainingMinutes = duration % 60;
        updatedFields.sessionTimeout = remainingMinutes > 0 ? `${hours}h${remainingMinutes}m` : `${hours}h`;
      } else {
        const days = Math.floor(duration / 1440);
        const remainingHours = Math.floor((duration % 1440) / 60);
        updatedFields.sessionTimeout = remainingHours > 0 ? `${days}d${remainingHours}h` : `${days}d`;
      }
    }

    // Handle bandwidth update
    if (body.bandwidth !== undefined) {
      updatedFields.bandwidth = {
        upload: parseInt(body.bandwidth.upload.toString()),
        download: parseInt(body.bandwidth.download.toString()),
      };

      // Rebuild rate limit string
      const uploadMbps =
        updatedFields.bandwidth.upload >= 1024
          ? `${Math.floor(updatedFields.bandwidth.upload / 1024)}M`
          : `${updatedFields.bandwidth.upload}k`;
      const downloadMbps =
        updatedFields.bandwidth.download >= 1024
          ? `${Math.floor(updatedFields.bandwidth.download / 1024)}M`
          : `${updatedFields.bandwidth.download}k`;
      updatedFields.rateLimit = `${uploadMbps}/${downloadMbps}`;
    }

    // Merge with existing package
    const mergedPackage = {
      ...existingPackage,
      ...updatedFields,
    };

    // Try to sync updated package to MikroTik if router is online and we have router connection info.
    let mikrotikSyncResult = null;
    if (router.health?.status === 'online') {
      try {
        const routerConfig = getRouterConnectionConfig(router, {
          forceLocal: false,
          forceVPN: true,
        });

        // If the package already exists on the router (has mikrotikId), update it.
        if (existingPackage.mikrotikId) {
          const mikrotikProfile = {
            'address-pool': mergedPackage.addressPool,
            'session-timeout': mergedPackage.sessionTimeout,
            'idle-timeout': mergedPackage.idleTimeout,
            'keepalive-timeout': mergedPackage.keepaliveTimeout,
            'status-autorefresh': mergedPackage.statusAutorefresh,
            'shared-users': mergedPackage.sharedUsers,
            'rate-limit': mergedPackage.rateLimit,
            'transparent-proxy': mergedPackage.transparentProxy,
          };

          const result = await MikroTikService.updateHotspotUserProfileById(
            routerConfig,
            existingPackage.mikrotikId,
            mikrotikProfile
          );

          mergedPackage.syncStatus = 'synced';
          mergedPackage.lastSynced = new Date();
          mergedPackage.syncError = null;
          mikrotikSyncResult = { success: true, mikrotikId: existingPackage.mikrotikId };
        } else {
          // If package not yet on the router, create it and record mikrotikId
          const mikrotikProfile = {
            name: mergedPackage.name,
            'address-pool': mergedPackage.addressPool,
            'session-timeout': mergedPackage.sessionTimeout,
            'idle-timeout': mergedPackage.idleTimeout,
            'keepalive-timeout': mergedPackage.keepaliveTimeout,
            'status-autorefresh': mergedPackage.statusAutorefresh,
            'shared-users': mergedPackage.sharedUsers,
            'rate-limit': mergedPackage.rateLimit,
            'transparent-proxy': mergedPackage.transparentProxy,
          };

          const result = await MikroTikService.createHotspotUserProfile(routerConfig, mikrotikProfile);
          mergedPackage.mikrotikId = result?.['.id'] || null;
          mergedPackage.syncStatus = 'synced';
          mergedPackage.lastSynced = new Date();
          mergedPackage.syncError = null;
          mikrotikSyncResult = { success: true, mikrotikId: mergedPackage.mikrotikId };
        }
      } catch (mikrotikError) {
        console.error('Failed to sync updated package to MikroTik:', mikrotikError);
        mergedPackage.syncStatus = 'failed';
        mergedPackage.syncError = mikrotikError instanceof Error ? mikrotikError.message : String(mikrotikError);
        mikrotikSyncResult = { success: false, error: mergedPackage.syncError };
      }
    }

    // Update package in MongoDB using array filter
    const updateResult = await db.collection('routers').updateOne(
      {
        _id: new ObjectId(routerId),
        'packages.hotspot.name': decodedPackageName,
      },
      {
        $set: {
          'packages.hotspot.$': mergedPackage,
          'packages.lastSynced': new Date(),
          updatedAt: new Date(),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: 'Failed to update package' }, { status: 500 });
    }

    // Log audit trail
    await db.collection('audit_logs').insertOne({
      user: {
        userId: new ObjectId(userId),
        email: session.user.email || '',
        role: session.user.role || 'homeowner',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
      action: {
        type: 'update',
        resource: 'package',
        resourceId: new ObjectId(routerId),
        description: `Updated package "${mergedPackage.displayName}" (${decodedPackageName})`,
      },
      changes: {
        before: existingPackage,
        after: mergedPackage,
        fields: Object.keys(updatedFields),
      },
      metadata: {
        source: 'web',
        severity: 'info',
      },
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      package: {
        ...mergedPackage,
        createdAt: mergedPackage.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: mergedPackage.updatedAt?.toISOString() || new Date().toISOString(),
        lastSynced: mergedPackage.lastSynced?.toISOString() || null,
      },
      message: 'Package updated successfully. Changes will be synced to router on next sync.',
    });
  } catch (error) {
    console.error('Error updating package:', error);
    return NextResponse.json(
      {
        error: 'Failed to update package',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}// DELETE /api/routers/[id]/packages/[packageName] - Delete package
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: routerId, packageName } = await context.params;
    const userId = session.user.id;

    // Decode package name
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

    // Find existing package
    const existingPackage = router.packages?.hotspot?.find(
      (pkg: any) => pkg.name === decodedPackageName
    );

    if (!existingPackage) {
      return NextResponse.json(
        { error: `Package with name "${decodedPackageName}" not found` },
        { status: 404 }
      );
    }

    // Check if package has active vouchers
    const activeVouchers = await db
      .collection('vouchers')
      .countDocuments({
        routerId: new ObjectId(routerId),
        'voucherInfo.packageType': decodedPackageName,
        status: { $in: ['active', 'unused'] },
      });

    if (activeVouchers > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete package "${decodedPackageName}" because it has ${activeVouchers} active voucher(s)`,
          activeVouchers,
        },
        { status: 400 }
      );
    }

    // Remove package from MongoDB
    const updateResult = await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $pull: { 'packages.hotspot': { name: decodedPackageName } },
        $set: {
          'packages.lastSynced': new Date(),
          updatedAt: new Date(),
        },
      } as any
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: 'Failed to delete package' }, { status: 500 });
    }

    // Log audit trail
    await db.collection('audit_logs').insertOne({
      user: {
        userId: new ObjectId(userId),
        email: session.user.email || '',
        role: session.user.role || 'homeowner',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
      action: {
        type: 'delete',
        resource: 'package',
        resourceId: new ObjectId(routerId),
        description: `Deleted package "${existingPackage.displayName}" (${decodedPackageName})`,
      },
      changes: {
        before: existingPackage,
        after: null,
        fields: ['packages'],
      },
      metadata: {
        source: 'web',
        severity: 'warning',
      },
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: `Package "${decodedPackageName}" deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting package:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete package',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}