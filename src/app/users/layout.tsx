import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Users - PAY N BROWSE',
  description: 'Manage your router users and connections',
};

export default async function UsersLayout({
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
        <h1 className="text-3xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground mt-2">
          Manage your router users and connections
        </p>
      </div>
      {children}
    </DashboardLayout>
  );
}