//  src/app/api/support/tickets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { TicketHelpers, RouterHelpers, toObjectId, isValidObjectId } from '@/lib/mongodb-helpers'
import { uploadFile } from '@/lib/storage'
import { z } from 'zod'
import { NotificationService } from '@/lib/services/notification'

// Validation schema
const createTicketSchema = z.object({
  title: z.string().min(10).max(200),
  description: z.string().min(50).max(2000),
  category: z.enum(['technical', 'billing', 'general', 'feature_request']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  type: z.enum(['router_issue', 'payment_issue', 'user_management', 'other']),
  routerId: z.string().optional().nullable().transform(val => val || undefined),
})

// GET: Fetch user's tickets
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const ticketsCollection = await TicketHelpers.getCollection()

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const routerId = searchParams.get('routerId')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const category = searchParams.get('category')

    // Build query
    const query: any = {
      userId: toObjectId(session.user.id),
    }

    if (routerId && routerId !== 'all' && isValidObjectId(routerId)) {
      query.routerId = toObjectId(routerId)
    }

    if (status && status !== 'all') {
      query.status = status
    }

    if (priority && priority !== 'all') {
      query['ticket.priority'] = priority
    }

    if (category && category !== 'all') {
      query['ticket.category'] = category
    }

    // Fetch tickets with lookups
    const tickets = await ticketsCollection.aggregate([
      { $match: query },
      { $sort: { createdAt: -1 } },
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
      {
        $lookup: {
          from: 'users',
          localField: 'assignment.assignedTo',
          foreignField: '_id',
          as: 'assignedUser'
        }
      },
      {
        $addFields: {
          userId: { $arrayElemAt: ['$user', 0] },
          routerId: { $arrayElemAt: ['$router', 0] },
          'assignment.assignedToName': { $arrayElemAt: ['$assignedUser.name', 0] }
        }
      },
      {
        $project: {
          user: 0,
          router: 0,
          assignedUser: 0
        }
      }
    ]).toArray()

    // Calculate statistics
    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      inProgress: tickets.filter(t => t.status === 'in_progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      breachedSla: tickets.filter(t => t.sla.breachedSla).length,
    }

    return NextResponse.json({
      success: true,
      tickets,
      stats,
    })
  } catch (error) {
    console.error('Error fetching tickets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tickets' },
      { status: 500 }
    )
  }
}

// POST: Create new ticket
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const ticketsCollection = await TicketHelpers.getCollection()

    // Parse form data
    const formData = await request.formData()
    
    // Extract ticket data - convert empty/null to undefined
    const routerIdValue = formData.get('routerId')
    const ticketData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      category: formData.get('category') as string,
      priority: formData.get('priority') as string,
      type: formData.get('type') as string,
      routerId: routerIdValue && routerIdValue !== 'none' ? (routerIdValue as string) : undefined,
    }

    // Validate ticket data
    const validated = createTicketSchema.parse(ticketData)

    // Verify router ownership if routerId provided
    if (validated.routerId && validated.routerId !== 'none') {
      if (!isValidObjectId(validated.routerId)) {
        return NextResponse.json(
          { error: 'Invalid router ID' },
          { status: 400 }
        )
      }

      const router = await RouterHelpers.findByIdAndUser(
        validated.routerId,
        session.user.id
      )

      if (!router) {
        return NextResponse.json(
          { error: 'Router not found or access denied' },
          { status: 404 }
        )
      }
    }

    // Handle file attachments
    const attachments: any[] = []
    const files = formData.getAll('attachments') as File[]
    
    if (files && files.length > 0) {
      for (const file of files) {
        if (file.size > 0) {
          try {
            // Upload file to storage
            const uploadResult = await uploadFile(file)
            attachments.push({
              id: uploadResult.key,
              name: file.name,
              size: uploadResult.size,
              url: uploadResult.url,
            })
          } catch (error) {
            console.error('Error uploading file:', error)
            // Continue with other files
          }
        }
      }
    }

    // Get SLA times based on priority
    const sla = TicketHelpers.getSLATimes(validated.priority)

    // Create ticket document
    const ticketDoc = {
      userId: toObjectId(session.user.id),
      routerId: validated.routerId && validated.routerId !== 'none' 
        ? toObjectId(validated.routerId)
        : null,
      ticket: {
        title: validated.title,
        description: validated.description,
        category: validated.category,
        priority: validated.priority,
        type: validated.type,
      },
      communication: attachments.length > 0 ? [{
        from: toObjectId(session.user.id),
        message: validated.description,
        attachments,
        isInternal: false,
        timestamp: new Date(),
      }] : [],
      sla: {
        responseTime: sla?.responseTime ?? 0,
        resolutionTime: sla?.resolutionTime ?? 0,
        breachedSla: false,
      },
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Insert ticket
    const result = await ticketsCollection.insertOne(ticketDoc)

    // Fetch created ticket with populated fields
    const createdTicket = await ticketsCollection.aggregate([
      { $match: { _id: result.insertedId } },
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
      {
        $addFields: {
          userId: { $arrayElemAt: ['$user', 0] },
          routerId: { $arrayElemAt: ['$router', 0] }
        }
      },
      {
        $project: {
          user: 0,
          router: 0
        }
      }
    ]).toArray()

    // Create notification for user
    try {
      await NotificationService.createNotification({
        userId: session.user.id,
        type: 'info',
        category: 'support',
        priority: 'normal',
        title: 'Support Ticket Created',
        message: `Your ticket "${validated.title}" has been submitted. We'll respond within ${sla?.responseTime || 24} hours.`,
        metadata: {
          resourceType: 'ticket',
          resourceId: result.insertedId.toString(),
          link: `/support/tickets/${result.insertedId}`,
        },
        sendEmail: false, // User initiated, no email needed
      });
    } catch (notifError) {
      console.error('Failed to create ticket notification:', notifError);
      // Don't fail the ticket creation if notification fails
    }

    // TODO: Send notification to support team
    // await sendTicketNotification(createdTicket[0])

    return NextResponse.json({
      success: true,
      message: 'Ticket created successfully',
      ticket: createdTicket[0],
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating ticket:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create ticket' },
      { status: 500 }
    )
  }
}