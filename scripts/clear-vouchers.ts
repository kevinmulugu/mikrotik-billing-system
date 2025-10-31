// scripts/clear-vouchers.ts
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'mikrotik_billing';

async function clearVouchers() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const result = await client.db(MONGODB_DB_NAME).collection('vouchers').deleteMany({});
    console.log(`✅ Cleared ${result.deletedCount} vouchers`);
  } finally {
    await client.close();
  }
}

clearVouchers().catch(console.error);
