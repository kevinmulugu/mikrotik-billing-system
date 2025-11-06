// scripts/init-sms-plans.ts
/**
 * Initialize SMS Plans Collection
 * 
 * This script creates the default SMS pricing plans in the database.
 * These plans are used for SMS credit purchases and verified server-side
 * to prevent pricing manipulation attacks.
 * 
 * Usage: pnpm tsx scripts/init-sms-plans.ts
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'mikrotik_billing';

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in .env.local');
}

interface SMSPlan {
  planId: string;
  name: string;
  description: string;
  pricePerCredit: number; // KES per SMS
  minimumCredits: number;
  maximumCredits?: number;
  bonusPercentage: number; // Bonus credits as percentage
  isActive: boolean;
  isCustom: boolean;
  displayOrder: number;
  features: string[];
  createdAt: Date;
  updatedAt: Date;
}

const defaultPlans: SMSPlan[] = [
  {
    planId: 'starter',
    name: 'Starter',
    description: 'Perfect for getting started with SMS notifications',
    pricePerCredit: 1.00,
    minimumCredits: 10,
    maximumCredits: 1000,
    bonusPercentage: 0,
    isActive: true,
    isCustom: false,
    displayOrder: 1,
    features: [
      'Pay as you go',
      'No commitment',
      'Instant activation'
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    planId: 'basic',
    name: 'Basic',
    description: 'Great value for regular SMS users',
    pricePerCredit: 0.80,
    minimumCredits: 100,
    maximumCredits: 5000,
    bonusPercentage: 0,
    isActive: true,
    isCustom: false,
    displayOrder: 2,
    features: [
      'KES 0.80 per SMS',
      '20% savings',
      'No bonus credits'
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    planId: 'standard',
    name: 'Standard',
    description: 'Best for growing businesses',
    pricePerCredit: 0.70,
    minimumCredits: 500,
    maximumCredits: 10000,
    bonusPercentage: 0,
    isActive: true,
    isCustom: false,
    displayOrder: 3,
    features: [
      'KES 0.70 per SMS',
      '30% savings',
      'Most popular plan'
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    planId: 'premium',
    name: 'Premium',
    description: 'Ideal for high-volume senders',
    pricePerCredit: 0.50,
    minimumCredits: 1000,
    maximumCredits: 50000,
    bonusPercentage: 0,
    isActive: true,
    isCustom: false,
    displayOrder: 4,
    features: [
      'KES 0.50 per SMS',
      '50% savings',
      'Priority support'
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    planId: 'enterprise',
    name: 'Enterprise',
    description: 'Best rate for large volume users',
    pricePerCredit: 0.40,
    minimumCredits: 5000,
    // No maximumCredits for unlimited
    bonusPercentage: 0,
    isActive: true,
    isCustom: true, // Allows custom amounts
    displayOrder: 5,
    features: [
      'KES 0.40 per SMS',
      '60% savings',
      'Custom amounts over KES 5,000',
      'Dedicated support'
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

async function initSMSPlans() {
  const client = new MongoClient(MONGODB_URI!);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB\n');

    const db = client.db(MONGODB_DB_NAME);
    const plansCollection = db.collection<SMSPlan>('sms_plans');

    console.log('📋 Initializing SMS Plans...\n');

    // Check if plans already exist
    const existingPlansCount = await plansCollection.countDocuments();

    if (existingPlansCount > 0) {
      console.log(`⚠️  Found ${existingPlansCount} existing plan(s)`);
      console.log('   Options:');
      console.log('   1. Keep existing plans (do nothing)');
      console.log('   2. Update existing plans with new values');
      console.log('   3. Delete and recreate all plans\n');

      // For script execution, we'll use upsert to update/insert
      console.log('📝 Using upsert strategy (update if exists, insert if not)...\n');

      for (const plan of defaultPlans) {
        const updateDoc: any = {
          $set: {
            name: plan.name,
            description: plan.description,
            pricePerCredit: plan.pricePerCredit,
            minimumCredits: plan.minimumCredits,
            bonusPercentage: plan.bonusPercentage,
            isActive: plan.isActive,
            isCustom: plan.isCustom,
            displayOrder: plan.displayOrder,
            features: plan.features,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            planId: plan.planId,
            createdAt: new Date(),
          }
        };

        // Only set maximumCredits if defined
        if (plan.maximumCredits !== undefined) {
          updateDoc.$set.maximumCredits = plan.maximumCredits;
        }

        const result = await plansCollection.updateOne(
          { planId: plan.planId },
          updateDoc,
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          console.log(`  ✓ Created plan: ${plan.name} (${plan.planId})`);
        } else if (result.modifiedCount > 0) {
          console.log(`  ↻ Updated plan: ${plan.name} (${plan.planId})`);
        } else {
          console.log(`  ⊙ No changes: ${plan.name} (${plan.planId})`);
        }
      }
    } else {
      // No existing plans, insert all
      const result = await plansCollection.insertMany(defaultPlans);
      console.log(`✓ Inserted ${result.insertedCount} SMS plans\n`);

      for (const plan of defaultPlans) {
        console.log(`  • ${plan.name} (${plan.planId}) - KES ${plan.pricePerCredit.toFixed(2)}/SMS`);
      }
    }

    console.log('\n📊 Current SMS Plans:\n');

    // Display all active plans
    const activePlans = await plansCollection
      .find({ isActive: true })
      .sort({ displayOrder: 1 })
      .toArray();

    console.log('┌─────────────┬──────────────┬────────────┬──────────────┬──────────┐');
    console.log('│ Plan ID     │ Name         │ Price/SMS  │ Min Credits  │ Custom   │');
    console.log('├─────────────┼──────────────┼────────────┼──────────────┼──────────┤');

    for (const plan of activePlans) {
      const planId = plan.planId.padEnd(11);
      const name = plan.name.padEnd(12);
      const price = `KES ${plan.pricePerCredit.toFixed(2)}`.padEnd(10);
      const minCredits = plan.minimumCredits.toString().padEnd(12);
      const custom = (plan.isCustom ? 'Yes' : 'No').padEnd(8);
      
      console.log(`│ ${planId} │ ${name} │ ${price} │ ${minCredits} │ ${custom} │`);
    }

    console.log('└─────────────┴──────────────┴────────────┴──────────────┴──────────┘\n');

    console.log('✅ SMS Plans initialization complete!\n');

  } catch (error) {
    console.error('❌ Error initializing SMS plans:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('✓ Database connection closed');
  }
}

// Run the initialization
initSMSPlans();
