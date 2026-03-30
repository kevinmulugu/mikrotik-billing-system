import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Wifi,
  DollarSign,
  HelpCircle,
  MessageSquare,
  Shield,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Admin Overview - PAY N BROWSE',
};

const fmt = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  minimumFractionDigits: 0,
});

const roleBadgeVariant = (role: string) => {
  switch (role) {
    case 'system_admin': return 'destructive';
    case 'isp_pro': return 'default';
    case 'isp': return 'secondary';
    default: return 'outline';
  }
};

async function getAdminOverview() {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    usersByRole,
    routersByType,
    paymentAgg,
    openTickets,
    smsThisMonth,
    recentUsers,
    recentPayments,
  ] = await Promise.all([
    db.collection('users').aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]).toArray(),

    db.collection('routers').aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]).toArray(),

    db.collection('payments').aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$transaction.amount' }, count: { $sum: 1 } } },
    ]).toArray(),

    db.collection('tickets').countDocuments({ status: { $in: ['open', 'in_progress'] } }),

    db.collection('messages').countDocuments({ createdAt: { $gte: startOfMonth } }),

    db.collection('users')
      .find({}, { projection: { name: 1, email: 1, role: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),

    db.collection('payments').aggregate([
      { $match: { status: 'completed' } },
      { $sort: { createdAt: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { email: 1 } }],
        },
      },
    ]).toArray(),
  ]);

  const roleCounts = Object.fromEntries(usersByRole.map((r) => [r._id, r.count]));
  const routerCounts = Object.fromEntries(routersByType.map((r) => [r._id, r.count]));
  const totalUsers = usersByRole.reduce((s, r) => s + r.count, 0);
  const totalRouters = routersByType.reduce((s, r) => s + r.count, 0);
  const totalRevenue = paymentAgg[0]?.total ?? 0;
  const totalPayments = paymentAgg[0]?.count ?? 0;

  return {
    totalUsers,
    roleCounts,
    totalRouters,
    routerCounts,
    totalRevenue,
    totalPayments,
    openTickets,
    smsThisMonth,
    recentUsers: recentUsers.map((u) => ({
      id: u._id.toString(),
      name: u.name || 'Unknown',
      email: u.email,
      role: u.role || 'homeowner',
      createdAt: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-KE') : 'N/A',
    })),
    recentPayments: recentPayments.map((p) => ({
      id: p._id.toString(),
      amount: p.transaction?.amount ?? 0,
      status: p.status,
      email: p.user?.[0]?.email ?? 'Unknown',
      createdAt: p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-KE') : 'N/A',
    })),
  };
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'system_admin') redirect('/dashboard');

  const data = await getAdminOverview();

  const stats = [
    {
      label: 'Total Users',
      value: data.totalUsers,
      sub: `${data.roleCounts['isp'] ?? 0} ISP · ${data.roleCounts['isp_pro'] ?? 0} ISP Pro · ${data.roleCounts['homeowner'] ?? 0} Homeowner`,
      icon: Users,
      color: 'text-blue-600',
    },
    {
      label: 'Total Routers',
      value: data.totalRouters,
      sub: `${data.routerCounts['mikrotik'] ?? 0} MikroTik · ${data.routerCounts['unifi'] ?? 0} UniFi`,
      icon: Wifi,
      color: 'text-green-600',
    },
    {
      label: 'Total Revenue',
      value: fmt.format(data.totalRevenue),
      sub: `${data.totalPayments} completed payments`,
      icon: DollarSign,
      color: 'text-emerald-600',
    },
    {
      label: 'Open Tickets',
      value: data.openTickets,
      sub: 'Open + in progress',
      icon: HelpCircle,
      color: 'text-orange-600',
    },
    {
      label: 'SMS This Month',
      value: data.smsThisMonth,
      sub: 'Messages sent',
      icon: MessageSquare,
      color: 'text-purple-600',
    },
    {
      label: 'Admin Accounts',
      value: data.roleCounts['system_admin'] ?? 1,
      sub: 'System administrators',
      icon: Shield,
      color: 'text-red-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-semibold mt-1">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
                </div>
                <s.icon className={`h-5 w-5 ${s.color} shrink-0 mt-0.5`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent users */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Users</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Name</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Role</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentUsers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 px-4 text-center text-muted-foreground">No users yet</td>
                    </tr>
                  ) : (
                    data.recentUsers.map((u) => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-4">
                          <p className="font-medium truncate max-w-[120px]">{u.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[120px]">{u.email}</p>
                        </td>
                        <td className="py-2 px-4">
                          <Badge variant={roleBadgeVariant(u.role)} className="text-xs">
                            {u.role}
                          </Badge>
                        </td>
                        <td className="py-2 px-4 text-right text-muted-foreground text-xs">{u.createdAt}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent payments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Customer</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Amount</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentPayments.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 px-4 text-center text-muted-foreground">No payments yet</td>
                    </tr>
                  ) : (
                    data.recentPayments.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-4 text-muted-foreground text-xs truncate max-w-[140px]">{p.email}</td>
                        <td className="py-2 px-4 text-right font-medium">{fmt.format(p.amount)}</td>
                        <td className="py-2 px-4 text-right text-muted-foreground text-xs">{p.createdAt}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
