import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Customers - PAY N BROWSE',
  description: 'Manage WiFi customers and their voucher purchases',
};

export default async function CustomersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">WiFi Customers</h1>
        <p className="text-muted-foreground mt-2">
          View and manage customers who purchased vouchers from your routers
        </p>
      </div>
      {children}
    </DashboardLayout>
  );
}