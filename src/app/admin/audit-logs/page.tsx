import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Audit Logs - Admin Panel',
};

const PAGE_SIZE = 25;

const SOURCES = [
  { key: 'user',               label: 'User actions'   },
  { key: 'mpesa_confirmation', label: 'M-Pesa confirm' },
  { key: 'mpesa_callback',     label: 'M-Pesa callback'},
  { key: 'mpesa_stk',          label: 'M-Pesa STK'    },
  { key: 'unifi',              label: 'UniFi'          },
  { key: 'mikrotik',           label: 'MikroTik'       },
  { key: 'system',             label: 'System'         },
] as const;

type SourceKey = (typeof SOURCES)[number]['key'] | '';

const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (s) {
    case 'success': return 'default';
    case 'failed':
    case 'error':   return 'destructive';
    case 'pending': return 'secondary';
    default:        return 'outline';
  }
};

// Normalise an audit_logs document into a common display shape
const normaliseAuditPipeline = [
  {
    $addFields: {
      _src:  '$source',
      _type: '$action.type',
      _stat: '$action.status',
      _detail: {
        $concat: [
          { $ifNull: ['$metadata.email', ''] },
          {
            $cond: [
              { $gt: [{ $size: { $ifNull: ['$action.details.changedFields', []] } }, 0] },
              {
                $concat: [
                  ' — changed: ',
                  {
                    $reduce: {
                      input: { $ifNull: ['$action.details.changedFields', []] },
                      initialValue: '',
                      in: {
                        $cond: [
                          { $eq: ['$$value', ''] },
                          '$$this',
                          { $concat: ['$$value', ', ', '$$this'] },
                        ],
                      },
                    },
                  },
                ],
              },
              '',
            ],
          },
        ],
      },
      _ip:   { $ifNull: ['$metadata.ipAddress', ''] },
      _ts:   '$timestamp',
    },
  },
];

// Normalise a webhook_logs document into the same shape
const normaliseWebhookPipeline = [
  {
    $addFields: {
      _src:    '$source',
      _type:   { $ifNull: ['$type', { $ifNull: ['$event', '-'] }] },
      _stat:   { $ifNull: ['$status', 'unknown'] },
      _detail: { $ifNull: ['$reason', { $ifNull: ['$message', { $ifNull: ['$error', ''] }] }] },
      _ip:     { $ifNull: ['$metadata.ipAddress', ''] },
      _ts:     { $ifNull: ['$timestamp', '$createdAt'] },
    },
  },
];

