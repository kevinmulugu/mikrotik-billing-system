import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { DollarSign, TrendingUp, Calendar } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Payments - Admin Panel',
};

const PAGE_SIZE = 20;

const fmt = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  minimumFractionDigits: 0,
});

const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (s) {
    case 'completed': return 'default';
    case 'pending': return 'secondary';
    case 'failed': return 'destructive';
    default: return 'outline';
  }
};

async function getPayments(page: number) {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [payments, total, totalAgg, todayAgg, monthAgg] = await Promise.all([
    db.collection('payments').aggregate([
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * PAGE_SIZE },
      { $limit: PAGE_SIZE },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { email: 1, name: 1 } }],
        },
      },
    ]).toArray(),

    db.collection('payments').countDocuments(),

    db.collection('payments').aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$transaction.amount' } } },
    ]).toArray(),

    db.collection('payments').aggregate([
      { $match: { status: 'completed', createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: '$transaction.amount' } } },
    ]).toArray(),

    db.collection('payments').aggregate([
      { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$transaction.amount' } } },
    ]).toArray(),
  ]);

  return {
    payments: payments.map((p) => ({
      id: p._id.toString(),
      amount: p.transaction?.amount ?? 0,
      type: p.type || 'voucher',
      status: p.status,
      txnId: p.transaction?.mpesaReceiptNumber || p.transaction?.transactionId || '-',
      email: p.user?.[0]?.email ?? 'Unknown',
      name: p.user?.[0]?.name ?? 'Unknown',
      createdAt: p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-KE') : 'N/A',
    })),
    total,
    pages: Math.ceil(total / PAGE_SIZE),
    totalRevenue: totalAgg[0]?.total ?? 0,
    todayRevenue: todayAgg[0]?.total ?? 0,
    monthRevenue: monthAgg[0]?.total ?? 0,
  };
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'system_admin') redirect('/dashboard');

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));

  const data = await getPayments(page);

  const stats = [
    { label: 'Total Revenue', value: fmt.format(data.totalRevenue), icon: DollarSign, color: 'text-green-600' },
    { label: 'Today', value: fmt.format(data.todayRevenue), icon: Calendar, color: 'text-blue-600' },
    { label: 'This Month', value: fmt.format(data.monthRevenue), icon: TrendingUp, color: 'text-purple-600' },
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
            All Payments{' '}
            <span className="text-muted-foreground font-normal text-sm">({data.total} total)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Customer</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">M-Pesa TxnID</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      No payments found
                    </td>
                  </tr>
                ) : (
                  data.payments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">{fmt.format(p.amount)}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{p.type}</td>
                      <td className="py-3 px-4">
                        <Badge variant={statusVariant(p.status)} className="text-xs">
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-muted-foreground">{p.txnId}</td>
                      <td className="py-3 px-4 text-right text-xs text-muted-foreground">{p.createdAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Page {page} of {data.pages} · {data.total} payments
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/payments?page=${page - 1}`}>Previous</Link>
                  </Button>
                )}
                {page < data.pages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/payments?page=${page + 1}`}>Next</Link>
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
