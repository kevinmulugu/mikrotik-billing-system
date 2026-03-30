import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Wifi, WifiOff } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Routers - Admin Panel',
};

const PAGE_SIZE = 20;

async function getRouters(page: number) {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

  const [routers, total, byType, online] = await Promise.all([
    db.collection('routers').aggregate([
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * PAGE_SIZE },
      { $limit: PAGE_SIZE },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'owner',
          pipeline: [{ $project: { email: 1, name: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'vouchers',
          localField: '_id',
          foreignField: 'routerId',
          as: 'vouchers',
          pipeline: [{ $count: 'count' }],
        },
      },
    ]).toArray(),

    db.collection('routers').countDocuments(),

    db.collection('routers').aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]).toArray(),

    db.collection('routers').countDocuments({ status: 'online' }),
  ]);

  const typeCounts = Object.fromEntries(byType.map((r) => [r._id, r.count]));

  return {
    routers: routers.map((r) => ({
      id: r._id.toString(),
      name: r.name || r.identity || 'Unnamed',
      type: r.type || 'mikrotik',
      model: r.model || '-',
      status: r.status || 'unknown',
      ownerEmail: r.owner?.[0]?.email ?? 'Unknown',
      ownerName: r.owner?.[0]?.name ?? 'Unknown',
      voucherCount: r.vouchers?.[0]?.count ?? 0,
      lastSync: r.lastSync ? new Date(r.lastSync).toLocaleDateString('en-KE') : 'Never',
    })),
    total,
    pages: Math.ceil(total / PAGE_SIZE),
    stats: {
      total,
      online,
      offline: total - online,
      mikrotik: typeCounts['mikrotik'] ?? 0,
      unifi: typeCounts['unifi'] ?? 0,
    },
  };
}

export default async function AdminRoutersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'system_admin') redirect('/dashboard');

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));

  const data = await getRouters(page);

  const stats = [
    { label: 'Total Routers', value: data.stats.total },
    { label: 'Online', value: data.stats.online },
    { label: 'Offline', value: data.stats.offline },
    { label: 'MikroTik', value: data.stats.mikrotik },
    { label: 'UniFi', value: data.stats.unifi },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-semibold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            All Routers{' '}
            <span className="text-muted-foreground font-normal text-sm">({data.total} total)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Owner</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Model</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Vouchers</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Last Sync</th>
                </tr>
              </thead>
              <tbody>
                {data.routers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted-foreground">
                      No routers found
                    </td>
                  </tr>
                ) : (
                  data.routers.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">{r.name}</td>
                      <td className="py-3 px-4">
                        <p className="text-xs">{r.ownerName}</p>
                        <p className="text-xs text-muted-foreground">{r.ownerEmail}</p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">{r.type}</Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{r.model}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {r.status === 'online' ? (
                            <Wifi className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className={r.status === 'online' ? 'text-green-600 text-xs' : 'text-muted-foreground text-xs'}>
                            {r.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">{r.voucherCount}</td>
                      <td className="py-3 px-4 text-right text-xs text-muted-foreground">{r.lastSync}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Page {page} of {data.pages} · {data.total} routers
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/routers?page=${page - 1}`}>Previous</Link>
                  </Button>
                )}
                {page < data.pages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/routers?page=${page + 1}`}>Next</Link>
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
