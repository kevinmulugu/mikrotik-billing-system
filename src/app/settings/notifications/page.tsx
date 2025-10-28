import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { NotificationSettings } from '@/components/settings/notification-settings';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Notification Settings - MikroTik Billing',
  description: 'Configure your notification preferences',
};

export default async function NotificationSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <a href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notification Settings</h1>
          <p className="text-muted-foreground mt-1">
            Choose how you want to receive updates and alerts
          </p>
        </div>
      </div>

      {/* Notification Settings */}
      <NotificationSettings />
    </div>
  );
}