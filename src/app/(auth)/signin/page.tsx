'use client';

import { signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [authConfig, setAuthConfig] = useState({ hasGoogle: false, hasEmail: false });
  const router = useRouter();

  // Check available auth methods
  useEffect(() => {
    const checkAuthConfig = async () => {
      try {
        // Check what providers are available via API
        const response = await fetch('/api/auth/providers');
        const providers = await response.json();

        const hasGoogle = !!providers.google;
        const hasEmail = !!providers.email;

        setAuthConfig({ hasGoogle, hasEmail });
      } catch (error) {
        // Fallback to environment detection
        const hasGoogle = !!(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
        const hasEmail = !!(
          process.env.NEXT_PUBLIC_EMAIL_FROM &&
          process.env.NEXT_PUBLIC_EMAIL_SERVER_HOST
        );
        setAuthConfig({ hasGoogle, hasEmail });
      }
    };

    checkAuthConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authConfig.hasEmail) {
      setMessage('Email login is not configured. Please use Google sign-in.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const result = await signIn('email', {
        email,
        redirect: false,
        callbackUrl: '/dashboard',
      });

      if (result?.error) {
        setMessage('Error sending email. Please try again.');
      } else {
        setMessage('Check your email for the magic link!');
      }
    } catch (error) {
      setMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/dashboard' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-600 mt-2">Sign in to your MikroTik Portal</p>
        </div>

        {message && (
          <div className="mb-4 p-3 rounded bg-blue-50 text-blue-700 text-sm">
            {message}
          </div>
        )}

        {/* Show Google sign-in if available */}
        {authConfig.hasGoogle && (
          <button
            onClick={handleGoogleSignIn}
            className="w-full bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50 flex items-center justify-center mb-6"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>
        )}

        {/* Show divider only if both methods are available */}
        {authConfig.hasGoogle && authConfig.hasEmail && (
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or</span>
            </div>
          </div>
        )}

        {/* Show email form if available */}
        {authConfig.hasEmail && (
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Magic Link'}
            </button>
          </form>
        )}

        {/* Show message if no auth methods are configured */}
        {!authConfig.hasGoogle && !authConfig.hasEmail && (
          <div className="text-center p-4 bg-yellow-50 rounded-md">
            <p className="text-yellow-800 text-sm">
              Authentication is not configured. Please check your environment variables.
            </p>
          </div>
        )}

        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            New to MikroTik Portal?{' '}
            <button
              onClick={() => router.push('/signup')}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Create account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}