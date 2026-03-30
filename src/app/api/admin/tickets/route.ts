import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'system_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const status = searchParams.get('status') || '';

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const [tickets, total, byStatus] = await Promise.all([
    db.collection('tickets').aggregate([
      { $match: filter },
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
    db.collection('tickets').countDocuments(filter),
    db.collection('tickets').aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).toArray(),
  ]);

  const statusCounts = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));

  return NextResponse.json({
    tickets: tickets.map((t) => ({ ...t, _id: t._id.toString() })),
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
    stats: statusCounts,
  });
}

const PatchSchema = z.object({
  ticketId: z.string(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'system_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation error' }, { status: 400 });
  }

  if (!ObjectId.isValid(parsed.data.ticketId)) {
    return NextResponse.json({ error: 'Invalid ticket ID' }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

  const result = await db.collection('tickets').updateOne(
    { _id: new ObjectId(parsed.data.ticketId) },
    { $set: { status: parsed.data.status, updatedAt: new Date() } },
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
