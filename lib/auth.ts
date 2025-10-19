import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import EmailProvider from 'next-auth/providers/email';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise from './database';

// Check if email configuration is available
const isEmailConfigured = !!(
  process.env.EMAIL_SERVER_HOST &&
  process.env.EMAIL_FROM &&
  (
    // For development with MailDev (no auth required)
    process.env.EMAIL_SERVER_HOST === 'localhost' ||
    // For production SMTP (auth required)
    (process.env.EMAIL_SERVER_USER && process.env.EMAIL_SERVER_PASSWORD)
  )
);

// Check if Google OAuth is configured
const isGoogleConfigured = !!(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET
);

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),

  providers: [
    // Only include Google if configured
    ...(isGoogleConfigured
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),

    // Only include Email if configured
    ...(isEmailConfigured
      ? [
          EmailProvider({
            server: {
              host: process.env.EMAIL_SERVER_HOST!,
              port: parseInt(process.env.EMAIL_SERVER_PORT || '587'),
              auth: process.env.EMAIL_SERVER_USER && process.env.EMAIL_SERVER_PASSWORD
                ? {
                    user: process.env.EMAIL_SERVER_USER!,
                    pass: process.env.EMAIL_SERVER_PASSWORD!,
                  }
                : undefined,
              secure: process.env.SMTP_SECURE === 'true',
            },
            from: process.env.EMAIL_FROM!,
          }),
        ]
      : []),
  ],

  pages: {
    signIn: '/signin',
  },

  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        session.user.role = user.role || 'user';
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // After successful sign-in, redirect to dashboard
      if (url.includes('/api/auth/callback/email')) {
        return `${baseUrl}/dashboard`;
      }
      // Allow relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allow callback URLs on the same origin
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/dashboard`;
    },
  },

  debug: process.env.NODE_ENV === 'development',
};

// Export configuration status for UI components
export const authConfig = {
  hasGoogle: isGoogleConfigured,
  hasEmail: isEmailConfigured,
};