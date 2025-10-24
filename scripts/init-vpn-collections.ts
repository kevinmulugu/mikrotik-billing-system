// scripts/init-vpn-collections.ts
// Run this to initialize VPN-related collections in MongoDB

import clientPromise from '../lib/mongodb';

async function initVPNCollections() {
  try {
    console.log('Initializing VPN collections...');

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Create vpn_setup_tokens collection with indexes
    console.log('Creating vpn_setup_tokens collection...');
    
    const tokensCollection = db.collection('vpn_setup_tokens');
    
    // Create indexes
    await tokensCollection.createIndex({ token: 1 }, { unique: true });
    await tokensCollection.createIndex({ userId: 1 });
    await tokensCollection.createIndex({ status: 1 });
    await tokensCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
    await tokensCollection.createIndex({ createdAt: 1 });

    console.log('✓ vpn_setup_tokens collection created with indexes');

    // Create vpn_tunnels collection with indexes
    console.log('Creating vpn_tunnels collection...');
    
    const tunnelsCollection = db.collection('vpn_tunnels');
    
    // Create indexes
    await tunnelsCollection.createIndex({ routerId: 1 }, { unique: true });
    await tunnelsCollection.createIndex({ customerId: 1 });
    await tunnelsCollection.createIndex({ 'vpnConfig.clientPublicKey': 1 }, { unique: true });
    await tunnelsCollection.createIndex({ 'vpnConfig.assignedIP': 1 }, { unique: true });
    await tunnelsCollection.createIndex({ 'connection.status': 1 });
    await tunnelsCollection.createIndex({ 'connection.lastSeen': 1 });

    console.log('✓ vpn_tunnels collection created with indexes');

    // Create vpn_ip_pool collection for IP management
    console.log('Creating vpn_ip_pool collection...');
    
    const ipPoolCollection = db.collection('vpn_ip_pool');
    
    // Create indexes
    await ipPoolCollection.createIndex({ ipAddress: 1 }, { unique: true });
    await ipPoolCollection.createIndex({ status: 1 });
    await ipPoolCollection.createIndex({ assignedTo: 1 });

    console.log('✓ vpn_ip_pool collection created with indexes');

    // Initialize IP pool (10.99.1.1 to 10.99.255.254)
    console.log('Initializing VPN IP pool...');
    
    const existingIPs = await ipPoolCollection.countDocuments();
    
    if (existingIPs === 0) {
      const ipPool = [];
      
      // Generate IPs: 10.99.1.1 - 10.99.255.254
      for (let octet3 = 1; octet3 <= 255; octet3++) {
        for (let octet4 = 1; octet4 <= 254; octet4++) {
          ipPool.push({
            ipAddress: `10.99.${octet3}.${octet4}`,
            status: 'available',
            assignedTo: null,
            assignedAt: null,
            createdAt: new Date(),
          });
        }
      }
      
      // Insert in batches of 1000
      const batchSize = 1000;
      for (let i = 0; i < ipPool.length; i += batchSize) {
        const batch = ipPool.slice(i, i + batchSize);
        await ipPoolCollection.insertMany(batch);
        console.log(`  Inserted ${i + batch.length}/${ipPool.length} IPs`);
      }
      
      console.log(`✓ Initialized ${ipPool.length} VPN IPs in pool`);
    } else {
      console.log(`✓ IP pool already initialized (${existingIPs} IPs)`);
    }

    console.log('\n✅ VPN collections initialized successfully!');
    console.log('\nCollections created:');
    console.log('  - vpn_setup_tokens (for temporary setup tokens)');
    console.log('  - vpn_tunnels (for active VPN connections)');
    console.log('  - vpn_ip_pool (for IP address management)');

  } catch (error) {
    console.error('Error initializing VPN collections:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  initVPNCollections()
    .then(() => {
      console.log('\nDone!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

export default initVPNCollections;