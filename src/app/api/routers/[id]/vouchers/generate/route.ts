// src/app/api/routers/[id]/vouchers/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { MikroTikService } from '@/lib/services/mikrotik';
import { getRouterConnectionConfig } from '@/lib/services/router-connection';
import { NotificationService } from '@/lib/services/notification';
import { RouterProviderFactory } from '@/lib/factories/router-provider.factory';
import type { ServiceType } from '@/lib/interfaces/router-provider.interface';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// Generate random voucher code
function generateVoucherCode(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (0, O, I, 1)
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Convert duration in minutes to MikroTik format
function convertMinutesToMikroTikFormat(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h${remainingMinutes}m` : `${hours}h`;
  } else if (minutes < 10080) {
    const days = Math.floor(minutes / 1440);
    const remainingHours = Math.floor((minutes % 1440) / 60);
    return remainingHours > 0 ? `${days}d${remainingHours}h` : `${days}d`;
  } else {
    const weeks = Math.floor(minutes / 10080);
    const remainingDays = Math.floor((minutes % 10080) / 1440);
    return remainingDays > 0 ? `${weeks}w${remainingDays}d` : `${weeks}w`;
  }
}

// Human-readable duration from minutes
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes < 1440) {
    const hours = minutes / 60;
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  if (minutes < 10080) {
    const days = minutes / 1440;
    return days === 1 ? '1 day' : `${days} days`;
  }
  const weeks = minutes / 10080;
  return weeks === 1 ? '1 week' : `${weeks} weeks`;
}

export async function POST(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { id: routerId } = await params;

    // Validate router ID
    if (!ObjectId.isValid(routerId)) {
      return NextResponse.json(
        { error: 'Invalid router ID' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await req.json();
    const {
      quantity = 10,
      packageName, // Package name from router (e.g., "3hours-25ksh")
      serviceType = 'hotspot' as ServiceType, // NEW: Service type (hotspot or pppoe)
      // Auto-expire controls activation expiry (unused vouchers). Default true for batches.
      autoExpire = true,
      expiryDays = 30,
      // Whether voucher usage should be timed starting from purchase time
      usageTimedOnPurchase = false,
      syncToRouter = true, // Whether to create users on router immediately
    } = body;

    // Validate input
    if (!packageName) {
      return NextResponse.json(
        { error: 'Package name is required' },
        { status: 400 }
      );
    }

    if (quantity < 1 || quantity > 1000) {
      return NextResponse.json(
        { error: 'Quantity must be between 1 and 1000' },
        { status: 400 }
      );
    }

    // Note: Auto Expire (activation expiry) and Time-after-Purchase (purchase-timed expiry)
    // are allowed to coexist. Auto Expire controls when an unused voucher generated in a
    // batch becomes invalid for activation. Time-after-Purchase controls when a purchased
    // voucher's purchase-window elapses. Both operate independently.

    // Validate that if autoExpire is enabled, expiryDays must be valid
    if (autoExpire && (!expiryDays || expiryDays < 1)) {
      return NextResponse.json(
        {
          error: 'Invalid configuration',
          message: 'When "Auto Expire Vouchers" is enabled, you must specify the number of days (minimum 1).',
        },
        { status: 400 }
      );
    }

    // Connect to database
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Verify router ownership and get package details
    const router = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        userId: new ObjectId(userId),
      });

    if (!router) {
      return NextResponse.json(
        { error: 'Router not found or access denied' },
        { status: 404 }
      );
    }

    // Get user for commission rate calculation
    const user = await db
      .collection('users')
      .findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get router type (defaults to mikrotik for backward compatibility)
    const routerType = router.routerType || 'mikrotik';

    // Check if service is enabled
    const serviceConfig = router.services?.[serviceType];
    if (!serviceConfig?.enabled) {
      return NextResponse.json(
        { error: `${serviceType} service is not enabled on this router` },
        { status: 400 }
      );
    }

    // Find the package in router's service packages (NEW: service-aware)
    let packageData = serviceConfig.packages?.find(
      (pkg: any) => pkg.name === packageName
    );

    // Fallback to legacy packages.hotspot for backward compatibility
    if (!packageData && serviceType === 'hotspot') {
      packageData = router.packages?.hotspot?.find(
        (pkg: any) => pkg.name === packageName
      );
    }

    if (!packageData) {
      return NextResponse.json(
        { error: `Package "${packageName}" not found for ${serviceType} service` },
        { status: 404 }
      );
    }

    // Extract package details
    const duration = packageData.duration || 60; // minutes
    const price = packageData.price || 10;
    const bandwidth = packageData.bandwidth || { upload: 512, download: 1024 };
    const displayName = packageData.displayName || packageName;

    // Generate batch ID
    const batchId = `BATCH-${Date.now()}`;

    // Calculate activation expiry date
    const activationExpiresAt = autoExpire
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
      : null;

    // Determine commission rate
    const commissionRate = (user.subscription?.plan === 'isp' || user.businessInfo?.type === 'isp')
      ? 0
      : (user.paymentSettings?.commissionRate ?? 20);

    // Prepare connection config and router provider
    let provider = null;
    let voucherResult = null;
    
    if (syncToRouter && router.health?.status === 'online') {
      const connectionConfig = getRouterConnectionConfig(router, {
        forceLocal: false,
        forceVPN: true,
      });

      // Create router provider instance
      provider = RouterProviderFactory.create(routerType, connectionConfig);

      // Check if provider supports this service
      if (!provider.supportsService(serviceType)) {
        return NextResponse.json(
          { error: `${routerType} router does not support ${serviceType} service` },
          { status: 400 }
        );
      }

      // Generate vouchers using provider abstraction
      try {
        console.log(`[Batch ${batchId}] Generating ${quantity} vouchers for ${serviceType} service...`);
        
        voucherResult = await provider.generateVouchersForService!(serviceType, {
          packageId: packageName,
          packageName,
          quantity,
          duration,
          price,
          serviceType,
        });

        if (!voucherResult.success) {
          console.error(`[Batch ${batchId}] Provider voucher generation failed:`, voucherResult.error);
          return NextResponse.json(
            { error: voucherResult.error || 'Failed to generate vouchers on router' },
            { status: 500 }
          );
        }

        console.log(`[Batch ${batchId}] Successfully generated ${voucherResult.vouchers.length} vouchers on router`);
      } catch (error) {
        console.error(`[Batch ${batchId}] Provider error:`, error);
        return NextResponse.json(
          {
            error: 'Failed to generate vouchers on router',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    }

    // Build voucher documents from provider result or generate codes manually
    const vouchers = [];
    
    if (voucherResult && voucherResult.vouchers.length > 0) {
      // Use vouchers generated by provider
      for (const genVoucher of voucherResult.vouchers) {
        const paymentReference = `VCH${(Date.now().toString(36) + Math.random().toString(36).slice(2, 4)).toUpperCase().slice(-9)}`;

        const voucher = {
          _id: new ObjectId(),
          routerId: new ObjectId(routerId),
          userId: new ObjectId(userId),
          reference: paymentReference,
          // NEW: Router type and service type
          routerType,
          serviceType,
          voucherInfo: {
            code: genVoucher.code,
            password: genVoucher.password,
            packageType: packageName,
            packageDisplayName: displayName,
            duration: duration,
            dataLimit: packageData.dataLimit || 0,
            bandwidth: bandwidth,
            price: price,
            currency: 'KES',
          },
          usage: {
            used: false,
            customerId: null,
            deviceMac: null,
            startTime: null,
            endTime: null,
            dataUsed: 0,
            timeUsed: 0,
            maxDurationMinutes: duration,
            expectedEndTime: null,
            timedOnPurchase: !!usageTimedOnPurchase,
            purchaseExpiresAt: null,
          },
          payment: {
            method: null,
            transactionId: null,
            phoneNumber: null,
            amount: price,
            commission: price * (commissionRate / 100),
            paymentDate: null,
          },
          batch: {
            batchId: batchId,
            batchSize: quantity,
            generatedBy: new ObjectId(userId),
          },
          expiry: {
            expiresAt: activationExpiresAt,
            autoDelete: autoExpire,
          },
          // NEW: Vendor-specific data
          vendorSpecific: genVoucher.vendorData || {},
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        vouchers.push(voucher);
        console.log(`[Voucher ${genVoucher.code}] Generated via provider`);
      }
    } else {
      // Fallback: Generate codes manually (vouchers not synced to router)
      const voucherCodes = new Set<string>();
      
      for (let i = 0; i < quantity; i++) {
        let code = generateVoucherCode();
        while (voucherCodes.has(code)) {
          code = generateVoucherCode();
        }
        voucherCodes.add(code);

        const paymentReference = `VCH${(Date.now().toString(36) + Math.random().toString(36).slice(2, 4)).toUpperCase().slice(-9)}`;

        const voucher = {
          _id: new ObjectId(),
          routerId: new ObjectId(routerId),
          userId: new ObjectId(userId),
          reference: paymentReference,
          routerType,
          serviceType,
          voucherInfo: {
            code: code,
            password: code,
            packageType: packageName,
            packageDisplayName: displayName,
            duration: duration,
            dataLimit: packageData.dataLimit || 0,
            bandwidth: bandwidth,
            price: price,
            currency: 'KES',
          },
          usage: {
            used: false,
            customerId: null,
            deviceMac: null,
            startTime: null,
            endTime: null,
            dataUsed: 0,
            timeUsed: 0,
            maxDurationMinutes: duration,
            expectedEndTime: null,
            timedOnPurchase: !!usageTimedOnPurchase,
            purchaseExpiresAt: null,
          },
          payment: {
            method: null,
            transactionId: null,
            phoneNumber: null,
            amount: price,
            commission: price * (commissionRate / 100),
            paymentDate: null,
          },
          batch: {
            batchId: batchId,
            batchSize: quantity,
            generatedBy: new ObjectId(userId),
          },
          expiry: {
            expiresAt: activationExpiresAt,
            autoDelete: autoExpire,
          },
          vendorSpecific: {},
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        vouchers.push(voucher);
        console.log(`[Voucher ${code}] Generated (not synced to router)`);
      }
    }

    // Insert vouchers into database (with mikrotikUserId)
    await db.collection('vouchers').insertMany(vouchers);
    console.log(`[Batch ${batchId}] Inserted ${vouchers.length} vouchers into database`);

    // Update router statistics
    await db.collection('routers').updateOne(
      { _id: new ObjectId(routerId) },
      {
        $inc: {
          'statistics.totalUsers': quantity,
        },
        $set: {
          updatedAt: new Date(),
        },
      }
    );

    // Log audit trail
    await db.collection('audit_logs').insertOne({
      user: {
        userId: new ObjectId(userId),
        email: session.user.email || '',
        role: session.user.role || 'homeowner',
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
      },
      action: {
        type: 'create',
        resource: 'voucher',
        resourceId: new ObjectId(routerId),
        description: `Generated ${quantity} ${displayName} vouchers (Batch: ${batchId})`,
      },
      changes: {
        before: null,
        after: {
          batchId,
          quantity,
          packageName,
          packageDisplayName: displayName,
          totalValue: quantity * price,
          syncedToRouter: syncToRouter,
        },
        fields: ['vouchers'],
      },
      metadata: {
        source: 'web',
        severity: 'info',
        correlationId: batchId,
      },
      timestamp: new Date(),
    });

    // Calculate sync success rate
    const syncedCount = voucherResult ? voucherResult.vouchers.length : 0;
    const failedCount = voucherResult ? 0 : quantity;

    // Return generated vouchers (including router/service types in response)
    const response = vouchers.map((v) => ({
      id: v._id.toString(),
      reference: v.reference, // Payment reference for M-Pesa (public, NOT the password)
      code: v.voucherInfo.code,
      password: v.voucherInfo.password,
      packageName: v.voucherInfo.packageType,
      packageDisplayName: v.voucherInfo.packageDisplayName,
      duration: formatDuration(v.voucherInfo.duration),
      durationMinutes: v.voucherInfo.duration,
      price: v.voucherInfo.price,
      expiresAt: v.expiry.expiresAt ? new Date(v.expiry.expiresAt).toISOString() : null,
      routerType: v.routerType,
      serviceType: v.serviceType,
      syncedToRouter: !!voucherResult,
      vendorData: v.vendorSpecific,
    }));

    // Create notification for user
    try {
      const routerName = router.routerInfo?.name || 'Router';
      await NotificationService.createNotification({
        userId,
        type: 'success',
        category: 'voucher',
        priority: 'normal',
        title: 'Vouchers Generated Successfully',
        message: `${quantity} ${displayName} voucher(s) generated for ${routerName}. Total value: KES ${quantity * price}`,
        metadata: {
          resourceType: 'router',
          resourceId: routerId,
          link: `/routers/${routerId}`,
          amount: quantity * price,
        },
        sendEmail: false, // User initiated action, no email needed
      });
    } catch (notifError) {
      console.error('Failed to create voucher generation notification:', notifError);
      // Don't fail the voucher generation if notification fails
    }

    return NextResponse.json({
      success: true,
      batchId,
      vouchers: response,
      summary: {
        totalGenerated: quantity,
        totalValue: quantity * price,
        commission: quantity * price * (commissionRate / 100),
        packageName: displayName,
        duration: formatDuration(duration),
        expiryDate: activationExpiresAt ? activationExpiresAt.toISOString() : null,
      },
      routerSync: syncToRouter
        ? {
          enabled: true,
          synced: syncedCount,
          failed: failedCount,
          successRate: quantity > 0 ? `${Math.round((syncedCount / quantity) * 100)}%` : '0%',
          routerType,
          serviceType,
        }
        : {
          enabled: false,
          message: 'Vouchers created in database only. Will sync to router upon purchase.',
        },
    });
  } catch (error) {
    console.error('[Voucher Generation] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate vouchers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}