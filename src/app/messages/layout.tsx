import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Messages - PAY N BROWSE',
  description: 'Send campaign and advisory messages to your customers',
};

export default async function MessagesLayout({
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
        <h1 className="text-3xl font-bold text-foreground">Customer Messaging</h1>
        <p className="text-muted-foreground mt-2">
          Send campaign and advisory messages to your WiFi customers
        </p>
      </div>
      {children}
    </DashboardLayout>
  );
}
