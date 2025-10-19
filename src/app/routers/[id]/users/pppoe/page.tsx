import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { PPPoEUserTable } from '@/components/users/pppoe-user-table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Globe, UserPlus } from 'lucide-react';

interface PPPoEUsersPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: PPPoEUsersPageProps): Promise<Metadata> {
  return {
    title: `PPPoE Users - MikroTik Billing`,
    description: 'Manage PPPoE user accounts and subscriptions',
  };
}

export default async function PPPoEUsersPage({ params }: PPPoEUsersPageProps) {
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
            <Globe className="h-6 w-6 text-purple-600" />
            PPPoE Users
          </h1>
          <p className="text-gray-600 mt-1">
            Manage PPPoE user accounts and monthly subscriptions
          </p>
        </div>
        
        <Button asChild>
          <a href={`/routers/${id}/users/pppoe/add`}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </a>
        </Button>
      </div>

      {/* PPPoE Users Table */}
      <PPPoEUserTable routerId={id} />
    </div>
  );
}