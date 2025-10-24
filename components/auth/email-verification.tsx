"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ArrowRight,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface EmailVerificationProps {
  email?: string;
  token?: string;
  onSuccess?: () => void;
  onResendSuccess?: () => void;
}

type VerificationStatus = "idle" | "verifying" | "success" | "error" | "expired";

export const EmailVerification: React.FC<EmailVerificationProps> = ({
  email: propEmail,
  token: propToken,
  onSuccess,
  onResendSuccess,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [status, setStatus] = useState<VerificationStatus>("idle");
  const [email, setEmail] = useState(propEmail || "");
  const [token] = useState(propToken || searchParams?.get("token") || "");
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Auto-verify if token is present
    if (token && status === "idle") {
      handleVerifyToken();
    }
  }, [token]);

  useEffect(() => {
    // Countdown timer for resend button
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [countdown]);

  const handleVerifyToken = async () => {
    setStatus("verifying");
    setErrorMessage("");

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        toast.success("Email verified successfully!");
        
        // Redirect after 3 seconds
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          } else {
            router.push("/dashboard");
          }
        }, 3000);
      } else {
        if (data.error === "TOKEN_EXPIRED") {
          setStatus("expired");
          setErrorMessage("Verification link has expired. Please request a new one.");
        } else {
          setStatus("error");
          setErrorMessage(data.error || "Verification failed. Please try again.");
        }
        toast.error("Verification failed");
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage("An unexpected error occurred. Please try again.");
      toast.error("Verification failed");
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsResending(true);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        toast.success("Verification email sent! Please check your inbox.");
        setCountdown(60); // 60 second cooldown
        if (onResendSuccess) {
          onResendSuccess();
        }
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to send verification email");
      }
    } catch (error) {
      toast.error("Failed to send verification email");
    } finally {
      setIsResending(false);
    }
  };

  const handleSignIn = () => {
    router.push("/signin");
  };

  // Verifying state
  if (status === "verifying") {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="rounded-full bg-primary/10 p-4">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">Verifying your email...</h3>
                <p className="text-sm text-muted-foreground">
                  Please wait while we verify your email address
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (status === "success") {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="rounded-full bg-green-500/10 p-4">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">Email Verified!</h3>
                <p className="text-sm text-muted-foreground">
                  Your email has been successfully verified. Redirecting to dashboard...
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Redirecting in 3 seconds</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error or Expired state
  if (status === "error" || status === "expired") {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardHeader>
            <div className="flex flex-col items-center space-y-2">
              <div className="rounded-full bg-red-500/10 p-4">
                {status === "expired" ? (
                  <Clock className="h-12 w-12 text-red-500" />
                ) : (
                  <XCircle className="h-12 w-12 text-red-500" />
                )}
              </div>
              <CardTitle className="text-center">
                {status === "expired" ? "Link Expired" : "Verification Failed"}
              </CardTitle>
              <CardDescription className="text-center">
                {errorMessage || "We couldn't verify your email address"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>What happened?</AlertTitle>
              <AlertDescription>
                {status === "expired"
                  ? "Your verification link has expired. Verification links are valid for 24 hours."
                  : "The verification link may be invalid or has already been used."}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isResending || countdown > 0}
              />
            </div>

            <Button
              onClick={handleResendVerification}
              disabled={isResending || countdown > 0}
              className="w-full"
            >
              {isResending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : countdown > 0 ? (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Resend in {countdown}s
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Resend Verification Email
                </>
              )}
            </Button>

            <div className="text-center pt-4">
              <Button variant="outline" onClick={handleSignIn} className="w-full">
                Back to Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Idle state - No token provided
  return (
    <div className="w-full max-w-md mx-auto">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-col items-center space-y-2">
            <div className="rounded-full bg-blue-500/10 p-4">
              <Mail className="h-12 w-12 text-blue-500" />
            </div>
            <CardTitle className="text-center">Verify Your Email</CardTitle>
            <CardDescription className="text-center">
              We've sent a verification link to your email address
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertTitle>Check your inbox</AlertTitle>
            <AlertDescription>
              Click the verification link in the email we sent you. The link expires in 24 hours.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">Didn't receive the email?</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Check your spam or junk folder</li>
                <li>Make sure you entered the correct email address</li>
                <li>Wait a few minutes for the email to arrive</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isResending || countdown > 0}
              />
            </div>

            <Button
              onClick={handleResendVerification}
              disabled={isResending || countdown > 0}
              className="w-full"
              variant="outline"
            >
              {isResending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : countdown > 0 ? (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Resend in {countdown}s
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Resend Verification Email
                </>
              )}
            </Button>
          </div>

          <div className="text-center pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-3">
              Already verified your email?
            </p>
            <Button onClick={handleSignIn} className="w-full">
              Continue to Sign In
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};