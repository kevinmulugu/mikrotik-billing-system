import mongoose, { Document, Model, Schema } from 'mongoose';

/**
 * Notification Model
 * 
 * Stores in-app notifications for router owners about critical events,
 * payments, system updates, etc.
 * 
 * Features:
 * - Indexed for fast queries (userId, read status, createdAt)
 * - TTL for auto-deletion after 90 days
 * - Metadata for linking to resources (routers, vouchers, etc.)
 * - Email notification support via flag
 */

// Notification types
export type NotificationType = 'success' | 'error' | 'warning' | 'info';
export type NotificationCategory = 'payment' | 'voucher' | 'router' | 'vpn' | 'sms' | 'support' | 'system';
export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low';

// Notification metadata interface
interface INotificationMetadata {
  resourceType?: 'router' | 'voucher' | 'payment' | 'vpn' | 'ticket' | 'sms';
  resourceId?: mongoose.Types.ObjectId | string;
  action?: string;
  link?: string;
  amount?: number;
  transactionId?: string;
  [key: string]: any; // Allow additional custom fields
}

// Notification interface
export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  
  notification: {
    type: NotificationType;
    category: NotificationCategory;
    priority: NotificationPriority;
    title: string;
    message: string;
  };
  
  status: {
    read: boolean;
    readAt?: Date;
  };
  
  metadata?: INotificationMetadata;
  
  emailSent?: boolean;
  emailSentAt?: Date;
  
  createdAt: Date;
  expiresAt: Date; // TTL index - auto-delete after 90 days
}

// Notification schema
const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    notification: {
      type: {
        type: String,
        enum: ['success', 'error', 'warning', 'info'],
        required: true,
        index: true,
      },
      category: {
        type: String,
        enum: ['payment', 'voucher', 'router', 'vpn', 'sms', 'support', 'system'],
        required: true,
        index: true,
      },
      priority: {
        type: String,
        enum: ['urgent', 'high', 'normal', 'low'],
        required: true,
        default: 'normal',
      },
      title: {
        type: String,
        required: true,
        maxlength: 200,
      },
      message: {
        type: String,
        required: true,
        maxlength: 1000,
      },
    },
    
    status: {
      read: {
        type: Boolean,
        default: false,
        index: true,
      },
      readAt: Date,
    },
    
    metadata: {
      resourceType: {
        type: String,
        enum: ['router', 'voucher', 'payment', 'vpn', 'ticket', 'sms'],
      },
      resourceId: Schema.Types.Mixed,
      action: String,
      link: String,
      amount: Number,
      transactionId: String,
    },
    
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: Date,
    
    createdAt: {
      type: Date,
      default: Date.now,
      index: -1, // Descending index for sorting
    },
    
    expiresAt: {
      type: Date,
      required: true,
      index: true, // TTL index
    },
  },
  {
    timestamps: false, // We manage createdAt manually
  }
);

// TTL index - auto-delete notifications after they expire
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for efficient queries
NotificationSchema.index({ userId: 1, 'status.read': 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, 'notification.category': 1, createdAt: -1 });

// Static methods
NotificationSchema.statics.createNotification = async function (
  userId: mongoose.Types.ObjectId,
  notification: {
    type: NotificationType;
    category: NotificationCategory;
    priority?: NotificationPriority;
    title: string;
    message: string;
  },
  metadata?: INotificationMetadata,
  expiryDays: number = 90
): Promise<INotification> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);
  
  return await this.create({
    userId,
    notification: {
      type: notification.type,
      category: notification.category,
      priority: notification.priority || 'normal',
      title: notification.title,
      message: notification.message,
    },
    status: {
      read: false,
    },
    metadata,
    emailSent: false,
    createdAt: now,
    expiresAt,
  });
};

NotificationSchema.statics.getUnreadCount = async function (
  userId: mongoose.Types.ObjectId
): Promise<number> {
  return await this.countDocuments({
    userId,
    'status.read': false,
  });
};

NotificationSchema.statics.markAsRead = async function (
  notificationId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<boolean> {
  const result = await this.updateOne(
    { _id: notificationId, userId },
    {
      $set: {
        'status.read': true,
        'status.readAt': new Date(),
      },
    }
  );
  
  return result.modifiedCount > 0;
};

NotificationSchema.statics.markAllAsRead = async function (
  userId: mongoose.Types.ObjectId
): Promise<number> {
  const result = await this.updateMany(
    { userId, 'status.read': false },
    {
      $set: {
        'status.read': true,
        'status.readAt': new Date(),
      },
    }
  );
  
  return result.modifiedCount;
};

NotificationSchema.statics.deleteNotification = async function (
  notificationId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<boolean> {
  const result = await this.deleteOne({
    _id: notificationId,
    userId,
  });
  
  return result.deletedCount > 0;
};

NotificationSchema.statics.getNotifications = async function (
  userId: mongoose.Types.ObjectId,
  options: {
    page?: number;
    limit?: number;
    category?: NotificationCategory;
    unreadOnly?: boolean;
  } = {}
): Promise<{ notifications: INotification[]; total: number; hasMore: boolean }> {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;
  
  const query: any = { userId };
  
  if (options.category) {
    query['notification.category'] = options.category;
  }
  
  if (options.unreadOnly) {
    query['status.read'] = false;
  }
  
  const [notifications, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query),
  ]);
  
  return {
    notifications,
    total,
    hasMore: skip + notifications.length < total,
  };
};

// Export model
const Notification: Model<INotification> = 
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
