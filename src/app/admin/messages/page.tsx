import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { MessageSquare, CheckCircle, XCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Messages - Admin Panel',
};

const PAGE_SIZE = 20;

async function getMessages(page: number) {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [messages, total, totalSent, monthSent, failedCount] = await Promise.all([
    db.collection('messages')
      .find({}, {
        projection: {
          content: 1,
          message: 1,
          recipients: 1,
          recipientCount: 1,
          delivered: 1,
          failed: 1,
          status: 1,
          routerId: 1,
          createdAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .toArray(),

    db.collection('messages').countDocuments(),

    db.collection('messages').countDocuments(),

    db.collection('messages').countDocuments({ createdAt: { $gte: startOfMonth } }),

    db.collection('messages').countDocuments({ status: 'failed' }),
  ]);

  return {
    messages: messages.map((m) => ({
      id: m._id.toString(),
      preview: (m.content || m.message || '').toString().slice(0, 80),
      recipientCount: m.recipientCount ?? (Array.isArray(m.recipients) ? m.recipients.length : 1),
      delivered: m.delivered ?? 0,
      failed: m.failed ?? 0,
      status: m.status || 'sent',
      routerId: m.routerId ? m.routerId.toString() : null,
      sentAt: m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-KE') : 'N/A',
    })),
    total,
    pages: Math.ceil(total / PAGE_SIZE),
    stats: { totalSent, monthSent, failedCount },
  };
}

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'system_admin') redirect('/dashboard');

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));

  const data = await getMessages(page);

  const stats = [
    { label: 'Total Sent', value: data.stats.totalSent, icon: MessageSquare, color: 'text-blue-600' },
    { label: 'This Month', value: data.stats.monthSent, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Failed', value: data.stats.failedCount, icon: XCircle, color: 'text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-semibold mt-1">{s.value}</p>
                </div>
                <s.icon className={`h-5 w-5 ${s.color} shrink-0 mt-0.5`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            SMS Messages{' '}
            <span className="text-muted-foreground font-normal text-sm">({data.total} total)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Message Preview</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Recipients</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Delivered</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Failed</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Sent At</th>
                </tr>
              </thead>
              <tbody>
                {data.messages.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      No messages found
                    </td>
                  </tr>
                ) : (
                  data.messages.map((m) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4 max-w-[300px]">
                        <p className="text-xs text-muted-foreground truncate">{m.preview || '—'}</p>
                      </td>
                      <td className="py-3 px-4 text-center">{m.recipientCount}</td>
                      <td className="py-3 px-4 text-center text-green-600">{m.delivered}</td>
                      <td className="py-3 px-4 text-center text-red-600">{m.failed}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={m.status === 'failed' ? 'destructive' : m.status === 'sent' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {m.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-muted-foreground">{m.sentAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Page {page} of {data.pages} · {data.total} messages
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/messages?page=${page - 1}`}>Previous</Link>
                  </Button>
                )}
                {page < data.pages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/messages?page=${page + 1}`}>Next</Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
