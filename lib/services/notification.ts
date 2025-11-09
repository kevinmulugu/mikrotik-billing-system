/**
 * Notification Service
 * 
 * Provides centralized notification creation and management.
 * Handles in-app notifications and email notifications for router owners.
 * 
 * Features:
 * - Create notifications with automatic expiry (90 days)
 * - Get unread count for session/header
 * - Mark as read (single or bulk)
 * - Delete notifications
 * - Email notification support (optional)
 */

import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import Notification, { 
  NotificationType, 
  NotificationCategory, 
  NotificationPriority 
} from '@/models/Notification';

interface NotificationMetadata {
  resourceType?: 'router' | 'voucher' | 'payment' | 'vpn' | 'ticket' | 'sms';
  resourceId?: ObjectId | string;
  action?: string;
  link?: string;
  amount?: number;
  transactionId?: string;
  [key: string]: any;
}

interface CreateNotificationParams {
  userId: ObjectId | string;
  type: NotificationType;
  category: NotificationCategory;
  priority?: NotificationPriority;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
  sendEmail?: boolean;
  expiryDays?: number;
}

export class NotificationService {
  /**
   * Create a new notification
   * 
   * @param params - Notification parameters
   * @returns Created notification document
   */
  static async createNotification(params: CreateNotificationParams) {
    try {
      const db = await getDatabase();
      const now = new Date();
      const expiryDays = params.expiryDays || 90;
      const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);
      
      const userId = typeof params.userId === 'string' 
        ? new ObjectId(params.userId) 
        : params.userId;
      
      // Create notification document
      const notification = {
        userId,
        notification: {
          type: params.type,
          category: params.category,
          priority: params.priority || 'normal',
          title: params.title,
          message: params.message,
        },
        status: {
          read: false,
        },
        metadata: params.metadata,
        emailSent: false,
        createdAt: now,
        expiresAt,
      };
      
      const result = await db.collection('notifications').insertOne(notification);
      
      console.log(`[Notification] Created ${params.type} notification for user ${userId}:`, params.title);
      
      // Send email if requested
      if (params.sendEmail) {
        await this.sendEmailNotification(userId, notification);
      }
      
      return {
        success: true,
        notificationId: result.insertedId,
        notification,
      };
    } catch (error) {
      console.error('[Notification] Failed to create notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Get unread notification count for a user
   * 
   * @param userId - User ObjectId
   * @returns Unread count
   */
  static async getUnreadCount(userId: ObjectId | string): Promise<number> {
    try {
      const db = await getDatabase();
      
      const userObjectId = typeof userId === 'string' 
        ? new ObjectId(userId) 
        : userId;
      
      const count = await db.collection('notifications').countDocuments({
        userId: userObjectId,
        'status.read': false,
      });
      
      return count;
    } catch (error) {
      console.error('[Notification] Failed to get unread count:', error);
      return 0;
    }
  }
  
  /**
   * Get paginated notifications for a user
   * 
   * @param userId - User ObjectId
   * @param options - Query options (page, limit, category, unreadOnly)
   * @returns Paginated notifications
   */
  static async getNotifications(
    userId: ObjectId | string,
    options: {
      page?: number;
      limit?: number;
      category?: NotificationCategory;
      unreadOnly?: boolean;
    } = {}
  ) {
    try {
      const db = await getDatabase();
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;
      
      const userObjectId = typeof userId === 'string' 
        ? new ObjectId(userId) 
        : userId;
      
      const query: any = { userId: userObjectId };
      
      if (options.category) {
        query['notification.category'] = options.category;
      }
      
      if (options.unreadOnly) {
        query['status.read'] = false;
      }
      
      const [notifications, total] = await Promise.all([
        db.collection('notifications')
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        db.collection('notifications').countDocuments(query),
      ]);
      
      return {
        success: true,
        notifications,
        total,
        page,
        limit,
        hasMore: skip + notifications.length < total,
      };
    } catch (error) {
      console.error('[Notification] Failed to get notifications:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        notifications: [],
        total: 0,
        page: 1,
        limit: 20,
        hasMore: false,
      };
    }
  }
  
  /**
   * Mark a single notification as read
   * 
   * @param notificationId - Notification ObjectId
   * @param userId - User ObjectId (for security check)
   * @returns Success status
   */
  static async markAsRead(
    notificationId: ObjectId | string,
    userId: ObjectId | string
  ) {
    try {
      const db = await getDatabase();
      
      const notifObjectId = typeof notificationId === 'string' 
        ? new ObjectId(notificationId) 
        : notificationId;
      
      const userObjectId = typeof userId === 'string' 
        ? new ObjectId(userId) 
        : userId;
      
      const result = await db.collection('notifications').updateOne(
        { _id: notifObjectId, userId: userObjectId },
        {
          $set: {
            'status.read': true,
            'status.readAt': new Date(),
          },
        }
      );
      
      if (result.matchedCount === 0) {
        return {
          success: false,
          error: 'Notification not found or access denied',
        };
      }
      
      return {
        success: true,
        modified: result.modifiedCount > 0,
      };
    } catch (error) {
      console.error('[Notification] Failed to mark as read:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Mark all notifications as read for a user
   * 
   * @param userId - User ObjectId
   * @returns Success status and count
   */
  static async markAllAsRead(userId: ObjectId | string) {
    try {
      const db = await getDatabase();
      
      const userObjectId = typeof userId === 'string' 
        ? new ObjectId(userId) 
        : userId;
      
      const result = await db.collection('notifications').updateMany(
        { userId: userObjectId, 'status.read': false },
        {
          $set: {
            'status.read': true,
            'status.readAt': new Date(),
          },
        }
      );
      
      return {
        success: true,
        count: result.modifiedCount,
      };
    } catch (error) {
      console.error('[Notification] Failed to mark all as read:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        count: 0,
      };
    }
  }
  
  /**
   * Delete a notification
   * 
   * @param notificationId - Notification ObjectId
   * @param userId - User ObjectId (for security check)
   * @returns Success status
   */
  static async deleteNotification(
    notificationId: ObjectId | string,
    userId: ObjectId | string
  ) {
    try {
      const db = await getDatabase();
      
      const notifObjectId = typeof notificationId === 'string' 
        ? new ObjectId(notificationId) 
        : notificationId;
      
      const userObjectId = typeof userId === 'string' 
        ? new ObjectId(userId) 
        : userId;
      
      const result = await db.collection('notifications').deleteOne({
        _id: notifObjectId,
        userId: userObjectId,
      });
      
      if (result.deletedCount === 0) {
        return {
          success: false,
          error: 'Notification not found or access denied',
        };
      }
      
      return {
        success: true,
      };
    } catch (error) {
      console.error('[Notification] Failed to delete notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Send email notification (placeholder for future implementation)
   * 
   * @param userId - User ObjectId
   * @param notification - Notification document
   */
  private static async sendEmailNotification(
    userId: ObjectId,
    notification: any
  ) {
    try {
      const db = await getDatabase();
      
      // Get user email
      const user = await db.collection('users').findOne(
        { _id: userId },
        { projection: { email: 1, name: 1, 'preferences.notifications.email': 1 } }
      );
      
      if (!user?.email) {
        console.warn('[Notification] User has no email address');
        return;
      }
      
      // Check if user has email notifications enabled
      const emailEnabled = user.preferences?.notifications?.email !== false;
      
      if (!emailEnabled) {
        console.log('[Notification] User has email notifications disabled');
        return;
      }
      
      // TODO: Implement email sending via your email service
      // For now, just log
      console.log('[Notification] Email notification would be sent to:', user.email);
      console.log('  Subject:', notification.notification.title);
      console.log('  Message:', notification.notification.message);
      
      // Mark email as sent
      await db.collection('notifications').updateOne(
        { _id: notification._id },
        {
          $set: {
            emailSent: true,
            emailSentAt: new Date(),
          },
        }
      );
    } catch (error) {
      console.error('[Notification] Failed to send email notification:', error);
      // Don't fail the notification creation
    }
  }
}
