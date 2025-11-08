# Phase 2 Security Hardening - Testing Guide

## Overview

This guide provides step-by-step instructions to verify that Phase 2 security hardening is working
correctly on your MikroTik router.

**Testing Objectives:**

1. ✅ Verify WiFi security profile creation (WPA2-PSK/AES)
2. ✅ Verify hotspot authentication security (HTTP CHAP only)
3. ✅ Confirm insecure authentication methods are disabled
4. ✅ Validate end-to-end user experience

---

## Pre-Testing Checklist

### **Environment Requirements:**

- [ ] Router is accessible and online
- [ ] Dashboard is running (`npm run dev` or production)
- [ ] You have router admin credentials
- [ ] You have a test device (laptop/phone) for WiFi testing
- [ ] Browser with developer console access (Chrome/Firefox recommended)

### **Router State:**

- [ ] Router has been configured with Phase 2 orchestrator
- [ ] OR: Router is ready for fresh configuration

---

## Test Plan

### **Test 1: Fresh Router Configuration with Phase 2 Security**

#### **Objective:** Verify Phase 2 security is applied during initial router onboarding

#### **Steps:**

**1.1 Delete Existing Router (if applicable)**

```bash
# Navigate to dashboard
# Go to: Routers page
# Find: "Stratt Test Router" or your test router
# Click: Delete/Remove router
# Confirm deletion
```

**1.2 Add Router with Security**

```bash
# Dashboard: Click "Add Router" button
# Fill in router details:
#   - Name: "Phase2-Test-Router"
#   - IP Address: <your router IP>
#   - Username: admin
#   - Password: <router password>
#   - SSID: "Phase2-SecureWiFi"
#   - WiFi Password: "SecureTest123!"  ← NEW FIELD (if not present, skip to manual test)
#   - Enable Hotspot: YES
#   - WAN Interface: ether1
#   - Bridge Interfaces: ether2,ether3,ether4
# Click: "Add Router" or "Configure"
```

**1.3 Monitor Console Logs**

```bash
# Open browser developer console (F12)
# Watch for orchestrator logs showing:

Expected Console Output:
-----------------------
[Orchestrator] Step 3.2a: Creating secure WiFi security profile...
✓ WiFi security profile created
  WiFi Password: Se**********!

[Orchestrator] Step 3.2b: Configuring WiFi...
✓ WiFi configured with WPA2-PSK encryption

[Orchestrator] Step 3.5a: Securing hotspot authentication...
✓ Hotspot authentication secured
  - Login method: Username/Password only
  - Cookie auth: Disabled
  - Trial mode: Disabled
  - MAC auth: Disabled
  - Device limit: 1 per user
```

**Expected Result:** ✅ All security steps complete successfully

---

### **Test 2: Verify Router Configuration via API**

#### **Objective:** Confirm security settings are applied at router level

#### **Steps:**

**2.1 Check WiFi Security Profile**

```bash
# SSH into router OR use WinBox/WebFig
# Run command:
/interface/wireless/security-profiles/print

# Expected Output:
# NAME: secure-wifi
# AUTHENTICATION-TYPES: wpa2-psk
# MODE: dynamic-keys
# UNICAST-CIPHERS: aes-ccm
# GROUP-CIPHERS: aes-ccm
```

**Verification:**

- [ ] Profile named "secure-wifi" exists
- [ ] Authentication is WPA2-PSK (NOT open/WEP/WPA1)
- [ ] Encryption is AES-CCM (NOT TKIP)

**2.2 Check WiFi Interface Configuration**

```bash
# Run command:
/interface/wireless/print detail

# Expected Output:
# NAME: wlan1
# SSID: Phase2-SecureWiFi
# SECURITY-PROFILE: secure-wifi  ← MUST NOT be "default"
# MODE: ap-bridge
# DISABLED: no
```

**Verification:**

- [ ] SSID matches configured name
- [ ] Security profile is "secure-wifi" (NOT "default")
- [ ] Interface is enabled

