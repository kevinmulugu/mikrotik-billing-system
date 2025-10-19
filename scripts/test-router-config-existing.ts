// scripts/test-router-config-existing.ts - Test with Existing Configuration

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
  note: (message: string, data?: any) => {
    console.log(`\n📝 [NOTE] ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  },
};

// Test configuration
const TEST_CONFIG = {
  ipAddress: '192.168.88.1', // Change to your router IP
  port: 8728,
  username: 'admin',
  password: 'Qwerty@123', // Change to your router password
};

interface ExistingResources {
  bridges: any[];
  ipPools: any[];
  dhcpServers: any[];
  dhcpNetworks: any[];
  hotspots: any[];
  hotspotProfiles: any[];
  natRules: any[];
  interfaces: any[];
}

// Main test function
async function testWithExistingConfig() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  MIKROTIK ROUTER - DISCOVER EXISTING CONFIGURATION');
  console.log('═══════════════════════════════════════════════════════\n');

  log.info('Router:', TEST_CONFIG.ipAddress);

  const existing: ExistingResources = {
    bridges: [],
    ipPools: [],
    dhcpServers: [],
    dhcpNetworks: [],
    hotspots: [],
    hotspotProfiles: [],
    natRules: [],
    interfaces: [],
  };

  // Step 1: Test connection
  console.log('\n' + '─'.repeat(60));
  console.log('STEP 1: Testing Router Connection');
  console.log('─'.repeat(60));

  try {
    const connectionResult = await MikroTikService.testConnection(TEST_CONFIG);

    if (connectionResult.success) {
      log.success('Connection successful!');
      log.info('Router Info:', connectionResult.data?.routerInfo);
    } else {
      log.error('Connection failed!', connectionResult.error);
      process.exit(1);
    }
  } catch (error: any) {
    log.error('Connection test failed', error.message);
    process.exit(1);
  }

  // Step 2: Discover existing configuration
  console.log('\n' + '═'.repeat(60));
  console.log('STEP 2: DISCOVERING EXISTING CONFIGURATION');
  console.log('═'.repeat(60));

  // 2.1: Get all interfaces
  console.log('\n📡 2.1: Available Interfaces');
  try {
    existing.interfaces = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/interface',
      'GET'
    );

    log.success(`Found ${existing.interfaces.length} interfaces`);
    existing.interfaces.forEach((iface: any, index: number) => {
      console.log(`  ${index + 1}. ${iface.name}`);
      console.log(`     Type: ${iface.type || 'N/A'}`);
      console.log(`     MAC: ${iface['mac-address'] || 'N/A'}`);
      console.log(`     Status: ${iface.disabled ? '❌ Disabled' : '✅ Enabled'}`);
    });

    // Check for required interfaces
    const hasEther1 = existing.interfaces.some((i: any) => i.name === 'ether1');
    const hasWlan1 = existing.interfaces.some((i: any) => i.name === 'wlan1');
    const hasEther4 = existing.interfaces.some((i: any) => i.name === 'ether4');

    log.note('Required interfaces check:', {
      'ether1 (WAN)': hasEther1 ? '✅ Available' : '❌ Missing',
      'wlan1 (WiFi)': hasWlan1 ? '✅ Available' : '❌ Missing',
      'ether4 (Bridge)': hasEther4 ? '✅ Available' : '⚠️ Missing (will use another port)',
    });
  } catch (error: any) {
    log.error('Failed to fetch interfaces', error.message);
  }

  // 2.2: Get existing bridges
  console.log('\n🌉 2.2: Existing Bridges');
  try {
    existing.bridges = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/interface/bridge',
      'GET'
    );

    if (existing.bridges.length > 0) {
      log.success(`Found ${existing.bridges.length} existing bridge(s)`);
      existing.bridges.forEach((bridge: any, index: number) => {
        console.log(`  ${index + 1}. ${bridge.name}`);
        console.log(`     ID: ${bridge['.id']}`);
        console.log(`     Disabled: ${bridge.disabled || 'false'}`);
      });

      log.note('💡 Recommendation:', {
        suggestion: 'You can reuse existing bridges instead of creating new ones',
        bridgeNames: existing.bridges.map((b: any) => b.name),
      });
    } else {
      log.warning('No existing bridges found - will create new one');
    }
  } catch (error: any) {
    log.error('Failed to fetch bridges', error.message);
  }

  // 2.3: Get existing IP pools
  console.log('\n🏊 2.3: Existing IP Pools');
  try {
    existing.ipPools = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/ip/pool',
      'GET'
    );

    if (existing.ipPools.length > 0) {
      log.success(`Found ${existing.ipPools.length} existing IP pool(s)`);
      existing.ipPools.forEach((pool: any, index: number) => {
        console.log(`  ${index + 1}. ${pool.name}`);
        console.log(`     Ranges: ${pool.ranges}`);
      });

      log.note('💡 Recommendation:', {
        suggestion: 'You can reuse existing IP pools',
        poolNames: existing.ipPools.map((p: any) => p.name),
      });
    } else {
      log.warning('No existing IP pools found - will create new ones');
    }
  } catch (error: any) {
    log.error('Failed to fetch IP pools', error.message);
  }

  // 2.4: Get existing DHCP servers
  console.log('\n🖥️  2.4: Existing DHCP Servers');
  try {
    existing.dhcpServers = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/ip/dhcp-server',
      'GET'
    );

    if (existing.dhcpServers.length > 0) {
      log.success(`Found ${existing.dhcpServers.length} existing DHCP server(s)`);
      existing.dhcpServers.forEach((server: any, index: number) => {
        console.log(`  ${index + 1}. ${server.name}`);
        console.log(`     Interface: ${server.interface}`);
        console.log(`     Address Pool: ${server['address-pool'] || 'N/A'}`);
        console.log(`     Disabled: ${server.disabled || 'false'}`);
      });

      log.note('💡 Recommendation:', {
        suggestion: 'You can reuse existing DHCP servers',
        serverNames: existing.dhcpServers.map((s: any) => s.name),
      });
    } else {
      log.warning('No existing DHCP servers found - will create new one');
    }
  } catch (error: any) {
    log.error('Failed to fetch DHCP servers', error.message);
  }

  // 2.5: Get existing DHCP networks
  console.log('\n🌐 2.5: Existing DHCP Networks');
  try {
    existing.dhcpNetworks = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/ip/dhcp-server/network',
      'GET'
    );

    if (existing.dhcpNetworks.length > 0) {
      log.success(`Found ${existing.dhcpNetworks.length} existing DHCP network(s)`);
      existing.dhcpNetworks.forEach((network: any, index: number) => {
        console.log(`  ${index + 1}. Network: ${network.address}`);
        console.log(`     Gateway: ${network.gateway || 'N/A'}`);
        console.log(`     DNS: ${network['dns-server'] || 'N/A'}`);
      });
    } else {
      log.warning('No existing DHCP networks found - will create new one');
    }
  } catch (error: any) {
    log.error('Failed to fetch DHCP networks', error.message);
  }

  // 2.6: Get existing hotspot configuration
  console.log('\n🔥 2.6: Existing Hotspot Configuration');
  try {
    existing.hotspots = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/ip/hotspot',
      'GET'
    );

    if (existing.hotspots.length > 0) {
      log.success(`Found ${existing.hotspots.length} existing hotspot(s)`);
      existing.hotspots.forEach((hotspot: any, index: number) => {
        console.log(`  ${index + 1}. ${hotspot.name}`);
        console.log(`     Interface: ${hotspot.interface}`);
        console.log(`     Address Pool: ${hotspot['address-pool'] || 'N/A'}`);
        console.log(`     Profile: ${hotspot.profile || 'N/A'}`);
        console.log(`     Disabled: ${hotspot.disabled || 'false'}`);
      });

      log.note('💡 Recommendation:', {
        suggestion: 'Hotspot already configured! You can skip hotspot creation',
        existingHotspots: existing.hotspots.map((h: any) => h.name),
      });
    } else {
      log.warning('No existing hotspot found - will create new one');
    }
  } catch (error: any) {
    log.error('Failed to fetch hotspot configuration', error.message);
  }

  // 2.7: Get existing hotspot profiles
  console.log('\n📋 2.7: Existing Hotspot Profiles');
  try {
    existing.hotspotProfiles = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/ip/hotspot/profile',
      'GET'
    );

    if (existing.hotspotProfiles.length > 0) {
      log.success(`Found ${existing.hotspotProfiles.length} existing hotspot profile(s)`);
      existing.hotspotProfiles.forEach((profile: any, index: number) => {
        console.log(`  ${index + 1}. ${profile.name}`);
        console.log(`     Hotspot Address: ${profile['hotspot-address'] || 'N/A'}`);
      });
    } else {
      log.warning('No existing hotspot profiles found');
    }
  } catch (error: any) {
    log.error('Failed to fetch hotspot profiles', error.message);
  }

  // 2.8: Get existing NAT rules
  console.log('\n🔒 2.8: Existing NAT Rules');
  try {
    existing.natRules = await MikroTikService.makeRequest(
      TEST_CONFIG,
      '/rest/ip/firewall/nat',
      'GET'
    );

    if (existing.natRules.length > 0) {
      log.success(`Found ${existing.natRules.length} existing NAT rule(s)`);
      const masqueradeRules = existing.natRules.filter((rule: any) => rule.action === 'masquerade');
      console.log(`  Masquerade rules: ${masqueradeRules.length}`);
      masqueradeRules.forEach((rule: any, index: number) => {
        console.log(`    ${index + 1}. ${rule.chain}: ${rule['src-address'] || 'any'} → ${rule['out-interface'] || 'any'}`);
      });

      if (masqueradeRules.length > 0) {
        log.note('💡 Recommendation:', 'NAT already configured for internet access');
      }
    } else {
      log.warning('No existing NAT rules found - will create new ones');
    }
  } catch (error: any) {
    log.error('Failed to fetch NAT rules', error.message);
  }

  // Step 3: Suggest configuration based on existing resources
  console.log('\n' + '═'.repeat(60));
  console.log('STEP 3: CONFIGURATION RECOMMENDATIONS');
  console.log('═'.repeat(60));

  const recommendations: string[] = [];
  const warnings: string[] = [];

  // Check what we can reuse
  if (existing.bridges.length > 0) {
    const bridgeName = existing.bridges[0].name;
    recommendations.push(`✅ Reuse existing bridge: "${bridgeName}"`);
    log.note(`Found bridge "${bridgeName}" that can be used for hotspot`);
  } else {
    warnings.push('⚠️ No bridges found - will create "bridge-hotspot"');
  }

  if (existing.ipPools.length > 0) {
    recommendations.push(`✅ Found ${existing.ipPools.length} IP pool(s) - check if suitable for hotspot`);
  } else {
    warnings.push('⚠️ No IP pools found - will create "hotspot-pool"');
  }

  if (existing.dhcpServers.length > 0) {
    recommendations.push(`✅ Found ${existing.dhcpServers.length} DHCP server(s) - check configuration`);
  } else {
    warnings.push('⚠️ No DHCP servers found - will create "dhcp-hotspot"');
  }

  if (existing.hotspots.length > 0) {
    recommendations.push(`✅ HOTSPOT ALREADY CONFIGURED! Found: ${existing.hotspots.map((h: any) => h.name).join(', ')}`);
    log.warning('Hotspot already exists! Running configuration may cause conflicts or duplicate entries');
  } else {
    warnings.push('⚠️ No hotspot found - will create new hotspot server');
  }

  const masqueradeRules = existing.natRules.filter((rule: any) => rule.action === 'masquerade');
  if (masqueradeRules.length > 0) {
    recommendations.push(`✅ Found ${masqueradeRules.length} NAT masquerade rule(s) - internet access configured`);
  } else {
    warnings.push('⚠️ No NAT rules found - will create masquerade rules');
  }

  console.log('\n📝 What you already have:');
  recommendations.forEach(rec => console.log(`  ${rec}`));

  console.log('\n⚠️  What will be created:');
  warnings.forEach(warn => console.log(`  ${warn}`));

  // Step 4: Smart configuration suggestions
  console.log('\n' + '═'.repeat(60));
  console.log('STEP 4: SMART CONFIGURATION OPTIONS');
  console.log('═'.repeat(60));

  const configOptions: any = {
    hotspotEnabled: existing.hotspots.length === 0, // Only enable if no hotspot exists
    pppoeEnabled: false,
    wanInterface: 'ether1',
  };

  // Smart bridge interface selection
  if (existing.bridges.length > 0) {
    // Use existing bridge name
    configOptions.useExistingBridge = existing.bridges[0].name;
    log.note(`💡 SUGGESTION: Modify orchestrator to use existing bridge "${existing.bridges[0].name}"`);
  } else {
    // Default bridge interfaces
    const hasWlan1 = existing.interfaces.some((i: any) => i.name === 'wlan1');
    const hasEther4 = existing.interfaces.some((i: any) => i.name === 'ether4');
    
    if (hasWlan1 && hasEther4) {
      configOptions.bridgeInterfaces = ['wlan1', 'ether4'];
      log.note('Will use: wlan1 (WiFi) + ether4 (LAN) for hotspot bridge');
    } else if (hasWlan1) {
      configOptions.bridgeInterfaces = ['wlan1'];
      log.warning('Only wlan1 available - bridge will only have WiFi interface');
    } else {
      log.error('No wlan1 found - cannot configure WiFi hotspot!');
      configOptions.hotspotEnabled = false;
    }
  }

  // Smart SSID selection
  const wirelessInterfaces = existing.interfaces.filter((i: any) => i.type === 'wlan');
  if (wirelessInterfaces.length > 0) {
    configOptions.ssid = 'BUY-N-BROWSE-HOTSPOT';
    log.note(`Will configure WiFi with SSID: "${configOptions.ssid}"`);
  }

  console.log('\n📋 Recommended Configuration:');
  console.log(JSON.stringify(configOptions, null, 2));

  // Step 5: Ask if user wants to proceed
  console.log('\n' + '═'.repeat(60));
  console.log('STEP 5: WHAT TO DO NEXT?');
  console.log('═'.repeat(60));

  if (existing.hotspots.length > 0) {
    log.warning('⚠️  IMPORTANT: Hotspot already configured!');
    console.log('\n❌ DO NOT run the orchestrator - it may create duplicates!');
    console.log('\n✅ Instead, you can:');
    console.log('  1. Use the existing hotspot configuration');
    console.log('  2. Add user profiles manually via /ip/hotspot/user/profile');
    console.log('  3. Generate vouchers using existing profiles');
    console.log('\n📝 Existing hotspot details:');
    existing.hotspots.forEach((h: any) => {
      console.log(`  Name: ${h.name}`);
      console.log(`  Interface: ${h.interface}`);
      console.log(`  Profile: ${h.profile}`);
    });
  } else {
    log.success('✅ Router ready for configuration!');
    console.log('\nYou can now run the orchestrator with these settings:');
    console.log('\nconst TEST_OPTIONS = {');
    console.log(`  hotspotEnabled: ${configOptions.hotspotEnabled},`);
    console.log(`  ssid: '${configOptions.ssid || 'YOUR-SSID'}',`);
    console.log(`  pppoeEnabled: false,`);
    console.log(`  wanInterface: 'ether1',`);
    if (configOptions.bridgeInterfaces) {
      console.log(`  bridgeInterfaces: ['${configOptions.bridgeInterfaces.join("', '")}'],`);
    }
    console.log('};');
  }

  // Final summary
  console.log('\n' + '═'.repeat(60));
  console.log('DISCOVERY COMPLETED');
  console.log('═'.repeat(60));
  console.log(`\nAnalyzed at: ${new Date().toISOString()}`);
  console.log(`\nExisting Resources Summary:`);
  console.log(`  Interfaces: ${existing.interfaces.length}`);
  console.log(`  Bridges: ${existing.bridges.length}`);
  console.log(`  IP Pools: ${existing.ipPools.length}`);
  console.log(`  DHCP Servers: ${existing.dhcpServers.length}`);
  console.log(`  Hotspots: ${existing.hotspots.length}`);
  console.log(`  NAT Rules: ${existing.natRules.length}`);
}

// Run the test
testWithExistingConfig()
  .then(() => {
    console.log('\n✅ Discovery completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Discovery failed:', error);
    process.exit(1);
  });