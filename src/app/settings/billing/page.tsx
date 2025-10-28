import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { BillingSettings } from '@/components/settings/billing-settings';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Billing Settings - MikroTik Billing',
  description: 'Manage your payment methods and billing preferences',
};

export default async function BillingSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <a href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage payment methods, billing address, and commission settings
          </p>
        </div>
      </div>

      {/* Billing Settings */}
      <BillingSettings />
    </div>
  );
}