**2.3 Check Hotspot Profile Security**

```bash
# Run command:
/ip/hotspot/profile/print detail

# Expected Output:
# NAME: hsprof1
# LOGIN-BY: http-chap  ← MUST ONLY show "http-chap"
# SHARED-USERS: 1
# USE-RADIUS: no
# TRANSPARENT-PROXY: yes
```

**Verification:**

- [ ] LOGIN-BY is **ONLY** "http-chap" (NOT "http-chap,trial,cookie,mac")
- [ ] SHARED-USERS is 1 (one device per user)
- [ ] Cookie/trial/MAC auth are NOT present

---

### **Test 3: WiFi Connection Security Test**

#### **Objective:** Verify WiFi requires WPA2-PSK password

#### **Steps:**

**3.1 Connect to WiFi**

```bash
# On test device (laptop/phone):
# 1. Scan for WiFi networks
# 2. Find SSID: "Phase2-SecureWiFi"
# 3. Attempt to connect
```

**Expected Behavior:**

- [ ] Network shows as "WPA2-Personal" or "WPA2-PSK" (NOT "Open")
- [ ] System prompts for password
- [ ] Connection FAILS with wrong password
- [ ] Connection SUCCEEDS with correct password: "SecureTest123!"

**3.2 Verify Encryption**

```bash
# Windows:
netsh wlan show interfaces
# Look for: Authentication: WPA2-Personal, Cipher: CCMP

# macOS:
Option+Click WiFi icon → Shows "Security: WPA2 Personal"

# Linux:
iwconfig wlan0
# Look for: Encryption key:on, ESSID:"Phase2-SecureWiFi"
```

**Verification:**

- [ ] Encryption shows WPA2/AES (NOT WEP/WPA1/TKIP)
- [ ] Connection requires password (NOT open network)

---

### **Test 4: Hotspot Authentication Security Test**

#### **Objective:** Verify only username/password login works

#### **Steps:**

**4.1 Attempt Cookie Authentication (Should FAIL)**

```bash
# 1. Connect to WiFi: "Phase2-SecureWiFi"
# 2. Browser opens captive portal login page
# 3. Try to access internet WITHOUT logging in
# Expected: Redirect to login page (no free access)

# 4. After successful login, copy session cookie
# 5. Try to use cookie on another device
# Expected: Login required again (cookies disabled)
```

**Expected Result:** ❌ Cookie auth does NOT work

**4.2 Attempt Trial Mode Access (Should FAIL)**

```bash
# 1. Connect to WiFi
# 2. Open captive portal login page
# 3. Look for "Free Trial" or "Guest Access" button
# Expected: NO trial button exists in UI

# 4. Try to access status page directly
# Expected: Redirect to login (no trial session)
```

**Expected Result:** ❌ Trial mode is NOT available

**4.3 Attempt MAC Authentication (Should FAIL)**

```bash
# Test via router CLI:
/ip/hotspot/ip-binding/add mac-address=AA:BB:CC:DD:EE:FF type=bypassed

# Expected: Binding created BUT user still cannot access internet
# Reason: Router enforces HTTP CHAP, MAC binding ignored
```

**Expected Result:** ❌ MAC bypass does NOT work

**4.4 Valid Username/Password Login (Should SUCCEED)**

```bash
# 1. Connect to WiFi: "Phase2-SecureWiFi"
# 2. Browser opens: http://10.5.50.1/login
# 3. Click "Buy Package" tab
# 4. Select package and enter phone number
# 5. Complete M-Pesa payment OR use test voucher
# 6. Login with voucher credentials
# Expected: Login succeeds, internet access granted
```

**Expected Result:** ✅ Voucher login WORKS

**4.5 Verify Device Limit (One Device Per User)**

```bash
# 1. Login with voucher on Device A
# 2. Try to login with SAME voucher on Device B
# Expected: Device A gets disconnected OR Device B login fails
# Reason: shared-users=1 enforces one device per account
```

