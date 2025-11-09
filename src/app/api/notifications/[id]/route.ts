// src/app/api/notifications/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NotificationService } from '@/lib/services/notification';

/**
 * PATCH /api/notifications/[id]
 * 
 * Mark a single notification as read
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const result = await NotificationService.markAsRead(
      params.id,
      session.user.id
    );
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to mark notification as read' },
        { status: result.error?.includes('not found') ? 404 : 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('[API] Failed to mark notification as read:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/[id]
 * 
 * Delete a notification
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const result = await NotificationService.deleteNotification(
      params.id,
      session.user.id
    );
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete notification' },
        { status: result.error?.includes('not found') ? 404 : 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    console.error('[API] Failed to delete notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
