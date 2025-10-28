import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { CommissionTracker } from '@/components/payments/commission-tracker';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Commission Tracking - MikroTik Billing',
  description: 'Track your commission earnings and payout history',
};

export default async function CommissionPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <a href="/payments">
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Commission Tracking</h1>
          <p className="text-muted-foreground mt-1">
            Monitor your commission earnings and payout schedule
          </p>
        </div>
      </div>

      {/* Commission Tracker */}
      <CommissionTracker />
    </div>
  );
}