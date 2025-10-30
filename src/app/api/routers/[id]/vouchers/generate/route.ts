// src/app/api/routers/[id]/vouchers/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { MikroTikService } from '@/lib/services/mikrotik';
import { getRouterConnectionConfig } from '@/lib/services/router-connection';

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
      // Auto-expire controls activation expiry (unused vouchers). Default true for batches.
      autoExpire = true,
      expiryDays = 30,
      // Whether voucher usage should be timed starting from purchase time
      usageTimedOnPurchase = false,
      // If true, voucher will be auto-terminated (deleted from DB/router) when purchase/usage window elapses
      autoTerminateOnPurchase = false,
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

    // Get customer
    const customer = await db
      .collection('customers')
      .findOne({ userId: new ObjectId(userId) });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const customerId = customer._id;

    // Verify router ownership and get package details
    const router = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        customerId: customerId,
      });

    if (!router) {
      return NextResponse.json(
        { error: 'Router not found or access denied' },
        { status: 404 }
      );
    }

    // Find the package in router's packages
    const packageData = router.packages?.hotspot?.find(
      (pkg: any) => pkg.name === packageName
    );

    if (!packageData) {
      return NextResponse.json(
        { error: `Package "${packageName}" not found on router` },
        { status: 404 }
      );
    }

    // Extract package details
    const duration = packageData.duration || 60; // minutes
    const price = packageData.price || 10;
    const bandwidth = packageData.bandwidth || { upload: 512, download: 1024 };
    const displayName = packageData.displayName || packageName;

    // Convert duration to MikroTik format
    const limitUptime = convertMinutesToMikroTikFormat(duration);

    // Generate batch ID
    const batchId = `BATCH-${Date.now()}`;

    // Calculate activation expiry date (when an unused voucher can no longer be activated).
    // Auto Expire controls this independently of whether usageTimedOnPurchase is enabled.
    // If autoExpire is false we leave activationExpiresAt as null (no automatic activation expiry).
    const activationExpiresAt = autoExpire
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
      : null;

    // Prepare router config if sync is enabled
    let routerConfig = null;
    if (syncToRouter && router.health?.status === 'online') {
      routerConfig = getRouterConnectionConfig(router, {
        forceLocal: false,
        forceVPN: true,
      });
    }

    // Determine commission rate: default 20% for personal/homeowner, 0% for ISPs if detected
    const commissionRate = (customer.subscription?.plan === 'isp' || customer.businessInfo?.type === 'isp')
      ? 0
      : (customer.paymentSettings?.commissionRate ?? 20);

    // Generate vouchers
    const vouchers = [];
    const voucherCodes = new Set<string>();
    const mikrotikCreationResults = [];

    for (let i = 0; i < quantity; i++) {
      // Generate unique code
      let code = generateVoucherCode();
      while (voucherCodes.has(code)) {
        code = generateVoucherCode();
      }
      voucherCodes.add(code);

      // Initialize mikrotikUserId (will be populated if sync succeeds)
      let mikrotikUserId: string | null = null;

      // Create user on MikroTik router if syncToRouter is enabled and router is online
      if (routerConfig) {
        try {
          console.log(`[Voucher ${code}] Creating MikroTik user...`);

          const userResult = await MikroTikService.createHotspotUser(
            routerConfig,
            {
              name: code,
              password: code,
              profile: packageName,
              limitUptime: limitUptime, // Critical: Session duration
              server: 'hotspot1',
              comment: `${displayName} - Generated automatically`,
            }
          );

          // CRITICAL FIX: ret field is the .id contrary to other API responses
          mikrotikUserId = userResult?.['ret'] || null;

          console.log(`[Voucher ${code}] MikroTik user created successfully. ID: ${mikrotikUserId}`);

          mikrotikCreationResults.push({
            code: code,
            success: true,
            mikrotikUserId: mikrotikUserId,
          });
        } catch (mikrotikError) {
          console.error(`[Voucher ${code}] Failed to create MikroTik user:`, mikrotikError);

          mikrotikCreationResults.push({
            code: code,
            success: false,
            mikrotikUserId: null,
            error: mikrotikError instanceof Error ? mikrotikError.message : 'Unknown error',
          });
        }
      }

      // Generate unique payment reference (separate from voucher code for security)
      const paymentReference = `VCH${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Create voucher document with mikrotikUserId
      const voucher = {
        _id: new ObjectId(),
        routerId: new ObjectId(routerId),
        customerId: customerId,
        reference: paymentReference, // Public reference for M-Pesa payments (NOT the password)
        voucherInfo: {
          code: code,
          password: code, // Same as code for simplicity
          packageType: packageName,
          packageDisplayName: displayName,
          duration: duration, // Store in minutes
          dataLimit: packageData.dataLimit || 0, // 0 = Unlimited
          bandwidth: bandwidth,
          price: price,
          currency: 'KES',
        },
        usage: {
          used: false,
          userId: null,
          deviceMac: null,
          startTime: null,
          endTime: null,
          dataUsed: 0,
          timeUsed: 0,
          // Max duration (minutes) that will be applied when voucher is activated
          maxDurationMinutes: duration,
          // expectedEndTime will be set when voucher is activated (startTime + maxDurationMinutes)
          expectedEndTime: null,
          // Whether to start a purchase-based deadline for this voucher
          timedOnPurchase: !!usageTimedOnPurchase,
          // purchaseExpiresAt will be set when voucher is purchased (purchaseTime + maxDurationMinutes)
          // The webhook will calculate this using the package duration
          purchaseExpiresAt: null,
          // Whether to auto-terminate/delete voucher after purchase expiry (remove from DB/router)
          autoTerminateOnPurchase: !!autoTerminateOnPurchase,
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
          // Activation expiry (when voucher can no longer be activated). Null means no activation expiry.
          expiresAt: activationExpiresAt,
          autoDelete: autoExpire,
        },
        // CRITICAL: Store MikroTik user ID for future operations
        mikrotikUserId: mikrotikUserId,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vouchers.push(voucher);
      console.log(`[Voucher ${code}] Generated. MikroTik ID: ${mikrotikUserId || 'not synced'}`);
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
    const syncedCount = mikrotikCreationResults.filter((r) => r.success).length;
    const failedCount = mikrotikCreationResults.filter((r) => !r.success).length;

    // Return generated vouchers (including mikrotikUserId in response)
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
      mikrotikUserId: v.mikrotikUserId, // Include in response for transparency
      syncedToRouter: v.mikrotikUserId !== null,
    }));

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
          details: mikrotikCreationResults,
        }
        : {
          enabled: false,
          message: 'Vouchers created in database only. Sync to router manually.',
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