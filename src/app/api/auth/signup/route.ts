import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/database';
import { signIn } from 'next-auth/react';

export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();
    const usersCollection = db.collection('users');
    const customersCollection = db.collection('customers');

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in instead.' },
        { status: 409 }
      );
    }

    // Create user document
    const now = new Date();
    const newUser = {
      email: email.toLowerCase(),
      name: name || null,
      emailVerified: null, // Will be set when they click the magic link
      image: null,
      role: 'homeowner',
      status: 'pending', // Changed to pending until email verified
      preferences: {
        language: 'en',
        notifications: { email: true, sms: true, push: true },
        theme: 'system'
      },
      metadata: {
        loginCount: 0,
        lastLogin: null,
        ipAddress: null,
        userAgent: null
      },
      createdAt: now,
      updatedAt: now
    };

    const userResult = await usersCollection.insertOne(newUser);
    const userId = userResult.insertedId;

    // Create customer record
    const newCustomer = {
      userId: userId,
      businessInfo: {
        name: name ? `${name}'s WiFi` : 'My WiFi Business',
        type: 'homeowner',
        address: {
          street: '',
          city: '',
          county: '',
          country: 'Kenya',
          postalCode: ''
        },
        contact: {
          phone: '',
          email: email.toLowerCase()
        }
      },
      paymentSettings: {
        preferredMethod: 'company_paybill',
        paybillNumber: null,
        accountNumber: null,
        commissionRate: 20, // 20% for Personal/Homeowner
        autoPayouts: true
      },
      subscription: {
        plan: 'personal',
        status: 'active',
        startDate: now,
        endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year
        features: ['single_router', 'basic_analytics', 'email_support']
      },
      statistics: {
        totalRouters: 0,
        activeUsers: 0,
        totalRevenue: 0,
        monthlyRevenue: 0
      },
      status: 'active',
      createdAt: now,
      updatedAt: now
    };

    const customerResult = await customersCollection.insertOne(newCustomer);

    // Link customer to user
    await usersCollection.updateOne(
      { _id: userId },
      { $set: { customerId: customerResult.insertedId, updatedAt: now } }
    );

    return NextResponse.json({
      success: true,
      message: 'Account created successfully. Please check your email to sign in.',
      userId: userId.toString()
    });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}
