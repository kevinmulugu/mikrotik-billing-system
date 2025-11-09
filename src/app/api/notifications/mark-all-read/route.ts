// src/app/api/notifications/mark-all-read/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NotificationService } from '@/lib/services/notification';

/**
 * PATCH /api/notifications/mark-all-read
 * 
 * Mark all notifications as read for authenticated user
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const result = await NotificationService.markAllAsRead(session.user.id);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to mark notifications as read' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      count: result.count,
      message: `${result.count} notification(s) marked as read`,
    });
  } catch (error) {
    console.error('[API] Failed to mark all as read:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
