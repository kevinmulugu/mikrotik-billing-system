// src/app/api/cron/sync-routers/route.ts - Background Sync Job

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { RouterSyncService } from '@/lib/services/router-sync';

/**
 * Background cron job to sync all active routers
 * Should be configured in vercel.json or called by external cron service
 * Recommended: Run every 5-10 minutes
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get all active routers
    const routers = await db
      .collection('routers')
      .find({ status: 'active' })
      .toArray();

    console.log(`Starting sync for ${routers.length} routers...`);

    const results = {
      total: routers.length,
      successful: 0,
      failed: 0,
      warnings: 0,
      errors: [] as Array<{ routerId: string; error: string }>,
    };

    // Sync each router
    for (const router of routers) {
      try {
        const syncResult = await RouterSyncService.syncRouter(router._id.toString());

        if (syncResult.success) {
          results.successful++;
          
          if (syncResult.discrepancies && syncResult.discrepancies.length > 0) {
            results.warnings++;
          }
        } else {
          results.failed++;
          results.errors.push({
            routerId: router._id.toString(),
            error: syncResult.error || 'Unknown error',
          });
        }

        // Small delay to avoid overwhelming the network
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        results.failed++;
        results.errors.push({
          routerId: router._id.toString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(`Sync completed: ${results.successful} successful, ${results.failed} failed, ${results.warnings} warnings`);

    // Log to system audit
    await db.collection('audit_logs').insertOne({
      user: {
        userId: null,
        email: 'system@mikrotik-billing.com',
        role: 'system',
        ipAddress: 'internal',
        userAgent: 'BackgroundSyncService',
      },
      action: {
        type: 'sync',
        resource: 'routers',
        resourceId: null,
        description: `Background router sync completed: ${results.successful}/${results.total} successful`,
      },
      changes: {
        before: null,
        after: null,
        fields: [],
      },
      metadata: {
        sessionId: '',
        correlationId: `background-sync-${Date.now()}`,
        source: 'system',
        severity: results.failed > 0 ? 'warning' : 'info',
      },
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Background sync completed',
      results,
    });
  } catch (error) {
    console.error('Background sync error:', error);
    return NextResponse.json(
      {
        error: 'Background sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}