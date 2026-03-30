import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'system_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const source = searchParams.get('source') || '';

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const filter: Record<string, unknown> = {};
  if (source) filter.source = source;

  const [logs, total, successCount, failedToday] = await Promise.all([
    db.collection('webhook_logs')
      .find(filter)
      .sort({ timestamp: -1, createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .toArray(),
    db.collection('webhook_logs').countDocuments(filter),
    db.collection('webhook_logs').countDocuments({ status: 'success' }),
    db.collection('webhook_logs').countDocuments({
      status: { $in: ['failed', 'error'] },
      timestamp: { $gte: startOfToday },
    }),
  ]);

  return NextResponse.json({
    logs: logs.map((l) => ({ ...l, _id: l._id.toString() })),
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
    stats: {
      total: await db.collection('webhook_logs').countDocuments(),
      success: successCount,
      failedToday,
    },
  });
}
