import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { VoucherHistory } from '@/components/vouchers/voucher-history';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Download } from 'lucide-react';

interface VoucherHistoryPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: VoucherHistoryPageProps): Promise<Metadata> {
  return {
    title: `Voucher History - MikroTik Billing`,
    description: 'View voucher sales history and analytics',
  };
}

export default async function VoucherHistoryPage({ params }: VoucherHistoryPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  const { id } = await params;
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <a href={`/routers/${id}/vouchers`}>
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="h-6 w-6 text-blue-600" />
            Voucher History
          </h1>
          <p className="text-gray-600 mt-1">
            Track voucher sales, usage patterns, and revenue trends
          </p>
        </div>
        
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Voucher History Component */}
      <VoucherHistory routerId={id} />
    </div>
  );
}