// src/app/api/messages/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { MessagingService } from '@/lib/services/messaging';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recipientType, routerId, templateId, message } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (recipientType === 'router' && !routerId) {
      return NextResponse.json({ error: 'Router ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get user's routers
    const routers = await db
      .collection('routers')
      .find({ userId: new ObjectId(session.user.id) })
      .toArray();

    if (routers.length === 0) {
      return NextResponse.json({ error: 'No routers found' }, { status: 404 });
    }

    // Build query based on recipient type
    let query: any = {
      routerId: { $in: routers.map((r) => r._id) },
      phone: { $ne: null, $exists: true }, // Only customers with phone numbers
    };

    if (recipientType === 'router') {
      // Verify the router belongs to the user
      const routerObjectId = new ObjectId(routerId);
      const routerBelongsToUser = routers.some((r) => r._id.equals(routerObjectId));

      if (!routerBelongsToUser) {
        return NextResponse.json({ error: 'Router not found' }, { status: 404 });
      }

      query.routerId = routerObjectId;
    }

    // Get customers
    const customers = await db
      .collection('customers')
      .find(query)
      .project({ phone: 1, name: 1 })
      .toArray();

    if (customers.length === 0) {
      return NextResponse.json({ error: 'No customers with phone numbers found' }, { status: 404 });
    }

    console.log(`[Messages] Sending SMS to ${customers.length} customers...`);
    console.log(`[Messages] Message preview: ${message.substring(0, 100)}...`);

    // === Send SMS using MobileSasa ===
    const smsRecipients = customers.map((c) => ({
      phone: c.phone,
      name: c.name,
      customerId: c._id,
    }));

    const smsResult = await MessagingService.sendBulkSMS({
      recipients: smsRecipients,
      message: message,
    });

    console.log(
      `[Messages] SMS Result: ${smsResult.successfulDeliveries}/${smsResult.totalRecipients} sent successfully`
    );

    // Determine overall status
    let messageStatus: 'sent' | 'partial' | 'failed' = 'failed';
    if (smsResult.successfulDeliveries === smsResult.totalRecipients) {
      messageStatus = 'sent';
    } else if (smsResult.successfulDeliveries > 0) {
      messageStatus = 'partial';
    }

    // Save message to database for record keeping
    const messageRecord = {
      userId: new ObjectId(session.user.id),
      recipientType,
      routerId: recipientType === 'router' ? new ObjectId(routerId) : null,
      templateId: templateId ? new ObjectId(templateId) : null,
      message,
      recipientCount: customers.length,
      successfulDeliveries: smsResult.successfulDeliveries,
      failedDeliveries: smsResult.failedDeliveries,
      recipients: smsResult.details.map((detail) => {
        const customer = customers.find((c) => c.phone === detail.phone);
        return {
          customerId: customer?._id,
          phone: detail.phone,
          name: detail.name || customer?.name,
          status: detail.status,
          messageId: detail.messageId,
          error: detail.error,
        };
      }),
      status: messageStatus,
      sentAt: new Date(),
      createdAt: new Date(),
    };

    const result = await db.collection('messages').insertOne(messageRecord);

    // Increment template usage count if template was used
    if (templateId) {
      await db.collection('message_templates').updateOne(
        { _id: new ObjectId(templateId) },
        { $inc: { usageCount: 1 }, $set: { updatedAt: new Date() } }
      );
    }

    return NextResponse.json({
      success: true,
      sentCount: smsResult.successfulDeliveries,
      failedCount: smsResult.failedDeliveries,
      totalRecipients: smsResult.totalRecipients,
      messageId: result.insertedId,
      status: messageStatus,
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
