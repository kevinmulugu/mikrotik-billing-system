import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AdminSMSPlanForm from './AdminSMSPlanForm';
import AdminSMSPlanDeleteButton from './AdminSMSPlanDeleteButton';

export const metadata: Metadata = {
  title: 'SMS Plans - Admin Panel',
};

const fmt = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  minimumFractionDigits: 0,
});

async function getSMSPlansData() {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

  const [plans, creditStats] = await Promise.all([
    db.collection('sms_plans').find({}).sort({ price: 1 }).toArray(),

    db.collection('sms_credits').aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalBalance: { $sum: '$balance' },
        },
      },
    ]).toArray(),
  ]);

  return {
    plans: plans.map((p) => ({
      id: p._id.toString(),
      name: p.name || '',
      credits: p.credits ?? 0,
      price: p.price ?? 0,
      validityDays: p.validityDays ?? p.validity_days ?? 30,
      active: p.active !== false,
    })),
    totalUsersWithCredits: creditStats[0]?.totalUsers ?? 0,
    totalCreditBalance: creditStats[0]?.totalBalance ?? 0,
  };
}

export default async function AdminSMSPlansPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'system_admin') redirect('/dashboard');

  const data = await getSMSPlansData();

  return (
    <div className="space-y-6">
      {/* Credit stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Users With SMS Credits</p>
            <p className="text-2xl font-semibold mt-1">{data.totalUsersWithCredits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Credit Balance (all users)</p>
            <p className="text-2xl font-semibold mt-1">{data.totalCreditBalance.toLocaleString()} credits</p>
          </CardContent>
        </Card>
      </div>

      {/* Plans table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            SMS Plans{' '}
            <span className="text-muted-foreground font-normal text-sm">({data.plans.length} plans)</span>
          </CardTitle>
          <AdminSMSPlanForm />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Credits</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Price</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Validity</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.plans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      No SMS plans configured yet
                    </td>
                  </tr>
                ) : (
                  data.plans.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">{p.name}</td>
                      <td className="py-3 px-4 text-right">{p.credits.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">{fmt.format(p.price)}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{p.validityDays} days</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={p.active ? 'default' : 'secondary'} className="text-xs">
                          {p.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <AdminSMSPlanForm plan={p} />
                          <AdminSMSPlanDeleteButton planId={p.id} planName={p.name} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
