import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { CreateTicketForm } from '@/components/support/create-ticket-form';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Create Ticket - MikroTik Billing',
  description: 'Submit a new support request',
};

export default async function CreateTicketPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <a href="/support/tickets">
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Support Ticket</h1>
          <p className="text-gray-600 mt-1">
            Describe your issue and we'll help you resolve it
          </p>
        </div>
      </div>

      {/* Create Ticket Form */}
      <CreateTicketForm />
    </div>
  );
}