'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface Ticket {
  _id: string;
  ticket: {
    title: string;
    description: string;
    category: string;
    priority: string;
    type: string;
  };
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
  createdAt: Date | string;
  updatedAt: Date | string;
  sla?: {
    breachedSla: boolean;
  };
}

interface RecentSupportTicketsProps {
  tickets: Ticket[];
}

const getStatusVariant = (status: string): BadgeProps['variant'] => {
  switch (status) {
    case 'open':
      return 'destructive';
    case 'in_progress':
      return 'default';
    case 'waiting_customer':
      return 'outline';
    case 'resolved':
    case 'closed':
      return 'secondary';
    default:
      return 'outline';
  }
};

const getPriorityColor = (priority: string): string => {
  switch (priority.toLowerCase()) {
    case 'urgent':
    case 'high':
      return 'border-red-500 text-red-600';
    case 'medium':
      return 'border-yellow-500 text-yellow-600';
    case 'low':
      return 'border-green-500 text-green-600';
    default:
      return 'border-gray-500 text-gray-600';
  }
};

const formatRelativeTime = (date: Date | string): string => {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch (error) {
    return 'Unknown';
  }
};

export function RecentSupportTickets({ tickets }: RecentSupportTicketsProps) {
  // Show only the 3 most recent tickets
  const recentTickets = tickets.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Recent Support Tickets</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <a href="/support/tickets">View All</a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {recentTickets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No support tickets yet</p>
            <p className="text-sm mt-1">Create your first ticket to get help from our support team</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentTickets.map((ticket) => (
              <div 
                key={ticket._id} 
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="font-medium truncate">{ticket.ticket.title}</h3>
                    <Badge variant={getStatusVariant(ticket.status)}>
                      {ticket.status.replace('_', ' ')}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={getPriorityColor(ticket.ticket.priority)}
                    >
                      {ticket.ticket.priority}
                    </Badge>
                    {ticket.sla?.breachedSla && (
                      <Badge variant="destructive" className="text-xs">
                        SLA Breached
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <span className="truncate">{ticket.ticket.category}</span>
                    <span>{formatRelativeTime(ticket.createdAt)}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild className="ml-4 flex-shrink-0">
                  <a href={`/support/tickets/${ticket._id}`}>View</a>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
