import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const createPPPoEUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().min(10, 'Valid phone number is required'),
  packageType: z.string().min(1, 'Package type is required'),
  price: z.number().min(0, 'Price must be positive'),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const routerId = searchParams.get('routerId');
    const userType = searchParams.get('type'); // 'hotspot' | 'pppoe' | 'all'

    // TODO: Fetch users from database
    const users = [
      {
        id: '1',
        username: 'user001',
        fullName: 'John Doe',
        type: 'pppoe',
        status: 'active',
        packageType: '5Mbps',
        lastLogin: new Date().toISOString(),
        dataUsed: 2.5, // GB
        isOnline: true,
      },
      {
        id: '2',
        sessionId: 'voucher_abc123',
        type: 'hotspot',
        status: 'active',
        packageType: '1hour',
        startTime: new Date().toISOString(),
        timeUsed: 45, // minutes
        deviceMac: '00:11:22:33:44:55',
      },
    ];

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
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
    const validatedData = createPPPoEUserSchema.parse(body);

    // TODO: Create PPPoE user in database and MikroTik router
    const newUser = {
      id: Date.now().toString(),
      ...validatedData,
      type: 'pppoe',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}