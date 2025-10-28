import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { TicketDetails } from '@/components/support/ticket-details';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface TicketPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: TicketPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Ticket ${id} - MikroTik Billing`,
    description: 'View and respond to your support ticket',
  };
}

export default async function TicketPage({ params }: TicketPageProps) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <a href="/support/tickets">
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Ticket #{id}</h1>
          <p className="text-muted-foreground mt-1">
            View ticket details and communication history
          </p>
        </div>
      </div>

      {/* Ticket Details */}
      <TicketDetails ticketId={id} />
    </div>
  );
}
