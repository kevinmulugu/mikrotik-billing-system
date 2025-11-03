// src/app/api/user/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDatabase();
    const userId = new ObjectId(session.user.id);

    const user = await db.collection('users').findOne(
      { _id: userId },
      {
        projection: {
          name: 1,
          email: 1,
          image: 1,
          role: 1,
          status: 1,
          businessInfo: 1,
          paymentSettings: 1,
          payoutSettings: 1,
          subscription: 1,
          preferences: 1,
          metadata: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      image: user.image || null,
      role: user.role || 'homeowner',
      status: user.status || 'active',
      businessInfo: user.businessInfo || { 
        type: 'individual',
        name: user.name,
        contact: {
          email: user.email,
          phone: ''
        },
        address: {
          street: '',
          city: '',
          county: '',
          country: 'Kenya',
          postalCode: ''
        }
      },
      paymentSettings: user.paymentSettings || {},
      payoutSettings: user.payoutSettings || {},
      subscription: user.subscription || { plan: 'individual', status: 'active' },
      preferences: user.preferences || {
        language: 'en',
        theme: 'light',
        notifications: {
          email: true,
          sms: true,
          push: true
        }
      },
      metadata: user.metadata || { loginCount: 0, lastLogin: null },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    return NextResponse.json(
      { error: 'Failed to get user profile' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDatabase();
    const userId = new ObjectId(session.user.id);
    const body = await request.json();

    // Build update object
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Update basic info
    if (body.name) updateData.name = body.name;
    if (body.image !== undefined) updateData.image = body.image;

    // Update business info
    if (body.businessInfo) {
      updateData['businessInfo.name'] = body.businessInfo.name;
      updateData['businessInfo.type'] = body.businessInfo.type;
      
      if (body.businessInfo.contact) {
        updateData['businessInfo.contact.phone'] = body.businessInfo.contact.phone;
        updateData['businessInfo.contact.email'] = body.businessInfo.contact.email;
      }
      
      if (body.businessInfo.address) {
        updateData['businessInfo.address.street'] = body.businessInfo.address.street;
        updateData['businessInfo.address.city'] = body.businessInfo.address.city;
        updateData['businessInfo.address.county'] = body.businessInfo.address.county;
        updateData['businessInfo.address.country'] = body.businessInfo.address.country || 'Kenya';
        updateData['businessInfo.address.postalCode'] = body.businessInfo.address.postalCode;
      }
    }

    // Update preferences
    if (body.preferences) {
      if (body.preferences.language) {
        updateData['preferences.language'] = body.preferences.language;
      }
      if (body.preferences.theme) {
        updateData['preferences.theme'] = body.preferences.theme;
      }
      if (body.preferences.notifications) {
        updateData['preferences.notifications'] = body.preferences.notifications;
      }
    }

    const result = await db.collection('users').updateOne(
      { _id: userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Profile updated successfully' 
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    );
  }
}
