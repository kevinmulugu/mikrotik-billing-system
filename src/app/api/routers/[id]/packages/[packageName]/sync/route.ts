// src/app/api/routers/[id]/packages/[packageName]/sync/route.ts
// TODO: Implement package sync to router functionality
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface RouteContext {
  params: {
    id: string;
    packageName: string;
  };
}

// POST /api/routers/[id]/packages/[packageName]/sync - Sync package to router
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: routerId, packageName } = context.params;

    // First, verify router is online
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8080';
    const routerResponse = await fetch(`${backendUrl}/api/routers/${routerId}`, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
      },
    });

    if (!routerResponse.ok) {
      const error = await routerResponse.json();
      return NextResponse.json(
        { error: error.message || 'Failed to fetch router' },
        { status: routerResponse.status }
      );
    }

    const routerData = await routerResponse.json();
    const router = routerData.router;

    // Check if router is online
    if (router.status !== 'online') {
      return NextResponse.json(
        { 
          error: 'Router is offline. Cannot sync package.',
          routerStatus: router.status,
        },
        { status: 400 }
      );
    }

    // Verify user owns this router
    if (router.customerId !== session.user.customerId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Sync package to router via backend API
    const syncResponse = await fetch(
      `${backendUrl}/api/routers/${routerId}/packages/${encodeURIComponent(packageName)}/sync`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!syncResponse.ok) {
      const error = await syncResponse.json();
      return NextResponse.json(
        { 
          error: error.message || 'Failed to sync package to router',
          details: error.details,
        },
        { status: syncResponse.status }
      );
    }

    const syncData = await syncResponse.json();

    return NextResponse.json({
      success: true,
      message: 'Package synced to router successfully',
      syncDetails: {
        syncedAt: syncData.syncedAt || new Date().toISOString(),
        profileCreated: syncData.profileCreated || true,
        syncStatus: 'synced',
      },
    });
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