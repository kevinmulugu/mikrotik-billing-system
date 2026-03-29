// src/app/payments/page.tsx
import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { PaymentsList } from '@/components/payments/payments-list';
import { Card, CardContent } from '@/components/ui/card';
import { CreditCard, TrendingUp, CalendarDays, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Payments - MikroTik Billing',
  description: 'View payment transactions from your customers',
};

async function getPaymentStats(userId: string) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    const uid = new ObjectId(userId);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalResult, monthResult, todayResult, totalCount, completedCount] = await Promise.all([
      db
        .collection('payments')
        .aggregate([
          { $match: { userId: uid, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$transaction.amount' } } },
        ])
        .toArray(),
      db
        .collection('payments')
        .aggregate([
          { $match: { userId: uid, status: 'completed', createdAt: { $gte: startOfMonth } } },
          { $group: { _id: null, total: { $sum: '$transaction.amount' } } },
        ])
        .toArray(),
      db
        .collection('payments')
        .aggregate([
          { $match: { userId: uid, status: 'completed', createdAt: { $gte: startOfDay } } },
          { $group: { _id: null, total: { $sum: '$transaction.amount' } } },
        ])
        .toArray(),
      db.collection('payments').countDocuments({ userId: uid }),
      db.collection('payments').countDocuments({ userId: uid, status: 'completed' }),
    ]);

    return {
      totalRevenue: totalResult[0]?.total ?? 0,
      monthlyRevenue: monthResult[0]?.total ?? 0,
      todayRevenue: todayResult[0]?.total ?? 0,
      totalTransactions: totalCount,
      successRate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    };
  } catch {
    return {
      totalRevenue: 0,
      monthlyRevenue: 0,
      todayRevenue: 0,
      totalTransactions: 0,
      successRate: 0,
    };
  }
}

export default async function PaymentsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/signin');

  const stats = await getPaymentStats(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6" />
          Payments
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Transaction history from your customers
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-xl font-semibold mt-1">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stats.totalTransactions} transactions
                </p>
              </div>
              <CreditCard className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">This Month</p>
                <p className="text-xl font-semibold mt-1 text-blue-600">
                  {formatCurrency(stats.monthlyRevenue)}
                </p>
              </div>
              <TrendingUp className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Today</p>
                <p className="text-xl font-semibold mt-1 text-green-600">
                  {formatCurrency(stats.todayRevenue)}
                </p>
              </div>
              <CalendarDays className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Success Rate</p>
                <p className="text-xl font-semibold mt-1">{stats.successRate}%</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <PaymentsList />
    </div>
  );
}
