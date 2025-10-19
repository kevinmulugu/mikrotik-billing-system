// src/app/api/routers/[id]/vouchers/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// Helper to convert vouchers to CSV
function convertToCSV(vouchers: any[]): string {
  const headers = [
    'Code',
    'Password',
    'Package',
    'Duration (minutes)',
    'Price (KES)',
    'Status',
    'Created At',
    'Expires At',
    'Used',
    'Data Used (MB)',
    'User ID',
    'Device MAC',
  ];

  const rows = vouchers.map(v => [
    v.voucherInfo.code,
    v.voucherInfo.password,
    v.voucherInfo.packageDisplayName || v.voucherInfo.packageType,
    v.voucherInfo.duration,
    v.voucherInfo.price,
    v.status,
    new Date(v.createdAt).toISOString(),
    new Date(v.expiry.expiresAt).toISOString(),
    v.usage.used ? 'Yes' : 'No',
    v.usage.dataUsed ? (v.usage.dataUsed / (1024 * 1024)).toFixed(2) : '0',
    v.usage.userId || '',
    v.usage.deviceMac || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
}

// GET /api/routers/[id]/vouchers/export
export async function GET(
  request: NextRequest,
  context: RouteContext
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
  const { id: routerId } = await context.params;

    // Validate router ID
    if (!ObjectId.isValid(routerId)) {
      return NextResponse.json(
        { error: 'Invalid router ID' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const status = searchParams.get('status') || 'all';
    const packageType = searchParams.get('packageType') || 'all';

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

    // Verify router ownership
    const router = await db
      .collection('routers')
      .findOne({
        _id: new ObjectId(routerId),
        customerId: customer._id,
      });

    if (!router) {
      return NextResponse.json(
        { error: 'Router not found or access denied' },
        { status: 404 }
      );
    }

    // Build query filters
    const query: any = {
      routerId: new ObjectId(routerId),
      customerId: customer._id,
    };

    if (status !== 'all') {
      query.status = status;
    }

    if (packageType !== 'all') {
      query['voucherInfo.packageType'] = packageType;
    }

    // Fetch all vouchers matching criteria
    const vouchers = await db
      .collection('vouchers')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    if (vouchers.length === 0) {
      return NextResponse.json(
        { error: 'No vouchers found to export' },
        { status: 404 }
      );
    }

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `vouchers_${router.routerInfo.name}_${timestamp}.${format}`;

    // Export based on format
    if (format === 'csv') {
      const csvContent = convertToCSV(vouchers);
      
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // JSON export
    const jsonContent = JSON.stringify(vouchers, null, 2);
    
    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename.replace('.csv', '.json')}"`,
      },
    });

  } catch (error) {
    console.error('Error exporting vouchers:', error);
    return NextResponse.json(
      {
        error: 'Failed to export vouchers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}