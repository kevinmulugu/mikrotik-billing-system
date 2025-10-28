'use client';

import { signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Mail, CheckCircle, XCircle } from 'lucide-react';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [authConfig, setAuthConfig] = useState({ hasGoogle: false, hasEmail: false });
  const [configError, setConfigError] = useState(false);
  const router = useRouter();

  // Check available auth methods
  useEffect(() => {
    const checkAuthConfig = async () => {
      try {
        // Check what providers are available via API
        const response = await fetch('/api/auth/providers');
        if (!response.ok) {
          throw new Error('Failed to fetch providers');
        }
        const providers = await response.json();

        const hasGoogle = !!providers.google;
        const hasEmail = !!providers.email;

        setAuthConfig({ hasGoogle, hasEmail });

        // If no providers are configured, log server-side and show generic error
        if (!hasGoogle && !hasEmail) {
          console.error('[Auth Config Error] No authentication providers configured');
          setConfigError(true);
        }
      } catch (error) {
        console.error('Failed to load auth providers:', error);
        // Log this error - in production, you'd want to send this to your monitoring service
        setConfigError(true);
        setAuthConfig({ hasGoogle: false, hasEmail: false });
      }
    };

    checkAuthConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authConfig.hasEmail) {
      toast.error('Email login is not configured', {
        description: 'Please use Google sign-in instead.',
      });
      return;
    }

    setLoading(true);

    try {
      const result = await signIn('email', {
        email,
        redirect: false,
        callbackUrl: '/dashboard',
      });

      if (result?.error || result?.ok === false) {
        // Account doesn't exist
        toast.error('Account not found', {
          description: 'No account exists with this email. Please sign up first.',
          action: {
            label: 'Sign Up',
            onClick: () => router.push('/signup'),
          },
          icon: <XCircle className="w-4 h-4" />,
          duration: 6000,
        });
      } else {
        toast.success('Check your email!', {
          description: 'We\'ve sent you a magic link to sign in.',
          icon: <Mail className="w-4 h-4" />,
          duration: 5000,
        });
      }
    } catch (error) {
      toast.error('Something went wrong', {
        description: 'Please try again later.',
        icon: <XCircle className="w-4 h-4" />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/dashboard' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold">Welcome Back</CardTitle>
          <CardDescription className="text-base">
            Sign in to your PAY N BROWSE Portal
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Show Google sign-in if available */}
          {authConfig.hasGoogle && (
            <Button
              onClick={handleGoogleSignIn}
              variant="outline"
              className="w-full"
              size="lg"
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
            </Button>
          )}

          {/* Show divider only if both methods are available */}
          {authConfig.hasGoogle && authConfig.hasEmail && (
            <div className="relative">
              <Separator />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-card px-2 text-sm text-muted-foreground">
                  Or
                </span>
              </div>
            </div>
          )}

          {/* Show email form if available */}
          {authConfig.hasEmail && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? 'Sending...' : 'Send Magic Link'}
              </Button>
            </form>
          )}

          {/* Show message if no auth methods are configured */}
          {configError && (
            <Alert variant="destructive">
              <AlertDescription>
                Unable to sign in at this time. Please try again later or contact support if the problem persists.
              </AlertDescription>
            </Alert>
          )}

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              New to PAY N BROWSE?{' '}
              <Button
                onClick={() => router.push('/signup')}
                variant="link"
                className="p-0 h-auto font-medium"
              >
                Create account
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}