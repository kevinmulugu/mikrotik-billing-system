// MongoDB VPN Collections Setup Script
// Run this in MongoDB shell or MongoDB Compass

// Switch to your database
use mikrotik_billing;

// ============================================
// 1. CREATE VPN TUNNELS COLLECTION
// ============================================

db.createCollection("vpn_tunnels", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["routerId", "customerId", "vpnConfig", "connection"],
      properties: {
        routerId: {
          bsonType: "objectId",
          description: "Reference to routers collection"
        },
        customerId: {
          bsonType: "objectId",
          description: "Reference to customers collection"
        },
        vpnConfig: {
          bsonType: "object",
          required: ["clientPublicKey", "assignedIP", "endpoint"],
          properties: {
            clientPrivateKey: {
              bsonType: "string",
              description: "Encrypted WireGuard private key"
            },
            clientPublicKey: {
              bsonType: "string",
              description: "WireGuard public key"
            },
            serverPublicKey: {
              bsonType: "string",
              description: "VPN server public key"
            },
            assignedIP: {
              bsonType: "string",
              description: "Assigned VPN IP address (e.g., 10.99.1.5)"
            },
            endpoint: {
              bsonType: "string",
              description: "VPN server endpoint (domain:port)"
            },
            allowedIPs: {
              bsonType: "string",
              description: "Allowed IP ranges"
            },
            persistentKeepalive: {
              bsonType: "int",
              description: "Keepalive interval in seconds"
            }
          }
        },
        connection: {
          bsonType: "object",
          properties: {
            status: {
              enum: ["connected", "disconnected", "setup", "failed"],
              description: "Current connection status"
            },
            lastHandshake: {
              bsonType: "date",
              description: "Last successful WireGuard handshake"
            },
            bytesReceived: {
              bsonType: "long",
              description: "Total bytes received through VPN"
            },
            bytesSent: {
              bsonType: "long",
              description: "Total bytes sent through VPN"
            },
            lastSeen: {
              bsonType: "date",
              description: "Last time router was reachable"
            }
          }
        },
        createdAt: {
          bsonType: "date"
        },
        updatedAt: {
          bsonType: "date"
        }
      }
    }
  }
});

print("✓ vpn_tunnels collection created");

// Create indexes for vpn_tunnels
db.vpn_tunnels.createIndex({ routerId: 1 }, { unique: true });
db.vpn_tunnels.createIndex({ "vpnConfig.assignedIP": 1 }, { unique: true });
db.vpn_tunnels.createIndex({ "vpnConfig.clientPublicKey": 1 }, { unique: true });
db.vpn_tunnels.createIndex({ "connection.status": 1 });
db.vpn_tunnels.createIndex({ customerId: 1 });
db.vpn_tunnels.createIndex({ "connection.lastSeen": 1 });

print("✓ vpn_tunnels indexes created");

// ============================================
// 2. CREATE VPN IP POOL COLLECTION
// ============================================

db.createCollection("vpn_ip_pool");

print("✓ vpn_ip_pool collection created");

// Initialize IP pool
db.vpn_ip_pool.insertOne({
  network: "10.99.0.0/16",
  reserved: {
    "10.99.0.1": "VPN Server",
    "10.99.0.2": "Reserved",
    "10.99.0.255": "Reserved",
    "10.99.255.255": "Broadcast"
  },
  assigned: {},  // Will be populated as routers are added
  nextAvailable: "10.99.1.1",
  totalCapacity: 65534,
  usedCount: 0,
  createdAt: new Date(),
  updatedAt: new Date()
});

print("✓ VPN IP pool initialized");

// Create index for IP pool
db.vpn_ip_pool.createIndex({ network: 1 }, { unique: true });

print("✓ vpn_ip_pool indexes created");

// ============================================
// 3. ADD VPN SERVER CONFIG TO SYSTEM_CONFIG
// ============================================

// IMPORTANT: Replace YOUR_SERVER_PUBLIC_KEY with actual key
// Get it from: ssh root@vpn.qebol.co.ke "cat /etc/wireguard/server_public.key"

