// scripts/full-reset.ts
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'mikrotik_billing';

async function fullReset() {
  console.log('🔥 Dropping database completely...\n');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    await client.db(MONGODB_DB_NAME).dropDatabase();
    console.log('✅ Database dropped successfully\n');
  } finally {
    await client.close();
  }
}

fullReset().catch(console.error);
