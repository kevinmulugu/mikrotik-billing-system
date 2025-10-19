import { Inter, JetBrains_Mono } from 'next/font/google';

export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

// Font class names for use in components
export const fontSans = inter.variable;
export const fontMono = jetbrainsMono.variable;

// CSS custom properties for fonts
export const fontVariables = `${inter.variable} ${jetbrainsMono.variable}`;

// middleware.ts - NextAuth.js Route Protection
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Public routes that don't require authentication
    const publicRoutes = [
      '/',
      '/signin',
      '/signup',
      '/verify',
      '/terms',
      '/privacy',
      '/api/auth',
      '/api/webhooks',
      '/api/health',
    ];

    // Check if current path is public
    const isPublicRoute = publicRoutes.some(route => 
      pathname === route || pathname.startsWith(route + '/')
    );

    // Allow access to public routes
    if (isPublicRoute) {
      return NextResponse.next();
    }

    // Redirect unauthenticated users to signin
    if (!token) {
      const signInUrl = new URL('/signin', req.url);
      signInUrl.searchParams.set('callbackUrl', req.url);
      return NextResponse.redirect(signInUrl);
    }

    // Role-based access control
    const userRole = token.role as string;

    // Admin-only routes (if any in customer portal)
    const adminRoutes = ['/admin'];
    const isAdminRoute = adminRoutes.some(route => 
      pathname.startsWith(route)
    );

    if (isAdminRoute && userRole !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // ISP-specific features
    const ispRoutes = ['/advanced-analytics', '/multi-tenant'];
    const isIspRoute = ispRoutes.some(route => 
      pathname.startsWith(route)
    );

    if (isIspRoute && !['isp', 'business'].includes(userRole)) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // Always allow access to public routes
        const publicRoutes = [
          '/',
          '/signin',
          '/signup',
          '/verify',
          '/terms',
          '/privacy',
        ];

        if (publicRoutes.includes(pathname) || pathname.startsWith('/api/')) {
          return true;
        }

        // Require authentication for all other routes
        return !!token;
      },
    },
    pages: {
      signIn: '/signin',
      error: '/signin',
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};