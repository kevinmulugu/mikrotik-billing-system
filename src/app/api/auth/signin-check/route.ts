import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// Pre-flight check before calling signIn('email') so the client gets a clear
// HTTP status code rather than having to parse NextAuth's opaque result object.
// The signIn callback in lib/auth.ts is still the real gate — this only gives
// the user a meaningful error message before the magic link is attempted.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    const user = await db.collection('users').findOne(
      { email },
      { projection: { status: 1 } },
    );

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this email. Please sign up first.' },
        { status: 404 },
      );
    }

    if (user.status === 'suspended') {
      return NextResponse.json(
        { error: 'AccountSuspended' },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[signin-check]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
