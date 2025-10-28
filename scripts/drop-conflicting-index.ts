// scripts/drop-conflicting-index.ts
/**
 * Drop the conflicting createdAt_1 index on vpn_setup_tokens collection
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'mikrotik_billing';

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in .env.local');
}

async function dropConflictingIndex() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(MONGODB_DB_NAME);
    const collection = db.collection('vpn_setup_tokens');

    // Check if the index exists
    const indexes = await collection.listIndexes().toArray();
    const hasCreatedAtIndex = indexes.some(idx => idx.name === 'createdAt_1');

    if (hasCreatedAtIndex) {
      console.log('🔍 Found conflicting index "createdAt_1", dropping it...');
      await collection.dropIndex('createdAt_1');
      console.log('✅ Successfully dropped index "createdAt_1"');
    } else {
      console.log('ℹ️  No conflicting index found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

dropConflictingIndex();
