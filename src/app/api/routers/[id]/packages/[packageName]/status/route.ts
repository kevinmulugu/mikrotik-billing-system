// src/app/api/routers/[id]/packages/[packageName]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface RouteContext {
  params: Promise<{
    id: string;
    packageName: string;
  }>;
}

// PATCH /api/routers/[id]/packages/[packageName]/status - Enable or disable package
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: routerId, packageName } = await context.params;
    const userId = session.user.id;
    const body = await request.json();

    const decodedPackageName = decodeURIComponent(packageName);

    // Validate disabled field
    if (typeof body.disabled !== 'boolean') {
      return NextResponse.json(
        { error: 'disabled field must be a boolean' },
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

    // If enabling (disabled=false), check for active users first
    if (body.disabled && packageData.activeUsers > 0) {
      return NextResponse.json(
        {
          error: 'Cannot disable package with active users',
          activeUsers: packageData.activeUsers,
        },
        { status: 400 }
      );
    }

    // Update package status in database
    const updateResult = await db.collection('routers').updateOne(
      {
        _id: new ObjectId(routerId),
        userId: new ObjectId(userId),
      },
      {
        $set: {
          [`packages.hotspot.${packageIndex}.disabled`]: body.disabled,
          [`packages.hotspot.${packageIndex}.updatedAt`]: new Date(),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to update package status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: body.disabled
        ? 'Package disabled successfully. No new vouchers can be purchased.'
        : 'Package enabled successfully. New vouchers can now be purchased.',
    });
  } catch (error) {
    console.error('Error updating package status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/routers/[id]/packages/[packageName]/status - Get package status
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
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
    const packageData = router.packages?.hotspot?.find(
      (pkg: any) => pkg.name === decodedPackageName
    );

    if (!packageData) {
      return NextResponse.json(
        { error: `Package "${decodedPackageName}" not found` },
        { status: 404 }
      );
    }

    const activeUsers = packageData.activeUsers || 0;

    return NextResponse.json({
      success: true,
      disabled: packageData.disabled || false,
      activeUsers,
      canDisable: !packageData.disabled && activeUsers === 0,
      canEnable: !!packageData.disabled,
    });
  } catch (error) {
    console.error('Error fetching package status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}