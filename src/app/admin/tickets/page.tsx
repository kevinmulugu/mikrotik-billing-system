import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import clientPromise from '@/lib/mongodb'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Tickets — Admin Panel' }

const PAGE_SIZE = 20

const STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'] as const
type Status = typeof STATUSES[number]

const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (s) {
    case 'open': return 'destructive'
    case 'in_progress': return 'default'
    case 'waiting_customer': return 'secondary'
    case 'resolved': return 'secondary'
    case 'closed': return 'outline'
    default: return 'outline'
  }
}

const priorityVariant = (p: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (p) {
    case 'urgent': return 'destructive'
    case 'high': return 'default'
    case 'medium': return 'secondary'
    default: return 'outline'
  }
}

async function getTickets(page: number, status: string) {
  const client = await clientPromise
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing')

  // Only use known status values — no free-form filter injection
  const filter: Record<string, unknown> = {}
  if (status && (STATUSES as readonly string[]).includes(status)) {
    filter.status = status
  }

  const [tickets, total, byStatus] = await Promise.all([
    db.collection('tickets').aggregate([
      { $match: filter },
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
    db.collection('tickets').countDocuments(filter),
    db.collection('tickets').aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).toArray(),
  ])

  const counts = Object.fromEntries(byStatus.map((s) => [s._id as string, s.count as number]))

  return {
    tickets: tickets.map((t) => ({
      id: t._id.toString(),
      title: t.ticket?.title ?? 'No subject',
      priority: t.ticket?.priority ?? 'medium',
      category: t.ticket?.category ?? '',
      status: (t.status as string) ?? 'open',
      slaBreached: t.sla?.breachedSla ?? false,
      email: t.user?.[0]?.email ?? 'Unknown',
      name: t.user?.[0]?.name ?? 'Unknown',
      createdAt: t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-KE') : '—',
      updatedAt: t.updatedAt ? new Date(t.updatedAt).toLocaleDateString('en-KE') : '—',
    })),
    total,
    pages: Math.ceil(total / PAGE_SIZE),
    stats: {
      open: counts['open'] ?? 0,
      in_progress: counts['in_progress'] ?? 0,
      waiting_customer: counts['waiting_customer'] ?? 0,
      resolved: counts['resolved'] ?? 0,
      closed: counts['closed'] ?? 0,
    },
  }
}

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'system_admin') redirect('/dashboard')

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page || '1', 10))
  const activeStatus = sp.status || ''

  const data = await getTickets(page, activeStatus)

  const statCards = [
    { label: 'Open', value: data.stats.open, status: 'open', color: 'text-red-600' },
    { label: 'In Progress', value: data.stats.in_progress, status: 'in_progress', color: 'text-blue-600' },
    { label: 'Waiting', value: data.stats.waiting_customer, status: 'waiting_customer', color: 'text-amber-600' },
    { label: 'Resolved', value: data.stats.resolved, status: 'resolved', color: 'text-green-600' },
    { label: 'Closed', value: data.stats.closed, status: 'closed', color: 'text-muted-foreground' },
  ]

  const buildHref = (params: Record<string, string>) => {
    const p = new URLSearchParams()
    if (params.status) p.set('status', params.status)
    if (params.page) p.set('page', params.page)
    const qs = p.toString()
    return `/admin/tickets${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-6">
      {/* Stat cards — double as filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Link href="/admin/tickets" className="block">
          <Card className={!activeStatus ? 'ring-2 ring-primary' : ''}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">All</p>
              <p className="text-2xl font-semibold mt-1">{data.total}</p>
            </CardContent>
          </Card>
        </Link>
        {statCards.map((s) => (
          <Link key={s.label} href={buildHref({ status: s.status })} className="block">
            <Card className={activeStatus === s.status ? 'ring-2 ring-primary' : ''}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-semibold mt-1 ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>
              Support Tickets
              {activeStatus && (
                <Badge variant="outline" className="ml-2 text-xs capitalize">
                  {activeStatus.replace('_', ' ')}
                </Badge>
              )}
            </span>
            <span className="text-muted-foreground font-normal text-sm">{data.total} total</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Subject</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Priority</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Created</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.tickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      No tickets found
                    </td>
                  </tr>
                ) : (
                  data.tickets.map((t) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4 max-w-[220px]">
                        <Link
                          href={`/admin/tickets/${t.id}`}
                          className="font-medium hover:underline truncate block"
                        >
                          {t.title}
                        </Link>
                        {t.slaBreached && (
                          <span className="text-xs text-red-600">SLA breached</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-xs font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.email}</p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={priorityVariant(t.priority)} className="text-xs">
                          {t.priority}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={statusVariant(t.status)} className="text-xs capitalize">
                          {t.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-muted-foreground">{t.createdAt}</td>
                      <td className="py-3 px-4 text-right text-xs text-muted-foreground">{t.updatedAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Page {page} of {data.pages} · {data.total} tickets
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={buildHref({ status: activeStatus, page: String(page - 1) })}>
                      Previous
                    </Link>
                  </Button>
                )}
                {page < data.pages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={buildHref({ status: activeStatus, page: String(page + 1) })}>
                      Next
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
