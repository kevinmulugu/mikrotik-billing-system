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

export const metadata: Metadata = {
  title: 'Support - MikroTik Billing',
  description: 'Get help with your routers, payments, and technical issues',
};

export default async function SupportPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  // TODO: Fetch support data from API
  const supportStats = {
    openTickets: 2,
    resolvedTickets: 8,
    avgResponseTime: '4 hours',
    satisfaction: 4.8,
  };

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
                <p className="text-2xl font-semibold text-orange-600">{supportStats.openTickets}</p>
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
                <p className="text-2xl font-semibold text-green-600">{supportStats.resolvedTickets}</p>
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
                <p className="text-2xl font-semibold text-blue-600">{supportStats.avgResponseTime}</p>
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
                <p className="text-2xl font-semibold text-purple-600">{supportStats.satisfaction}/5</p>
              </div>
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={`h-4 w-4 ${i < Math.floor(supportStats.satisfaction) ? 'text-yellow-400' : 'text-gray-300'}`}
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
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" asChild>
          <a href="/support/tickets">
            <CardHeader className="text-center">
              <MessageSquare className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>Support Tickets</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                Get personalized help from our support team for technical issues
              </p>
              <Badge variant="secondary">
                {supportStats.openTickets} open tickets
              </Badge>
            </CardContent>
          </a>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" asChild>
          <a href="/support/knowledge-base">
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
          </a>
        </Card>

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
          <div className="space-y-4">
            {[
              {
                id: 'TK-001',
                title: 'Router not connecting to internet',
                status: 'open',
                priority: 'high',
                created: '2 hours ago',
                category: 'Technical'
              },
              {
                id: 'TK-002',
                title: 'Payment not reflecting in account',
                status: 'in_progress',
                priority: 'medium',
                created: '1 day ago',
                category: 'Billing'
              },
              {
                id: 'TK-003',
                title: 'How to generate bulk vouchers?',
                status: 'resolved',
                priority: 'low',
                created: '3 days ago',
                category: 'General'
              }
            ].map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium">{ticket.title}</h3>
                    <Badge
                      variant={
                        ticket.status === 'open' ? 'destructive' :
                          ticket.status === 'in_progress' ? 'default' : 'secondary'
                      }
                    >
                      {ticket.status.replace('_', ' ')}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        ticket.priority === 'high' ? 'border-red-500 text-red-600' :
                          ticket.priority === 'medium' ? 'border-yellow-500 text-yellow-600' :
                            'border-green-500 text-green-600'
                      }
                    >
                      {ticket.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>#{ticket.id}</span>
                    <span>{ticket.category}</span>
                    <span>{ticket.created}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/support/tickets/${ticket.id}`}>View</a>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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