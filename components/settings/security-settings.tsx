"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Smartphone,
  Mail,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Trash2,
  Monitor,
  MapPin,
  Clock,
  Plus,
  X,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

const RESEND_COOLDOWN_SEC = 60;

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+254${digits.slice(1)}`;
  if (digits.length === 9) return `+254${digits}`;
  return null;
}

// ── Phone OTP Management ─────────────────────────────────────────────────────

function PhoneOtpSection() {
  const [hasPhone, setHasPhone] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [requestId, setRequestId] = useState('');
  const [otp, setOtp] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const [isRemoving, setIsRemoving] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  useEffect(() => {
    fetchPhoneStatus();
  }, []);

  const fetchPhoneStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/user/phone');
      if (res.ok) {
        const data = await res.json();
        setHasPhone(data.hasOtpPhone);
        setMaskedPhone(data.maskedPhone);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleSendOtp = async () => {
    const normalized = normalizePhone(phone);
    if (!normalized) { toast.error('Invalid phone number'); return; }

    setIsSending(true);
    try {
      const res = await fetch('/api/user/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Could not send code'); return; }
      setRequestId(data.requestId);
      setStep('otp');
      setOtp('');
      startCooldown();
      toast.success('Verification code sent!');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{6}$/.test(otp)) { toast.error('Enter the 6-digit code'); return; }
    setIsVerifying(true);
    try {
      const res = await fetch('/api/user/phone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, otp }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Verification failed'); return; }
      toast.success('Phone number verified and saved!');
      setDialogOpen(false);
      setStep('phone');
      setPhone('');
      fetchPhoneStatus();
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRemovePhone = async () => {
    setIsRemoving(true);
    try {
      const res = await fetch('/api/user/phone', { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to remove phone number'); return; }
      toast.success('Phone number removed. SMS sign-in disabled.');
      setRemoveDialogOpen(false);
      fetchPhoneStatus();
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setIsRemoving(false);
    }
  };

  const openAddDialog = () => {
    setStep('phone');
    setPhone('');
    setOtp('');
    setRequestId('');
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <Smartphone className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">SMS OTP</p>
            {hasPhone && maskedPhone ? (
              <p className="text-sm text-muted-foreground">Phone: {maskedPhone}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Not configured</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasPhone ? (
            <Badge variant="default" className="text-xs">Active</Badge>
          ) : (
            <Badge variant="outline" className="text-xs">Not set up</Badge>
          )}
          <Button variant="outline" size="sm" onClick={openAddDialog}>
            {hasPhone ? 'Change' : <><Plus className="h-3 w-3 mr-1" />Add</>}
          </Button>
          {hasPhone && (
            <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Remove phone number</DialogTitle>
                  <DialogDescription>
                    This will disable SMS sign-in. You can always add it back later.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleRemovePhone} disabled={isRemoving}>
                    {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Add/Change Phone Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setStep('phone'); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{hasPhone ? 'Change phone number' : 'Add phone number'}</DialogTitle>
            <DialogDescription>
              {step === 'phone'
                ? 'Enter your Kenyan mobile number. We\'ll send a 6-digit verification code.'
                : 'Enter the 6-digit code sent to your phone.'}
            </DialogDescription>
          </DialogHeader>

          {step === 'phone' ? (
            <div className="space-y-4">
              <Input
                type="tel"
                placeholder="Phone number (e.g. 0712 345 678)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSendOtp} disabled={isSending || !phone.trim()}>
                  {isSending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</> : 'Send Code'}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="p-0 h-auto" onClick={() => setStep('phone')}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Change number
                </Button>
              </div>
              <Input
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={handleSendOtp}
                disabled={isSending || resendCooldown > 0}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </Button>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleVerifyOtp} disabled={isVerifying || otp.length !== 6}>
                  {isVerifying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying…</> : 'Verify & Save'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export const SecuritySettings: React.FC = () => {
  const { data: session } = useSession();
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [isSmsAvailable, setIsSmsAvailable] = useState(false);

  useEffect(() => {
    // Fetch connected providers from profile API
    fetch('/api/user/profile')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.connectedProviders) setConnectedProviders(data.connectedProviders);
      })
      .catch(() => {});

    // Check if SMS OTP is configured on the platform
    fetch('/api/auth/providers')
      .then((r) => r.ok ? r.json() : null)
      .then((providers) => {
        if (providers?.['phone-otp']) setIsSmsAvailable(true);
      })
      .catch(() => {});
  }, []);

  const hasGoogle = connectedProviders.includes('google');
  const hasEmail = !!session?.user?.email;

  const formatRelativeTime = (date: Date): string => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    return `${days} day${days > 1 ? "s" : ""} ago`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Security Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your sign-in methods and account security</p>
      </div>

      {/* Sign-in Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Sign-in Methods
          </CardTitle>
          <CardDescription>
            Ways you can sign in to your account. Having multiple methods means you won't get locked out.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Google */}
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <div>
                <p className="font-medium">Google</p>
                {hasGoogle && (
                  <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
                )}
              </div>
            </div>
            <Badge variant={hasGoogle ? 'default' : 'outline'} className="text-xs">
              {hasGoogle ? 'Connected' : 'Not connected'}
            </Badge>
          </div>

          {/* Magic Link */}
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Magic Link (Email)</p>
                {hasEmail && (
                  <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
                )}
              </div>
            </div>
            <Badge variant={hasEmail ? 'default' : 'outline'} className="text-xs">
              {hasEmail ? 'Active' : 'No email'}
            </Badge>
          </div>

          {/* SMS OTP */}
          {isSmsAvailable ? (
            <PhoneOtpSection />
          ) : (
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4 opacity-50">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">SMS OTP</p>
                  <p className="text-sm text-muted-foreground">Not available on this platform</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">Unavailable</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions — placeholder (real data requires session store query) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Active Sessions
              </CardTitle>
              <CardDescription>
                Devices currently signed in to your account
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4 rounded-lg border p-4">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">Current session</p>
                <Badge variant="default" className="text-xs">Current</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {session?.user?.email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions for your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Delete Account</AlertTitle>
            <AlertDescription>
              Once you delete your account, there is no going back. All your routers, users,
              and data will be permanently deleted.
            </AlertDescription>
          </Alert>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Are you absolutely sure?</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete your account
                  and remove all your data from our servers.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type "DELETE" to confirm</label>
                <Input placeholder="DELETE" />
              </div>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button variant="destructive">Delete Account</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};
