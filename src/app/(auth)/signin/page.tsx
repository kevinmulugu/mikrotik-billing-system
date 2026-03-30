// src/app/(auth)/signin/page.tsx
'use client';

import { signIn } from 'next-auth/react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Mail, Smartphone, XCircle, ArrowLeft, RefreshCw } from 'lucide-react';

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  AccountSuspended: {
    title: 'Account suspended',
    description: 'Your account has been suspended. Please contact support for assistance.',
  },
  OAuthAccountNotLinked: {
    title: 'Email already in use',
    description: 'This email is linked to a different sign-in method. Try another provider.',
  },
  EmailSignin: {
    title: 'Could not send email',
    description: 'We could not send the magic link. Please try again.',
  },
  Default: {
    title: 'Sign-in failed',
    description: 'Something went wrong. Please try again later.',
  },
};

const RESEND_COOLDOWN_SEC = 60;

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [requestId, setRequestId] = useState('');
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [authConfig, setAuthConfig] = useState({ hasGoogle: false, hasEmail: false, hasOtp: false });
  const [configError, setConfigError] = useState(false);

  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  // Show error from URL ?error= param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get('error');
    if (!errorCode) return;

    const msg = ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES['Default']!;
    toast.error(msg.title, { description: msg.description, icon: <XCircle className="w-4 h-4" />, duration: 8000 });

    const clean = new URL(window.location.href);
    clean.searchParams.delete('error');
    window.history.replaceState({}, '', clean.toString());
  }, []);

  // Check available auth methods
  useEffect(() => {
    fetch('/api/auth/providers')
      .then((r) => r.ok ? r.json() : null)
      .then((providers) => {
        if (!providers) { setConfigError(true); return; }
        const hasGoogle = !!providers.google;
        const hasEmail = !!providers.email;
        const hasOtp = !!providers['phone-otp'];
        setAuthConfig({ hasGoogle, hasEmail, hasOtp });
        if (!hasGoogle && !hasEmail && !hasOtp) setConfigError(true);
      })
      .catch(() => setConfigError(true));
  }, []);

  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN_SEC);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { if (cooldownRef.current) clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLoading(true);
    try {
      const check = await fetch('/api/auth/signin-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const checkData = await check.json();

      if (!check.ok) {
        if (check.status === 404) {
          toast.error('Account not found', {
            description: 'No account exists with this email. Please sign up first.',
            action: { label: 'Sign Up', onClick: () => router.push('/signup') },
            icon: <XCircle className="w-4 h-4" />,
            duration: 6000,
          });
        } else if (check.status === 403 && checkData.error === 'AccountSuspended') {
          const msg = ERROR_MESSAGES['AccountSuspended']!;
          toast.error(msg.title, { description: msg.description, icon: <XCircle className="w-4 h-4" />, duration: 8000 });
        } else {
          toast.error('Sign-in failed', { description: checkData.error || 'Please try again later.', icon: <XCircle className="w-4 h-4" /> });
        }
        return;
      }

      const result = await signIn('email', { email, redirect: false, callbackUrl: '/dashboard' });
      if (result?.error || result?.ok === false) {
        toast.error('Could not send email', { description: 'Please try again or contact support.', icon: <XCircle className="w-4 h-4" /> });
      } else {
        toast.success('Check your email!', {
          description: "We've sent you a magic link to sign in.",
          icon: <Mail className="w-4 h-4" />,
          duration: 5000,
        });
      }
    } catch {
      toast.error('Something went wrong', { description: 'Please try again later.', icon: <XCircle className="w-4 h-4" /> });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleRequestOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!phone.trim()) return;
    setOtpLoading(true);
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not send code', { icon: <XCircle className="w-4 h-4" /> });
        return;
      }
      setRequestId(data.requestId);
      setOtpSent(true);
      setOtp('');
      startCooldown();
      toast.success('Code sent', {
        description: 'If this number is registered you will receive a 6-digit code.',
        icon: <Smartphone className="w-4 h-4" />,
        duration: 4000,
      });
    } catch {
      toast.error('Something went wrong', { description: 'Please try again later.' });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) { toast.error('Please enter the 6-digit code'); return; }
    setOtpLoading(true);
    try {
      const result = await signIn('phone-otp', {
        requestId,
        otp,
        redirect: false,
        callbackUrl: '/dashboard',
      });

      if (result?.error) {
        toast.error('Incorrect or expired code', {
          description: 'Please check the code and try again, or request a new one.',
          icon: <XCircle className="w-4 h-4" />,
        });
      } else if (result?.url) {
        router.push(result.url);
      }
    } catch {
      toast.error('Something went wrong', { description: 'Please try again later.' });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleGoogleSignIn = () => signIn('google', { callbackUrl: '/dashboard' });

  const methodCount = [authConfig.hasGoogle, authConfig.hasEmail, authConfig.hasOtp].filter(Boolean).length;

  const googleButton = authConfig.hasGoogle && (
    <Button onClick={handleGoogleSignIn} variant="outline" className="w-full" size="lg">
      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      Continue with Google
    </Button>
  );

  const emailForm = authConfig.hasEmail && (
    <form onSubmit={handleEmailSubmit} className="space-y-4">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
      />
      <Button type="submit" disabled={emailLoading} className="w-full" size="lg">
        {emailLoading ? 'Sending…' : 'Send Magic Link'}
      </Button>
    </form>
  );

  const otpForm = authConfig.hasOtp && (
    <div className="space-y-4">
      {!otpSent ? (
        <form onSubmit={handleRequestOtp} className="space-y-3">
          <Input
            type="tel"
            placeholder="Phone number (e.g. 0712 345 678)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Button type="submit" disabled={otpLoading} className="w-full" size="lg">
            {otpLoading ? 'Sending…' : 'Send Code'}
          </Button>
        </form>
      ) : (
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setOtpSent(false); setOtp(''); setRequestId(''); }}
            className="p-0 h-auto text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Change number
          </Button>
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <Input
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
            <Button type="submit" disabled={otpLoading} className="w-full" size="lg">
              {otpLoading ? 'Verifying…' : 'Sign In'}
            </Button>
          </form>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRequestOtp}
            disabled={otpLoading || resendCooldown > 0}
            className="w-full text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
          </Button>
        </div>
      )}
    </div>
  );

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
          {configError && (
            <Alert variant="destructive">
              <AlertDescription>
                Unable to sign in at this time. Please try again later or contact support.
              </AlertDescription>
            </Alert>
          )}

          {!configError && (
            <>
              {methodCount > 1 ? (
                <Tabs defaultValue={authConfig.hasGoogle ? 'google' : authConfig.hasEmail ? 'email' : 'phone'}>
                  <TabsList className="w-full">
                    {authConfig.hasGoogle && <TabsTrigger value="google" className="flex-1">Google</TabsTrigger>}
                    {authConfig.hasEmail && <TabsTrigger value="email" className="flex-1">Magic Link</TabsTrigger>}
                    {authConfig.hasOtp && <TabsTrigger value="phone" className="flex-1">Phone</TabsTrigger>}
                  </TabsList>
                  {authConfig.hasGoogle && <TabsContent value="google" className="mt-4">{googleButton}</TabsContent>}
                  {authConfig.hasEmail && <TabsContent value="email" className="mt-4">{emailForm}</TabsContent>}
                  {authConfig.hasOtp && <TabsContent value="phone" className="mt-4">{otpForm}</TabsContent>}
                </Tabs>
              ) : (
                <div className="space-y-4">
                  {googleButton}
                  {emailForm}
                  {otpForm}
                </div>
              )}
            </>
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
