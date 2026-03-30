import { NextRequest, NextResponse } from 'next/server';
import { randomInt, randomUUID, createHmac } from 'crypto';
import clientPromise from '@/lib/mongodb';
import { MessagingService } from '@/lib/services/messaging';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_SENDS_PER_PHONE_PER_HOUR = 3;
const MAX_SENDS_PER_IP_PER_HOUR = 10;

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+254${digits.slice(1)}`;
  if (digits.length === 9) return `+254${digits}`;
  return null;
}

function hashOtp(requestId: string, otp: string): string {
  return createHmac('sha256', process.env.NEXTAUTH_SECRET!)
    .update(`${requestId}:${otp}`)
    .digest('hex');
}

export async function POST(request: NextRequest) {
  // CSRF: only accept JSON (rejects form-based CSRF attacks)
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const ip =
    (request.headers.get('x-forwarded-for')?.split(',')[0] ?? '').trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    const body = await request.json();
    const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');
    const otpTokens = db.collection('otp_tokens');
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Rate limit: max 3 per phone per hour
    const recentByPhone = await otpTokens.countDocuments({
      phone,
      createdAt: { $gte: oneHourAgo },
    });
    if (recentByPhone >= MAX_SENDS_PER_PHONE_PER_HOUR) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again in 1 hour.' },
        { status: 429 },
      );
    }

    // Rate limit: max 10 per IP per hour
    const recentByIp = await otpTokens.countDocuments({
      ipAddress: ip,
      createdAt: { $gte: oneHourAgo },
    });
    if (recentByIp >= MAX_SENDS_PER_IP_PER_HOUR) {
      return NextResponse.json(
        { error: 'Too many requests from this network. Please try again later.' },
        { status: 429 },
      );
    }

    // Look up user by phone — do not reveal whether phone exists
    const user = await db.collection('users').findOne(
      { phone },
      { projection: { _id: 1, status: 1 } },
    );

    const requestId = randomUUID();
    const otp = randomInt(100000, 999999).toString();
    const otpHash = hashOtp(requestId, otp);
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

    // Store OTP token regardless of whether user exists (prevent enumeration)
    await otpTokens.insertOne({
      requestId,
      phone,
      otpHash,
      userExists: !!user && user.status !== 'suspended',
      expiresAt,
      attemptCount: 0,
      used: false,
      ipAddress: ip,
      createdAt: now,
    });

    // Only send SMS if the user exists and is active
    if (user && user.status !== 'suspended') {
      const message = `Your PAY N BROWSE sign-in code is: ${otp}. Valid for 5 minutes. Do not share this code.`;
      await MessagingService.sendSingleSMS(phone, message).catch((err) =>
        console.error('[OTP] SMS send failed:', err),
      );
    }

    // Always return success (don't reveal phone registration status)
    return NextResponse.json({ requestId });
  } catch (error) {
    console.error('[OTP request]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
