import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as readline from 'readline';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'mikrotik_billing';

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in .env.local');
}

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function resetDatabase() {
  console.log('⚠️  WARNING: This will DELETE ALL DATA in the database!');
  console.log(`Database: ${MONGODB_DB_NAME}`);
  console.log(`URI: ${MONGODB_URI!.replace(/\/\/.*@/, '//<credentials>@')}\n`);

  const answer = await question('Are you sure you want to continue? (yes/no): ');

  if (answer.toLowerCase() !== 'yes') {
    console.log('❌ Database reset cancelled.');
    rl.close();
    process.exit(0);
  }

  const confirmAnswer = await question(
    'Type the database name to confirm: '
  );

  if (confirmAnswer !== MONGODB_DB_NAME) {
    console.log('❌ Database name does not match. Reset cancelled.');
    rl.close();
    process.exit(0);
  }

  rl.close();

  console.log('\n🔥 Starting database reset...\n');

  const client = new MongoClient(MONGODB_URI!);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(MONGODB_DB_NAME);

    // Drop the entire database
    await db.dropDatabase();
    console.log('✅ Database dropped successfully\n');

    console.log('🎉 Database reset completed!');
    console.log('\n💡 Run "npm run db:init" to reinitialize the database.\n');
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the reset
resetDatabase();