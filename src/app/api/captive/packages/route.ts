// src/app/api/captive/packages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper function: Format duration to human-readable string
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return minutes === 1 ? '1 Minute' : `${minutes} Minutes`;
  }
  
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return hours === 1 ? '1 Hour' : `${hours} Hours`;
    }
    return `${hours}h ${remainingMinutes}m`;
  }
  
  if (minutes < 10080) {
    const days = Math.floor(minutes / 1440);
    const remainingHours = Math.floor((minutes % 1440) / 60);
    if (remainingHours === 0) {
      return days === 1 ? '1 Day' : `${days} Days`;
    }
    return `${days}d ${remainingHours}h`;
  }
  
  const weeks = Math.floor(minutes / 10080);
  const remainingDays = Math.floor((minutes % 10080) / 1440);
  if (remainingDays === 0) {
    return weeks === 1 ? '1 Week' : `${weeks} Weeks`;
  }
  return `${weeks}w ${remainingDays}d`;
}

// Helper function: Format bandwidth to user-friendly string
function formatBandwidth(bandwidth: { upload: number; download: number }): string {
  const formatSpeed = (kbps: number): string => {
    if (kbps >= 1024) {
      const mbps = Math.floor(kbps / 1024);
      return `${mbps}Mbps`;
    }
    return `${kbps}kbps`;
  };
  
  const upload = formatSpeed(bandwidth.upload);
  const download = formatSpeed(bandwidth.download);
  
  return `${upload}/${download}`;
}

// Helper function: Generate marketing description based on package
function generateDescription(duration: number, price: number): string {
  if (duration < 120) {
    return 'Perfect for quick browsing and social media';
  }
  
  if (duration < 360) {
    return 'Great for streaming and downloads';
  }
  
  if (duration < 1440) {
    return 'Ideal for work and entertainment';
  }
  
  if (duration < 10080) {
    return 'Best value for daily internet needs';
  }
  
  return 'Maximum value for heavy users and families';
}

// Helper function: Generate feature list based on package specs
function generateFeatures(
  duration: number,
  bandwidth: { upload: number; download: number }
): string[] {
  const features: string[] = [];
  
  // Bandwidth-based features
  if (bandwidth.download >= 15360) {
    features.push('Ultra-fast 4K streaming');
  } else if (bandwidth.download >= 10240) {
    features.push('Fast HD video streaming');
  } else if (bandwidth.download >= 6144) {
    features.push('HD video streaming');
  } else if (bandwidth.download >= 3072) {
    features.push('Smooth video streaming');
  } else {
    features.push('Fast browsing speed');
  }
  
  // Duration-based features
  const durationDisplay = formatDuration(duration);
  features.push(`${durationDisplay} of connectivity`);
  
  // Additional features based on duration tiers
  if (duration >= 10080) {
    features.push('Best for families');
  } else if (duration >= 1440) {
    features.push('All-day access');
  } else if (duration >= 720) {
    features.push('Extended browsing time');
  }
  
  // Speed-based additional features
  if (bandwidth.download >= 10240) {
    features.push('Large file downloads');
  }
  
  return features;
}

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

// GET /api/captive/packages - Fetch available packages for router
export async function GET(request: NextRequest) {
  try {
    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const routerId = searchParams.get('routerId');
    const activeOnly = searchParams.get('activeOnly') !== 'false'; // Default: true

    // Validate routerId parameter
    if (!routerId) {
      return NextResponse.json(
        {
          success: false,
          error: 'missing_router_id',
          message: 'Router ID is required',
          packages: [],
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
          packages: [],
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

    // Router not found
    if (!router) {
      console.warn(`Router not found: ${routerId}`);
      
      return NextResponse.json(
        {
          success: false,
          error: 'router_not_found',
          message: 'Router not found. Please contact support for assistance.',
          packages: [],
          support: {
            phone: '+254700000000',
            email: 'support@wifiservice.com',
          },
        },
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=60',
          },
        }
      );
    }

    // Extract packages from router
    const allPackages = router.packages?.hotspot || [];

    // Filter packages based on activeOnly parameter
    let packages = activeOnly
      ? allPackages.filter((pkg: any) => pkg.syncStatus === 'synced')
      : allPackages;

    // Check if no packages available
    if (packages.length === 0) {
      const message = activeOnly
        ? 'No packages available at the moment. Please contact support.'
        : 'No packages configured for this router.';

      return NextResponse.json(
        {
          success: true,
          packages: [],
          router: {
            name: router.routerInfo?.name || 'WiFi Router',
            status: router.health?.status || 'unknown',
            location: router.routerInfo?.location?.name || '',
          },
          message: message,
          metadata: {
            total_packages: 0,
          },
        },
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=300',
          },
        }
      );
    }

    // Transform packages to captive portal format
    const transformedPackages = packages.map((pkg: any) => ({
      id: pkg.name,
      name: pkg.displayName || pkg.name,
      description: pkg.description || generateDescription(pkg.duration, pkg.price),
      price: pkg.price,
      currency: 'KSh',
      duration: pkg.duration,
      duration_display: formatDuration(pkg.duration),
      bandwidth: {
        upload: pkg.bandwidth.upload,
        download: pkg.bandwidth.download,
        display: formatBandwidth(pkg.bandwidth),
      },
      features: generateFeatures(pkg.duration, pkg.bandwidth),
      validity_days: pkg.validity || 30,
    }));

    // Sort packages by price (ascending - cheapest first)
    transformedPackages.sort((a: any, b: any) => a.price - b.price);

    // Calculate metadata
    const prices = transformedPackages.map((p: any) => p.price);
    const metadata = {
      total_packages: transformedPackages.length,
      cheapest_price: Math.min(...prices),
      most_expensive_price: Math.max(...prices),
      currency: 'KSh',
    };

    // Build successful response
    const response = {
      success: true,
      packages: transformedPackages,
      router: {
        name: router.routerInfo?.name || 'WiFi Router',
        status: router.health?.status || 'unknown',
        location: router.routerInfo?.location?.name || '',
      },
      metadata: metadata,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error('Error fetching packages:', error);

    // Return error response
    return NextResponse.json(
      {
        success: false,
        error: 'server_error',
        message: 'Failed to fetch packages. Please try again.',
        packages: [],
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