async function getLogs(page: number, source: SourceKey) {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const skip = (page - 1) * PAGE_SIZE;

  // ── "All" view: merge both collections via $unionWith ──────────────────────
  if (!source) {
    const [docs, countResult, webhookSuccess, auditSuccess, webhookFailed, auditFailed] =
      await Promise.all([
        // Paginated merged results
        db.collection('audit_logs').aggregate([
          ...normaliseAuditPipeline,
          {
            $unionWith: {
              coll: 'webhook_logs',
              pipeline: normaliseWebhookPipeline,
            },
          },
          { $sort: { _ts: -1 } },
          { $skip: skip },
          { $limit: PAGE_SIZE },
          { $project: { _id: 1, _src: 1, _type: 1, _stat: 1, _detail: 1, _ip: 1, _ts: 1 } },
        ]).toArray(),

        // Total count across both
        db.collection('audit_logs').aggregate([
          { $count: 'n' },
          {
            $unionWith: {
              coll: 'webhook_logs',
              pipeline: [{ $count: 'n' }],
            },
          },
          { $group: { _id: null, total: { $sum: '$n' } } },
        ]).toArray(),

        db.collection('webhook_logs').countDocuments({ status: 'success' }),
        db.collection('audit_logs').countDocuments({ 'action.status': 'success' }),
        db.collection('webhook_logs').countDocuments({ status: { $in: ['failed', 'error'] }, timestamp: { $gte: startOfToday } }),
        db.collection('audit_logs').countDocuments({ 'action.status': 'failed', timestamp: { $gte: startOfToday } }),
      ]);

    const total = (countResult[0] as any)?.total ?? 0;

    return {
      logs: docs.map((l: any) => ({
        id: l._id.toString(),
        source: l._src ?? 'unknown',
        type:   l._type ?? '-',
        status: l._stat ?? 'unknown',
        reason: l._detail ?? '',
        ip:     l._ip ?? '',
        timestamp: l._ts ? new Date(l._ts).toLocaleString('en-KE') : 'N/A',
      })),
      total,
      pages: Math.ceil(total / PAGE_SIZE),
      stats: {
        total,
        success: webhookSuccess + auditSuccess,
        failedToday: webhookFailed + auditFailed,
      },
    };
  }

  // ── "User actions" — audit_logs only ──────────────────────────────────────
  if (source === 'user') {
    const filter = { source: 'user' };
    const [docs, total, successCount, failedToday] = await Promise.all([
      db.collection('audit_logs')
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .toArray(),
      db.collection('audit_logs').countDocuments(filter),
      db.collection('audit_logs').countDocuments({ source: 'user', 'action.status': 'success' }),
      db.collection('audit_logs').countDocuments({
        source: 'user',
        'action.status': 'failed',
        timestamp: { $gte: startOfToday },
      }),
    ]);

    return {
      logs: docs.map((l) => ({
        id:     l._id.toString(),
        source: 'user',
        type:   l.action?.type ?? '-',
        status: l.action?.status ?? 'success',
        reason: [
          l.metadata?.email,
          Array.isArray(l.action?.details?.changedFields) && l.action.details.changedFields.length
            ? `changed: ${(l.action.details.changedFields as string[]).join(', ')}`
            : '',
        ].filter(Boolean).join(' — '),
        ip:        l.metadata?.ipAddress ?? '',
        timestamp: l.timestamp ? new Date(l.timestamp).toLocaleString('en-KE') : 'N/A',
      })),
      total,
      pages: Math.ceil(total / PAGE_SIZE),
      stats: { total, success: successCount, failedToday },
    };
  }

  // ── Specific webhook source ────────────────────────────────────────────────
  const filter: Record<string, unknown> = { source };
  const failedFilter = {
    source,
    status: { $in: ['failed', 'error'] },
    timestamp: { $gte: startOfToday },
  };

  const [docs, total, successCount, failedToday] = await Promise.all([
    db.collection('webhook_logs')
      .find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(PAGE_SIZE)
      .toArray(),
    db.collection('webhook_logs').countDocuments(filter),
    db.collection('webhook_logs').countDocuments({ source, status: 'success' }),
    db.collection('webhook_logs').countDocuments(failedFilter),
  ]);

  return {
    logs: docs.map((l) => ({
      id:        l._id.toString(),
      source:    l.source ?? 'unknown',
      type:      l.type ?? l.event ?? '-',
      status:    l.status ?? 'unknown',
      reason:    l.reason ?? l.message ?? l.error ?? '',
      ip:        l.metadata?.ipAddress ?? '',
      timestamp: l.timestamp || l.createdAt
        ? new Date(l.timestamp ?? l.createdAt).toLocaleString('en-KE')
        : 'N/A',
    })),
    total,
    pages: Math.ceil(total / PAGE_SIZE),
    stats: { total, success: successCount, failedToday },
  };
}

function buildHref(source: string, page: number) {
  const sp = new URLSearchParams();
  if (source) sp.set('source', source);
  if (page > 1) sp.set('page', String(page));
  const qs = sp.toString();
  return `/admin/audit-logs${qs ? `?${qs}` : ''}`;
}

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; source?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'system_admin') redirect('/dashboard');

  const params   = await searchParams;
  const page     = Math.max(1, parseInt(params.page || '1', 10));
  const source   = (params.source ?? '') as SourceKey;
  const data     = await getLogs(page, source);

  const pageTitle = source
    ? (SOURCES.find((s) => s.key === source)?.label ?? source)
    : 'All logs';

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total ({pageTitle})</p>
            <p className="text-2xl font-semibold mt-1">{data.stats.total.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Successful</p>
            <p className="text-2xl font-semibold mt-1 text-green-600">{data.stats.success.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Failed Today</p>
            <p className="text-2xl font-semibold mt-1 text-red-600">{data.stats.failedToday.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Source filter */}
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/audit-logs">
          <Badge variant={!source ? 'default' : 'outline'} className="cursor-pointer px-3 py-1">
            All
          </Badge>
        </Link>
        {SOURCES.map((s) => (
          <Link key={s.key} href={buildHref(s.key, 1)}>
            <Badge
              variant={source === s.key ? 'default' : 'outline'}
              className="cursor-pointer px-3 py-1"
            >
              {s.label}
            </Badge>
          </Link>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {pageTitle}{' '}
            <span className="text-muted-foreground font-normal text-sm">
              ({data.total.toLocaleString()} entries)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Source</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Action / Type</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Details</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">IP</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      No logs found
                    </td>
                  </tr>
                ) : (
                  data.logs.map((l) => (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs font-mono">{l.source}</Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground font-mono">{l.type}</td>
                      <td className="py-3 px-4">
                        <Badge variant={statusVariant(l.status)} className="text-xs">{l.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground max-w-[280px] truncate">
                        {l.reason || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground font-mono">
                        {l.ip || '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-muted-foreground font-mono whitespace-nowrap">
                        {l.timestamp}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Page {page} of {data.pages} · {data.total.toLocaleString()} entries
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={buildHref(source, page - 1)}>Previous</Link>
                  </Button>
                )}
                {page < data.pages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={buildHref(source, page + 1)}>Next</Link>
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
