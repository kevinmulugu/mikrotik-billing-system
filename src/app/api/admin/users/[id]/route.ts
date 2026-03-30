import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };

// Strict allowlist — never accept role or status from a non-admin source
const PatchSchema = z.object({
  status: z.enum(['active', 'suspended']).optional(),
  role: z.enum(['homeowner', 'isp', 'isp_pro', 'system_admin']).optional(),
}).refine((d) => d.status !== undefined || d.role !== undefined, {
  message: 'Provide status or role',
});

export async function GET(
  _req: NextRequest,
  { params }: RouteContext,
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'system_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');
  const oid = new ObjectId(id);

  const [user, routers, recentTickets, recentPayments] = await Promise.all([
    db.collection('users').findOne(
      { _id: oid },
      {
        projection: {
          name: 1, email: 1, role: 1, status: 1, createdAt: 1,
          'subscription.plan': 1, 'businessInfo.businessName': 1,
          'smsCredits.balance': 1,
          // never return passwordHash or credentials
        },
      },
    ),
    db.collection('routers')
      .find({ userId: oid }, { projection: { 'routerInfo.name': 1, type: 1, 'health.status': 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
    db.collection('tickets')
      .find({ userId: oid }, { projection: { 'ticket.title': 1, 'ticket.priority': 1, status: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
    db.collection('payments')
      .find({ userId: oid }, { projection: { 'transaction.amount': 1, status: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
  ]);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    user: { ...user, _id: user._id.toString() },
    routers: routers.map((r) => ({ ...r, _id: r._id.toString() })),
    recentTickets: recentTickets.map((t) => ({ ...t, _id: t._id.toString() })),
    recentPayments: recentPayments.map((p) => ({ ...p, _id: p._id.toString() })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext,
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'system_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  // Prevent admin from changing their own role or status
  if (id === session.user.id) {
    return NextResponse.json({ error: 'Cannot modify your own account' }, { status: 400 });
  }

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation error' },
      { status: 400 },
    );
  }

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');
  const oid = new ObjectId(id);

  // Prevent demoting the last system_admin
  if (parsed.data.role && parsed.data.role !== 'system_admin') {
    const target = await db.collection('users').findOne({ _id: oid }, { projection: { role: 1 } });
    if (target?.role === 'system_admin') {
      const adminCount = await db.collection('users').countDocuments({ role: 'system_admin' });
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last system admin' }, { status: 400 });
      }
    }
  }

  // Build explicit update — no mass assignment
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.role !== undefined) update.role = parsed.data.role;

  const result = await db.collection('users').updateOne(
    { _id: oid },
    { $set: update },
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // When suspending: invalidate all active sessions so the user is kicked immediately
  if (parsed.data.status === 'suspended') {
    await db.collection('sessions').deleteMany({ userId: oid });
  }

  return NextResponse.json({ success: true });
}
