// src/app/api/user/payment-method/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

/**
 * GET /api/user/payment-method
 * Fetch the current user's payment method preference
 * This endpoint provides fresh data from the database to avoid stale session issues
 * 
 * Security:
 * - Requires authentication (Next-Auth session)
 * - Users can only access their own payment method
 * - No sensitive credentials exposed (only method type)
 * - MongoDB projection limits data exposure
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // Security: Require authentication
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await getDatabase();
    
    // Security: Use session user ID (cannot be manipulated)
    const userId = new ObjectId(session.user.id);

    // Security: Only fetch paymentSettings field (principle of least privilege)
    const user = await db.collection('users').findOne(
      { _id: userId },
      { projection: { paymentSettings: 1 } }
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Security: Only expose non-sensitive payment information
    // Do NOT expose API credentials (consumerKey, consumerSecret, passKey)
    const method = user.paymentSettings?.method || 'company_paybill';
    const paybillNumber = user.paymentSettings?.paybillNumber;

    return NextResponse.json({
      success: true,
      method,
      paybillNumber,
      updatedAt: user.paymentSettings?.updatedAt,
    });
  } catch (error) {
    console.error('[Payment Method API] Error:', error);
    // Security: Generic error message (no stack trace exposure)
    return NextResponse.json(
      { error: 'Failed to fetch payment method' },
      { status: 500 }
    );
  }
}