db.system_config.insertOne({
  category: "vpn",
  key: "wireguard_server",
  value: {
    serverPublicKey: "YOUR_SERVER_PUBLIC_KEY_HERE",
    endpoint: "vpn.qebol.co.ke:51820",
    ipPool: {
      network: "10.99.0.0/16",
      serverIP: "10.99.0.1",
      clientRangeStart: "10.99.1.1",
      clientRangeEnd: "10.99.255.254"
    },
    settings: {
      persistentKeepalive: 25,
      allowedIPs: "10.99.0.0/16",
      mtu: 1420,
      listenPort: 51820
    }
  },
  encrypted: false,
  description: "WireGuard VPN server configuration for router management",
  metadata: {
    lastModified: new Date(),
    modifiedBy: null,
    version: 1,
    environment: "production"
  },
  createdAt: new Date(),
  updatedAt: new Date()
});

print("✓ VPN server config added to system_config");

// ============================================
// 4. UPDATE ROUTERS COLLECTION SCHEMA
// ============================================

// Add vpnTunnel field to existing routers collection
// This updates the validator to include vpnTunnel field

db.runCommand({
  collMod: "routers",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["customerId", "routerInfo", "connection", "configuration", "health"],
      properties: {
        customerId: { bsonType: "objectId" },
        routerInfo: { bsonType: "object" },
        connection: {
          bsonType: "object",
          properties: {
            localIP: {
              bsonType: "string",
              description: "Original local IP address"
            },
            vpnIP: {
              bsonType: ["string", "null"],
              description: "VPN management IP address"
            },
            preferVPN: {
              bsonType: "bool",
              description: "Whether to prefer VPN for management"
            },
            ipAddress: {
              bsonType: "string",
              description: "Current active IP (VPN or local)"
            },
            port: { bsonType: "int" },
            apiUser: { bsonType: "string" },
            apiPassword: { bsonType: "string" },
            restApiEnabled: { bsonType: "bool" },
            sshEnabled: { bsonType: "bool" }
          }
        },
        vpnTunnel: {
          bsonType: "object",
          properties: {
            enabled: {
              bsonType: "bool",
              description: "Whether VPN is enabled for this router"
            },
            clientPublicKey: {
              bsonType: ["string", "null"],
              description: "WireGuard client public key"
            },
            serverPublicKey: {
              bsonType: ["string", "null"],
              description: "WireGuard server public key"
            },
            assignedVPNIP: {
              bsonType: ["string", "null"],
              description: "Assigned VPN IP address"
            },
            status: {
              enum: ["connected", "disconnected", "setup", "failed", "pending"],
              description: "VPN connection status"
            },
            lastHandshake: {
              bsonType: ["date", "null"],
              description: "Last WireGuard handshake"
            },
            provisionedAt: {
              bsonType: ["date", "null"],
              description: "When VPN was provisioned"
            },
            error: {
              bsonType: ["string", "null"],
              description: "VPN error message if failed"
            },
            lastAttempt: {
              bsonType: ["date", "null"],
              description: "Last VPN provisioning attempt"
            }
          }
        },
        configuration: { bsonType: "object" },
        health: { bsonType: "object" },
        statistics: { bsonType: "object" },
        status: { bsonType: "string" }
      }
    }
  }
});

print("✓ routers collection schema updated with vpnTunnel field");

// ============================================
// 5. CREATE INDEXES FOR PERFORMANCE
// ============================================

// Additional indexes for VPN queries
db.routers.createIndex({ "vpnTunnel.assignedVPNIP": 1 });
db.routers.createIndex({ "vpnTunnel.status": 1 });
db.routers.createIndex({ "vpnTunnel.enabled": 1 });
db.routers.createIndex({ "connection.preferVPN": 1 });

print("✓ Additional router indexes created");

// ============================================
// 6. VERIFICATION QUERIES
// ============================================

print("\n=== VERIFICATION ===\n");

// Check collections exist
print("Collections created:");
db.getCollectionNames().forEach(function(collection) {
  if (collection === "vpn_tunnels" || collection === "vpn_ip_pool") {
    print("  ✓ " + collection);
  }
});

