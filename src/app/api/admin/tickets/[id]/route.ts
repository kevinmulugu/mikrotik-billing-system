import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { TicketHelpers, toObjectId, isValidObjectId } from '@/lib/mongodb-helpers'
import { z } from 'zod'

type RouteContext = { params: Promise<{ id: string }> }

// Explicit allowlist — never derive from request
const ALLOWED_STATUS = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'] as const

// Discriminated union prevents ambiguous/conflicting payloads
const ActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('addMessage'),
    message: z.string().min(1, 'Message cannot be empty').max(5000),
    isInternal: z.boolean().optional().default(false),
  }),
  z.object({
    action: z.literal('updateStatus'),
    status: z.enum(ALLOWED_STATUS),
  }),
])

async function fetchTicketForAdmin(ticketId: string) {
  const col = await TicketHelpers.getCollection()
  const docs = await col.aggregate([
    { $match: { _id: toObjectId(ticketId) } },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
        pipeline: [{ $project: { name: 1, email: 1, image: 1, role: 1 } }],
      },
    },
    {
      $lookup: {
        from: 'routers',
        localField: 'routerId',
        foreignField: '_id',
        as: 'router',
        pipeline: [{ $project: { 'routerInfo.name': 1, 'health.status': 1 } }],
      },
    },
    {
      $lookup: {
        from: 'users',
        let: { fromIds: '$communication.from' },
        pipeline: [
          { $match: { $expr: { $in: ['$_id', '$$fromIds'] } } },
          { $project: { name: 1, email: 1, image: 1, role: 1 } },
        ],
        as: 'commUsers',
      },
    },
    {
      $addFields: {
        user: { $arrayElemAt: ['$user', 0] },
        routerDoc: { $arrayElemAt: ['$router', 0] },
        communication: {
          $map: {
            input: '$communication',
            as: 'm',
            in: {
              $mergeObjects: [
                '$$m',
                {
                  from: {
                    $let: {
                      vars: {
                        u: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: '$commUsers',
                                as: 'u',
                                cond: { $eq: ['$$u._id', '$$m.from'] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: '$$u',
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
    { $project: { router: 0, assignedUser: 0, commUsers: 0 } },
  ]).toArray()
  return docs[0] ?? null
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'system_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 })
  }

  const ticket = await fetchTicketForAdmin(id)
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ success: true, ticket })
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'system_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = ActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  const col = await TicketHelpers.getCollection()
  const ticketOid = toObjectId(id)
  const now = new Date()

  if (parsed.data.action === 'addMessage') {
    const existing = await col.findOne(
      { _id: ticketOid },
      { projection: { 'sla.firstResponseAt': 1 } },
    )
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Only non-internal messages count as first response for SLA
    const isFirstResponse =
      !existing.sla?.firstResponseAt && !parsed.data.isInternal

    const result = await col.updateOne(
      { _id: ticketOid },
      {
        $push: {
          communication: {
            from: toObjectId(session.user.id),
            message: parsed.data.message,
            attachments: [],
            isInternal: parsed.data.isInternal,
            timestamp: now,
          },
        } as any,
        $set: {
          updatedAt: now,
          // Move to in_progress on first admin reply if still open
          ...(existing.status === 'open' && !parsed.data.isInternal
            ? { status: 'in_progress' }
            : {}),
          ...(isFirstResponse ? { 'sla.firstResponseAt': now } : {}),
        },
      },
    )

    if (result.matchedCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (parsed.data.action === 'updateStatus') {
    const setFields: Record<string, unknown> = {
      status: parsed.data.status,
      updatedAt: now,
    }
    if (parsed.data.status === 'resolved') {
      setFields['sla.resolvedAt'] = now
    }

    const result = await col.updateOne({ _id: ticketOid }, { $set: setFields })
    if (result.matchedCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const ticket = await fetchTicketForAdmin(id)
  return NextResponse.json({ success: true, ticket })
}
