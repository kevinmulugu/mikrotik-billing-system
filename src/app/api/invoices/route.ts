// src/app/api/invoices/route.ts
/**
 * Invoices API
 * 
 * Manages subscription invoices for ISP plan users.
 * Individual plan users don't receive invoices (they pay via commission).
 * 
 * Invoice types:
 * - subscription: Monthly/annual subscription fee
 * - overage: Additional charges for exceeding plan limits
 * - adjustment: Manual adjustments (credits/debits)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET /api/invoices
 * Fetch user's invoices
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // paid, pending, overdue, cancelled
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Build query
    const query: any = { userId: new ObjectId(userId) };
    if (status) {
      query.status = status;
    }

    // Fetch invoices
    const invoices = await db
      .collection('invoices')
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const total = await db.collection('invoices').countDocuments(query);

    // Calculate summary
    const summary = await db
      .collection('invoices')
      .aggregate([
        { $match: { userId: new ObjectId(userId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
      ])
      .toArray();

    const stats = {
      paid: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      overdue: { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 },
    };

    summary.forEach((item: any) => {
      if (item._id in stats) {
        stats[item._id as keyof typeof stats] = {
          count: item.count,
          amount: item.totalAmount,
        };
      }
    });

    return NextResponse.json({
      invoices: invoices.map((inv: any) => ({
        id: inv._id.toString(),
        invoiceNumber: inv.invoiceNumber,
        type: inv.type,
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        description: inv.description,
        dueDate: inv.dueDate,
        paidDate: inv.payment?.paidDate || null,
        createdAt: inv.createdAt,
        items: inv.items || [],
        payment: {
          method: inv.payment?.method || null,
          transactionId: inv.payment?.transactionId || null,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: stats,
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invoices
 * Create a new invoice (admin only or system generated)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can manually create invoices
    // In production, add role check here

    const body = await request.json();
    const {
      userId,
      type = 'subscription',
      amount,
      currency = 'KES',
      description,
      dueDate,
      items = [],
    } = body;

    if (!userId || !amount || !description || !dueDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Generate invoice number
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // Get count of invoices this month for sequential numbering
    const startOfMonth = new Date(year, now.getMonth(), 1);
    const count = await db.collection('invoices').countDocuments({
      createdAt: { $gte: startOfMonth },
    });

    const invoiceNumber = `INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;

    // Create invoice
    const invoiceDoc = {
      userId: new ObjectId(userId),
      invoiceNumber,
      type, // subscription, overage, adjustment
      amount,
      currency,
      description,
      items,
      dueDate: new Date(dueDate),
      payment: {
        method: null,
        transactionId: null,
        paidDate: null,
      },
      status: 'pending', // pending, paid, overdue, cancelled
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('invoices').insertOne(invoiceDoc);

    // Log audit trail
    await db.collection('audit_logs').insertOne({
      userId: new ObjectId(session.user.id),
      action: {
        type: 'invoice_created',
        description: `Created invoice ${invoiceNumber}`,
      },
      resourceType: 'invoice',
      resourceId: result.insertedId,
      metadata: {
        invoiceNumber,
        amount,
        targetUserId: userId,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: now,
    });

    return NextResponse.json({
      success: true,
      message: 'Invoice created successfully',
      invoice: {
        id: result.insertedId.toString(),
        invoiceNumber,
        amount,
        status: 'pending',
        dueDate: invoiceDoc.dueDate,
      },
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/invoices/:id
 * Update invoice status (mark as paid, cancelled, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { invoiceId, status, payment } = body;

    if (!invoiceId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['pending', 'paid', 'overdue', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    const userId = session.user.id;

    // Find invoice
    const invoice = await db.collection('invoices').findOne({
      _id: new ObjectId(invoiceId),
      userId: new ObjectId(userId),
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Update invoice
    const updateFields: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'paid' && payment) {
      updateFields['payment.method'] = payment.method || 'mpesa';
      updateFields['payment.transactionId'] = payment.transactionId || null;
      updateFields['payment.paidDate'] = new Date();
    }

    await db.collection('invoices').updateOne(
      { _id: new ObjectId(invoiceId) },
      { $set: updateFields }
    );

    // Log audit trail
    await db.collection('audit_logs').insertOne({
      userId: new ObjectId(userId),
      action: {
        type: 'invoice_updated',
        description: `Updated invoice ${invoice.invoiceNumber} to ${status}`,
      },
      resourceType: 'invoice',
      resourceId: new ObjectId(invoiceId),
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        oldStatus: invoice.status,
        newStatus: status,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Invoice updated successfully',
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    );
  }
}
