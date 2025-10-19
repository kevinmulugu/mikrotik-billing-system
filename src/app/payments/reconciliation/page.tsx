import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { ReconciliationTool } from '@/components/payments/reconciliation-tool';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Payment Reconciliation - MikroTik Billing',
  description: 'Match payments with transactions and resolve discrepancies',
};

export default async function ReconciliationPage() {
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
          <h1 className="text-2xl font-bold text-gray-900">Payment Reconciliation</h1>
          <p className="text-gray-600 mt-1">
            Match M-Pesa payments with voucher sales and PPPoE payments
          </p>
        </div>
      </div>

      {/* Reconciliation Tool */}
      <ReconciliationTool />
    </div>
  );
}