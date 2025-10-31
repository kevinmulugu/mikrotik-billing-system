import mongoose, { Document, Model, Schema } from 'mongoose'

// Communication message interface
interface ICommunication {
  from: mongoose.Types.ObjectId
  message: string
  attachments?: {
    id?: string
    name: string
    size: number
    url: string
  }[]
  isInternal: boolean
  timestamp: Date
}

// Ticket interface
export interface ITicket extends Document {
  userId: mongoose.Types.ObjectId
  routerId?: mongoose.Types.ObjectId
  ticket: {
    title: string
    description: string
    category: 'technical' | 'billing' | 'general' | 'feature_request'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    type: 'router_issue' | 'payment_issue' | 'user_management' | 'other'
  }
  assignment?: {
    assignedTo: mongoose.Types.ObjectId
    assignedAt: Date
    department: string
  }
  sla: {
    responseTime: number // hours
    resolutionTime: number // hours
    firstResponseAt?: Date
    resolvedAt?: Date
    breachedSla: boolean
  }
  communication: ICommunication[]
  resolution?: {
    solution: string
    resolvedBy: mongoose.Types.ObjectId
    customerSatisfaction?: number
    feedback?: string
  }
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'
  createdAt: Date
  updatedAt: Date
}

// Communication schema
const CommunicationSchema = new Schema<ICommunication>({
  from: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  attachments: [{
    id: String,
    name: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
  }],
  isInternal: {
    type: Boolean,
    default: false,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
})

// Ticket schema
const TicketSchema = new Schema<ITicket>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    routerId: {
      type: Schema.Types.ObjectId,
      ref: 'Router',
      index: true,
    },
    ticket: {
      title: {
        type: String,
        required: true,
        trim: true,
        minlength: 10,
        maxlength: 200,
      },
      description: {
        type: String,
        required: true,
        trim: true,
        minlength: 50,
        maxlength: 2000,
      },
      category: {
        type: String,
        enum: ['technical', 'billing', 'general', 'feature_request'],
        required: true,
        index: true,
      },
      priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        required: true,
        default: 'medium',
        index: true,
      },
      type: {
        type: String,
        enum: ['router_issue', 'payment_issue', 'user_management', 'other'],
        required: true,
      },
    },
    assignment: {
      assignedTo: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
      assignedAt: Date,
      department: {
        type: String,
        enum: ['technical', 'billing', 'customer_success'],
      },
    },
    sla: {
      responseTime: {
        type: Number,
        required: true,
      },
      resolutionTime: {
        type: Number,
        required: true,
      },
      firstResponseAt: Date,
      resolvedAt: Date,
      breachedSla: {
        type: Boolean,
        default: false,
      },
    },
    communication: [CommunicationSchema],
    resolution: {
      solution: String,
      resolvedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      customerSatisfaction: {
        type: Number,
        min: 1,
        max: 5,
      },
      feedback: String,
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'],
      default: 'open',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

// Indexes for performance
TicketSchema.index({ createdAt: -1 })
TicketSchema.index({ status: 1, 'ticket.priority': 1 })
TicketSchema.index({ userId: 1, status: 1 })
TicketSchema.index({ 'sla.breachedSla': 1 })

// Text search index
TicketSchema.index({
  'ticket.title': 'text',
  'ticket.description': 'text',
})

// Virtual for ticket age
TicketSchema.virtual('age').get(function(this: ITicket) {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60)) // hours
})

// Method to check SLA breach
TicketSchema.methods.checkSLABreach = function(this: ITicket) {
  const now = new Date()
  const createdTime = this.createdAt.getTime()
  const hoursSinceCreation = (now.getTime() - createdTime) / (1000 * 60 * 60)

  // Check response time SLA
  if (!this.sla.firstResponseAt && hoursSinceCreation > this.sla.responseTime) {
    this.sla.breachedSla = true
    return true
  }

  // Check resolution time SLA
  if (!this.sla.resolvedAt && hoursSinceCreation > this.sla.resolutionTime) {
    this.sla.breachedSla = true
    return true
  }

  return false
}

// Method to add communication
TicketSchema.methods.addCommunication = function(
  this: ITicket,
  from: mongoose.Types.ObjectId,
  message: string,
  attachments?: ICommunication['attachments'],
  isInternal: boolean = false
) {
  this.communication.push({
    from,
    message,
    attachments,
    isInternal,
    timestamp: new Date(),
  } as ICommunication)

  // Set first response time if this is from support
  if (!this.sla.firstResponseAt && from.toString() !== this.userId.toString()) {
    this.sla.firstResponseAt = new Date()
  }

  return this.save()
}

// Pre-save hook to check SLA
TicketSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'resolved') {
    this.sla.resolvedAt = new Date()
  }
  next()
})

// Static method to get ticket statistics
TicketSchema.statics.getStatistics = async function(userId: string) {
  const stats = await this.aggregate([
    {
      $match: { userId: new mongoose.Types.ObjectId(userId) }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        open: {
          $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
        },
        inProgress: {
          $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
        },
        resolved: {
          $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
        },
        breachedSla: {
          $sum: { $cond: ['$sla.breachedSla', 1, 0] }
        },
        avgResponseTime: {
          $avg: {
            $cond: [
              { $ne: ['$sla.firstResponseAt', null] },
              {
                $divide: [
                  { $subtract: ['$sla.firstResponseAt', '$createdAt'] },
                  3600000 // Convert to hours
                ]
              },
              null
            ]
          }
        }
      }
    }
  ])

  return stats[0] || {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    breachedSla: 0,
    avgResponseTime: 0
  }
}

// Export model
export const Ticket: Model<ITicket> = 
  mongoose.models.Ticket || mongoose.model<ITicket>('Ticket', TicketSchema)