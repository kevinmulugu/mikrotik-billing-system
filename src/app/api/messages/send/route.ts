// src/app/api/messages/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

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

    // Log the message (for now, just console.log)
    // In production, integrate with your SMS provider (e.g., Africa's Talking, Twilio, etc.)
    console.log('='.repeat(60));
    console.log('MESSAGE SEND REQUEST');
    console.log('='.repeat(60));
    console.log('User:', session.user.email);
    console.log('Recipient Type:', recipientType);
    console.log('Router ID:', routerId || 'All routers');
    console.log('Message:', message);
    console.log('Recipients:', customers.length);
    console.log('-'.repeat(60));
    customers.forEach((customer, index) => {
      console.log(`${index + 1}. ${customer.name || 'Unknown'} - ${customer.phone}`);
    });
    console.log('='.repeat(60));

    // TODO: Integrate with SMS provider
    // Example with Africa's Talking:
    /*
    const africastalking = require('africastalking')({
      apiKey: process.env.AFRICASTALKING_API_KEY,
      username: process.env.AFRICASTALKING_USERNAME,
    });

    const sms = africastalking.SMS;
    const phoneNumbers = customers.map(c => c.phone).filter(Boolean);
    
    const result = await sms.send({
      to: phoneNumbers,
      message: message,
    });
    */

    // Save message to database for record keeping
    const messageRecord = {
      userId: new ObjectId(session.user.id),
      recipientType,
      routerId: recipientType === 'router' ? new ObjectId(routerId) : null,
      templateId: templateId ? new ObjectId(templateId) : null,
      message,
      recipientCount: customers.length,
      recipients: customers.map((c) => ({
        customerId: c._id,
        phone: c.phone,
        name: c.name,
      })),
      status: 'sent', // In production: 'pending', 'sent', 'failed'
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
      sentCount: customers.length,
      messageId: result.insertedId,
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
