import { withAuth } from 'next-auth/middleware';

export default withAuth(
  {
    pages: {
      signIn: '/signin',
    },
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to home page
        if (req.nextUrl.pathname === '/') return true;

        // Require authentication for all other pages
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (auth API routes)
     * - api/webhooks (webhook endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|api/webhooks|_next/static|_next/image|favicon.ico).*)',
  ],
};