// src/app/api/routers/[id]/packages/[packageName]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface RouteContext {
  params: {
    id: string;
    packageName: string;
  };
}

// PATCH /api/routers/[id]/packages/[packageName]/status - Enable or disable package
export async function PATCH(
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
    const body = await request.json();

    // Validate enabled field
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled field must be a boolean' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8080';

    // If disabling, check for active users first
    if (!body.enabled) {
      const activeUsersResponse = await fetch(
        `${backendUrl}/api/routers/${routerId}/packages/${encodeURIComponent(packageName)}/active-users`,
        {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
          },
        }
      );

      if (activeUsersResponse.ok) {
        const activeUsersData = await activeUsersResponse.json();
        
        if (activeUsersData.activeUsers > 0) {
          return NextResponse.json(
            { 
              error: 'Cannot disable package with active users',
              activeUsers: activeUsersData.activeUsers,
              userDetails: activeUsersData.users,
            },
            { status: 400 }
          );
        }
      }
    }

    // Update package status via backend API
    const response = await fetch(
      `${backendUrl}/api/routers/${routerId}/packages/${encodeURIComponent(packageName)}/status`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: body.enabled }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || 'Failed to update package status' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      package: data.package,
      message: body.enabled 
        ? 'Package enabled successfully. New vouchers can now be purchased.'
        : 'Package disabled successfully. No new vouchers can be purchased.',
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

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: routerId, packageName } = context.params;

    // Fetch package status from backend API
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8080';
    const response = await fetch(
      `${backendUrl}/api/routers/${routerId}/packages/${encodeURIComponent(packageName)}/status`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || 'Failed to fetch package status' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      enabled: data.enabled,
      activeUsers: data.activeUsers || 0,
      canDisable: data.activeUsers === 0,
    });
  } catch (error) {
    console.error('Error fetching package status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}