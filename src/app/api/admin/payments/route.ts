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
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [payments, total, totalAgg, todayAgg, monthAgg] = await Promise.all([
    db.collection('payments').aggregate([
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * PAGE_SIZE },
      { $limit: PAGE_SIZE },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { email: 1, name: 1 } }],
        },
      },
    ]).toArray(),

    db.collection('payments').countDocuments(),

    db.collection('payments').aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$transaction.amount' } } },
    ]).toArray(),

    db.collection('payments').aggregate([
      { $match: { status: 'completed', createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: '$transaction.amount' } } },
    ]).toArray(),

    db.collection('payments').aggregate([
      { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$transaction.amount' } } },
    ]).toArray(),
  ]);

  return NextResponse.json({
    payments: payments.map((p) => ({ ...p, _id: p._id.toString() })),
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
    stats: {
      totalRevenue: totalAgg[0]?.total ?? 0,
      todayRevenue: todayAgg[0]?.total ?? 0,
      monthRevenue: monthAgg[0]?.total ?? 0,
    },
  });
}
