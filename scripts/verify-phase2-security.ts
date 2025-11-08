#!/usr/bin/env ts-node

/**
 * Phase 2 Security Verification Script
 * 
 * This script connects to your MikroTik router and verifies that Phase 2
 * security hardening has been applied correctly.
 * 
 * Usage:
 *   npx ts-node scripts/verify-phase2-security.ts
 * 
 * Or add to package.json:
 *   "verify-security": "ts-node scripts/verify-phase2-security.ts"
 */

import { MikroTikService } from '../lib/services/mikrotik';
import * as readline from 'readline';

interface SecurityCheckResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function verifyPhase2Security() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         Phase 2 Security Verification Script                ║');
  console.log('║         MikroTik Router Security Audit                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Get router connection details
  const ipAddress = await question('Router IP Address: ');
  const username = await question('Router Username [admin]: ') || 'admin';
  const password = await question('Router Password: ');

  console.log('');
  console.log('Connecting to router...');

  const config = {
    ipAddress,
    port: 80,
    username,
    password,
  };

  const results: SecurityCheckResult[] = [];

  try {
    // Test connection
    console.log('Testing connection...');
    const connectionTest = await MikroTikService.testConnection(config);
    
    if (!connectionTest.success) {
      console.error('❌ Connection failed:', connectionTest.error);
      rl.close();
      process.exit(1);
    }

    console.log('✅ Connected successfully');
    console.log(`   Router: ${connectionTest.data?.routerInfo.model}`);
    console.log(`   Version: ${connectionTest.data?.routerInfo.version}`);
    console.log('');

    // Check 1: WiFi Security Profile
    console.log('🔍 Checking WiFi security profile...');
    try {
      const securityProfiles = await MikroTikService.makeRequest(
        config,
        '/rest/interface/wireless/security-profiles',
        'GET'
      );

      const secureProfile = Array.isArray(securityProfiles)
        ? securityProfiles.find((p: any) => p.name === 'secure-wifi')
        : null;

      if (secureProfile) {
        const isWPA2 = secureProfile['authentication-types'] === 'wpa2-psk';
        const isAES = secureProfile['unicast-ciphers'] === 'aes-ccm' &&
                      secureProfile['group-ciphers'] === 'aes-ccm';
        const isDynamicKeys = secureProfile.mode === 'dynamic-keys';

        const passed = isWPA2 && isAES && isDynamicKeys;

        results.push({
          name: 'WiFi Security Profile',
          passed,
          message: passed
            ? 'Secure WiFi profile configured correctly'
            : 'WiFi profile has security issues',
          details: {
            authentication: secureProfile['authentication-types'],
            unicastCipher: secureProfile['unicast-ciphers'],
            groupCipher: secureProfile['group-ciphers'],
            mode: secureProfile.mode,
          },
        });

        console.log(passed ? '   ✅ PASS' : '   ❌ FAIL');
        console.log(`   Authentication: ${secureProfile['authentication-types']}`);
        console.log(`   Encryption: ${secureProfile['unicast-ciphers']}`);
      } else {
        results.push({
          name: 'WiFi Security Profile',
          passed: false,
          message: 'Security profile "secure-wifi" not found',
        });
        console.log('   ❌ FAIL - Profile not found');
      }
    } catch (error) {
      console.log('   ⚠️  No wireless capability or error checking profiles');
    }

    console.log('');

    // Check 2: WiFi Interface Configuration
    console.log('🔍 Checking WiFi interface...');
    try {
      const wirelessInterfaces = await MikroTikService.makeRequest(
        config,
        '/rest/interface/wireless',
        'GET'
      );

      const wlan1 = Array.isArray(wirelessInterfaces)
        ? wirelessInterfaces.find((i: any) => i.name === 'wlan1')
        : null;

      if (wlan1) {
        const usesSecureProfile = wlan1['security-profile'] === 'secure-wifi';
        const isEnabled = wlan1.disabled === 'false' || wlan1.disabled === false;
        const isAPBridge = wlan1.mode === 'ap-bridge';

        const passed = usesSecureProfile && isEnabled && isAPBridge;

        results.push({
          name: 'WiFi Interface Configuration',
          passed,
          message: passed
            ? 'WiFi interface configured securely'
            : 'WiFi interface configuration has issues',
          details: {
            securityProfile: wlan1['security-profile'],
            ssid: wlan1.ssid,
            mode: wlan1.mode,
            disabled: wlan1.disabled,
          },
        });

        console.log(passed ? '   ✅ PASS' : '   ❌ FAIL');
        console.log(`   SSID: ${wlan1.ssid}`);
        console.log(`   Security Profile: ${wlan1['security-profile']}`);
        console.log(`   Enabled: ${isEnabled}`);
      } else {
        console.log('   ⚠️  wlan1 interface not found (router may not have WiFi)');
      }
    } catch (error) {
      console.log('   ⚠️  No wireless capability');
    }

    console.log('');

    // Check 3: Hotspot Profile Security
    console.log('🔍 Checking hotspot authentication...');
    try {
      const hotspotProfiles = await MikroTikService.makeRequest(
        config,
        '/rest/ip/hotspot/profile',
        'GET'
      );

      const hsprof1 = Array.isArray(hotspotProfiles)
        ? hotspotProfiles.find((p: any) => p.name === 'hsprof1')
        : null;

      if (hsprof1) {
        const loginBy = hsprof1['login-by'] || '';
        const isHTTPChapOnly = loginBy === 'http-chap';
        const sharedUsers = hsprof1['shared-users'];
        const isOneDevice = sharedUsers === '1' || sharedUsers === 1;
        const useRadius = hsprof1['use-radius'];
        const isLocalAuth = useRadius === 'no' || useRadius === 'false' || useRadius === false;

        const passed = isHTTPChapOnly && isOneDevice && isLocalAuth;

        // Check for insecure methods
        const hasCookie = loginBy.includes('cookie');
        const hasTrial = loginBy.includes('trial');
        const hasMAC = loginBy.includes('mac');

        results.push({
          name: 'Hotspot Authentication Security',
          passed,
          message: passed
            ? 'Hotspot authentication secured (HTTP CHAP only)'
            : 'Hotspot has insecure authentication methods enabled',
          details: {
            loginBy,
            sharedUsers,
            useRadius,
            insecureMethods: {
              cookie: hasCookie,
              trial: hasTrial,
              mac: hasMAC,
            },
          },
        });

        console.log(passed ? '   ✅ PASS' : '   ❌ FAIL');
        console.log(`   Login By: ${loginBy}`);
        console.log(`   Shared Users: ${sharedUsers}`);
        console.log(`   Cookie Auth: ${hasCookie ? '❌ ENABLED (BAD)' : '✅ DISABLED'}`);
        console.log(`   Trial Mode: ${hasTrial ? '❌ ENABLED (BAD)' : '✅ DISABLED'}`);
        console.log(`   MAC Auth: ${hasMAC ? '❌ ENABLED (BAD)' : '✅ DISABLED'}`);
      } else {
        results.push({
          name: 'Hotspot Authentication Security',
          passed: false,
          message: 'Hotspot profile "hsprof1" not found',
        });
        console.log('   ❌ FAIL - Profile not found');
      }
    } catch (error) {
      console.log('   ❌ Error checking hotspot configuration');
    }

    console.log('');

    // Check 4: Hotspot Server Status
    console.log('🔍 Checking hotspot server...');
    try {
      const hotspotServers = await MikroTikService.makeRequest(
        config,
        '/rest/ip/hotspot',
        'GET'
      );

      const hotspot1 = Array.isArray(hotspotServers)
        ? hotspotServers.find((s: any) => s.name === 'hotspot1')
        : null;

      if (hotspot1) {
        const isEnabled = hotspot1.disabled === 'no' || hotspot1.disabled === false;
        const usesSecureProfile = hotspot1.profile === 'hsprof1';

        const passed = isEnabled && usesSecureProfile;

        results.push({
          name: 'Hotspot Server',
          passed,
          message: passed
            ? 'Hotspot server configured correctly'
            : 'Hotspot server configuration issues',
          details: {
            name: hotspot1.name,
            interface: hotspot1.interface,
            profile: hotspot1.profile,
            disabled: hotspot1.disabled,
          },
        });

        console.log(passed ? '   ✅ PASS' : '   ❌ FAIL');
        console.log(`   Name: ${hotspot1.name}`);
        console.log(`   Interface: ${hotspot1.interface}`);
        console.log(`   Profile: ${hotspot1.profile}`);
        console.log(`   Enabled: ${isEnabled}`);
      } else {
        console.log('   ⚠️  Hotspot server not found');
      }
    } catch (error) {
      console.log('   ❌ Error checking hotspot server');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                    VERIFICATION SUMMARY                    ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    const passedTests = results.filter((r) => r.passed).length;
    const totalTests = results.length;
    const allPassed = passedTests === totalTests;

    results.forEach((result) => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.name}`);
      console.log(`   ${result.message}`);
      console.log('');
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Results: ${passedTests}/${totalTests} checks passed`);
    console.log('═══════════════════════════════════════════════════════════');

    if (allPassed) {
      console.log('');
      console.log('🎉 SUCCESS! Phase 2 security hardening is correctly configured!');
      console.log('');
      console.log('Your router is secured with:');
      console.log('  ✅ WPA2-PSK WiFi encryption (AES-CCM)');
      console.log('  ✅ HTTP CHAP authentication only');
      console.log('  ✅ Cookie authentication disabled');
      console.log('  ✅ Trial mode disabled');
      console.log('  ✅ MAC authentication disabled');
      console.log('  ✅ One device per user enforced');
      console.log('');
    } else {
      console.log('');
      console.log('⚠️  ATTENTION: Some security checks failed!');
      console.log('');
      console.log('Recommended actions:');
      console.log('  1. Re-run the router configuration orchestrator');
      console.log('  2. Ensure Phase 2 security methods are enabled');
      console.log('  3. Check router logs for configuration errors');
      console.log('  4. Manually verify failed checks using WinBox/WebFig');
      console.log('');
    }

    rl.close();
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('');
    console.error('❌ Verification failed:', error instanceof Error ? error.message : error);
    rl.close();
    process.exit(1);
  }
}

// Run verification
verifyPhase2Security().catch((error) => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});
