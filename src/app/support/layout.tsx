import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support - MikroTik Customer Portal',
  description: 'Get help and support for your MikroTik setup',
};

export default async function SupportLayout({
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
        <h1 className="text-3xl font-bold text-gray-900">Support</h1>
        <p className="text-gray-600 mt-2">
          Get help and support for your MikroTik setup
        </p>
      </div>
      {children}
    </DashboardLayout>
  );
}