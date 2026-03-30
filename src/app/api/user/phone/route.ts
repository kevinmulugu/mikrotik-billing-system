// API routes for managing the user's OTP-auth phone number.
// GET  — returns masked phone + whether OTP auth is set up
// POST — request a verification OTP to a new phone number
// PATCH — verify OTP and save the new phone number to users.phone
// DELETE — remove the OTP phone (disables SMS sign-in)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { randomInt, randomUUID, createHmac } from 'crypto';
import { MessagingService } from '@/lib/services/messaging';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_SENDS_PER_PHONE_PER_10MIN = 3;
// Reuse the same hash function as the login OTP route
function hashOtp(requestId: string, otp: string): string {
  return createHmac('sha256', process.env.NEXTAUTH_SECRET!)
    .update(`${requestId}:${otp}`)
    .digest('hex');
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+254${digits.slice(1)}`;
  if (digits.length === 9) return `+254${digits}`;
  return null;
}

function maskPhone(phone: string): string {
  // +254712345678 → +254***5678
  if (phone.length < 6) return '***';
  return phone.slice(0, 4) + '***' + phone.slice(-4);
}

async function getDb() {
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');
}

// GET — return current OTP phone status
export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(session.user.id) },
    { projection: { phone: 1 } },
  );

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({
    hasOtpPhone: !!user.phone,
    maskedPhone: user.phone ? maskPhone(user.phone) : null,
  });
}

// POST — request a verification OTP to a new phone number
export async function POST(request: NextRequest) {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip =
    (request.headers.get('x-forwarded-for')?.split(',')[0] ?? '').trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const body = await request.json().catch(() => ({}));
  const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date();

  // Check this phone isn't already used by another account
  const existing = await db.collection('users').findOne(
    { phone, _id: { $ne: new ObjectId(session.user.id) } },
    { projection: { _id: 1 } },
  );
  if (existing) {
    return NextResponse.json(
      { error: 'This phone number is linked to another account.' },
      { status: 409 },
    );
  }

  // Rate limit: max 3 per phone per 10 min
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const recentByPhone = await db.collection('otp_tokens').countDocuments({
    phone,
    purpose: 'phone_verify',
    createdAt: { $gte: tenMinutesAgo },
  });
  if (recentByPhone >= MAX_SENDS_PER_PHONE_PER_10MIN) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before requesting another code.' },
      { status: 429 },
    );
  }

  const requestId = randomUUID();
  const otp = randomInt(100000, 999999).toString();
  const otpHash = hashOtp(requestId, otp);
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

  await db.collection('otp_tokens').insertOne({
    requestId,
    phone,
    otpHash,
    purpose: 'phone_verify',
    userId: new ObjectId(session.user.id),
    userExists: true,
    expiresAt,
    attemptCount: 0,
    used: false,
    ipAddress: ip,
    createdAt: now,
  });

  const message = `Your PAY N BROWSE verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`;
  await MessagingService.sendSingleSMS(phone, message).catch((err) =>
    console.error('[Phone verify OTP] SMS send failed:', err),
  );

  return NextResponse.json({ requestId });
}

// PATCH — verify OTP code and save phone to user record
export async function PATCH(request: NextRequest) {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { requestId, otp } = body;

  if (typeof requestId !== 'string' || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date();

  const token = await db.collection('otp_tokens').findOne({
    requestId,
    purpose: 'phone_verify',
    userId: new ObjectId(session.user.id),
  });

  if (!token) return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
  if (token.used) return NextResponse.json({ error: 'Code already used' }, { status: 400 });
  if (token.expiresAt < now) return NextResponse.json({ error: 'Code expired' }, { status: 400 });
  if (token.attemptCount >= 5) {
    return NextResponse.json({ error: 'Too many failed attempts' }, { status: 400 });
  }

  const expectedHash = hashOtp(requestId, otp);
  if (expectedHash !== token.otpHash) {
    await db.collection('otp_tokens').updateOne(
      { requestId },
      { $inc: { attemptCount: 1 } },
    );
    const remaining = 4 - token.attemptCount;
    return NextResponse.json(
      { error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` },
      { status: 400 },
    );
  }

  // Valid — mark used and save phone
  await Promise.all([
    db.collection('otp_tokens').updateOne({ requestId }, { $set: { used: true, usedAt: now } }),
    db.collection('users').updateOne(
      { _id: new ObjectId(session.user.id) },
      { $set: { phone: token.phone, updatedAt: now } },
    ),
  ]);

  // Audit log
  db.collection('audit_logs').insertOne({
    userId: new ObjectId(session.user.id),
    source: 'user',
    action: {
      type: 'phone_verified',
      category: 'account',
      status: 'success',
      details: { maskedPhone: maskPhone(token.phone) },
    },
    metadata: { email: session.user.email },
    timestamp: now,
    createdAt: now,
  }).catch((err) => console.error('[Audit] Phone verify:', err));

  return NextResponse.json({ success: true });
}

// DELETE — remove OTP phone (disables SMS sign-in)
export async function DELETE(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const now = new Date();

  await db.collection('users').updateOne(
    { _id: new ObjectId(session.user.id) },
    { $unset: { phone: '' }, $set: { updatedAt: now } },
  );

  db.collection('audit_logs').insertOne({
    userId: new ObjectId(session.user.id),
    source: 'user',
    action: { type: 'phone_removed', category: 'account', status: 'success', details: {} },
    metadata: { email: session.user.email },
    timestamp: now,
    createdAt: now,
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