// Check IP pool
print("\nVPN IP Pool:");
var ipPool = db.vpn_ip_pool.findOne();
if (ipPool) {
  print("  Network: " + ipPool.network);
  print("  Next Available: " + ipPool.nextAvailable);
  print("  Used Count: " + ipPool.usedCount);
  print("  Capacity: " + ipPool.totalCapacity);
}

// Check system config
print("\nVPN Server Config:");
var serverConfig = db.system_config.findOne({ key: "wireguard_server" });
if (serverConfig) {
  print("  Endpoint: " + serverConfig.value.endpoint);
  print("  Server Public Key: " + serverConfig.value.serverPublicKey.substring(0, 20) + "...");
  print("  IP Pool: " + serverConfig.value.ipPool.network);
}

// Check indexes
print("\nVPN Tunnels Indexes:");
db.vpn_tunnels.getIndexes().forEach(function(index) {
  print("  - " + JSON.stringify(index.key));
});

print("\nRouters VPN Indexes:");
db.routers.getIndexes().forEach(function(index) {
  var keys = JSON.stringify(index.key);
  if (keys.includes("vpn")) {
    print("  - " + keys);
  }
});

print("\n=== SETUP COMPLETE ===\n");
print("Next steps:");
print("1. Update YOUR_SERVER_PUBLIC_KEY in system_config");
print("2. Add VPN_* environment variables to .env.local");
print("3. Deploy VPNProvisioner service");
print("4. Test with a router onboarding\n");

// ============================================
// 7. HELPER FUNCTIONS (Optional)
// ============================================

// Function to get VPN statistics
function getVPNStats() {
  var stats = {
    totalTunnels: db.vpn_tunnels.countDocuments(),
    connectedTunnels: db.vpn_tunnels.countDocuments({ "connection.status": "connected" }),
    failedTunnels: db.vpn_tunnels.countDocuments({ "connection.status": "failed" }),
    ipPoolUsage: db.vpn_ip_pool.findOne().usedCount,
    routersWithVPN: db.routers.countDocuments({ "vpnTunnel.enabled": true })
  };
  
  print("\n=== VPN Statistics ===");
  print("Total VPN Tunnels: " + stats.totalTunnels);
  print("Connected: " + stats.connectedTunnels);
  print("Failed: " + stats.failedTunnels);
  print("IP Pool Usage: " + stats.ipPoolUsage + " / 65534");
  print("Routers with VPN: " + stats.routersWithVPN);
  
  return stats;
}

// Function to find disconnected routers
function findDisconnectedRouters() {
  print("\n=== Disconnected Routers ===");
  
  var fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  db.vpn_tunnels.find({
    $or: [
      { "connection.status": "disconnected" },
      { "connection.lastSeen": { $lt: fiveMinutesAgo } }
    ]
  }).forEach(function(tunnel) {
    var router = db.routers.findOne({ _id: tunnel.routerId });
    if (router) {
      print("  - " + router.routerInfo.name + " (" + tunnel.vpnConfig.assignedIP + ")");
      print("    Last seen: " + tunnel.connection.lastSeen);
      print("    Status: " + tunnel.connection.status);
    }
  });
}

// Function to cleanup failed VPN tunnels
function cleanupFailedTunnels() {
  print("\n=== Cleaning Failed VPN Tunnels ===");
  
  var result = db.vpn_tunnels.deleteMany({
    "connection.status": "failed",
    "updatedAt": { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Older than 24 hours
  });
  
  print("Deleted " + result.deletedCount + " failed tunnels older than 24 hours");
  
  // Update routers to mark VPN as pending
  db.routers.updateMany(
    {
      "vpnTunnel.status": "failed",
      "vpnTunnel.lastAttempt": { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    },
    {
      $set: {
        "vpnTunnel.status": "pending",
        "vpnTunnel.error": null
      }
    }
  );
  
  print("Reset router VPN status to pending");
}

print("\nHelper functions available:");
print("  - getVPNStats() - View VPN statistics");
print("  - findDisconnectedRouters() - Find routers with VPN issues");
print("  - cleanupFailedTunnels() - Cleanup old failed tunnels\n");