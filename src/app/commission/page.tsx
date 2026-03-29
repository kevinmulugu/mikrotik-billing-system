// src/app/commission/page.tsx
import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import {
  Percent,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  Info,
  CreditCard,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Commission - MikroTik Billing',
  description: 'View your platform commission breakdown and earnings',
};

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

async function getCommissionData(userId: string) {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');
  const uid = new ObjectId(userId);

  const user = await db.collection('users').findOne({ _id: uid });
  if (!user) throw new Error('User not found');

  let plan: string = user.subscription?.plan || 'individual';
  if (plan === 'basic') plan = 'individual';
  if (plan === 'isp_5_routers') plan = 'isp';

  const isISP = plan === 'isp' || plan === 'isp_pro';
  // For individual users the rate has always been 20%.
  // For ISP users who may have previously been on individual we still record 0 going forward.
  const commissionRate: number = isISP ? 0 : (user.paymentSettings?.commissionRate ?? 20);
  const keepRate = 100 - commissionRate;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalResult, monthResult, monthlyBreakdown] = await Promise.all([
    db
      .collection('payments')
      .aggregate([
        { $match: { userId: uid, status: 'completed' } },
        { $group: { _id: null, revenue: { $sum: '$transaction.amount' }, count: { $sum: 1 } } },
      ])
      .toArray(),

    db
      .collection('payments')
      .aggregate([
        { $match: { userId: uid, status: 'completed', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, revenue: { $sum: '$transaction.amount' }, count: { $sum: 1 } } },
      ])
      .toArray(),

    db
      .collection('payments')
      .aggregate([
        { $match: { userId: uid, status: 'completed' } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            revenue: { $sum: '$transaction.amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 },
      ])
      .toArray(),
  ]);

  const totalRevenue = totalResult[0]?.revenue ?? 0;
  const monthRevenue = monthResult[0]?.revenue ?? 0;
  const totalCommission = Math.round(totalRevenue * (commissionRate / 100));
  const monthCommission = Math.round(monthRevenue * (commissionRate / 100));

  return {
    plan,
    planLabel: plan === 'individual' ? 'Individual' : plan === 'isp' ? 'ISP Basic' : 'ISP Pro',
    isISP,
    commissionRate,
    keepRate,
    totalRevenue,
    totalCommission,
    totalEarnings: totalRevenue - totalCommission,
    monthRevenue,
    monthCommission,
    monthEarnings: monthRevenue - monthCommission,
    totalTransactions: totalResult[0]?.count ?? 0,
    monthlyBreakdown: monthlyBreakdown.map((row) => {
      const rev = row.revenue as number;
      const comm = Math.round(rev * (commissionRate / 100));
      return {
        year: row._id.year as number,
        month: row._id.month as number,
        label: `${MONTH_NAMES[(row._id.month as number) - 1]} ${row._id.year}`,
        revenue: rev,
        commission: comm,
        earnings: rev - comm,
        count: row.count as number,
      };
    }),
  };
}

export default async function CommissionPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/signin');

  let data;
  try {
    data = await getCommissionData(session.user.id);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>Unable to load commission data. Please try again.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plan badges */}
      <div className="flex items-center gap-2">
        <Badge variant={data.isISP ? 'default' : 'secondary'} className="text-sm px-3 py-1">
          {data.planLabel} Plan
        </Badge>
        <Badge
          variant={data.isISP ? 'default' : 'outline'}
          className="text-sm px-3 py-1"
        >
          {data.commissionRate}% commission
        </Badge>
      </div>

      {/* Plan banner */}
      {data.isISP ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Your <strong>{data.planLabel}</strong> plan has <strong>0% commission</strong>. You
            keep 100% of all customer payments. Monthly subscription:{' '}
            <strong>KES {data.plan === 'isp' ? '2,500' : '3,900'}/month</strong>.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            On the <strong>Individual Plan</strong>, the platform charges a{' '}
            <strong>20% commission</strong> on each completed customer payment. You keep the
            remaining <strong>80%</strong>. Upgrade to an ISP plan to eliminate commission.{' '}
            <Link href="/settings/billing" className="underline font-medium">
              Upgrade plan →
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-xl font-semibold mt-1">{formatCurrency(data.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.totalTransactions} transactions
                </p>
              </div>
              <CreditCard className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            </div>
          </CardContent>
        </Card>

        {!data.isISP && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Commission Paid</p>
                  <p className="text-xl font-semibold mt-1 text-orange-600">
                    {formatCurrency(data.totalCommission)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{data.commissionRate}% of revenue</p>
                </div>
                <Percent className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Your Earnings</p>
                <p className="text-xl font-semibold mt-1 text-green-600">
                  {formatCurrency(data.totalEarnings)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{data.keepRate}% of revenue</p>
              </div>
              <Wallet className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">This Month Earnings</p>
                <p className="text-xl font-semibold mt-1 text-blue-600">
                  {formatCurrency(data.monthEarnings)}
                </p>
                {!data.isISP && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    -{formatCurrency(data.monthCommission)} commission
                  </p>
                )}
              </div>
              <TrendingUp className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.monthlyBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">No completed payments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Period</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Transactions</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Revenue</th>
                    {!data.isISP && (
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                        Commission (20%)
                      </th>
                    )}
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                      Your Earnings
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthlyBreakdown.map((row) => (
                    <tr key={`${row.year}-${row.month}`} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">{row.label}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{row.count}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(row.revenue)}</td>
                      {!data.isISP && (
                        <td className="py-3 px-4 text-right text-orange-600">
                          -{formatCurrency(row.commission)}
                        </td>
                      )}
                      <td className="py-3 px-4 text-right font-medium text-green-600">
                        {formatCurrency(row.earnings)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/50 font-medium">
                    <td className="py-3 px-4">Total (last 12 months)</td>
                    <td className="py-3 px-4 text-right text-muted-foreground">
                      {data.monthlyBreakdown.reduce((s, r) => s + r.count, 0)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(data.monthlyBreakdown.reduce((s, r) => s + r.revenue, 0))}
                    </td>
                    {!data.isISP && (
                      <td className="py-3 px-4 text-right text-orange-600">
                        -{formatCurrency(data.monthlyBreakdown.reduce((s, r) => s + r.commission, 0))}
                      </td>
                    )}
                    <td className="py-3 px-4 text-right text-green-600">
                      {formatCurrency(data.monthlyBreakdown.reduce((s, r) => s + r.earnings, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade CTA for individual users */}
      {!data.isISP && (
        <Card className="border-dashed">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-primary" />
                Eliminate commission with an ISP plan
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                From KES 2,500/month — keep 100% of all customer revenue, support up to 5 routers.
              </p>
            </div>
            <Button asChild>
              <Link href="/settings/billing">View Plans</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
