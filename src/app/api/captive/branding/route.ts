// src/app/api/captive/branding/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Default branding when router/customer not found or has no custom branding
const DEFAULT_BRANDING = {
  logo_url: '/default-wifi-logo.png',
  primary_color: '#3B82F6',
  secondary_color: '#10B981',
  company_name: 'WiFi Service',
  location: '',
  support: {
    phone: '+254700000000',
    email: 'support@wifiservice.com',
    hours: '24/7',
  },
};

// CORS headers for captive portal access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/captive/branding - Fetch router branding for captive portal
export async function GET(request: NextRequest) {
  try {
    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const routerId = searchParams.get('routerId');
    const mac = searchParams.get('mac'); // Optional: for analytics

    // Validate routerId parameter
    if (!routerId) {
      return NextResponse.json(
        {
          success: false,
          error: 'missing_router_id',
          message: 'Router ID is required',
          fallback: true,
          branding: DEFAULT_BRANDING,
        },
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-cache',
          },
        }
      );
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(routerId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_router_id',
          message: 'Invalid router identifier format',
          fallback: true,
          branding: DEFAULT_BRANDING,
        },
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-cache',
          },
        }
      );
    }

    // Connect to database
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Query router by ObjectId
    const router = await db.collection('routers').findOne({
      _id: new ObjectId(routerId),
    });

    // Router not found - return fallback branding
    if (!router) {
      console.warn(`Router not found: ${routerId}`);
      
      return NextResponse.json(
        {
          success: true,
          fallback: true,
          message: 'Router configuration not found. Using default branding.',
          branding: DEFAULT_BRANDING,
        },
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=60', // Cache for 1 minute if not found
          },
        }
      );
    }

    // Query router owner for branding information
    const routerOwner = await db.collection('users').findOne({
      _id: router.userId,
    });

    // Build branding object
    let branding;

    if (routerOwner && routerOwner.branding) {
      // Router owner has custom branding
      branding = {
        logo_url: routerOwner.branding.logo || DEFAULT_BRANDING.logo_url,
        primary_color: routerOwner.branding.primaryColor || DEFAULT_BRANDING.primary_color,
        secondary_color: routerOwner.branding.secondaryColor || DEFAULT_BRANDING.secondary_color,
        company_name: routerOwner.branding.companyName || routerOwner.businessInfo?.name || DEFAULT_BRANDING.company_name,
        location: router.routerInfo?.location?.name || routerOwner.businessInfo?.address?.city || '',
        support: {
          phone: routerOwner.businessInfo?.contact?.phone || DEFAULT_BRANDING.support.phone,
          email: routerOwner.businessInfo?.contact?.email || DEFAULT_BRANDING.support.email,
          hours: '24/7',
        },
      };
    } else if (routerOwner) {
      // Router owner exists but no custom branding - use business info
      branding = {
        logo_url: DEFAULT_BRANDING.logo_url,
        primary_color: DEFAULT_BRANDING.primary_color,
        secondary_color: DEFAULT_BRANDING.secondary_color,
        company_name: routerOwner.businessInfo?.name || DEFAULT_BRANDING.company_name,
        location: router.routerInfo?.location?.name || routerOwner.businessInfo?.address?.city || '',
        support: {
          phone: routerOwner.businessInfo?.contact?.phone || DEFAULT_BRANDING.support.phone,
          email: routerOwner.businessInfo?.contact?.email || DEFAULT_BRANDING.support.email,
          hours: '24/7',
        },
      };
    } else {
      // Router owner not found - use defaults
      branding = {
        ...DEFAULT_BRANDING,
        location: router.routerInfo?.location?.name || '',
      };
    }

    // Optional: Log analytics
    if (mac) {
      try {
        await db.collection('analytics').insertOne({
          event: 'captive_portal_view',
          routerId: router._id,
          userId: router.userId,
          mac: mac,
          timestamp: new Date(),
          metadata: {
            routerName: router.routerInfo?.name,
            location: router.routerInfo?.location?.name,
          },
        });
      } catch (analyticsError) {
        // Don't fail the request if analytics fails
        console.error('Analytics logging failed:', analyticsError);
      }
    }

    // Build successful response
    const response = {
      success: true,
      branding: branding,
      router: {
        name: router.routerInfo?.name || 'WiFi Router',
        location: router.routerInfo?.location?.name || '',
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error('Error fetching branding:', error);

    // Return fallback branding on server error
    return NextResponse.json(
      {
        success: false,
        error: 'server_error',
        message: 'Failed to fetch branding. Using defaults.',
        fallback: true,
        branding: DEFAULT_BRANDING,
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
}