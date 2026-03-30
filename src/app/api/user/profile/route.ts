import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

async function getDb() {
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');
}

const PatchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  image: z.string().url().nullable().optional(),
  businessInfo: z
    .object({
      name: z.string().max(200).optional(),
      contact: z
        .object({
          phone: z.string().max(20).optional(),
          email: z.string().email().optional(),
        })
        .optional(),
      address: z
        .object({
          street: z.string().max(200).optional(),
          city: z.string().max(100).optional(),
          county: z.string().max(100).optional(),
          country: z.string().max(100).optional(),
          postalCode: z.string().max(20).optional(),
        })
        .optional(),
    })
    .optional(),
});

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const userId = new ObjectId(session.user.id);

    const [user, accounts] = await Promise.all([
      db.collection('users').findOne(
        { _id: userId },
        {
          projection: {
            name: 1,
            email: 1,
            image: 1,
            role: 1,
            status: 1,
            businessInfo: 1,
            createdAt: 1,
          },
        },
      ),
      db
        .collection('accounts')
        .find({ userId }, { projection: { provider: 1, providerAccountId: 1 } })
        .toArray(),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: user._id.toString(),
      name: user.name || '',
      email: user.email || '',
      image: user.image || null,
      role: user.role || 'homeowner',
      status: user.status || 'active',
      businessInfo: user.businessInfo || {
        name: '',
        contact: { email: user.email, phone: '' },
        address: { street: '', city: '', county: '', country: 'Kenya', postalCode: '' },
      },
      createdAt: user.createdAt || null,
      connectedProviders: accounts.map((a) => a.provider as string),
    });
  } catch (error) {
    console.error('[Profile GET] error:', error);
    return NextResponse.json({ error: 'Failed to get user profile' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const ip =
    (request.headers.get('x-forwarded-for')?.split(',')[0] ?? '').trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const ua = request.headers.get('user-agent') ?? 'unknown';
  const now = new Date();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }

    const db = await getDb();
    const userId = new ObjectId(session.user.id);
    const { name, image, businessInfo } = parsed.data;

    // Build update and track which logical fields changed for the audit log
    const set: Record<string, unknown> = { updatedAt: now };
    const changedFields: string[] = [];

    if (name !== undefined) { set.name = name; changedFields.push('name'); }
    if (image !== undefined) { set.image = image; changedFields.push('image'); }
    if (businessInfo?.name !== undefined) { set['businessInfo.name'] = businessInfo.name; changedFields.push('businessInfo.name'); }
    if (businessInfo?.contact?.phone !== undefined) { set['businessInfo.contact.phone'] = businessInfo.contact.phone; changedFields.push('businessInfo.contact.phone'); }
    if (businessInfo?.contact?.email !== undefined) { set['businessInfo.contact.email'] = businessInfo.contact.email; changedFields.push('businessInfo.contact.email'); }
    if (businessInfo?.address) {
      const addr = businessInfo.address;
      if (addr.street !== undefined) { set['businessInfo.address.street'] = addr.street; changedFields.push('businessInfo.address.street'); }
      if (addr.city !== undefined) { set['businessInfo.address.city'] = addr.city; changedFields.push('businessInfo.address.city'); }
      if (addr.county !== undefined) { set['businessInfo.address.county'] = addr.county; changedFields.push('businessInfo.address.county'); }
      if (addr.country !== undefined) { set['businessInfo.address.country'] = addr.country; changedFields.push('businessInfo.address.country'); }
      if (addr.postalCode !== undefined) { set['businessInfo.address.postalCode'] = addr.postalCode; changedFields.push('businessInfo.address.postalCode'); }
    }

    const result = await db.collection('users').updateOne({ _id: userId }, { $set: set });
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Audit log — fire-and-forget, never block the response
    db.collection('audit_logs').insertOne({
      userId,
      source: 'user',
      action: {
        type: 'profile_updated',
        category: 'account',
        status: 'success',
        details: {
          changedFields,
          // Log new values for non-sensitive fields; never log passwords or API keys
          newValues: {
            ...(name !== undefined && { name }),
            ...(businessInfo?.name !== undefined && { businessName: businessInfo.name }),
            ...(businessInfo?.contact?.phone !== undefined && { phone: businessInfo.contact.phone }),
            ...(businessInfo?.address?.city !== undefined && { city: businessInfo.address.city }),
            ...(businessInfo?.address?.county !== undefined && { county: businessInfo.address.county }),
            // image logged as boolean only — base64 URLs are too large
            ...(image !== undefined && { imageUpdated: image !== null }),
          },
        },
      },
      metadata: {
        ipAddress: ip,
        userAgent: ua,
        email: session.user.email,
      },
      timestamp: now,
      createdAt: now,
    }).catch((err) => console.error('[Audit] Failed to write profile audit log:', err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Profile PATCH] error:', error);

    // Audit failed attempt
    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        const db = await getDb();
        await db.collection('audit_logs').insertOne({
          userId: new ObjectId(session.user.id),
          source: 'user',
          action: {
            type: 'profile_updated',
            category: 'account',
            status: 'failed',
            details: { error: error instanceof Error ? error.message : 'unknown' },
          },
          metadata: { ipAddress: ip, userAgent: ua, email: session.user.email },
          timestamp: now,
          createdAt: now,
        });
      }
    } catch (_) { /* best-effort */ }

    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
