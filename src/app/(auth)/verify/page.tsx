import { Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify Email - PAY N BROWSE',
  description: 'Check your email for the magic link to sign in',
};

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription className="text-base">
            We've sent you a magic link to sign in to your account.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground text-center">
            Didn't receive the email? Check your spam folder or try again.
          </p>

          <div className="flex justify-center">
            <Button variant="ghost" asChild>
              <Link href="/signin">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to sign in
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}