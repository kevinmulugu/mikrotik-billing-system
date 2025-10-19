// scripts/test-router-config.ts - Test Router Configuration

import { MikroTikOrchestrator } from '../lib/services/mikrotik-orchestrator';
import { MikroTikService } from '../lib/services/mikrotik';

// Enhanced logging
const log = {
  info: (message: string, data?: any) => {
    console.log(`\n[INFO] ${new Date().toISOString()} - ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  },
  success: (message: string, data?: any) => {
    console.log(`\n✅ [SUCCESS] ${new Date().toISOString()} - ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  },
  error: (message: string, error?: any) => {
    console.error(`\n❌ [ERROR] ${new Date().toISOString()} - ${message}`);
    if (error) console.error(JSON.stringify(error, null, 2));
  },
  warning: (message: string, data?: any) => {
    console.warn(`\n⚠️  [WARNING] ${new Date().toISOString()} - ${message}`);
    if (data) console.warn(JSON.stringify(data, null, 2));
  },
  request: (endpoint: string, method: string, body?: any) => {
    console.log(`\n📤 [REQUEST] ${method} ${endpoint}`);
    if (body) console.log('Body:', JSON.stringify(body, null, 2));
  },
  response: (status: number, data?: any) => {
    console.log(`\n📥 [RESPONSE] Status: ${status}`);
    if (data) console.log('Data:', JSON.stringify(data, null, 2));
  },
};

// Test configuration
const TEST_CONFIG = {
  ipAddress: '192.168.88.1', // Change to your router IP
  port: 8728,
  username: 'admin',
  password: 'Qwerty@123', // Change to your router password
};

const TEST_OPTIONS = {
  hotspotEnabled: true,
  ssid: 'TEST-HOTSPOT',
  pppoeEnabled: false,
  wanInterface: 'ether1',
  bridgeInterfaces: ['wlan1', 'ether4'],
};

// Enhanced MikroTik Service with logging
class MikroTikServiceWithLogging extends MikroTikService {
  static override async makeRequest(
    config: any,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: any
  ): Promise<any> {
    const requestId = Math.random().toString(36).substring(7);
    
    log.request(endpoint, method, body);
    console.log(`[Request ID: ${requestId}]`);

    try {
      const result = await super.makeRequest(config, endpoint, method, body);
      log.response(200, result);
      return result;
    } catch (error: any) {
      log.error(`Request failed for ${endpoint}`, {
        error: error.message,
        endpoint,
        method,
        body,
      });
      throw error;
    }
  }
}

// Main test function
async function testRouterConfiguration() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('     MIKROTIK ROUTER CONFIGURATION TEST SCRIPT');
  console.log('═══════════════════════════════════════════════════════\n');

  log.info('Test Configuration:', {
    router: TEST_CONFIG.ipAddress,
    port: TEST_CONFIG.port,
    username: TEST_CONFIG.username,
    hotspotEnabled: TEST_OPTIONS.hotspotEnabled,
    ssid: TEST_OPTIONS.ssid,
    pppoeEnabled: TEST_OPTIONS.pppoeEnabled,
  });

  // Step 1: Test connection
  console.log('\n' + '─'.repeat(60));
  console.log('STEP 1: Testing Router Connection');
  console.log('─'.repeat(60));

  try {
    log.info('Connecting to router...');
    const connectionResult = await MikroTikServiceWithLogging.testConnection(TEST_CONFIG);

    if (connectionResult.success) {
      log.success('Connection successful!', connectionResult.data);
    } else {
      log.error('Connection failed!', connectionResult.error);
      process.exit(1);
    }
  } catch (error: any) {
    log.error('Connection test threw exception', error.message);
    process.exit(1);
  }

  // Step 2: Get router information
  console.log('\n' + '─'.repeat(60));
  console.log('STEP 2: Fetching Router Information');
  console.log('─'.repeat(60));

  try {
    log.info('Fetching router identity...');
    const identity = await MikroTikServiceWithLogging.getIdentity(TEST_CONFIG);
    log.info('Router Identity:', identity);

    log.info('Fetching interfaces...');
    const interfaces = await MikroTikServiceWithLogging.getInterfaces(TEST_CONFIG);
    log.info('Available Interfaces:', {
      count: interfaces.length,
      interfaces: interfaces.map((i: any) => ({
        name: i.name,
        type: i.type,
        macAddress: i['mac-address'],
        disabled: i.disabled,
      })),
    });

    // Check if required interfaces exist
    const requiredInterfaces = ['ether1', 'wlan1', 'ether4'];
    const availableInterfaceNames = interfaces.map((i: any) => i.name);
    
    log.info('Checking required interfaces...');
    requiredInterfaces.forEach((reqInterface) => {
      if (availableInterfaceNames.includes(reqInterface)) {
        log.success(`✓ ${reqInterface} found`);
      } else {
        log.warning(`✗ ${reqInterface} NOT found`);
      }
    });
  } catch (error: any) {
    log.error('Failed to fetch router information', error.message);
  }

  // Step 3: Check existing configuration
  console.log('\n' + '─'.repeat(60));
  console.log('STEP 3: Checking Existing Configuration');
  console.log('─'.repeat(60));

  try {
    log.info('Checking existing bridges...');
    const bridges = await MikroTikServiceWithLogging.makeRequest(
      TEST_CONFIG,
      '/rest/interface/bridge',
      'GET'
    );
    log.info('Existing Bridges:', bridges);

    log.info('Checking existing IP pools...');
    const pools = await MikroTikServiceWithLogging.makeRequest(
      TEST_CONFIG,
      '/rest/ip/pool',
      'GET'
    );
    log.info('Existing IP Pools:', pools);

    log.info('Checking existing DHCP servers...');
    const dhcpServers = await MikroTikServiceWithLogging.makeRequest(
      TEST_CONFIG,
      '/rest/ip/dhcp-server',
      'GET'
    );
    log.info('Existing DHCP Servers:', dhcpServers);

    log.info('Checking existing hotspot configuration...');
    const hotspots = await MikroTikServiceWithLogging.makeRequest(
      TEST_CONFIG,
      '/rest/ip/hotspot',
      'GET'
    );
    log.info('Existing Hotspots:', hotspots);

    log.info('Checking existing NAT rules...');
    const natRules = await MikroTikServiceWithLogging.makeRequest(
      TEST_CONFIG,
      '/rest/ip/firewall/nat',
      'GET'
    );
    log.info('Existing NAT Rules:', natRules);
  } catch (error: any) {
    log.error('Failed to check existing configuration', error.message);
  }

  // Step 4: Test individual configuration steps
  console.log('\n' + '─'.repeat(60));
  console.log('STEP 4: Testing Individual Configuration Steps');
  console.log('─'.repeat(60));

  // Test 4.1: WAN Interface
  console.log('\n🔧 Test 4.1: WAN Interface Configuration');
  try {
    log.info('Testing WAN interface configuration...');
    const wanResult = await MikroTikServiceWithLogging.makeRequest(
      TEST_CONFIG,
      '/rest/ip/dhcp-client',
      'GET'
    );
    log.info('WAN Configuration Result:', wanResult);
  } catch (error: any) {
    log.error('WAN test failed', error.message);
  }

  // Test 4.2: Bridge Creation
  console.log('\n🔧 Test 4.2: Bridge Creation');
  try {
    log.info('Testing bridge creation endpoint...');
    
    // Try to create a test bridge
    const testBridgeName = 'test-bridge-' + Date.now();
    const bridgeResult = await MikroTikServiceWithLogging.makeRequest(
      TEST_CONFIG,
      '/rest/interface/bridge',
      'PUT',
      { name: testBridgeName }
    );
    log.success('Bridge creation successful!', bridgeResult);

    // Clean up test bridge
    log.info('Cleaning up test bridge...');
    const bridges = await MikroTikServiceWithLogging.makeRequest(
      TEST_CONFIG,
      '/rest/interface/bridge',
      'GET'
    );
    const testBridge = bridges.find((b: any) => b.name === testBridgeName);
    if (testBridge) {
      await MikroTikServiceWithLogging.makeRequest(
        TEST_CONFIG,
        `/rest/interface/bridge/${testBridge['.id']}`,
        'DELETE'
      );
      log.success('Test bridge cleaned up');
    }
  } catch (error: any) {
    log.error('Bridge creation test failed', {
      message: error.message,
      detail: 'This might be why bridge configuration is failing',
    });
  }

  // Test 4.3: IP Pool Creation
  console.log('\n🔧 Test 4.3: IP Pool Creation');
  try {
    log.info('Testing IP pool creation endpoint...');
    
    const testPoolName = 'test-pool-' + Date.now();
    const poolResult = await MikroTikServiceWithLogging.makeRequest(
      TEST_CONFIG,
      '/rest/ip/pool',
      'PUT',
      { name: testPoolName, ranges: '192.168.99.10-192.168.99.20' }
    );
    log.success('IP pool creation successful!', poolResult);

    // Clean up test pool
    log.info('Cleaning up test pool...');
    const pools = await MikroTikServiceWithLogging.makeRequest(
      TEST_CONFIG,
      '/rest/ip/pool',
      'GET'
    );
    const testPool = pools.find((p: any) => p.name === testPoolName);
    if (testPool) {
      await MikroTikServiceWithLogging.makeRequest(
        TEST_CONFIG,
        `/rest/ip/pool/${testPool['.id']}`,
        'DELETE'
      );
      log.success('Test pool cleaned up');
    }
  } catch (error: any) {
    log.error('IP pool creation test failed', {
      message: error.message,
      detail: 'This might be why IP pool configuration is failing',
    });
  }

  // Test 4.4: DHCP Server
  console.log('\n🔧 Test 4.4: DHCP Server Configuration');
  try {
    log.info('Testing DHCP server endpoint...');
    const dhcpServers = await MikroTikServiceWithLogging.makeRequest(
      TEST_CONFIG,
      '/rest/ip/dhcp-server',
      'GET'
    );
    log.info('DHCP Servers:', dhcpServers);
  } catch (error: any) {
    log.error('DHCP server test failed', error.message);
  }

  // Test 4.5: Hotspot
  console.log('\n🔧 Test 4.5: Hotspot Configuration');
  try {
    log.info('Testing hotspot endpoint...');
    const hotspots = await MikroTikServiceWithLogging.makeRequest(
      TEST_CONFIG,
      '/rest/ip/hotspot',
      'GET'
    );
    log.info('Hotspots:', hotspots);

    log.info('Testing hotspot profile endpoint...');
    const profiles = await MikroTikServiceWithLogging.makeRequest(
      TEST_CONFIG,
      '/rest/ip/hotspot/profile',
      'GET'
    );
    log.info('Hotspot Profiles:', profiles);
  } catch (error: any) {
    log.error('Hotspot test failed', error.message);
  }

  // Step 5: Run full orchestrator
  console.log('\n' + '═'.repeat(60));
  console.log('STEP 5: Running Full Configuration Orchestrator');
  console.log('═'.repeat(60));

  try {
    log.info('Starting full configuration...');
    console.log('This may take 10-30 seconds...\n');

    const startTime = Date.now();
    const result = await MikroTikOrchestrator.configureRouter(TEST_CONFIG, TEST_OPTIONS);
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '═'.repeat(60));
    console.log('CONFIGURATION RESULTS');
    console.log('═'.repeat(60));

    log.info(`Configuration completed in ${duration} seconds`);
    log.info('Overall Success:', result.success ? '✅ YES' : '❌ NO');
    
    console.log('\n📊 COMPLETED STEPS:');
    result.completedSteps.forEach((step, index) => {
      console.log(`  ${index + 1}. ✅ ${step}`);
    });

    if (result.failedSteps.length > 0) {
      console.log('\n❌ FAILED STEPS:');
      result.failedSteps.forEach((failed, index) => {
        console.log(`  ${index + 1}. ❌ ${failed.step}`);
        console.log(`     Error: ${failed.error}`);
      });
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      result.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }

    // Detailed analysis
    console.log('\n' + '─'.repeat(60));
    console.log('DETAILED ANALYSIS');
    console.log('─'.repeat(60));

    const totalSteps = result.completedSteps.length + result.failedSteps.length;
    const successRate = ((result.completedSteps.length / totalSteps) * 100).toFixed(1);
    
    console.log(`\nSuccess Rate: ${successRate}% (${result.completedSteps.length}/${totalSteps} steps)`);
    console.log(`Warnings: ${result.warnings.length}`);
    console.log(`Duration: ${duration}s`);

    if (!result.success) {
      console.log('\n🔍 TROUBLESHOOTING TIPS:');
      result.failedSteps.forEach((failed) => {
        console.log(`\n❌ ${failed.step}:`);
        
        if (failed.error.includes('no such command')) {
          console.log('  → Issue: REST API endpoint not found');
          console.log('  → Possible causes:');
          console.log('    1. RouterOS version too old (requires v7.1+)');
          console.log('    2. REST API not enabled');
          console.log('    3. Incorrect API endpoint');
          console.log('  → Solution: Check RouterOS version and enable REST API');
        } else if (failed.error.includes('Bad Request')) {
          console.log('  → Issue: Invalid request format');
          console.log('  → Check: Request body format and required fields');
        } else if (failed.error.includes('Authentication')) {
          console.log('  → Issue: Authentication failed');
          console.log('  → Check: Username and password');
        } else if (failed.error.includes('timeout')) {
          console.log('  → Issue: Connection timeout');
          console.log('  → Check: Network connectivity and firewall');
        }
      });
    }

  } catch (error: any) {
    log.error('Orchestrator threw exception', {
      message: error.message,
      stack: error.stack,
    });
  }

  // Final summary
  console.log('\n' + '═'.repeat(60));
  console.log('TEST COMPLETED');
  console.log('═'.repeat(60));
  console.log(`\nTest finished at: ${new Date().toISOString()}`);
}

// Run the test
testRouterConfiguration()
  .then(() => {
    console.log('\n✅ Test script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });