/**
 * Ticket Type Definitions
 */

export type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TicketCategory = 'technical' | 'billing' | 'general' | 'feature_request'
export type TicketType = 'router_issue' | 'payment_issue' | 'user_management' | 'other'
export type TicketDepartment = 'technical' | 'billing' | 'customer_success'

export interface TicketAttachment {
  id: string
  name: string
  size: number
  url: string
}

export interface TicketCommunication {
  _id?: string
  from: {
    _id: string
    name: string
    email: string
    image?: string
    role?: string
  }
  message: string
  attachments?: TicketAttachment[]
  isInternal: boolean
  timestamp: Date
}

export interface TicketAssignment {
  assignedTo: {
    _id: string
    name: string
    email: string
    image?: string
  }
  assignedAt: Date
  department: TicketDepartment
}

export interface TicketSLA {
  responseTime: number // hours
  resolutionTime: number // hours
  firstResponseAt?: Date
  resolvedAt?: Date
  breachedSla: boolean
}

export interface TicketResolution {
  solution: string
  resolvedBy: {
    _id: string
    name: string
    email: string
  }
  customerSatisfaction?: number // 1-5
  feedback?: string
}

export interface TicketRouter {
  _id: string
  routerInfo: {
    name: string
    location?: {
      name: string
    }
  }
  health: {
    status: string
  }
}

export interface Ticket {
  _id: string
  userId: {
    _id: string
    name: string
    email: string
    image?: string
  }
  routerId?: TicketRouter
  ticket: {
    title: string
    description: string
    category: TicketCategory
    priority: TicketPriority
    type: TicketType
  }
  assignment?: TicketAssignment
  sla: TicketSLA
  communication: TicketCommunication[]
  resolution?: TicketResolution
  status: TicketStatus
  createdAt: Date
  updatedAt: Date
}

export interface TicketStats {
  total: number
  open: number
  inProgress: number
  resolved: number
  breachedSla: number
  avgResponseTime?: number
}

export interface CreateTicketDTO {
  title: string
  description: string
  category: TicketCategory
  priority: TicketPriority
  type: TicketType
  routerId?: string
}

export interface UpdateTicketDTO {
  action: 'addMessage' | 'updateStatus' | 'resolve' | 'reopen'
  message?: string
  attachments?: TicketAttachment[]
  status?: TicketStatus
  solution?: string
  satisfaction?: number
  feedback?: string
}

export interface TicketFilters {
  status?: TicketStatus | 'all'
  priority?: TicketPriority | 'all'
  category?: TicketCategory | 'all'
  search?: string
  routerId?: string
}

export interface TicketListResponse {
  success: boolean
  tickets: Ticket[]
  stats: TicketStats
}

export interface TicketResponse {
  success: boolean
  ticket: Ticket
  message?: string
}