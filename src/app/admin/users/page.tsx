import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import AdminUserActions from './AdminUserActions';

export const metadata: Metadata = {
  title: 'Users - Admin Panel',
};

const PAGE_SIZE = 20;

const roleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (role) {
    case 'system_admin': return 'destructive';
    case 'isp_pro': return 'default';
    case 'isp': return 'secondary';
    default: return 'outline';
  }
};

const ALLOWED_ROLES = ['homeowner', 'isp', 'isp_pro', 'system_admin'] as const;

async function getUsers(page: number, role?: string, search?: string) {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

  const filter: Record<string, unknown> = {};
  // Only allow known role values — no injection via query string
  if (role && (ALLOWED_ROLES as readonly string[]).includes(role)) filter.role = role;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { email: { $regex: escaped, $options: 'i' } },
      { name: { $regex: escaped, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * PAGE_SIZE;

  const [users, total] = await Promise.all([
    db.collection('users')
      .find(filter, { projection: { name: 1, email: 1, role: 1, subscription: 1, status: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(PAGE_SIZE)
      .toArray(),
    db.collection('users').countDocuments(filter),
  ]);

  // Get router counts per user
  const userIds = users.map((u) => u._id);
  const routerCounts = await db.collection('routers').aggregate([
    { $match: { userId: { $in: userIds } } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
  ]).toArray();
  const routerMap = Object.fromEntries(routerCounts.map((r) => [r._id.toString(), r.count]));

  return {
    users: users.map((u) => ({
      id: u._id.toString(),
      name: u.name || 'Unknown',
      email: u.email || '',
      role: u.role || 'homeowner',
      plan: u.subscription?.plan || 'individual',
      status: u.status || 'active',
      routers: routerMap[u._id.toString()] ?? 0,
      createdAt: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-KE') : 'N/A',
    })),
    total,
    pages: Math.ceil(total / PAGE_SIZE),
  };
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; role?: string; search?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'system_admin') redirect('/dashboard');

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const roleFilter = params.role || '';
  const search = params.search?.trim() || '';

  const { users, total, pages } = await getUsers(page, roleFilter || undefined, search || undefined);

  const buildHref = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { page: '1', role: roleFilter, search, ...overrides };
    if (merged.role) p.set('role', merged.role);
    if (merged.search) p.set('search', merged.search);
    if (merged.page && merged.page !== '1') p.set('page', merged.page);
    const qs = p.toString();
    return `/admin/users${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="space-y-6">
      {/* Search + role filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <form method="GET" action="/admin/users" className="flex gap-2 flex-1">
          {roleFilter && <input type="hidden" name="role" value={roleFilter} />}
          <input
            name="search"
            defaultValue={search}
            placeholder="Search by name or email…"
            className="h-8 flex-1 max-w-xs rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button type="submit" className="h-8 px-3 rounded-md border border-input bg-background text-sm hover:bg-muted">
            Search
          </button>
          {search && (
            <Link href={buildHref({ search: '' })} className="h-8 px-3 rounded-md border border-input bg-background text-sm flex items-center hover:bg-muted">
              Clear
            </Link>
          )}
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={buildHref({ role: '', page: '1' })}>
            <Badge variant={!roleFilter ? 'default' : 'outline'} className="cursor-pointer px-3 py-1">
              All ({total})
            </Badge>
          </Link>
          {ALLOWED_ROLES.map((r) => (
            <Link key={r} href={buildHref({ role: r, page: '1' })}>
              <Badge variant={roleFilter === r ? 'default' : 'outline'} className="cursor-pointer px-3 py-1">
                {r}
              </Badge>
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Users{' '}
            <span className="text-muted-foreground font-normal text-sm">({total} total)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Plan</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Routers</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Created</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">
                        <Link href={`/admin/users/${u.id}`} className="hover:underline">
                          {u.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{u.email}</td>
                      <td className="py-3 px-4">
                        <Badge variant={roleBadgeVariant(u.role)} className="text-xs">
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{u.plan}</td>
                      <td className="py-3 px-4 text-center">{u.routers}</td>
                      <td className="py-3 px-4">
                        <Badge variant={u.status === 'suspended' ? 'destructive' : 'outline'} className="text-xs">
                          {u.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{u.createdAt}</td>
                      <td className="py-3 px-4 text-right">
                        <AdminUserActions
                          userId={u.id}
                          currentRole={u.role}
                          currentStatus={u.status}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Page {page} of {pages} · {total} users
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={buildHref({ page: String(page - 1) })}>Previous</Link>
                  </Button>
                )}
                {page < pages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={buildHref({ page: String(page + 1) })}>Next</Link>
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
