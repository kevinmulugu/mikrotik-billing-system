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

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [messages, total, monthSent, failedCount] = await Promise.all([
    db.collection('messages')
      .find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .toArray(),
    db.collection('messages').countDocuments(),
    db.collection('messages').countDocuments({ createdAt: { $gte: startOfMonth } }),
    db.collection('messages').countDocuments({ status: 'failed' }),
  ]);

  return NextResponse.json({
    messages: messages.map((m) => ({ ...m, _id: m._id.toString() })),
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
    stats: { totalSent: total, monthSent, failedCount },
  });
}
