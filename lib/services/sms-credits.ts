// lib/services/sms-credits.ts
import { ObjectId, Db } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { NotificationService } from './notification';

/**
 * SMS Credits Service
 * 
 * Manages SMS credits system:
 * - Credit balance tracking
 * - Credit purchases (top-ups)
 * - Credit deductions (SMS usage)
 * - Transaction history
 * - Cost calculations
 */

export interface SMSCreditsBalance {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  lastPurchaseDate?: Date;
  lastPurchaseAmount?: number;
}

export interface SMSCreditTransaction {
  _id?: ObjectId;
  userId: ObjectId;
  type: 'purchase' | 'usage' | 'refund' | 'adjustment';
  amount: number; // Positive for additions, negative for deductions
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  metadata?: {
    messageId?: string;
    recipient?: string;
    packageId?: string;
    smsCount?: number;
  };
  paymentInfo?: {
    TransID?: string;
    TransAmount?: number;
    PhoneNumber?: string;
    PaymentMethod?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchasePackage {
  id: string;
  name: string;
  credits: number;
  price: number; // KES
  bonus: number; // Extra credits
  popular?: boolean;
  savings?: string;
}

export interface SMSPlan {
  planId: string;
  name: string;
  description: string;
  pricePerCredit: number;
  minimumCredits: number;
  maximumCredits?: number;
  bonusPercentage: number;
  isActive: boolean;
  isCustom: boolean;
  displayOrder: number;
  features: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class SMSCreditsService {
  /**
   * SMS Credit Pricing Packages
   * @deprecated Use getPlansFromDatabase() instead for server-side verification
   * These are kept for backward compatibility only
   */
  static readonly PACKAGES: PurchasePackage[] = [
    {
      id: 'starter',
      name: 'Starter',
      credits: 100,
      price: 100,
      bonus: 0,
    },
    {
      id: 'basic',
      name: 'Basic',
      credits: 500,
      price: 450,
      bonus: 50,
      savings: '10% off',
    },
    {
      id: 'standard',
      name: 'Standard',
      credits: 1000,
      price: 800,
      bonus: 200,
      popular: true,
      savings: '20% off',
    },
    {
      id: 'premium',
      name: 'Premium',
      credits: 2500,
      price: 1750,
      bonus: 750,
      savings: '30% off',
    },
    {
      id: 'business',
      name: 'Business',
      credits: 5000,
      price: 3000,
      bonus: 2000,
      savings: '40% off',
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      credits: 10000,
      price: 5000,
      bonus: 5000,
      savings: '50% off',
    },
  ];

  /**
   * Get SMS credit cost per message
   */
  static readonly COST_PER_SMS = 1; // 1 credit = 1 SMS

  /**
   * Get database instance
   */
  private static async getDb(): Promise<Db> {
    const client = await clientPromise;
    return client.db();
  }

  /**
   * Get all active SMS plans from database
   */
  static async getPlansFromDatabase(): Promise<SMSPlan[]> {
    const db = await this.getDb();
    const plans = await db.collection<SMSPlan>('sms_plans')
      .find({ isActive: true })
      .sort({ displayOrder: 1 })
      .toArray();
    
    return plans;
  }

  /**
   * Get a specific SMS plan from database by planId
   */
  static async getPlanFromDatabase(planId: string): Promise<SMSPlan | null> {
    const db = await this.getDb();
    const plan = await db.collection<SMSPlan>('sms_plans')
      .findOne({ planId, isActive: true });
    
    return plan;
  }

  /**
   * Verify purchase amount against database plan
   * Returns the plan if valid, throws error if invalid
   */
  static async verifyPurchase(planId: string, credits: number, amount: number): Promise<SMSPlan> {
    const plan = await this.getPlanFromDatabase(planId);
    
    if (!plan) {
      throw new Error(`Invalid plan: ${planId}`);
    }

    // For enterprise (custom) plan
    if (plan.isCustom) {
      // Minimum amount validation
      const minimumAmount = plan.minimumCredits * plan.pricePerCredit;
      if (amount < minimumAmount) {
        throw new Error(`Minimum amount for ${plan.name} is KES ${minimumAmount.toFixed(2)}`);
      }

      // Verify credits calculation
      const expectedCredits = Math.floor(amount / plan.pricePerCredit);
      const tolerance = 1; // Allow 1 credit tolerance for rounding
      
      if (Math.abs(credits - expectedCredits) > tolerance) {
        throw new Error('Credits calculation mismatch');
      }

      return plan;
    }

    // For fixed plans, verify the amount matches expected
    const expectedAmount = credits * plan.pricePerCredit;
    const tolerance = 1; // Allow KES 1 tolerance for rounding
    
    if (Math.abs(amount - expectedAmount) > tolerance) {
      throw new Error(`Invalid amount for plan ${plan.name}. Expected KES ${expectedAmount.toFixed(2)}`);
    }

    // Verify credits are within plan limits
    if (credits < plan.minimumCredits) {
      throw new Error(`Minimum credits for ${plan.name} is ${plan.minimumCredits}`);
    }

    if (plan.maximumCredits && credits > plan.maximumCredits) {
      throw new Error(`Maximum credits for ${plan.name} is ${plan.maximumCredits}`);
    }

    return plan;
  }

  /**
   * Get user's SMS credits balance
   */
  static async getBalance(userId: string | ObjectId): Promise<SMSCreditsBalance> {
    const db = await this.getDb();
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const user = await db.collection('users').findOne(
      { _id: userObjectId },
      { projection: { smsCredits: 1 } }
    );

    if (!user || !user.smsCredits) {
      // Initialize if not exists
      const defaultBalance: SMSCreditsBalance = {
        balance: 0,
        totalPurchased: 0,
        totalUsed: 0,
      };

      await db.collection('users').updateOne(
        { _id: userObjectId },
        { 
          $set: { 
            smsCredits: defaultBalance,
            updatedAt: new Date()
          } 
        }
      );

      return defaultBalance;
    }

    return user.smsCredits as SMSCreditsBalance;
  }

  /**
   * Check if user has sufficient credits
   */
  static async hasSufficientCredits(
    userId: string | ObjectId,
    requiredCredits: number
  ): Promise<{ sufficient: boolean; balance: number; required: number }> {
    const balance = await this.getBalance(userId);

    return {
      sufficient: balance.balance >= requiredCredits,
      balance: balance.balance,
      required: requiredCredits,
    };
  }

  /**
   * Deduct credits from user account (for SMS usage)
   */
  static async deductCredits(
    userId: string | ObjectId,
    amount: number,
    description: string,
    metadata?: SMSCreditTransaction['metadata']
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const db = await this.getDb();
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    try {
      // Get current balance
      const currentBalance = await this.getBalance(userObjectId);

      // Check if sufficient credits
      if (currentBalance.balance < amount) {
        return {
          success: false,
          newBalance: currentBalance.balance,
          error: `Insufficient credits. Required: ${amount}, Available: ${currentBalance.balance}`,
        };
      }

      const newBalance = currentBalance.balance - amount;
      const newTotalUsed = currentBalance.totalUsed + amount;

      // Update user balance
      await db.collection('users').updateOne(
        { _id: userObjectId },
        {
          $set: {
            'smsCredits.balance': newBalance,
            'smsCredits.totalUsed': newTotalUsed,
            updatedAt: new Date(),
          },
        }
      );

      // Log transaction
      const transaction: SMSCreditTransaction = {
        userId: userObjectId,
        type: 'usage',
        amount: -amount, // Negative for deduction
        balanceBefore: currentBalance.balance,
        balanceAfter: newBalance,
        description,
        ...(metadata && { metadata }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection('sms_credit_transactions').insertOne(transaction);

      console.log(`[SMS Credits] ✓ Deducted ${amount} credits from user ${userObjectId}`);
      console.log(`[SMS Credits]   Balance: ${currentBalance.balance} → ${newBalance}`);

      // Check if balance is now low (< 10 credits) and send warning
      if (newBalance < 10 && newBalance < currentBalance.balance) {
        try {
          // Check if we already sent a low credits warning recently (within 24 hours)
          const recentWarning = await db.collection('notifications').findOne({
            userId: userObjectId,
            'notification.category': 'sms',
            'notification.title': 'Low SMS Credits',
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
          });

          if (!recentWarning) {
            await NotificationService.createNotification({
              userId: userObjectId,
              type: 'warning',
              category: 'sms',
              priority: 'normal',
              title: 'Low SMS Credits',
              message: `Only ${newBalance} SMS credits remaining. Purchase more to avoid service interruption.`,
              metadata: {
                resourceType: 'sms',
                action: 'purchase_credits',
                link: '/sms-credits',
              },
              sendEmail: true,
            });
            
            console.log(`[SMS Credits] ⚠️ Low balance notification sent (${newBalance} credits remaining)`);
          }
        } catch (notifError) {
          console.error('[SMS Credits] Failed to send low balance notification:', notifError);
          // Don't fail the deduction
        }
      }

      return {
        success: true,
        newBalance,
      };
    } catch (error) {
      console.error('[SMS Credits] Error deducting credits:', error);
      return {
        success: false,
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Add credits to user account (for purchases or refunds)
   */
  static async addCredits(
    userId: string | ObjectId,
    amount: number,
    type: 'purchase' | 'refund' | 'adjustment',
    description: string,
    paymentInfo?: SMSCreditTransaction['paymentInfo']
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const db = await this.getDb();
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    try {
      // Get current balance
      const currentBalance = await this.getBalance(userObjectId);
      const newBalance = currentBalance.balance + amount;
      const newTotalPurchased = type === 'purchase' 
        ? currentBalance.totalPurchased + amount 
        : currentBalance.totalPurchased;

      // Prepare update
      const updateFields: any = {
        'smsCredits.balance': newBalance,
        'smsCredits.totalPurchased': newTotalPurchased,
        updatedAt: new Date(),
      };

      if (type === 'purchase') {
        updateFields['smsCredits.lastPurchaseDate'] = new Date();
        updateFields['smsCredits.lastPurchaseAmount'] = amount;
      }

      // Update user balance
      await db.collection('users').updateOne(
        { _id: userObjectId },
        { $set: updateFields }
      );

      // Log transaction
      const transaction: SMSCreditTransaction = {
        userId: userObjectId,
        type,
        amount, // Positive for addition
        balanceBefore: currentBalance.balance,
        balanceAfter: newBalance,
        description,
        ...(paymentInfo && { paymentInfo }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection('sms_credit_transactions').insertOne(transaction);

      console.log(`[SMS Credits] ✓ Added ${amount} credits to user ${userObjectId} (${type})`);
      console.log(`[SMS Credits]   Balance: ${currentBalance.balance} → ${newBalance}`);

      return {
        success: true,
        newBalance,
      };
    } catch (error) {
      console.error('[SMS Credits] Error adding credits:', error);
      return {
        success: false,
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get transaction history for a user
   */
  static async getTransactionHistory(
    userId: string | ObjectId,
    options?: {
      limit?: number;
      skip?: number;
      type?: SMSCreditTransaction['type'];
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{
    transactions: SMSCreditTransaction[];
    total: number;
    summary: {
      totalPurchased: number;
      totalUsed: number;
      totalRefunded: number;
    };
  }> {
    const db = await this.getDb();
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const query: any = { userId: userObjectId };

    if (options?.type) {
      query.type = options.type;
    }

    if (options?.startDate || options?.endDate) {
      query.createdAt = {};
      if (options.startDate) query.createdAt.$gte = options.startDate;
      if (options.endDate) query.createdAt.$lte = options.endDate;
    }

    // Get transactions
    const transactions = await db
      .collection('sms_credit_transactions')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(options?.skip || 0)
      .limit(options?.limit || 50)
      .toArray() as unknown as SMSCreditTransaction[];

    // Get total count
    const total = await db.collection('sms_credit_transactions').countDocuments(query);

    // Calculate summary
    const summaryPipeline = [
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: null,
          totalPurchased: {
            $sum: {
              $cond: [{ $eq: ['$type', 'purchase'] }, '$amount', 0],
            },
          },
          totalUsed: {
            $sum: {
              $cond: [{ $eq: ['$type', 'usage'] }, { $abs: '$amount' }, 0],
            },
          },
          totalRefunded: {
            $sum: {
              $cond: [{ $eq: ['$type', 'refund'] }, '$amount', 0],
            },
          },
        },
      },
    ];

    const summaryResult = await db
      .collection('sms_credit_transactions')
      .aggregate(summaryPipeline)
      .toArray();

    const summary = summaryResult[0]
      ? {
          totalPurchased: summaryResult[0].totalPurchased || 0,
          totalUsed: summaryResult[0].totalUsed || 0,
          totalRefunded: summaryResult[0].totalRefunded || 0,
        }
      : {
          totalPurchased: 0,
          totalUsed: 0,
          totalRefunded: 0,
        };

    return {
      transactions,
      total,
      summary,
    };
  }

  /**
   * Calculate SMS cost for a message
   * Handles multi-part SMS (messages > 160 characters)
   */
  static calculateSMSCost(message: string, recipientCount: number = 1): number {
    const messageLength = message.length;
    let smsCount = 1;

    if (messageLength > 160) {
      // Multi-part SMS - each segment is 153 characters (7 chars for header)
      smsCount = Math.ceil(messageLength / 153);
    }

    return smsCount * recipientCount * this.COST_PER_SMS;
  }

  /**
   * Get package by ID
   */
  static getPackage(packageId: string): PurchasePackage | undefined {
    return this.PACKAGES.find((pkg) => pkg.id === packageId);
  }

  /**
   * Get package by price (for webhook matching)
   */
  static getPackageByPrice(price: number): PurchasePackage | undefined {
    return this.PACKAGES.find((pkg) => pkg.price === price);
  }

  /**
   * Calculate total credits for a package (including bonus)
   */
  static getTotalCredits(packageId: string): number {
    const pkg = this.getPackage(packageId);
    return pkg ? pkg.credits + pkg.bonus : 0;
  }

  /**
   * Get user's SMS usage statistics
   */
  static async getUsageStatistics(
    userId: string | ObjectId,
    period?: { startDate: Date; endDate: Date }
  ): Promise<{
    totalSent: number;
    totalCost: number;
    averageCostPerDay: number;
    projectedMonthlyCost: number;
  }> {
    const db = await this.getDb();
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const matchQuery: any = {
      userId: userObjectId,
      type: 'usage',
    };

    if (period) {
      matchQuery.createdAt = {
        $gte: period.startDate,
        $lte: period.endDate,
      };
    }

    const stats = await db
      .collection('sms_credit_transactions')
      .aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalSent: { $sum: { $abs: '$amount' } },
            firstDate: { $min: '$createdAt' },
            lastDate: { $max: '$createdAt' },
          },
        },
      ])
      .toArray();

    if (!stats.length || !stats[0] || stats[0].totalSent === 0) {
      return {
        totalSent: 0,
        totalCost: 0,
        averageCostPerDay: 0,
        projectedMonthlyCost: 0,
      };
    }

    const result = stats[0];
    const totalSent = result.totalSent as number;
    const totalCost = totalSent * this.COST_PER_SMS; // In credits (1 credit = KES 1)

    // Calculate days in period
    const firstDate = new Date(result.firstDate as Date);
    const lastDate = new Date(result.lastDate as Date);
    const daysDiff = Math.max(
      1,
      Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    const averageCostPerDay = totalCost / daysDiff;
    const projectedMonthlyCost = averageCostPerDay * 30;

    return {
      totalSent,
      totalCost,
      averageCostPerDay,
      projectedMonthlyCost,
    };
  }
}

export default SMSCreditsService;
