// src/app/payments/setup/page.tsx
import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { PaymentSetup } from '@/components/payments/payment-setup';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Payment Setup - MikroTik Billing',
  description: 'Configure your payment method and paybill settings',
};

export default async function PaymentSetupPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <a href="/payments">
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Setup</h1>
          <p className="text-muted-foreground mt-1">
            Choose how you want to receive payments from your customers
          </p>
        </div>
      </div>

      {/* Payment Setup Component */}
      <PaymentSetup />
    </div>
  );
}