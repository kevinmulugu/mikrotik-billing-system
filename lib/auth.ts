// lib/auth.ts
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
          // Custom email template
          async sendVerificationRequest({ identifier: email, url, provider }) {
            const { host } = new URL(url);
            const { createTransport } = await import('nodemailer');
            const transport = createTransport(provider.server);

            const result = await transport.sendMail({
              to: email,
              from: provider.from,
              subject: `Sign in to PAY N BROWSE`,
              text: text({ url, host }),
              html: html({ url, host, email }),
            });

            const failed = result.rejected.concat(result.pending).filter(Boolean);
            if (failed.length) {
              throw new Error(`Email(s) (${failed.join(', ')}) could not be sent`);
            }
          },
        }),
      ]
      : []),
  ],

  pages: {
    signIn: '/signin',
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account?.provider || !user.email) {
        return false;
      }

      const client = await clientPromise;
      const db = client.db();
      const usersCollection = db.collection('users');
      const { ObjectId } = await import('mongodb');

      // For Email provider: ONLY allow existing users (security: prevent account enumeration via magic link)
      if (account.provider === 'email') {
        // Check if user exists
        const existingUser = await usersCollection.findOne({
          email: user.email.toLowerCase()
        });

        if (!existingUser) {
          // User doesn't exist - reject sign in
          console.log(`[Auth] Sign-in rejected: User ${user.email} does not exist`);
          return false;
        }

        // User exists - allow sign in and activate if pending
        if (existingUser.status === 'pending') {
          await usersCollection.updateOne(
            { _id: existingUser._id },
            {
              $set: {
                status: 'active',
                emailVerified: new Date(),
                updatedAt: new Date()
              }
            }
          );
        }

        return true;
      }

      // For OAuth providers (Google): Check if user exists
      if (account.provider === 'google') {
        const existingUser = await usersCollection.findOne({
          email: user.email.toLowerCase()
        });

        if (!existingUser) {
          // User doesn't exist - reject to prevent account takeover
          console.log(`[Auth] OAuth sign-in rejected: User ${user.email} does not exist. They must sign up first.`);
          return '/signup?error=AccountNotFound&email=' + encodeURIComponent(user.email);
        }

        // User exists - allow sign in and set up business fields if missing
        const userId = existingUser._id;
        let needsSetup = !existingUser.role || !existingUser.businessInfo;

        if (needsSetup) {
          const updateFields: any = {
            updatedAt: new Date()
          };

          // Set role if missing
          if (!existingUser.role) {
            updateFields.role = 'homeowner';
            updateFields.status = 'active';
            updateFields.emailVerified = new Date();
            updateFields.preferences = {
              language: 'en',
              notifications: { email: true, sms: true, push: true },
              theme: 'system'
            };
            updateFields.metadata = {
              loginCount: 0,
              lastLogin: new Date()
            };
          }

          // Add business fields if missing
          if (!existingUser.businessInfo) {
            updateFields.businessInfo = {
              name: user.name ? `${user.name}'s WiFi` : 'My WiFi Business',
              type: 'homeowner',
              address: {
                street: '',
                city: '',
                county: '',
                country: 'Kenya',
                postalCode: ''
              },
              contact: {
                phone: '',
                email: user.email.toLowerCase()
              }
            };
            updateFields.paymentSettings = {
              preferredMethod: 'company_paybill',
              paybillNumber: null,
              accountNumber: null,
              commissionRate: 20,
              autoPayouts: true
            };
            updateFields.subscription = {
              plan: 'personal',
              status: 'active',
              startDate: new Date(),
              endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              features: ['single_router', 'basic_analytics', 'email_support']
            };
            updateFields.statistics = {
              totalRouters: 0,
              activeUsers: 0,
              totalRevenue: 0,
              monthlyRevenue: 0
            };
          }

          await usersCollection.updateOne(
            { _id: userId },
            { $set: updateFields }
          );
        }

        return true;
      }

      // Unknown provider
      return false;
    },

    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        session.user.role = user.role || 'homeowner';
        
        // Include business fields in session
        const userData = user as any;
        if (userData.businessInfo) {
          (session.user as any).businessInfo = userData.businessInfo;
        }
        if (userData.paymentSettings) {
          (session.user as any).paymentSettings = userData.paymentSettings;
        }
        if (userData.subscription) {
          (session.user as any).subscription = userData.subscription;
        }
        if (userData.statistics) {
          (session.user as any).statistics = userData.statistics;
        }
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

// Email template functions
function html({ url, host, email }: { url: string; host: string; email: string }) {
  const escapedEmail = email.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to PAY N BROWSE</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #ffffff;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 60px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          
          <!-- Logo/Brand -->
          <tr>
            <td style="padding: 0 0 32px 0; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #000000; letter-spacing: -0.5px;">
                PAY N BROWSE
              </h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 0;">
              <h2 style="margin: 0 0 16px 0; font-size: 21px; font-weight: 600; color: #000000; line-height: 1.3;">
                Sign in to your account
              </h2>
              
              <p style="margin: 0 0 32px 0; font-size: 17px; line-height: 1.5; color: #000000;">
                Click the button below to sign in to PAY N BROWSE.
              </p>

              <!-- Sign in Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 32px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 28px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 17px; font-weight: 500;">
                      Sign in
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback Link -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 32px 0;">
                <tr>
                  <td style="padding: 16px; background-color: #f5f5f7; border-radius: 8px;">
                    <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 1.4; color: #86868b;">
                      If the button doesn't work, copy and paste this link into your browser:
                    </p>
                    <p style="margin: 0; font-size: 13px; line-height: 1.4; color: #000000; word-break: break-all; font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;">
                      ${url}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 8px 0; font-size: 15px; line-height: 1.4; color: #86868b;">
                This link will expire in 24 hours.
              </p>

              <p style="margin: 0 0 32px 0; font-size: 15px; line-height: 1.4; color: #86868b;">
                If you didn't request this email, you can safely ignore it.
              </p>

              <!-- Divider -->
              <div style="border-top: 1px solid #d2d2d7; margin: 32px 0;"></div>

              <p style="margin: 0; font-size: 13px; line-height: 1.4; color: #86868b;">
                This email was sent to ${escapedEmail}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 0 0 0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #86868b;">
                © ${new Date().getFullYear()} PAY N BROWSE
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function text({ url, host }: { url: string; host: string }) {
  return `Sign in to PAY N BROWSE\n\nClick the link below to sign in:\n\n${url}\n\nThis link will expire in 24 hours.\n\nIf you didn't request this email, you can safely ignore it.\n\n© ${new Date().getFullYear()} PAY N BROWSE\n`;
}