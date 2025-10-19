import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { PaymentHistory } from '@/components/payments/payment-history';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Payment History - MikroTik Billing',
  description: 'View complete transaction history and export reports',
};

export default async function PaymentHistoryPage() {
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
          <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
          <p className="text-gray-600 mt-1">
            Complete transaction history and financial reports
          </p>
        </div>
        
        <Button variant="outline">
          Export Report
        </Button>
      </div>

      {/* Payment History Table */}
      <PaymentHistory />
    </div>
  );
}
