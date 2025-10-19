import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { HotspotUserTable } from '@/components/users/hotspot-user-table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Wifi } from 'lucide-react';

interface HotspotUsersPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: HotspotUsersPageProps): Promise<Metadata> {
  return {
    title: `Hotspot Users - MikroTik Billing`,
    description: 'Manage hotspot users and voucher sessions',
  };
}

export default async function HotspotUsersPage({ params }: HotspotUsersPageProps) {
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
          <a href={`/routers/${id}/users`}>
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wifi className="h-6 w-6 text-blue-600" />
            Hotspot Users
          </h1>
          <p className="text-gray-600 mt-1">
            Active voucher sessions and hotspot connections
          </p>
        </div>
        
        <Button asChild>
          <a href={`/routers/${id}/vouchers/generate`}>
            Generate Vouchers
          </a>
        </Button>
      </div>

      {/* Hotspot Users Table */}
      <HotspotUserTable routerId={id} />
    </div>
  );
}