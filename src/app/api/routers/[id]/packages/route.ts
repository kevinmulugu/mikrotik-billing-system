// src/app/api/routers/[id]/packages/route.ts
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
  }>;
}

// Convert duration in minutes to MikroTik time format
function convertMinutesToMikroTikFormat(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h${remainingMinutes}m` : `${hours}h`;
  } else if (minutes < 10080) {
    const days = Math.floor(minutes / 1440);
    const remainingHours = Math.floor((minutes % 1440) / 60);
    return remainingHours > 0 ? `${days}d${remainingHours}h` : `${days}d`;
  } else {
    const weeks = Math.floor(minutes / 10080);
    const remainingDays = Math.floor((minutes % 10080) / 1440);
    return remainingDays > 0 ? `${weeks}w${remainingDays}d` : `${weeks}w`;
  }
}

// GET /api/routers/[id]/packages - List all packages for a router
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

  const userId = session.user.id;
  const { id: routerId } = await context.params;

    // Validate router ID
    if (!ObjectId.isValid(routerId)) {
      return NextResponse.json(
        { error: 'Invalid router ID' },
        { status: 400 }
      );
    }

    // Connect to database
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get customer
    const customer = await db
      .collection('customers')
      .findOne({ userId: new ObjectId(userId) });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Verify router ownership
    const router = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        customerId: customer._id,
      });

    if (!router) {
      return NextResponse.json(
        { error: 'Router not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      packages: router.packages?.hotspot || [],
    });
  } catch (error) {
    console.error('Error fetching packages:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch packages',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/routers/[id]/packages - Create a new package
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

  const { id: routerId } = await context.params;
    const userId = session.user.id;
  // params are a Promise in Next.js 15; unwrapped above

    // Validate router ID
    if (!ObjectId.isValid(routerId)) {
      return NextResponse.json(
        { error: 'Invalid router ID' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      name,
      displayName,
      description = '',
      price,
      duration, // in minutes
      dataLimit = 0, // 0 = unlimited
      bandwidth,
      validity = 30, // days
      syncToRouter = true,
      // Optional MikroTik-specific overrides
      idleTimeout,
      keepaliveTimeout = '2m',
      statusAutorefresh = '1m',
      sharedUsers = '1',
      transparentProxy = 'yes',
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Package name is required' },
        { status: 400 }
      );
    }

    if (!displayName) {
      return NextResponse.json(
        { error: 'Display name is required' },
        { status: 400 }
      );
    }

    if (!price || price <= 0) {
      return NextResponse.json(
        { error: 'Price must be greater than 0' },
        { status: 400 }
      );
    }

    if (!duration || duration <= 0) {
      return NextResponse.json(
        { error: 'Duration must be greater than 0 minutes' },
        { status: 400 }
      );
    }

    if (!bandwidth || !bandwidth.upload || !bandwidth.download) {
      return NextResponse.json(
        { error: 'Bandwidth upload and download speeds are required' },
        { status: 400 }
      );
    }

    // Validate package name format (RouterOS compatible)
    const nameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!nameRegex.test(name)) {
      return NextResponse.json(
        { error: 'Package name can only contain letters, numbers, hyphens, and underscores' },
        { status: 400 }
      );
    }

    // Connect to database
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get customer
    const customer = await db
      .collection('customers')
      .findOne({ userId: new ObjectId(userId) });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const customerId = customer._id;

    // Verify router ownership
    const router = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        customerId: customerId,
      });

    if (!router) {
      return NextResponse.json(
        { error: 'Router not found or access denied' },
        { status: 404 }
      );
    }

    // Check if package name already exists
    const existingPackage = router.packages?.hotspot?.find(
      (pkg: any) => pkg.name === name
    );

    if (existingPackage) {
      return NextResponse.json(
        { error: `Package with name "${name}" already exists` },
        { status: 409 }
      );
    }

    // Convert duration to MikroTik format
    const sessionTimeout = convertMinutesToMikroTikFormat(duration);

    // Calculate idle timeout (default: 10% of session time, min 5m, max 1h)
    const calculatedIdleTimeout = idleTimeout || (() => {
      const idleMinutes = Math.max(5, Math.min(60, Math.floor(duration * 0.1)));
      return convertMinutesToMikroTikFormat(idleMinutes);
    })();

    // Build rate limit string (MikroTik format: upload/download in M or k)
    const uploadMbps = bandwidth.upload >= 1024 
      ? `${Math.floor(bandwidth.upload / 1024)}M` 
      : `${bandwidth.upload}k`;
    const downloadMbps = bandwidth.download >= 1024 
      ? `${Math.floor(bandwidth.download / 1024)}M` 
      : `${bandwidth.download}k`;
    const rateLimit = `${uploadMbps}/${downloadMbps}`;

    // Build package object for MongoDB
    const packageData = {
      name: name.trim(),
      displayName: displayName.trim(),
      description: description.trim(),
      price: parseFloat(price.toString()),
      duration: parseInt(duration.toString()), // Store in minutes
      dataLimit: parseInt(dataLimit.toString()), // 0 = unlimited
      bandwidth: {
        upload: parseInt(bandwidth.upload.toString()), // in kbps
        download: parseInt(bandwidth.download.toString()), // in kbps
      },
      validity: parseInt(validity.toString()), // days until voucher expires
      // MikroTik-specific fields
      sessionTimeout: sessionTimeout, // MikroTik format (e.g., "3h", "1d")
      idleTimeout: calculatedIdleTimeout, // MikroTik format
      rateLimit: rateLimit, // MikroTik format (e.g., "3M/6M")
      addressPool: 'hotspot-pool', // Standard pool name
      sharedUsers: sharedUsers.toString(),
      transparentProxy: transparentProxy.toString(),
      keepaliveTimeout: keepaliveTimeout,
      statusAutorefresh: statusAutorefresh,
      // Sync status
      syncStatus: 'not_synced' as 'synced' | 'not_synced' | 'pending' | 'failed',
      lastSynced: null as Date | null,
      syncError: null as string | null,
      createdAt: new Date(),
    };

    // If syncToRouter is enabled and router is online, create profile on MikroTik
    let mikrotikSyncResult = null;
    if (syncToRouter && router.health?.status === 'online') {
      try {
        console.log(`Syncing package "${name}" to router...`);

        // const routerConfig = {
        //   ipAddress: router.connection.ipAddress,
        //   port: router.connection.port || 8728,
        //   username: router.connection.apiUser || 'admin',
        //   password: MikroTikService.decryptPassword(router.connection.apiPassword),
        // };
        const routerConfig = getRouterConnectionConfig(router, {
          forceLocal: false, // Use local IP for hotspot provisioning
          forceVPN: true, // Use VPN IP if available
        });

        console.log('Router config:', { ...routerConfig, password: '****' });

        // Create hotspot user profile on MikroTik
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

        console.log('Creating MikroTik profile:', mikrotikProfile);

        const result = await MikroTikService.createHotspotUserProfile(
          routerConfig,
          mikrotikProfile
        );

        console.log('MikroTik profile created successfully:', result);

        // Update sync status
        packageData.syncStatus = 'synced';
        packageData.lastSynced = new Date();
        mikrotikSyncResult = {
          success: true,
          // mikrotikId: result?.data?.['.id'] || null,
          mikrotikId: result?.['.id'] || null,
          message: 'Package synced to router successfully',
        };
      } catch (mikrotikError) {
        console.error('Failed to sync package to MikroTik:', mikrotikError);
        packageData.syncStatus = 'failed';
        packageData.syncError = mikrotikError instanceof Error 
          ? mikrotikError.message 
          : 'Unknown error';
        mikrotikSyncResult = {
          success: false,
          error: packageData.syncError,
          message: 'Package created in database but failed to sync to router',
        };
      }
    }

    // Update router document in MongoDB - add package to array
      const updateResult = await db.collection('routers').updateOne(
        { _id: new ObjectId(routerId) },
        {
          $push: { 'packages.hotspot': packageData },
          $set: {
            'packages.lastSynced': new Date(),
            updatedAt: new Date(),
          },
        } as any
      );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to update router' },
        { status: 500 }
      );
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
        type: 'create',
        resource: 'package',
        resourceId: new ObjectId(routerId),
        description: `Created package "${displayName}" (${name})`,
      },
      changes: {
        before: null,
        after: packageData,
        fields: ['packages'],
      },
      metadata: {
        source: 'web',
        severity: 'info',
        syncedToRouter: syncToRouter,
      },
      timestamp: new Date(),
    });

    // Build response
    const response: any = {
      success: true,
      package: {
        ...packageData,
        // Convert dates to ISO strings for JSON response
        createdAt: packageData.createdAt.toISOString(),
        lastSynced: packageData.lastSynced?.toISOString() || null,
      },
    };

    // Add sync result to response
    if (syncToRouter) {
      response.sync = mikrotikSyncResult || {
        success: false,
        message: 'Router is offline. Package will be synced when router comes online.',
      };
    } else {
      response.message = 'Package created successfully. Remember to sync it to the router manually.';
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating package:', error);
    return NextResponse.json(
      {
        error: 'Failed to create package',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PUT /api/routers/[id]/packages - Update existing package (future implementation)
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  return NextResponse.json(
    { error: 'Package updates not yet implemented' },
    { status: 501 }
  );
}

// DELETE /api/routers/[id]/packages - Delete package (future implementation)
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  return NextResponse.json(
    { error: 'Package deletion not yet implemented' },
    { status: 501 }
  );
}