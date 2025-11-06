// src/app/sms-credits/layout.tsx
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SMS Credits - MikroTik Billing',
  description: 'Purchase SMS credits to send notifications to your customers',
};

export default async function SMSCreditsLayout({
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
        <h1 className="text-3xl font-bold text-foreground">SMS Credits</h1>
        <p className="text-muted-foreground mt-2">
          Purchase and manage SMS credits for customer notifications
        </p>
      </div>
      {children}
    </DashboardLayout>
  );
}
