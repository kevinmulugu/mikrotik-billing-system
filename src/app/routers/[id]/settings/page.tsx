// src/app/routers/[id]/settings/page.tsx
import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { RouterSettings } from '@/components/routers/router-settings';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface RouterSettingsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: RouterSettingsPageProps): Promise<Metadata> {
  return {
    title: `Router Settings - MikroTik Billing`,
    description: 'Configure your router settings, hotspot, and PPPoE',
  };
}

export default async function RouterSettingsPage({ params }: RouterSettingsPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  const { id } = await params;
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/routers/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Router Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure your router's network and service settings
          </p>
        </div>
      </div>

      {/* Settings Component */}
      <RouterSettings routerId={id} />
    </div>
  );
}