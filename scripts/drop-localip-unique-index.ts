// scripts/drop-localip-unique-index.ts
/**
 * Drop unique index on connection.localIP if it exists
 * 
 * This script removes the unique constraint on localIP because
 * many routers use the same local IP (e.g., 192.168.88.1)
 * 
 * Usage: npx tsx scripts/drop-localip-unique-index.ts
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

async function dropLocalIPIndex() {
  console.log('🔧 Dropping unique index on connection.localIP...\n');

  const client = new MongoClient(MONGODB_URI as string);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(MONGODB_DB_NAME);
    const collection = db.collection('routers');

    // Get all indexes
    const indexes = await collection.indexes();
    console.log('📋 Existing indexes on routers collection:');
    indexes.forEach((index: any) => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Look for any index on connection.localIP
    const localIPIndexes = indexes.filter((index: any) => 
      index.key['connection.localIP'] !== undefined
    );

    if (localIPIndexes.length === 0) {
      console.log('\n✅ No index found on connection.localIP - nothing to drop!');
      return;
    }

    console.log(`\n🗑️  Found ${localIPIndexes.length} index(es) on connection.localIP:`);
    for (const index of localIPIndexes) {
      const indexName = index.name;
      if (!indexName) {
        console.log(`  ⚠️  Skipping index with no name`);
        continue;
      }

      console.log(`  - ${indexName} (unique: ${index.unique || false})`);
      
      try {
        await collection.dropIndex(indexName);
        console.log(`  ✅ Dropped index: ${indexName}`);
      } catch (error) {
        console.error(`  ❌ Failed to drop index ${indexName}:`, error);
      }
    }

    console.log('\n✅ Index cleanup complete!');
    console.log('\nℹ️  Note: localIP should NOT be unique because many routers use 192.168.88.1');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
dropLocalIPIndex()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
