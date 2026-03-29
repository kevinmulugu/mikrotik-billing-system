import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Commission - PAY N BROWSE',
  description: 'View your platform commission breakdown and net earnings',
};

export default async function CommissionLayout({
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
        <h1 className="text-3xl font-bold text-foreground">Commission</h1>
        <p className="text-muted-foreground mt-2">
          Platform fee breakdown and your net earnings
        </p>
      </div>
      {children}
    </DashboardLayout>
  );
}