**Expected Result:** ✅ Only ONE device can use voucher

---

### **Test 5: Security Audit Checklist**

#### **Router Configuration Verification:**

**WiFi Security:**

- [ ] WiFi security profile name: "secure-wifi"
- [ ] Authentication type: wpa2-psk (ONLY)
- [ ] Unicast cipher: aes-ccm
- [ ] Group cipher: aes-ccm
- [ ] Password: At least 8 characters
- [ ] WiFi interface uses "secure-wifi" profile (NOT "default")

**Hotspot Security:**

- [ ] Hotspot profile login-by: "http-chap" (ONLY)
- [ ] Hotspot profile shared-users: 1
- [ ] Hotspot profile use-radius: no
- [ ] No trial mode in login-by parameter
- [ ] No cookie auth in login-by parameter
- [ ] No MAC auth in login-by parameter

**Captive Portal:**

- [ ] Login page loads correctly
- [ ] Buy Package tab works
- [ ] Voucher tab works
- [ ] M-Pesa tab works
- [ ] NO trial/guest access buttons visible
- [ ] Status page shows session info after login

---

### **Test 6: Negative Security Tests**

#### **Attempt to Bypass Security (Should ALL FAIL):**

**6.1 Direct Internet Access**

```bash
# Without authenticating:
curl -I http://google.com
# Expected: Redirect to captive portal (302/307)
```

**6.2 DNS Manipulation**

```bash
# Change DNS to 8.8.8.8 without authenticating
# Try to browse internet
# Expected: Still redirected to captive portal
```

**6.3 MAC Spoofing**

```bash
# Spoof MAC address of authenticated device
# Try to access internet
# Expected: Still requires authentication
```

**6.4 Cookie Replay**

```bash
# Copy session cookie from Device A
# Use on Device B
# Expected: Authentication still required
```

**Expected Result:** ❌ ALL bypass attempts FAIL

---

## Verification Commands

### **Quick Router Audit Script** (RouterOS CLI)

```bash
# Copy and paste into router terminal:

:put "=== PHASE 2 SECURITY AUDIT ==="
:put ""

:put "1. WiFi Security Profile:"
/interface/wireless/security-profiles/print where name="secure-wifi"
:put ""

:put "2. WiFi Interface Configuration:"
/interface/wireless/print detail where name="wlan1"
:put ""

:put "3. Hotspot Profile Security:"
/ip/hotspot/profile/print detail where name="hsprof1"
:put ""

:put "4. Hotspot Server Status:"
/ip/hotspot/print
:put ""

:put "5. Active Hotspot Users:"
/ip/hotspot/active/print
:put ""

:put "=== AUDIT COMPLETE ==="
```

### **Expected Audit Output:**

```
=== PHASE 2 SECURITY AUDIT ===

1. WiFi Security Profile:
   name: secure-wifi
   authentication-types: wpa2-psk
   mode: dynamic-keys
   unicast-ciphers: aes-ccm
   group-ciphers: aes-ccm

2. WiFi Interface Configuration:
   name: wlan1
   ssid: Phase2-SecureWiFi
   security-profile: secure-wifi
   mode: ap-bridge
   disabled: no

3. Hotspot Profile Security:
   name: hsprof1
   login-by: http-chap
   shared-users: 1
   use-radius: no
   transparent-proxy: yes

4. Hotspot Server Status:
   name: hotspot1
   interface: bridge-hotspot
   profile: hsprof1
   disabled: no

5. Active Hotspot Users:
   (Shows active sessions if any)

=== AUDIT COMPLETE ===
```

---

## Troubleshooting

### **Issue: WiFi password not working**

**Symptoms:**

- Cannot connect to WiFi
- "Incorrect password" error

**Diagnosis:**

```bash
# Check security profile password:
/interface/wireless/security-profiles/print detail where name="secure-wifi"
# Verify wpa2-pre-shared-key matches your password
```

**Solution:**

