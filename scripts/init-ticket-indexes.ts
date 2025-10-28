// scripts/init-ticket-indexes.ts
/**
 * Initialize MongoDB Indexes for Tickets Collection
 * 
 * Run this script once to create all necessary indexes for optimal performance
 * Usage: npx tsx scripts/init-ticket-indexes.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// print MONGODB_URI to console
console.log('MONGODB_URI:', process.env.MONGODB_URI);

import { TicketHelpers } from '../lib/mongodb-helpers'

async function initializeTicketIndexes() {
  try {
    console.log('🚀 Starting ticket indexes initialization...')

    // Create all indexes
    await TicketHelpers.createIndexes()

    console.log('✅ Successfully created all ticket indexes!')
    console.log('\nCreated indexes:')
    console.log('  - customerId')
    console.log('  - userId')
    console.log('  - routerId')
    console.log('  - status')
    console.log('  - createdAt (descending)')
    console.log('  - sla.breachedSla')
    console.log('  - customerId + status (compound)')
    console.log('  - status + ticket.priority (compound)')
    console.log('  - ticket.title + ticket.description (text search)')

    // Verify indexes
    const collection = await TicketHelpers.getCollection()
    const indexes = await collection.indexes()
    
    console.log('\n📊 Total indexes:', indexes.length)
    console.log('\nIndex details:')
    indexes.forEach((index, i) => {
      console.log(`  ${i + 1}. ${index.name}:`, JSON.stringify(index.key))
    })

    process.exit(0)
  } catch (error) {
    console.error('❌ Error initializing indexes:', error)
    process.exit(1)
  }
}

// Run the initialization
initializeTicketIndexes()