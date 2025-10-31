// scripts/aggregate-commissions.ts
/**
 * Commission Aggregation Script
 * 
 * This script aggregates voucher sales from the vouchers collection into the commissions collection.
 * Should be run periodically (hourly or daily) via cron.
 * 
 * What it does:
 * 1. Finds paid vouchers with unprocessed commissions
 * 2. Groups by userId (router owner) and period (month/year)
 * 3. Updates/creates commission records with totals
 * 4. Marks vouchers as commission processed
 * 
 * Usage: npx tsx scripts/aggregate-commissions.ts
 * Cron: Run hourly or daily depending on volume
 */

import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'mikrotik_billing';

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in .env.local');
}

interface Voucher {
  _id: ObjectId;
  userId: ObjectId;
  routerId: ObjectId;
  payment: {
    method: string;
    transactionId: string;
    amount: number;
    commission: number;
    paymentDate: Date;
  };
  commissionProcessed?: boolean;
}

async function aggregateCommissions() {
  console.log('🔄 Starting commission aggregation...\n');

  const client = new MongoClient(MONGODB_URI as string);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(MONGODB_DB_NAME);
    const vouchersCollection = db.collection('vouchers');
    const commissionsCollection = db.collection('commissions');

    // Find paid vouchers with unprocessed commissions
    const unprocessedVouchers = await vouchersCollection
      .find({
        status: { $in: ['paid', 'used', 'expired'] },
        'payment.transactionId': { $exists: true },
        'payment.commission': { $exists: true },
        commissionProcessed: { $ne: true },
      })
      .toArray() as unknown as Voucher[];

    if (unprocessedVouchers.length === 0) {
      console.log('ℹ️  No unprocessed vouchers found. All caught up!\n');
      return;
    }

    console.log(`📊 Found ${unprocessedVouchers.length} unprocessed vouchers\n`);

    // Group vouchers by userId and period (month/year)
    const groupedByUserAndPeriod: Record<string, Voucher[]> = {};

    for (const voucher of unprocessedVouchers) {
      const date = new Date(voucher.payment.paymentDate);
      const month = date.getMonth() + 1; // 1-12
      const year = date.getFullYear();
      const key = `${voucher.userId.toString()}-${year}-${month}`;

      if (!groupedByUserAndPeriod[key]) {
        groupedByUserAndPeriod[key] = [];
      }
      groupedByUserAndPeriod[key].push(voucher);
    }

    console.log(`👥 Processing commissions for ${Object.keys(groupedByUserAndPeriod).length} user-period combinations\n`);

    let processedCount = 0;
    let updatedCount = 0;
    let createdCount = 0;

    // Process each user-period group
    for (const [key, vouchers] of Object.entries(groupedByUserAndPeriod)) {
      const [userIdStr, yearStr, monthStr] = key.split('-');
      const userId = new ObjectId(userIdStr);
      const month = parseInt(monthStr!);
      const year = parseInt(yearStr!);

      // Calculate totals for this period
      const totalSales = vouchers.reduce((sum, v) => sum + v.payment.amount, 0);
      const totalCommission = vouchers.reduce((sum, v) => sum + v.payment.commission, 0);
      const transactionCount = vouchers.length;

      // Find existing commission record for this user-period
      const existingCommission = await commissionsCollection.findOne({
        userId: userId,
        'period.month': month,
        'period.year': year,
      });

      if (existingCommission) {
        // Update existing commission record
        await commissionsCollection.updateOne(
          { _id: existingCommission._id },
          {
            $inc: {
              'earnings.totalSales': totalSales,
              'earnings.totalCommission': totalCommission,
              'earnings.transactionCount': transactionCount,
            },
            $set: {
              updatedAt: new Date(),
            },
          }
        );
        console.log(`  ✓ Updated commission for user ${userIdStr} - ${year}-${month.toString().padStart(2, '0')}`);
        console.log(`    Sales: +KES ${totalSales.toFixed(2)}, Commission: +KES ${totalCommission.toFixed(2)}`);
        updatedCount++;
      } else {
        // Create new commission record
        await commissionsCollection.insertOne({
          userId: userId,
          period: {
            month: month,
            year: year,
            startDate: new Date(year, month - 1, 1),
            endDate: new Date(year, month, 0, 23, 59, 59, 999),
          },
          earnings: {
            totalSales: totalSales,
            totalCommission: totalCommission,
            transactionCount: transactionCount,
          },
          payout: {
            status: 'unpaid',
            amount: 0,
            paidAt: null,
            transactionId: null,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`  ✓ Created commission for user ${userIdStr} - ${year}-${month.toString().padStart(2, '0')}`);
        console.log(`    Sales: KES ${totalSales.toFixed(2)}, Commission: KES ${totalCommission.toFixed(2)}`);
        createdCount++;
      }

      // Mark all vouchers in this group as processed
      const voucherIds = vouchers.map(v => v._id);
      await vouchersCollection.updateMany(
        { _id: { $in: voucherIds } },
        {
          $set: {
            commissionProcessed: true,
            commissionProcessedAt: new Date(),
          },
        }
      );

      processedCount += transactionCount;
    }

    console.log('\n✅ Commission aggregation completed!\n');
    console.log('📈 Summary:');
    console.log(`  - Vouchers processed: ${processedCount}`);
    console.log(`  - Commission records created: ${createdCount}`);
    console.log(`  - Commission records updated: ${updatedCount}`);
    console.log(`  - Total commission records affected: ${createdCount + updatedCount}\n`);

  } catch (error) {
    console.error('❌ Error during commission aggregation:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB\n');
  }
}

// Run the aggregation
aggregateCommissions()
  .then(() => {
    console.log('🎉 Commission aggregation finished successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Commission aggregation failed:', error);
    process.exit(1);
  });
