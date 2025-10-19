// src/app/routers/[id]/vouchers/generate/page.tsx
import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { VoucherGenerator } from '@/components/vouchers/voucher-generator';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';

interface GenerateVouchersPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: GenerateVouchersPageProps): Promise<Metadata> {
  return {
    title: 'Generate Vouchers',
    description: 'Create new hotspot vouchers for sale',
  };
}

export default async function GenerateVouchersPage({ params }: GenerateVouchersPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  // Await params (Next.js 15 requirement)
  const { id: routerId } = await params;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/routers/${routerId}/vouchers`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Generate Vouchers</h1>
          <p className="text-muted-foreground mt-1">
            Create new hotspot vouchers with custom packages and pricing
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-100">Voucher Generation</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Generated vouchers will be immediately available for sale. 
              Choose your package type and quantity carefully as this affects your potential revenue.
            </p>
          </div>
        </div>
      </div>

      {/* Voucher Generator */}
      <VoucherGenerator routerId={routerId} />
    </div>
  );
}