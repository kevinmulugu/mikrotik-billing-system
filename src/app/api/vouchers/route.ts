import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const generateVouchersSchema = z.object({
  routerId: z.string().min(1, 'Router ID is required'),
  packageType: z.string().min(1, 'Package type is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1').max(100, 'Maximum 100 vouchers at once'),
  duration: z.number().min(1, 'Duration must be positive'),
  price: z.number().min(0, 'Price must be positive'),
  bandwidth: z.object({
    upload: z.number().min(0),
    download: z.number().min(0),
  }),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const routerId = searchParams.get('routerId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // TODO: Fetch vouchers from database
    const vouchers = [
      {
        id: '1',
        code: 'WIFI001',
        packageType: '1hour',
        duration: 60,
        price: 10,
        status: 'active',
        used: false,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '2',
        code: 'WIFI002',
        packageType: '3hours',
        duration: 180,
        price: 25,
        status: 'used',
        used: true,
        usedAt: new Date().toISOString(),
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ];

    return NextResponse.json({ vouchers });
  } catch (error) {
    console.error('Error fetching vouchers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = generateVouchersSchema.parse(body);

    // TODO: Generate vouchers and save to database
    const vouchers = Array.from({ length: validatedData.quantity }, (_, i) => ({
      id: Date.now() + i,
      code: `WIFI${Date.now()}${i.toString().padStart(3, '0')}`,
      ...validatedData,
      status: 'active',
      used: false,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    }));

    return NextResponse.json({ vouchers, count: vouchers.length }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error generating vouchers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}