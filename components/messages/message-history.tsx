// components/messages/message-history.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Users, Router, Clock } from 'lucide-react';

interface Message {
  id: string;
  recipientType: string;
  routerId?: string;
  routerName?: string | null;
  message: string;
  recipientCount: number;
  status: string;
  sentAt: Date;
}

interface MessageHistoryProps {
  messages: Message[];
}

export function MessageHistory({ messages }: MessageHistoryProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Message History
        </CardTitle>
        <CardDescription>
          View your recently sent messages (last 20)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No messages sent yet</p>
            <p className="text-sm">
              Messages you send will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className="flex flex-col gap-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {message.recipientType === 'all' ? (
                        <>
                          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium">All Customers</span>
                        </>
                      ) : (
                        <>
                          <Router className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium">{message.routerName}</span>
                        </>
                      )}
                      <Badge variant="secondary" className="ml-auto">
                        {message.recipientCount} recipient{message.recipientCount !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground break-words">{message.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(message.sentAt)}
                  </div>
                  <Badge
                    variant={message.status === 'sent' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {message.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
