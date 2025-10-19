// src/app/api/routers/[id]/packages/[packageName]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface RouteContext {
  params: {
    id: string;
    packageName: string;
  };
}

// GET /api/routers/[id]/packages/[packageName] - Get specific package details
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

    // Fetch package from backend API
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8080';
    const response = await fetch(
      `${backendUrl}/api/routers/${routerId}/packages/${encodeURIComponent(packageName)}`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || 'Failed to fetch package' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      package: data.package,
    });
  } catch (error) {
    console.error('Error fetching package:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/routers/[id]/packages/[packageName] - Update package
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

    // Validate that name is not being changed
    if (body.name && body.name !== packageName) {
      return NextResponse.json(
        { error: 'Package name cannot be changed' },
        { status: 400 }
      );
    }

    // Validate price if provided
    if (body.price !== undefined) {
      if (body.price <= 0) {
        return NextResponse.json(
          { error: 'Price must be greater than 0' },
          { status: 400 }
        );
      }
      if (body.price > 100000) {
        return NextResponse.json(
          { error: 'Price cannot exceed KSh 100,000' },
          { status: 400 }
        );
      }
    }

    // Validate duration if provided
    if (body.duration !== undefined) {
      if (body.duration <= 0) {
        return NextResponse.json(
          { error: 'Duration must be greater than 0' },
          { status: 400 }
        );
      }
      if (body.duration > 525600) { // 1 year in minutes
        return NextResponse.json(
          { error: 'Duration cannot exceed 1 year' },
          { status: 400 }
        );
      }
    }

    // Validate data limit if provided
    if (body.dataLimit !== undefined && body.dataLimit < 0) {
      return NextResponse.json(
        { error: 'Data limit cannot be negative' },
        { status: 400 }
      );
    }

    // Validate bandwidth if provided
    if (body.bandwidth) {
      if (body.bandwidth.upload !== undefined && body.bandwidth.upload <= 0) {
        return NextResponse.json(
          { error: 'Upload speed must be greater than 0' },
          { status: 400 }
        );
      }
      if (body.bandwidth.download !== undefined && body.bandwidth.download <= 0) {
        return NextResponse.json(
          { error: 'Download speed must be greater than 0' },
          { status: 400 }
        );
      }
    }

    // Validate validity if provided
    if (body.validity !== undefined) {
      if (body.validity <= 0) {
        return NextResponse.json(
          { error: 'Validity must be greater than 0' },
          { status: 400 }
        );
      }
      if (body.validity > 365) {
        return NextResponse.json(
          { error: 'Validity cannot exceed 365 days' },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {};
    
    if (body.displayName !== undefined) updateData.displayName = body.displayName.trim();
    if (body.description !== undefined) updateData.description = body.description.trim();
    if (body.price !== undefined) updateData.price = parseFloat(body.price);
    if (body.duration !== undefined) updateData.duration = parseInt(body.duration);
    if (body.dataLimit !== undefined) updateData.dataLimit = parseInt(body.dataLimit);
    if (body.validity !== undefined) updateData.validity = parseInt(body.validity);
    
    if (body.bandwidth) {
      updateData.bandwidth = {};
      if (body.bandwidth.upload !== undefined) {
        updateData.bandwidth.upload = parseInt(body.bandwidth.upload);
      }
      if (body.bandwidth.download !== undefined) {
        updateData.bandwidth.download = parseInt(body.bandwidth.download);
      }
    }

    // Update package via backend API
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8080';
    const response = await fetch(
      `${backendUrl}/api/routers/${routerId}/packages/${encodeURIComponent(packageName)}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || 'Failed to update package' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Check if router sync is required
    const routerSyncRequired = !!(
      body.duration !== undefined ||
      body.dataLimit !== undefined ||
      body.bandwidth !== undefined
    );

    return NextResponse.json({
      success: true,
      package: data.package,
      syncRequired: routerSyncRequired,
      message: routerSyncRequired
        ? 'Package updated. Sync to router required for changes to take effect.'
        : 'Package updated successfully.',
    });
  } catch (error) {
    console.error('Error updating package:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/routers/[id]/packages/[packageName] - Delete package (optional - might want to disable instead)
export async function DELETE(
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

    // Check if package has active users or historical data
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8080';
    const checkResponse = await fetch(
      `${backendUrl}/api/routers/${routerId}/packages/${encodeURIComponent(packageName)}/check-usage`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      }
    );

    if (checkResponse.ok) {
      const usageData = await checkResponse.json();
      
      if (usageData.hasActiveUsers) {
        return NextResponse.json(
          { 
            error: 'Cannot delete package with active users. Disable it instead.',
            activeUsers: usageData.activeUsers,
          },
          { status: 400 }
        );
      }

      if (usageData.hasHistoricalData) {
        return NextResponse.json(
          { 
            error: 'Cannot delete package with historical data. Disable it instead.',
            voucherCount: usageData.voucherCount,
          },
          { status: 400 }
        );
      }
    }

    // Delete package via backend API
    const response = await fetch(
      `${backendUrl}/api/routers/${routerId}/packages/${encodeURIComponent(packageName)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || 'Failed to delete package' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Package deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting package:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}