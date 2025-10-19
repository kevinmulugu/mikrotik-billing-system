import clientPromise from './mongodb'
import { Db, Collection, ObjectId } from 'mongodb'

/**
 * MongoDB Helper Functions
 * These helpers work with your existing MongoDB client setup
 */

const DB_NAME = 'mikrotik_billing'

/**
 * Get database instance
 */
export async function getDatabase(): Promise<Db> {
  const client = await clientPromise
  return client.db(DB_NAME)
}

/**
 * Get a collection
 */
export async function getCollection<T = any>(collectionName: string): Promise<Collection<T>> {
  const db = await getDatabase()
  return db.collection<T>(collectionName)
}

/**
 * Convert string to ObjectId safely
 */
export function toObjectId(id: string | ObjectId): ObjectId {
  if (typeof id === 'string') {
    return new ObjectId(id)
  }
  return id
}

/**
 * Check if string is valid ObjectId
 */
export function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id)
}

/**
 * Ticket-specific helpers
 */
export const TicketHelpers = {
  /**
   * Get tickets collection
   */
  async getCollection() {
    return getCollection('tickets')
  },

  /**
   * Create indexes for tickets collection
   */
  async createIndexes() {
    const collection = await this.getCollection()
    
    await collection.createIndex({ customerId: 1 })
    await collection.createIndex({ userId: 1 })
    await collection.createIndex({ routerId: 1 })
    await collection.createIndex({ status: 1 })
    await collection.createIndex({ createdAt: -1 })
    await collection.createIndex({ 'sla.breachedSla': 1 })
    await collection.createIndex({ customerId: 1, status: 1 })
    await collection.createIndex({ status: 1, 'ticket.priority': 1 })
    await collection.createIndex(
      { 'ticket.title': 'text', 'ticket.description': 'text' },
      { name: 'ticket_text_search' }
    )
  },

  /**
   * Get ticket statistics for a customer
   */
  async getStatistics(customerId: string) {
    const collection = await this.getCollection()
    
    const stats = await collection.aggregate([
      {
        $match: { customerId: toObjectId(customerId) }
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
    ]).toArray()

    return stats[0] || {
      total: 0,
      open: 0,
      inProgress: 0,
      resolved: 0,
      breachedSla: 0,
      avgResponseTime: 0
    }
  },

  /**
   * Check if ticket SLA is breached
   */
  checkSLABreach(ticket: any): boolean {
    const now = new Date()
    const createdTime = new Date(ticket.createdAt).getTime()
    const hoursSinceCreation = (now.getTime() - createdTime) / (1000 * 60 * 60)

    // Check response time SLA
    if (!ticket.sla.firstResponseAt && hoursSinceCreation > ticket.sla.responseTime) {
      return true
    }

    // Check resolution time SLA
    if (!ticket.sla.resolvedAt && hoursSinceCreation > ticket.sla.resolutionTime) {
      return true
    }

    return false
  },

  /**
   * Get SLA times based on priority
   */
  getSLATimes(priority: string) {
    const slaMapping: Record<string, { responseTime: number; resolutionTime: number }> = {
      urgent: { responseTime: 1, resolutionTime: 4 },
      high: { responseTime: 2, resolutionTime: 24 },
      medium: { responseTime: 4, resolutionTime: 48 },
      low: { responseTime: 24, resolutionTime: 72 },
    }

    return slaMapping[priority] || slaMapping.medium
  }
}

/**
 * User-specific helpers
 */
export const UserHelpers = {
  async getCollection() {
    return getCollection('users')
  },

  async findById(userId: string) {
    const collection = await this.getCollection()
    return collection.findOne({ _id: toObjectId(userId) })
  }
}

/**
 * Router-specific helpers
 */
export const RouterHelpers = {
  async getCollection() {
    return getCollection('routers')
  },

  async findByIdAndCustomer(routerId: string, customerId: string) {
    const collection = await this.getCollection()
    return collection.findOne({
      _id: toObjectId(routerId),
      customerId: toObjectId(customerId)
    })
  }
}

/**
 * Customer-specific helpers
 */
export const CustomerHelpers = {
  async getCollection() {
    return getCollection('customers')
  },

  async findById(customerId: string) {
    const collection = await this.getCollection()
    return collection.findOne({ _id: toObjectId(customerId) })
  }
}