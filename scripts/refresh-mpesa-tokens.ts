// scripts/refresh-mpesa-tokens.ts
/**
 * M-Pesa Token Refresh Cron Job
 * 
 * This script refreshes access tokens for all active paybills.
 * Tokens expire after ~1 hour, so this runs every 30 minutes to ensure valid tokens.
 * 
 * Usage: pnpm refresh-tokens
 * Cron: *30 * * * * (every 30 minutes)
 * 
 * Run via cron or scheduler:
 * - Vercel Cron: .vercel/cron.json
 * - Manual: npx tsx scripts/refresh-mpesa-tokens.ts
 * 
 * NOTE: This script does NOT import lib/mongodb or lib/services/mpesa
 * to avoid module initialization issues with environment variables.
 * It uses its own MongoDB connection and implements token refresh directly.
 */

// Load environment variables FIRST before any other imports
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Only import what's needed
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'mikrotik_billing';
const MPESA_BASE_URL = process.env.MPESA_ENVIRONMENT === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in .env.local');
}

// log the mpesa base url
console.log('M-Pesa Base URL:', MPESA_BASE_URL);

interface Paybill {
  _id: any;
  paybillInfo: {
    number: string;
    name: string;
    type: 'paybill' | 'till';
  };
  credentials?: {
    consumerKey?: string;
    consumerSecret?: string;
    accessToken?: string;
    tokenExpiresAt?: Date;
  };
  status: string;
}

interface AccessTokenResponse {
  access_token: string;
  expires_in: string;
}

/**
 * Generate M-Pesa access token for a paybill
 * This is a standalone implementation for the script only
 */
async function generateAccessToken(
  db: any,
  paybill: Paybill
): Promise<{ token: string; expiresAt: Date } | null> {
  try {
    const consumerKey = paybill.credentials?.consumerKey;
    const consumerSecret = paybill.credentials?.consumerSecret;

    if (!consumerKey || !consumerSecret) {
      throw new Error(`Missing credentials for paybill ${paybill.paybillInfo.number}`);
    }

    // Generate auth string
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    const response = await fetch(`${MPESA_BASE_URL}/oauth/v2/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to generate token: ${response.statusText}`);
    }

    const data: AccessTokenResponse = await response.json();
    
    // Token expires in seconds (usually 3599 seconds = ~1 hour)
    const expiresIn = parseInt(data.expires_in);
    const expiresAt = new Date(Date.now() + (expiresIn * 1000));

    // Update paybill with new token
    await db.collection('paybills').updateOne(
      { _id: paybill._id },
      {
        $set: {
          'credentials.accessToken': data.access_token,
          'credentials.tokenExpiresAt': expiresAt,
          'credentials.lastTokenRefresh': new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return {
      token: data.access_token,
      expiresAt,
    };
  } catch (error) {
    console.error('Error generating M-Pesa access token:', error);
    return null;
  }
}

async function refreshMpesaTokens() {
  console.log('🔄 M-Pesa Token Refresh Started');
  console.log('================================\n');

  const client = new MongoClient(MONGODB_URI!);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(MONGODB_DB_NAME);

    // Get all active paybills
    const paybills = await db
      .collection('paybills')
      .find({ status: 'active' })
      .toArray() as unknown as Paybill[];

    console.log(`📋 Found ${paybills.length} active paybill(s)\n`);

    if (paybills.length === 0) {
      console.log('⚠️  No active paybills to refresh');
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    // Refresh tokens for each paybill
    for (const paybill of paybills) {
      const paybillNumber = paybill.paybillInfo.number;
      const paybillName = paybill.paybillInfo.name;

      console.log(`\n🔑 Refreshing token for: ${paybillName} (${paybillNumber})`);

      try {
        // Check if token needs refresh (expires in < 10 minutes)
        const tokenExpiresAt = paybill.credentials?.tokenExpiresAt;
        const now = new Date();

        if (tokenExpiresAt) {
          const timeUntilExpiry = tokenExpiresAt.getTime() - now.getTime();
          const minutesUntilExpiry = Math.floor(timeUntilExpiry / 1000 / 60);

          if (minutesUntilExpiry > 10) {
            console.log(`  ⏭️  Token still valid for ${minutesUntilExpiry} minutes, skipping...`);
            successCount++;
            continue;
          } else {
            console.log(`  ⚠️  Token expires in ${minutesUntilExpiry} minutes, refreshing...`);
          }
        } else {
          console.log(`  ⚠️  No token found, generating new one...`);
        }

        // Generate new token
        const result = await generateAccessToken(db, paybill);

        if (result) {
          console.log(`  ✅ Token refreshed successfully`);
          console.log(`     Expires at: ${result.expiresAt.toISOString()}`);
          successCount++;
        } else {
          console.log(`  ❌ Failed to refresh token`);
          failureCount++;
        }
      } catch (error) {
        console.error(`  ❌ Error refreshing token:`, error);
        failureCount++;
      }
    }

    // Summary
    console.log('\n================================');
    console.log('📊 Token Refresh Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);
    console.log(`   📋 Total: ${paybills.length}`);
    console.log('================================\n');

    if (failureCount > 0) {
      console.error('⚠️  Some tokens failed to refresh. Check logs above.');
      process.exit(1);
    } else {
      console.log('✅ All tokens refreshed successfully');
    }
  } catch (error) {
    console.error('❌ Fatal error during token refresh:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the script
refreshMpesaTokens()
  .then(() => {
    console.log('\n✅ Token refresh completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Token refresh failed:', error);
    process.exit(1);
  });
