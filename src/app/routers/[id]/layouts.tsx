import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

interface RouterLayoutProps {
  children: React.ReactNode;
  params: {
    id: string;
  };
}

export default async function RouterLayout({ children, params }: RouterLayoutProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  );
}