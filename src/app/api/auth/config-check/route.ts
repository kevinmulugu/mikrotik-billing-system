import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * API endpoint to check auth configuration health
 * This logs issues server-side for monitoring
 */
export async function GET() {
  try {
    const hasGoogleClientId = !!process.env.GOOGLE_CLIENT_ID;
    const hasGoogleClientSecret = !!process.env.GOOGLE_CLIENT_SECRET;
    const hasEmailServer = !!process.env.EMAIL_SERVER_HOST;
    const hasEmailFrom = !!process.env.EMAIL_FROM;
    const hasNextAuthSecret = !!process.env.NEXTAUTH_SECRET;

    const issues: string[] = [];

    // Check NextAuth essentials
    if (!hasNextAuthSecret) {
      issues.push('NEXTAUTH_SECRET is not configured');
    }

    // Check Google OAuth
    const hasGoogleConfig = hasGoogleClientId && hasGoogleClientSecret;
    if (hasGoogleClientId && !hasGoogleClientSecret) {
      issues.push('GOOGLE_CLIENT_ID set but GOOGLE_CLIENT_SECRET missing');
    }

    // Check Email provider
    const hasEmailConfig = hasEmailServer && hasEmailFrom;
    if (hasEmailServer && !hasEmailFrom) {
      issues.push('EMAIL_SERVER_HOST set but EMAIL_FROM missing');
    }
    if (!hasEmailServer && hasEmailFrom) {
      issues.push('EMAIL_FROM set but EMAIL_SERVER_HOST missing');
    }

    // Check if at least one provider is configured
    if (!hasGoogleConfig && !hasEmailConfig) {
      issues.push('No authentication providers configured (Google or Email)');
    }

    // Log issues server-side
    if (issues.length > 0) {
      logger.error('Authentication configuration issues detected', { issues });

      // In development, return the issues for debugging
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({
          ok: false,
          issues,
          providers: {
            google: hasGoogleConfig,
            email: hasEmailConfig,
          }
        }, { status: 500 });
      }

      // In production, just return a generic error
      return NextResponse.json({
        ok: false,
        providers: {
          google: false,
          email: false,
        }
      }, { status: 500 });
    }

    // All good
    return NextResponse.json({
      ok: true,
      providers: {
        google: hasGoogleConfig,
        email: hasEmailConfig,
      }
    });

  } catch (error) {
    logger.error('Error checking auth configuration', { error });
    return NextResponse.json({
      ok: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
