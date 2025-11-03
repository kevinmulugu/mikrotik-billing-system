// src/app/support/page.tsx
import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  HelpCircle,
  MessageSquare,
  BookOpen,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  AlertTriangle,
  Plus
} from 'lucide-react';
import { RecentSupportTickets } from '@/components/support/recent-support-tickets';
import { TicketHelpers, toObjectId } from '@/lib/mongodb-helpers';

export const metadata: Metadata = {
  title: 'Support - MikroTik Billing',
  description: 'Get help with your routers, payments, and technical issues',
};

async function fetchSupportData(userId: string) {
  try {
    const ticketsCollection = await TicketHelpers.getCollection();

    // Build query for user's tickets
    const query = {
      userId: toObjectId(userId),
    };

    // Fetch tickets
    const tickets = await ticketsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(10) // Get last 10 tickets for stats
      .toArray();

    // Calculate statistics
    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      inProgress: tickets.filter(t => t.status === 'in_progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      breachedSla: tickets.filter(t => t.sla?.breachedSla).length,
    };

    return {
      tickets: JSON.parse(JSON.stringify(tickets)), // Serialize for client component
      stats,
    };
  } catch (error) {
    console.error('Error fetching support data:', error);
    return {
      tickets: [],
      stats: {
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0,
        breachedSla: 0,
      }
    };
  }
}

export default async function SupportPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  // Fetch real support data from API
  const supportData = await fetchSupportData(session.user.id);
  const stats = supportData.stats || {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    breachedSla: 0,
  };

  // Calculate average response time (placeholder - can be enhanced later)
  const avgResponseTime = stats.total > 0 ? '4 hours' : 'N/A';
  const satisfaction = 4.8; // This would come from a ratings system

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-blue-600" />
            Support Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Get help with your routers, payments, and technical questions
          </p>
        </div>

        <Button asChild>
          <a href="/support/tickets/create">
            <Plus className="h-4 w-4 mr-2" />
            Create Ticket
          </a>
        </Button>
      </div>

      {/* Support Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Tickets</p>
                <p className="text-2xl font-semibold text-orange-600">{stats.open}</p>
              </div>
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-semibold text-green-600">{stats.resolved}</p>
              </div>
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-semibold text-blue-600">{avgResponseTime}</p>
              </div>
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Satisfaction</p>
                <p className="text-2xl font-semibold text-purple-600">{satisfaction}/5</p>
              </div>
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={`h-4 w-4 ${i < Math.floor(satisfaction) ? 'text-yellow-400' : 'text-gray-300'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Help Options */}
      <div className="grid md:grid-cols-3 gap-6">
        <a href="/support/tickets">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="text-center">
              <MessageSquare className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>Support Tickets</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                Get personalized help from our support team for technical issues
              </p>
              <Badge variant="secondary">
                {stats.open} open tickets
              </Badge>
            </CardContent>
          </Card>
        </a>

        <a href="/support/knowledge-base">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="text-center">
              <BookOpen className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <CardTitle>Knowledge Base</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                Find answers to common questions and step-by-step guides
              </p>
              <Badge variant="secondary">
                50+ articles
              </Badge>
            </CardContent>
          </Card>
        </a>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <Phone className="h-12 w-12 text-purple-600 mx-auto mb-4" />
            <CardTitle>Contact Support</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Phone Support</p>
              <p className="font-medium">+254 700 000 000</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email Support</p>
              <p className="font-medium">support@mikrotikbilling.com</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tickets */}
      <RecentSupportTickets tickets={supportData.tickets || []} />

      {/* Common Issues */}
      <Card>
        <CardHeader>
          <CardTitle>Common Issues & Quick Fixes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                title: 'Router Offline',
                description: 'Check power connection and internet cables',
                icon: AlertTriangle,
                color: 'text-red-600'
              },
              {
                title: 'Voucher Not Working',
                description: 'Verify voucher code and expiry date',
                icon: HelpCircle,
                color: 'text-orange-600'
              },
              {
                title: 'Payment Issues',
                description: 'Check M-Pesa transaction status',
                icon: Mail,
                color: 'text-blue-600'
              },
              {
                title: 'User Cannot Connect',
                description: 'Reset user credentials or check bandwidth limits',
                icon: CheckCircle,
                color: 'text-green-600'
              }
            ].map((issue, index) => (
              <div key={index} className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg">
                <issue.icon className={`h-6 w-6 ${issue.color} mt-1`} />
                <div>
                  <h4 className="font-medium mb-1">{issue.title}</h4>
                  <p className="text-sm text-muted-foreground">{issue.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}