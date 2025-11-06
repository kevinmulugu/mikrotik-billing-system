// src/app/api/messages/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const routerId = searchParams.get('routerId');
    const status = searchParams.get('status');

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Build query
    const query: any = {
      userId: new ObjectId(session.user.id),
    };

    if (routerId && routerId !== 'all') {
      query.routerId = new ObjectId(routerId);
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    // Get total count
    const totalMessages = await db.collection('messages').countDocuments(query);

    // Get paginated messages
    const messages = await db
      .collection('messages')
      .find(query)
      .sort({ sentAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Get router names for messages
    const routerIds = messages
      .map((m) => m.routerId)
      .filter((id): id is ObjectId => id !== null && id !== undefined);

    const routers = await db
      .collection('routers')
      .find({ _id: { $in: routerIds } })
      .project({ _id: 1, routerInfo: 1 })
      .toArray();

    const routerMap = new Map(
      routers.map((r) => [r._id.toString(), r.routerInfo?.name || 'Unknown Router'])
    );

    // Format response
    const formattedMessages = messages.map((m) => ({
      id: m._id.toString(),
      recipientType: m.recipientType,
      routerId: m.routerId?.toString(),
      routerName:
        m.recipientType === 'router' && m.routerId
          ? routerMap.get(m.routerId.toString())
          : null,
      message: m.message,
      recipientCount: m.recipientCount,
      successfulDeliveries: m.successfulDeliveries || m.recipientCount,
      failedDeliveries: m.failedDeliveries || 0,
      status: m.status,
      sentAt: m.sentAt,
      createdAt: m.createdAt,
    }));

    return NextResponse.json({
      success: true,
      messages: formattedMessages,
      pagination: {
        page,
        limit,
        totalMessages,
        totalPages: Math.ceil(totalMessages / limit),
        hasMore: page * limit < totalMessages,
      },
    });
  } catch (error) {
    console.error('[Messages History] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch message history' },
      { status: 500 }
    );
  }
}
