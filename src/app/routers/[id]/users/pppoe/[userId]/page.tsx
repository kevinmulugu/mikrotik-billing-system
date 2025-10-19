import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { PPPoEUserDetails } from '@/components/users/pppoe-user-details';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface PPPoEUserPageProps {
  params: Promise<{
    id: string;
    userId: string;
  }>;
}

export async function generateMetadata({ params }: PPPoEUserPageProps): Promise<Metadata> {
  const { userId } = await params;
  return {
    title: `PPPoE User ${userId} - MikroTik Billing`,
    description: 'View and manage PPPoE user details',
  };
}

export default async function PPPoEUserPage({ params }: PPPoEUserPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }
  const { id, userId } = await params;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <a href={`/routers/${id}/users/pppoe`}>
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">PPPoE User Details</h1>
          <p className="text-gray-600 mt-1">
            Manage user account, billing, and usage
          </p>
        </div>
        
        <Button variant="outline" asChild>
          <a href={`/routers/${id}/users/pppoe/${userId}/edit`}>
            Edit User
          </a>
        </Button>
      </div>

      {/* User Details */}
      <PPPoEUserDetails routerId={id} userId={userId} />
    </div>
  );
}