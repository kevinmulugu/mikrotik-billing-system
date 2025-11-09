// src/app/api/payments/setup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { NotificationService } from '@/lib/services/notification';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDatabase();
    const userId = new ObjectId(session.user.id);
    const body = await request.json();
    const { method, paybillData, credentials, phoneNumber } = body;

    // Validate method
    if (!method || !['company_paybill', 'own_paybill'].includes(method)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    if (method === 'company_paybill') {
      // For company paybill, update user's preference with company paybill number
      const companyPaybillNumber = process.env.MPESA_DEFAULT_PAYBILL;
      
      if (!companyPaybillNumber) {
        return NextResponse.json(
          { error: 'Company paybill not configured' },
          { status: 500 }
        );
      }

      await db.collection('users').updateOne(
        { _id: userId },
        {
          $set: {
            'paymentSettings.method': 'company_paybill',
            'paymentSettings.paybillNumber': companyPaybillNumber,
            'paymentSettings.updatedAt': new Date(),
          },
        }
      );

      // Send notification
      try {
        await NotificationService.createNotification({
          userId: session.user.id,
          type: 'info',
          category: 'system',
          priority: 'low',
          title: 'Payment Method Updated',
          message: `Payment method changed to Company Paybill (${companyPaybillNumber}).`,
          metadata: {
            resourceType: 'payment',
            link: '/payments/setup',
          },
          sendEmail: false,
        });
      } catch (notifError) {
        console.error('[Payments] Failed to send notification:', notifError);
      }

      return NextResponse.json({
        success: true,
        message: 'Company paybill activated successfully',
        method: 'company_paybill',
      });
    }

    if (method === 'own_paybill') {
      // Validate required fields
      if (!paybillData || !credentials) {
        return NextResponse.json(
          { error: 'Paybill data and credentials are required' },
          { status: 400 }
        );
      }

      // Check if user already has a paybill setup
      const existingPaybill = await db.collection('paybills').findOne({
        userId,
        status: 'active',
      });

      if (existingPaybill) {
        // Update existing paybill
        await db.collection('paybills').updateOne(
          { _id: existingPaybill._id },
          {
            $set: {
              paybillInfo: {
                number: paybillData.number,
                name: paybillData.name,
                type: paybillData.type || 'paybill',
                provider: paybillData.provider || 'mpesa',
              },
              credentials: {
                consumerKey: credentials.consumerKey,
                consumerSecret: credentials.consumerSecret,
                passKey: credentials.passKey,
              },
              config: {
                environment: process.env.MPESA_ENVIRONMENT || 'sandbox',
                webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mpesa/callback`,
                confirmationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mpesa/confirmation`,
              },
              updatedAt: new Date(),
            },
          }
        );
      } else {
        // Create new paybill entry
        await db.collection('paybills').insertOne({
          userId,
          paybillInfo: {
            number: paybillData.number,
            name: paybillData.name,
            type: paybillData.type || 'paybill',
            provider: paybillData.provider || 'mpesa',
          },
          credentials: {
            consumerKey: credentials.consumerKey,
            consumerSecret: credentials.consumerSecret,
            passKey: credentials.passKey,
            accessToken: null,
            tokenExpiresAt: null,
          },
          config: {
            environment: process.env.MPESA_ENVIRONMENT || 'sandbox',
            webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mpesa/callback`,
            confirmationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mpesa/confirmation`,
          },
          statistics: {
            totalTransactions: 0,
            totalAmount: 0,
            successRate: 0,
          },
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Update user's payment preference
      await db.collection('users').updateOne(
        { _id: userId },
        {
          $set: {
            'paymentSettings.method': 'own_paybill',
            'paymentSettings.paybillNumber': paybillData.number,
            'paymentSettings.updatedAt': new Date(),
          },
        }
      );

      // Send notification
      try {
        await NotificationService.createNotification({
          userId: session.user.id,
          type: 'info',
          category: 'system',
          priority: 'low',
          title: 'Payment Method Updated',
          message: `Payment method changed to Own Paybill (${paybillData.number} - ${paybillData.name}).`,
          metadata: {
            resourceType: 'payment',
            link: '/payments/setup',
          },
          sendEmail: false,
        });
      } catch (notifError) {
        console.error('[Payments] Failed to send notification:', notifError);
      }

      return NextResponse.json({
        success: true,
        message: 'Paybill setup completed successfully',
        method: 'own_paybill',
        paybill: {
          number: paybillData.number,
          name: paybillData.name,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Payment setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup payment method' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDatabase();
    const userId = new ObjectId(session.user.id);

    // Get user's payment settings
    const user = await db.collection('users').findOne(
      { _id: userId },
      { projection: { paymentSettings: 1, businessInfo: 1 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const paymentMethod = user.paymentSettings?.method || null;
    let paybillInfo = null;

    if (paymentMethod === 'own_paybill') {
      // Get user's paybill details
      const paybill = await db.collection('paybills').findOne(
        { userId, status: 'active' },
        {
          projection: {
            'paybillInfo.number': 1,
            'paybillInfo.name': 1,
            'paybillInfo.type': 1,
            statistics: 1,
            createdAt: 1,
          },
        }
      );

      if (paybill) {
        paybillInfo = {
          number: paybill.paybillInfo.number,
          name: paybill.paybillInfo.name,
          type: paybill.paybillInfo.type,
          statistics: paybill.statistics,
          createdAt: paybill.createdAt,
        };
      }
    } else if (paymentMethod === 'company_paybill') {
      // Get company paybill info
      const companyPaybillNumber = process.env.MPESA_DEFAULT_PAYBILL;
      const companyPaybill = await db.collection('paybills').findOne(
        {
          'paybillInfo.number': companyPaybillNumber,
          userId: null,
        },
        {
          projection: {
            'paybillInfo.number': 1,
            'paybillInfo.name': 1,
            'paybillInfo.type': 1,
          },
        }
      );

      if (companyPaybill) {
        paybillInfo = {
          number: companyPaybill.paybillInfo.number,
          name: companyPaybill.paybillInfo.name,
          type: companyPaybill.paybillInfo.type,
        };
      }
    }

    // Get user plan info
    const userPlan = user.businessInfo?.type || 'individual';
    const isISP = userPlan === 'isp' || userPlan === 'isp_pro';

    return NextResponse.json({
      method: paymentMethod,
      paybillInfo,
      userPlan: {
        type: userPlan,
        commissionRate: isISP ? 0 : 80,
      },
    });
  } catch (error) {
    console.error('Get payment setup error:', error);
    return NextResponse.json(
      { error: 'Failed to get payment setup' },
      { status: 500 }
    );
  }
}
