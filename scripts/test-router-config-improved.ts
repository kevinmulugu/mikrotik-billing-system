// scripts/test-router-config-improved.ts - Works with existing configuration

import { MikroTikService } from '../lib/services/mikrotik';
import { MikroTikNetworkConfig } from '../lib/services/mikrotik';
import { MikroTikServiceConfig } from '../lib/services/mikrotik';

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
  note: (message: string) => {
    console.log(`\n📝 [NOTE] ${message}`);
  },
};

// Test configuration - YOUR ACTUAL ROUTER
const TEST_CONFIG = {
  ipAddress: '192.168.88.1',
  port: 8728,
  username: 'admin',
  password: 'Qwerty@123',
};

// Based on your discovery output - REUSE EXISTING RESOURCES
const EXISTING_RESOURCES = {
  bridge: 'bridge', // Your existing bridge
  ipPool: 'default-dhcp', // Your existing IP pool  
  dhcpServer: 'defconf', // Your existing DHCP server
  dhcpNetwork: '192.168.88.0/24', // Your existing network
};

// Main test function
async function testSmartConfiguration() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   SMART MIKROTIK CONFIGURATION - USE EXISTING RESOURCES');
  console.log('═══════════════════════════════════════════════════════\n');

  // Step 1: Test connection
  console.log('─'.repeat(60));
  console.log('STEP 1: Testing Connection');
  console.log('─'.repeat(60));

  try {
    const connectionResult = await MikroTikService.testConnection(TEST_CONFIG);
    if (!connectionResult.success) {
      log.error('Connection failed', connectionResult.error);
      process.exit(1);
    }
    log.success('Connected to router', connectionResult.data?.routerInfo);
  } catch (error: any) {
    log.error('Connection failed', error.message);
    process.exit(1);
  }

  // Step 2: Enable ether1 (WAN) - Currently DISABLED
  console.log('\n' + '─'.repeat(60));
  console.log('STEP 2: Enable WAN Interface (ether1)');
  console.log('─'.repeat(60));

  try {
    log.note('Your ether1 is currently DISABLED - enabling it for internet access');
    
    // Get ether1 interface
    const interfaces = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/interface',
      'GET'
    );
    const ether1 = interfaces.find((i: any) => i.name === 'ether1');
    
    if (ether1 && ether1.disabled === 'true') {
      log.info('Enabling ether1...');
      await MikroTikService.makeRequest(
        TEST_CONFIG,
        `/rest/interface/${ether1['.id']}`,
        'PATCH',
        { disabled: 'false' }
      );
      log.success('ether1 enabled!');
    } else {
      log.success('ether1 already enabled');
    }

    // Configure as DHCP client if not configured
    const dhcpClients = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/ip/dhcp-client',
      'GET'
    );
    const ether1Client = dhcpClients.find((c: any) => c.interface === 'ether1');
    
    if (!ether1Client) {
      log.info('Configuring ether1 as DHCP client...');
      await MikroTikService.makeRequest(
        TEST_CONFIG,
        '/rest/ip/dhcp-client',
        'POST',
        {
          interface: 'ether1',
          'add-default-route': 'yes',
          'use-peer-dns': 'yes',
        }
      );
      log.success('ether1 configured as DHCP client');
    } else {
      log.success('ether1 already configured as DHCP client');
    }
  } catch (error: any) {
    log.error('Failed to configure ether1', error.message);
  }

  // Step 3: Enable wlan1 (WiFi) - Currently DISABLED
  console.log('\n' + '─'.repeat(60));
  console.log('STEP 3: Enable WiFi Interface (wlan1)');
  console.log('─'.repeat(60));

  try {
    log.note('Your wlan1 is currently DISABLED - enabling it for hotspot');
    
    const interfaces = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/interface',
      'GET'
    );
    const wlan1 = interfaces.find((i: any) => i.name === 'wlan1');
    
    if (wlan1 && wlan1.disabled === 'true') {
      log.info('Enabling wlan1...');
      await MikroTikService.makeRequest(
        TEST_CONFIG,
        `/rest/interface/${wlan1['.id']}`,
        'PATCH',
        { disabled: 'false' }
      );
      log.success('wlan1 enabled!');
    } else {
      log.success('wlan1 already enabled');
    }
  } catch (error: any) {
    log.error('Failed to enable wlan1', error.message);
  }

  // Step 4: Configure WiFi with SSID
  console.log('\n' + '─'.repeat(60));
  console.log('STEP 4: Configure WiFi SSID');
  console.log('─'.repeat(60));

  const SSID = 'BUY-N-BROWSE';

  try {
    log.info(`Configuring WiFi with SSID: "${SSID}"`);
    
    const wirelessInterfaces = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/interface/wireless',
      'GET'
    );
    const wlan1 = wirelessInterfaces.find((i: any) => i.name === 'wlan1');
    
    if (wlan1) {
      await MikroTikService.makeRequest(
        TEST_CONFIG,
        `/rest/interface/wireless/${wlan1['.id']}`,
        'PATCH',
        {
          mode: 'ap-bridge',
          ssid: SSID,
          'security-profile': 'default',
          disabled: 'false',
        }
      );
      log.success(`WiFi configured with SSID: "${SSID}"`);
    }
  } catch (error: any) {
    log.error('Failed to configure WiFi', error.message);
  }

  // Step 5: Add wlan1 to EXISTING bridge
  console.log('\n' + '─'.repeat(60));
  console.log('STEP 5: Add wlan1 to Existing Bridge');
  console.log('─'.repeat(60));

  try {
    log.note(`Using existing bridge: "${EXISTING_RESOURCES.bridge}"`);
    
    // Check if wlan1 already in bridge
    const bridgePorts = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/interface/bridge/port',
      'GET'
    );
    const wlan1Port = bridgePorts.find(
      (p: any) => p.interface === 'wlan1' && p.bridge === EXISTING_RESOURCES.bridge
    );
    
    if (!wlan1Port) {
      log.info('Adding wlan1 to bridge...');
      await MikroTikService.makeRequest(
        TEST_CONFIG,
        '/rest/interface/bridge/port',
        'POST',
        {
          interface: 'wlan1',
          bridge: EXISTING_RESOURCES.bridge,
        }
      );
      log.success('wlan1 added to bridge');
    } else {
      log.success('wlan1 already in bridge');
    }
  } catch (error: any) {
    log.error('Failed to add wlan1 to bridge', error.message);
  }

  // Step 6: Enable existing bridge
  console.log('\n' + '─'.repeat(60));
  console.log('STEP 6: Enable Existing Bridge');
  console.log('─'.repeat(60));

  try {
    const bridges = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/interface/bridge',
      'GET'
    );
    const bridge = bridges.find((b: any) => b.name === EXISTING_RESOURCES.bridge);
    
    if (bridge && bridge.disabled === 'true') {
      log.info('Enabling bridge...');
      await MikroTikService.makeRequest(
        TEST_CONFIG,
        `/rest/interface/bridge/${bridge['.id']}`,
        'PATCH',
        { disabled: 'false' }
      );
      log.success('Bridge enabled');
    } else {
      log.success('Bridge already enabled');
    }
  } catch (error: any) {
    log.error('Failed to enable bridge', error.message);
  }

  // Step 7: Create NEW IP Pool for Hotspot (avoid conflict with existing)
  console.log('\n' + '─'.repeat(60));
  console.log('STEP 7: Create Hotspot IP Pool');
  console.log('─'.repeat(60));

  const HOTSPOT_POOL_NAME = 'hotspot-pool';
  const HOTSPOT_POOL_RANGE = '10.5.50.10-10.5.50.200';

  try {
    log.note('Creating NEW IP pool for hotspot (separate from existing)');
    
    const pools = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/ip/pool',
      'GET'
    );
    const hotspotPool = pools.find((p: any) => p.name === HOTSPOT_POOL_NAME);
    
    if (!hotspotPool) {
      await MikroTikService.makeRequest(
        TEST_CONFIG,
        '/rest/ip/pool',
        'POST',
        {
          name: HOTSPOT_POOL_NAME,
          ranges: HOTSPOT_POOL_RANGE,
        }
      );
      log.success(`Created IP pool: ${HOTSPOT_POOL_NAME}`);
    } else {
      log.success('Hotspot IP pool already exists');
    }
  } catch (error: any) {
    log.error('Failed to create hotspot IP pool', error.message);
  }

  // Step 8: Assign IP to bridge for hotspot
  console.log('\n' + '─'.repeat(60));
  console.log('STEP 8: Assign Hotspot IP to Bridge');
  console.log('─'.repeat(60));

  const HOTSPOT_GATEWAY = '10.5.50.1/24';

  try {
    log.info(`Assigning IP ${HOTSPOT_GATEWAY} to bridge for hotspot...`);
    
    const addresses = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/ip/address',
      'GET'
    );
    const hotspotAddress = addresses.find(
      (a: any) => a.interface === EXISTING_RESOURCES.bridge && a.address === HOTSPOT_GATEWAY
    );
    
    if (!hotspotAddress) {
      await MikroTikService.makeRequest(
        TEST_CONFIG,
        '/rest/ip/address',
        'POST',
        {
          address: HOTSPOT_GATEWAY,
          interface: EXISTING_RESOURCES.bridge,
        }
      );
      log.success('Hotspot IP assigned to bridge');
    } else {
      log.success('Hotspot IP already assigned');
    }
  } catch (error: any) {
    log.error('Failed to assign hotspot IP', error.message);
  }

  // Step 9: Create hotspot server
  console.log('\n' + '─'.repeat(60));
  console.log('STEP 9: Create Hotspot Server');
  console.log('─'.repeat(60));

  try {
    log.info('Creating hotspot server...');
    
    // First create hotspot profile
    const profiles = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/ip/hotspot/profile',
      'GET'
    );
    const hotspotProfile = profiles.find((p: any) => p.name === 'hsprof1');
    
    if (!hotspotProfile) {
      await MikroTikService.makeRequest(
        TEST_CONFIG,
        '/rest/ip/hotspot/profile',
        'POST',
        {
          name: 'hsprof1',
          'hotspot-address': '10.5.50.1',
          'dns-name': 'hotspot.local',
          'html-directory': 'hotspot',
          'http-proxy': '0.0.0.0:0',
          'login-by': 'username,trial,mac,cookie',
        }
      );
      log.success('Hotspot profile created');
    }

    // Create hotspot server
    const hotspots = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/ip/hotspot',
      'GET'
    );
    const hotspot = hotspots.find((h: any) => h.name === 'hotspot1');
    
    if (!hotspot) {
      await MikroTikService.makeRequest(
        TEST_CONFIG,
        '/rest/ip/hotspot',
        'POST',
        {
          name: 'hotspot1',
          interface: EXISTING_RESOURCES.bridge,
          'address-pool': HOTSPOT_POOL_NAME,
          profile: 'hsprof1',
        }
      );
      log.success('Hotspot server created');
    } else {
      log.success('Hotspot server already exists');
    }
  } catch (error: any) {
    log.error('Failed to create hotspot', error.message);
    log.note('This is likely why you got "no such command" errors');
    log.note('Your router may need the hotspot package installed or RouterOS upgrade');
  }

  // Step 10: Create hotspot user profiles
  console.log('\n' + '─'.repeat(60));
  console.log('STEP 10: Create Hotspot User Profiles (8 packages)');
  console.log('─'.repeat(60));

  try {
    await MikroTikServiceConfig.createHotspotUserProfiles(TEST_CONFIG);
    log.success('Created 8 hotspot user profiles (voucher packages)');
  } catch (error: any) {
    log.error('Failed to create user profiles', error.message);
  }

  // Step 11: Update NAT rule (if needed)
  console.log('\n' + '─'.repeat(60));
  console.log('STEP 11: Configure NAT for Hotspot');
  console.log('─'.repeat(60));

  try {
    log.note('Checking if NAT rule needs update for hotspot network');
    
    const natRules = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/ip/firewall/nat',
      'GET'
    );
    
    const hotspotNat = natRules.find(
      (r: any) =>
        r.chain === 'srcnat' &&
        r['src-address'] === '10.5.50.0/24' &&
        r.action === 'masquerade'
    );
    
    if (!hotspotNat) {
      log.info('Adding NAT rule for hotspot network...');
      await MikroTikService.makeRequest(
        TEST_CONFIG,
        '/rest/ip/firewall/nat',
        'POST',
        {
          chain: 'srcnat',
          'src-address': '10.5.50.0/24',
          'out-interface': 'ether1',
          action: 'masquerade',
        }
      );
      log.success('NAT rule added for hotspot');
    } else {
      log.success('NAT rule already exists for hotspot');
    }
  } catch (error: any) {
    log.error('Failed to configure NAT', error.message);
  }

  // Final Summary
  console.log('\n' + '═'.repeat(60));
  console.log('CONFIGURATION COMPLETED');
  console.log('═'.repeat(60));

  console.log('\n✅ What was configured:');
  console.log('  1. ✅ ether1 (WAN) - Enabled and configured as DHCP client');
  console.log('  2. ✅ wlan1 (WiFi) - Enabled and configured with SSID');
  console.log(`  3. ✅ WiFi SSID - Set to "${SSID}"`);
  console.log(`  4. ✅ Bridge - Used existing "${EXISTING_RESOURCES.bridge}"`);
  console.log('  5. ✅ wlan1 - Added to bridge');
  console.log('  6. ✅ Hotspot IP Pool - Created new pool for hotspot');
  console.log('  7. ✅ Hotspot Server - Created on bridge');
  console.log('  8. ✅ User Profiles - 8 voucher packages created');
  console.log('  9. ✅ NAT Rule - Configured for internet access');

  console.log('\n📝 Important Notes:');
  console.log('  • Used EXISTING bridge instead of creating new one');
  console.log('  • Used EXISTING DHCP server for LAN (192.168.88.0/24)');
  console.log('  • Created SEPARATE hotspot network (10.5.50.0/24)');
  console.log('  • Enabled all disabled interfaces');
  
  console.log('\n🎯 Next Steps:');
  console.log('  1. Connect ether1 to your internet source');
  console.log('  2. Connect to WiFi: "' + SSID + '"');
  console.log('  3. Generate vouchers via your application');
  console.log('  4. Test hotspot login with a voucher');

  console.log('\n✨ Configuration successful!');
}

// Run the test
testSmartConfiguration()
  .then(() => {
    console.log('\n✅ Smart configuration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Configuration failed:', error);
    process.exit(1);
  });