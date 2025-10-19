import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { TicketList } from '@/components/support/ticket-list';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Support Tickets - MikroTik Billing',
  description: 'View and manage your support tickets',
};

export default async function TicketsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <a href="/support">
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
          <p className="text-gray-600 mt-1">
            Track and manage your support requests
          </p>
        </div>
        
        <Button asChild>
          <a href="/support/tickets/create">
            <Plus className="h-4 w-4 mr-2" />
            Create Ticket
          </a>
        </Button>
      </div>

      {/* Tickets List */}
      <TicketList />
    </div>
  );
}