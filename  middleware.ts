import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export default withAuth(
  async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    // const token = request.nextauth.token;
    const token = await getToken({ req: request });

    // Allow access to public routes
    if (
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/auth') ||
      pathname === '/' ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon') ||
      pathname.startsWith('/images') ||
      pathname.startsWith('/icons')
    ) {
      return NextResponse.next();
    }

    // Redirect unauthenticated users to sign in
    if (!token) {
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Check if user has required permissions for certain routes
    const userRole = token.role as string;
    const userId = token.sub as string;

    // Admin-only routes
    if (pathname.startsWith('/admin')) {
      if (userRole !== 'system_admin') {
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }
    }

    // Customer routes - require homeowner or ISP role
    if (pathname.startsWith('/dashboard') || 
        pathname.startsWith('/routers') || 
        pathname.startsWith('/users') ||
        pathname.startsWith('/vouchers') ||
        pathname.startsWith('/payments') ||
        pathname.startsWith('/settings') ||
        pathname.startsWith('/support')) {
      
      if (!['homeowner', 'isp', 'system_admin'].includes(userRole)) {
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }
    }

    // API route protection
    if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth')) {
      // Validate API access
      if (!token) {
        return new NextResponse(
          JSON.stringify({ error: 'Authentication required' }),
          { 
            status: 401, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Rate limiting for API routes
    if (pathname.startsWith('/api')) {
      // Rate limiting logic would go here
      // For now, we'll let it pass through
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // Allow public routes
        if (
          pathname.startsWith('/api/auth') ||
          pathname.startsWith('/auth') ||
          pathname === '/' ||
          pathname.startsWith('/_next') ||
          pathname.startsWith('/favicon') ||
          pathname.startsWith('/images') ||
          pathname.startsWith('/icons') ||
          pathname === '/robots.txt' ||
          pathname === '/sitemap.xml'
        ) {
          return true;
        }

        // Require authentication for protected routes
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth.js routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, icons, etc.)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images|icons).*)',
  ],
};