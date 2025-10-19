import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AddPPPoEUserForm } from '@/components/users/add-pppoe-user-form';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface AddPPPoEUserPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: AddPPPoEUserPageProps): Promise<Metadata> {
  return {
    title: `Add PPPoE User - MikroTik Billing`,
    description: 'Create a new PPPoE user account',
  };
}

export default async function AddPPPoEUserPage({ params }: AddPPPoEUserPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  const { id } = await params;
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <a href={`/routers/${id}/users/pppoe`}>
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add PPPoE User</h1>
          <p className="text-gray-600 mt-1">
            Create a new PPPoE user account with billing settings
          </p>
        </div>
      </div>

      {/* Add User Form */}
      <AddPPPoEUserForm routerId={id} />
    </div>
  );
}