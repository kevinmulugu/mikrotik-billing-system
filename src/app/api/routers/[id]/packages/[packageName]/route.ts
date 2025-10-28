// src/app/api/routers/[id]/packages/[packageName]/route.ts
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

    // Get customer
    const customer = await db
      .collection('customers')
      .findOne({ userId: new ObjectId(userId) });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Verify router ownership
    const router = await db.collection('routers').findOne({
      _id: new ObjectId(routerId),
      customerId: customer._id,
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

// PATCH /api/routers/[id]/packages/[packageName] - Update package (delegates to PUT on main route)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: routerId, packageName } = await context.params;
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

    // Call the PUT endpoint on the main packages route
    const baseUrl = request.nextUrl.origin;
    const response = await fetch(`${baseUrl}/api/routers/${routerId}/packages`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        name: decodedPackageName,
        ...body,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error || 'Failed to update package' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data);
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
}// DELETE /api/routers/[id]/packages/[packageName] - Delete package (delegates to DELETE on main route)
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: routerId, packageName } = await context.params;

    // Decode package name
    const decodedPackageName = decodeURIComponent(packageName);

    // Call the DELETE endpoint on the main packages route
    const baseUrl = request.nextUrl.origin;
    const response = await fetch(
      `${baseUrl}/api/routers/${routerId}/packages?name=${encodeURIComponent(decodedPackageName)}`,
      {
        method: 'DELETE',
        headers: {
          'Cookie': request.headers.get('cookie') || '',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error || 'Failed to delete package' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data);
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