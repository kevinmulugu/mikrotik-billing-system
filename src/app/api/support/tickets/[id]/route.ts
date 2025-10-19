import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { TicketHelpers, toObjectId, isValidObjectId } from '@/lib/mongodb-helpers'
import { uploadFile } from '@/lib/storage'

type RouteContext = { params: { id: string } }

// Helper: build aggregation to fetch a single ticket populated for UI
async function fetchTicketForUser(ticketId: string, userId: string) {
  const ticketsCollection = await TicketHelpers.getCollection()

  const pipeline: any[] = [
    { $match: { _id: toObjectId(ticketId), userId: toObjectId(userId) } },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $lookup: {
        from: 'routers',
        localField: 'routerId',
        foreignField: '_id',
        as: 'router'
      }
    },
    // Assigned user lookup
    {
      $lookup: {
        from: 'users',
        localField: 'assignment.assignedTo',
        foreignField: '_id',
        as: 'assignedUser'
      }
    },
    // Communication user lookups (collect all from IDs)
    {
      $lookup: {
        from: 'users',
        let: { fromIds: '$communication.from' },
        pipeline: [
          { $match: { $expr: { $in: ['$_id', '$$fromIds'] } } },
        ],
        as: 'commUsers'
      }
    },
    {
      $addFields: {
        userId: { $arrayElemAt: ['$user', 0] },
        routerId: { $arrayElemAt: ['$router', 0] },
        'assignment.assignedTo': { $arrayElemAt: ['$assignedUser', 0] },
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
                                cond: { $eq: ['$$u._id', '$$m.from'] }
                              }
                            },
                            0
                          ]
                        }
                      },
                      in: '$$u'
                    }
                  }
                }
              ]
            }
          }
        }
      }
    },
    { $project: { user: 0, router: 0, assignedUser: 0, commUsers: 0 } }
  ]

  const docs = await ticketsCollection.aggregate(pipeline).toArray()
  return docs[0] || null
}

// GET: Fetch single ticket for the authenticated user
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ticketId = params.id
    if (!isValidObjectId(ticketId)) {
      return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 })
    }

    const ticket = await fetchTicketForUser(ticketId, session.user.id)
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, ticket })
  } catch (error) {
    console.error('Error fetching ticket:', error)
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 })
  }
}

// PATCH: Update ticket - add message, change status, reopen
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ticketId = params.id
    if (!isValidObjectId(ticketId)) {
      return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 })
    }

    const ticketsCollection = await TicketHelpers.getCollection()

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = await request.json()
      const action = body.action as string

      if (action === 'updateStatus') {
        const allowed = new Set(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'])
        const newStatus: string | undefined = body.status
        if (!newStatus || !allowed.has(newStatus)) {
          return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        }

        const result = await ticketsCollection.updateOne(
          { _id: toObjectId(ticketId), userId: toObjectId(session.user.id) },
          { $set: { status: newStatus, updatedAt: new Date() } }
        )

        if (result.matchedCount === 0) {
          return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
        }

        const ticket = await fetchTicketForUser(ticketId, session.user.id)
        return NextResponse.json({ success: true, ticket })
      }

      if (action === 'reopen') {
        const result = await ticketsCollection.updateOne(
          { _id: toObjectId(ticketId), userId: toObjectId(session.user.id) },
          { $set: { status: 'open', updatedAt: new Date() } }
        )
        if (result.matchedCount === 0) {
          return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
        }

        const ticket = await fetchTicketForUser(ticketId, session.user.id)
        return NextResponse.json({ success: true, ticket })
      }

      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
    }

    // Multipart/form-data: addMessage + attachments
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const action = (formData.get('action') as string) || ''

      if (action !== 'addMessage') {
        return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
      }

      const message = (formData.get('message') as string) || ''
      const files = (formData.getAll('attachments') as File[]) || []

      if (!message.trim() && files.length === 0) {
        return NextResponse.json({ error: 'Message or attachments required' }, { status: 400 })
      }

      const attachments: any[] = []
      for (const file of files) {
        if (file && typeof file.size === 'number' && file.size > 0) {
          try {
            const uploaded = await uploadFile(file)
            attachments.push({
              id: uploaded.key,
              name: file.name,
              size: uploaded.size,
              url: uploaded.url,
            })
          } catch (err) {
            console.error('Attachment upload failed:', err)
            // Continue with other files
          }
        }
      }

      const updateDoc: any = {
        $push: {
          communication: {
            from: toObjectId(session.user.id),
            message,
            attachments,
            isInternal: false,
            timestamp: new Date(),
          }
        },
        $set: { updatedAt: new Date() }
      }

      const update = await ticketsCollection.updateOne(
        { _id: toObjectId(ticketId), userId: toObjectId(session.user.id) } as any,
        updateDoc
      )

      if (update.matchedCount === 0) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
      }

      const ticket = await fetchTicketForUser(ticketId, session.user.id)
      return NextResponse.json({ success: true, ticket })
    }

    return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 })
  } catch (error) {
    console.error('Error updating ticket:', error)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }
}