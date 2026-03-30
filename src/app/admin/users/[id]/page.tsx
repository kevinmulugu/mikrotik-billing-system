import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect, notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import AdminUserActions from '../AdminUserActions';

export const metadata: Metadata = {
  title: 'User Details - Admin Panel',
};

type RouteContext = { params: Promise<{ id: string }> };

const roleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (role) {
    case 'system_admin': return 'destructive';
    case 'isp_pro': return 'default';
    case 'isp': return 'secondary';
    default: return 'outline';
  }
};

async function getUserDetail(id: string) {
  if (!ObjectId.isValid(id)) return null;

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');
  const oid = new ObjectId(id);

  const [user, routers, recentTickets, recentPayments] = await Promise.all([
    db.collection('users').findOne(
      { _id: oid },
      {
        projection: {
          name: 1, email: 1, role: 1, status: 1, createdAt: 1,
          'subscription.plan': 1, 'businessInfo.businessName': 1,
          'smsCredits.balance': 1,
        },
      },
    ),
    db.collection('routers')
      .find({ userId: oid }, { projection: { 'routerInfo.name': 1, type: 1, 'health.status': 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray(),
    db.collection('tickets')
      .find({ userId: oid }, { projection: { 'ticket.title': 1, 'ticket.priority': 1, status: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
    db.collection('payments')
      .find({ userId: oid }, { projection: { 'transaction.amount': 1, status: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
  ]);

  if (!user) return null;

  return {
    user: {
      id: user._id.toString(),
      name: user.name || 'Unknown',
      email: user.email || '',
      role: user.role || 'homeowner',
      status: user.status || 'active',
      plan: user.subscription?.plan || 'individual',
      businessName: user.businessInfo?.businessName || '',
      smsCredits: user.smsCredits?.balance ?? 0,
      createdAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-KE', { dateStyle: 'medium' }) : 'N/A',
    },
    routers: routers.map((r) => ({
      id: r._id.toString(),
      name: r.routerInfo?.name || 'Unnamed Router',
      type: r.type || 'mikrotik',
      status: r.health?.status || 'unknown',
      createdAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-KE') : 'N/A',
    })),
    recentTickets: recentTickets.map((t) => ({
      id: t._id.toString(),
      title: t.ticket?.title || 'No subject',
      priority: t.ticket?.priority || 'medium',
      status: t.status || 'open',
      createdAt: t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-KE') : 'N/A',
    })),
    recentPayments: recentPayments.map((p) => ({
      id: p._id.toString(),
      amount: p.transaction?.amount ?? 0,
      status: p.status || 'pending',
      createdAt: p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-KE') : 'N/A',
    })),
  };
}

export default async function AdminUserDetailPage({ params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'system_admin') redirect('/dashboard');

  const { id } = await params;
  const data = await getUserDetail(id);
  if (!data) notFound();

  const { user, routers, recentTickets, recentPayments } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/users"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{user.name}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <AdminUserActions userId={user.id} currentRole={user.role} currentStatus={user.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: user info */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Role</span>
                <Badge variant={roleBadgeVariant(user.role)} className="text-xs">{user.role}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={user.status === 'suspended' ? 'destructive' : 'outline'} className="text-xs">
                  {user.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span>{user.plan}</span>
              </div>
              {user.businessName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Business</span>
                  <span className="text-right truncate max-w-[140px]">{user.businessName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">SMS credits</span>
                <span>{user.smsCredits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Joined</span>
                <span>{user.createdAt}</span>
              </div>
            </CardContent>
          </Card>

          {/* Routers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Routers ({routers.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {routers.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">No routers</p>
              ) : (
                <ul className="divide-y">
                  {routers.map((r) => (
                    <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div>
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.type} · {r.createdAt}</p>
                      </div>
                      <Badge
                        variant={r.status === 'online' ? 'default' : r.status === 'offline' ? 'destructive' : 'outline'}
                        className="text-xs"
                      >
                        {r.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: tickets + payments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent tickets */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent tickets</CardTitle>
              <Link
                href={`/admin/tickets?search=${encodeURIComponent(user.email)}`}
                className="text-xs text-muted-foreground hover:underline"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentTickets.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">No tickets</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">Subject</th>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">Priority</th>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTickets.map((t) => (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-4">
                          <Link href={`/admin/tickets/${t.id}`} className="hover:underline">
                            {t.title}
                          </Link>
                        </td>
                        <td className="py-2 px-4">
                          <Badge
                            variant={t.priority === 'urgent' || t.priority === 'high' ? 'destructive' : 'outline'}
                            className="text-xs"
                          >
                            {t.priority}
                          </Badge>
                        </td>
                        <td className="py-2 px-4">
                          <Badge variant="outline" className="text-xs">{t.status}</Badge>
                        </td>
                        <td className="py-2 px-4 text-muted-foreground text-xs">{t.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Recent payments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent payments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recentPayments.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">No payments</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">Amount</th>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-4 font-medium">KES {p.amount.toLocaleString()}</td>
                        <td className="py-2 px-4">
                          <Badge
                            variant={p.status === 'completed' ? 'default' : p.status === 'failed' ? 'destructive' : 'outline'}
                            className="text-xs"
                          >
                            {p.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-4 text-muted-foreground text-xs">{p.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
