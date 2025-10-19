// app/api/routers/[id]/provision/route.ts - API Route Handler

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import clientPromise from '@/lib/mongodb';
import RouterProvisioningService from '@/lib/services/router-provisioning';
import { ObjectId } from 'mongodb';

/**
 * POST /api/routers/[id]/provision
 * Provision a router with complete configuration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

  const { id: routerId } = await params;

    // Validate router ID
    if (!ObjectId.isValid(routerId)) {
      return NextResponse.json(
        { error: 'Invalid router ID' },
        { status: 400 }
      );
    }

    // Connect to database
    const client = await clientPromise;
    const db = client.db();

    // Check if router exists and belongs to user
    const router = await db.collection('routers').findOne({
      _id: new ObjectId(routerId),
      ownerId: new ObjectId(session.user.id),
    });

    if (!router) {
      return NextResponse.json(
        { error: 'Router not found or access denied' },
        { status: 404 }
      );
    }

    // Check if already provisioning
    if (router.status === 'maintenance') {
      return NextResponse.json(
        { 
          error: 'Router is already being provisioned',
          message: 'Please wait for the current provisioning to complete'
        },
        { status: 409 }
      );
    }

    // Start provisioning (async)
    const result = await RouterProvisioningService.provisionRouter(
      routerId,
      db
    );

    // Return result
    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: 'Router provisioned successfully',
          data: {
            routerId: result.routerId,
            completedSteps: result.completedSteps,
            configuredAt: result.configuredAt,
            warnings: result.warnings,
          },
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Router provisioning failed',
          error: result.error,
          data: {
            routerId: result.routerId,
            completedSteps: result.completedSteps,
            failedSteps: result.failedSteps,
            warnings: result.warnings,
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Provisioning API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/routers/[id]/provision
 * Get provisioning status of a router
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

  const { id: routerId } = await params;

    if (!ObjectId.isValid(routerId)) {
      return NextResponse.json(
        { error: 'Invalid router ID' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    const router = await db.collection('routers').findOne(
      {
        _id: new ObjectId(routerId),
        ownerId: new ObjectId(session.user.id),
      },
      {
        projection: {
          name: 1,
          status: 1,
          configurationStatus: 1,
          health: 1,
        },
      }
    );

    if (!router) {
      return NextResponse.json(
        { error: 'Router not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        routerId: router._id,
        name: router.name,
        status: router.status,
        configurationStatus: router.configurationStatus,
        health: router.health,
      },
    });
  } catch (error) {
    console.error('Get provisioning status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/routers/[id]/provision
 * Retry failed provisioning steps
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

  const { id: routerId } = await params;

    if (!ObjectId.isValid(routerId)) {
      return NextResponse.json(
        { error: 'Invalid router ID' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    const router = await db.collection('routers').findOne({
      _id: new ObjectId(routerId),
      ownerId: new ObjectId(session.user.id),
    });

    if (!router) {
      return NextResponse.json(
        { error: 'Router not found' },
        { status: 404 }
      );
    }

    // Check if there are failed steps to retry
    if (
      !router.configurationStatus?.failedSteps ||
      router.configurationStatus.failedSteps.length === 0
    ) {
      return NextResponse.json(
        { 
          error: 'No failed steps to retry',
          message: 'Router is already fully configured'
        },
        { status: 400 }
      );
    }

    // Retry provisioning
    const result = await RouterProvisioningService.retryFailedSteps(
      routerId,
      db
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Router provisioning retry successful',
        data: {
          routerId: result.routerId,
          completedSteps: result.completedSteps,
          configuredAt: result.configuredAt,
        },
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Router provisioning retry failed',
          error: result.error,
          data: {
            routerId: result.routerId,
            completedSteps: result.completedSteps,
            failedSteps: result.failedSteps,
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Retry provisioning error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}