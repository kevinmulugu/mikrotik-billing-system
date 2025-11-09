// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NotificationService } from '@/lib/services/notification';

/**
 * GET /api/notifications
 * 
 * Get paginated notifications for authenticated user
 * 
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - category: string (optional filter)
 * - unreadOnly: boolean (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const category = searchParams.get('category') || undefined;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    
    const result = await NotificationService.getNotifications(session.user.id, {
      page,
      limit,
      category: category as any,
      unreadOnly,
    });
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch notifications' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      notifications: result.notifications,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error('[API] Failed to fetch notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
