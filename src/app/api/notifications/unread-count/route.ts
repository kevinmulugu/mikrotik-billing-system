// src/app/api/notifications/unread-count/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NotificationService } from '@/lib/services/notification';

/**
 * GET /api/notifications/unread-count
 * 
 * Get unread notification count for authenticated user
 * Fast endpoint for header polling
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
    
    const count = await NotificationService.getUnreadCount(session.user.id);
    
    return NextResponse.json({ count });
  } catch (error) {
    console.error('[API] Failed to fetch unread count:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
