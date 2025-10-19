import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Routers - MikroTik Customer Portal',
  description: 'Manage your MikroTik routers and configurations',
};

export default async function RoutersLayout({
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
        <h1 className="text-3xl font-bold text-gray-900">Routers</h1>
        <p className="text-gray-600 mt-2">
          Manage your MikroTik routers and configurations
        </p>
      </div>
      {children}
    </DashboardLayout>
  );
}