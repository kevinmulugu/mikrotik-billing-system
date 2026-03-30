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

  const [routers, total, byType, online] = await Promise.all([
    db.collection('routers').aggregate([
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * PAGE_SIZE },
      { $limit: PAGE_SIZE },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'owner',
          pipeline: [{ $project: { email: 1, name: 1 } }],
        },
      },
    ]).toArray(),
    db.collection('routers').countDocuments(),
    db.collection('routers').aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]).toArray(),
    db.collection('routers').countDocuments({ status: 'online' }),
  ]);

  const typeCounts = Object.fromEntries(byType.map((r) => [r._id, r.count]));

  return NextResponse.json({
    routers: routers.map((r) => ({ ...r, _id: r._id.toString() })),
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
    stats: {
      total,
      online,
      offline: total - online,
      mikrotik: typeCounts['mikrotik'] ?? 0,
      unifi: typeCounts['unifi'] ?? 0,
    },
  });
}
