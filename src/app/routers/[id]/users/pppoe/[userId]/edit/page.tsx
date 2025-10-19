import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { EditPPPoEUserForm } from '@/components/users/edit-pppoe-user-form';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface EditPPPoEUserPageProps {
  params: Promise<{
    id: string;
    userId: string;
  }>;
}

export async function generateMetadata({ params }: EditPPPoEUserPageProps): Promise<Metadata> {
  return {
    title: `Edit PPPoE User - MikroTik Billing`,
    description: 'Edit PPPoE user account and settings',
  };
}

export default async function EditPPPoEUserPage({ params }: EditPPPoEUserPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  const { id, userId } = await params;
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <a href={`/routers/${id}/users/pppoe/${userId}`}>
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit PPPoE User</h1>
          <p className="text-gray-600 mt-1">
            Update user account information and settings
          </p>
        </div>
      </div>

      {/* Edit User Form */}
      <EditPPPoEUserForm routerId={id} userId={userId} />
    </div>
  );
}