- Ensure password is at least 8 characters
- Re-run orchestrator with correct password
- Manually update password:
  `/interface/wireless/security-profiles/set secure-wifi wpa2-pre-shared-key="YourPassword"`

---

### **Issue: Hotspot still allows trial/cookie auth**

**Symptoms:**

- Users can access internet without voucher
- Cookie authentication works

**Diagnosis:**

```bash
# Check hotspot profile login-by:
/ip/hotspot/profile/print detail where name="hsprof1"
# If shows "http-chap,trial,cookie" → NOT SECURE
```

**Solution:**

```bash
# Manually fix:
/ip/hotspot/profile/set hsprof1 login-by=http-chap shared-users=1

# Or re-run orchestrator
```

---

### **Issue: Multiple devices using same voucher**

**Symptoms:**

- Voucher works on multiple devices simultaneously

**Diagnosis:**

```bash
# Check shared-users setting:
/ip/hotspot/profile/print detail where name="hsprof1"
# Should show: shared-users: 1
```

**Solution:**

```bash
# Fix shared-users:
/ip/hotspot/profile/set hsprof1 shared-users=1

# Disconnect all active sessions:
/ip/hotspot/active/remove [find]
```

---

## Success Criteria

### **Phase 2 is SUCCESSFUL if:**

✅ **WiFi Security:**

- WPA2-PSK encryption is active
- AES-CCM cipher is used
- Password is required for connection
- Security profile is NOT "default"

✅ **Hotspot Security:**

- Only HTTP CHAP authentication works
- Cookie authentication does NOT work
- Trial mode does NOT work
- MAC authentication does NOT work
- One device per voucher is enforced

✅ **User Experience:**

- Captive portal loads correctly
- Purchase workflow works
- Voucher login works
- Session status displays correctly
- No trial/guest buttons visible

✅ **Security Audit:**

- All bypass attempts fail
- Configuration matches security requirements
- Console logs show security steps completed

---

## Post-Testing Actions

### **If Tests PASS:**

1. Mark Phase 2 as complete ✅
2. Update todo list (Item 7 → completed)
3. Document WiFi password for customer
4. Consider Phase 3 enhancements (optional)

### **If Tests FAIL:**

1. Review failed test details
2. Check router logs for errors
3. Re-run orchestrator with correct settings
4. Consult troubleshooting section
5. Verify code changes were deployed

---

## Phase 3 Considerations (Future Enhancement)

**Potential Additional Security:**

- HTTPS for captive portal (SSL/TLS)
- RADIUS server integration
- MAC address blacklisting
- Rate limiting on login attempts
- Two-factor authentication for admin
- Automated security audits

---

## Testing Timeline

**Estimated Time:** 30-45 minutes

- [ ] Test 1: Router configuration (10 min)
- [ ] Test 2: API verification (5 min)
- [ ] Test 3: WiFi connection (5 min)
- [ ] Test 4: Hotspot authentication (15 min)
- [ ] Test 5: Security audit (5 min)
- [ ] Test 6: Negative tests (5 min)

---

## Report Template

```markdown
# Phase 2 Testing Report

**Date:** [Date] **Tester:** [Your Name] **Router:** [Router Name/IP]

## Test Results

### WiFi Security

- [ ] WPA2-PSK configured: YES / NO
- [ ] AES encryption: YES / NO
- [ ] Password required: YES / NO
- Issues: [None or describe]

### Hotspot Security

- [ ] HTTP CHAP only: YES / NO
- [ ] Cookie auth disabled: YES / NO
- [ ] Trial mode disabled: YES / NO
- [ ] MAC auth disabled: YES / NO
- [ ] One device limit: YES / NO
- Issues: [None or describe]

### User Experience

- [ ] Login page loads: YES / NO
- [ ] Purchase works: YES / NO
- [ ] Voucher works: YES / NO
- Issues: [None or describe]

### Overall Result

- [ ] PASS - All tests successful
- [ ] FAIL - Issues found (see above)

**Notes:** [Additional observations]
```

---

**END OF TESTING GUIDE**
