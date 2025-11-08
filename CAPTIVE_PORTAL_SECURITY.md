# Captive Portal Security Hardening Documentation

## Overview

This document outlines the security requirements and necessary modifications for the captive portal
files to align with **Phase 2 Security Hardening** implementation.

**Last Updated:** November 7, 2025  
**Phase:** Phase 2 - Security Hardening (Item 6)

---

## Security Objectives

1. **Enforce HTTP CHAP Authentication:** Only username/password login allowed
2. **Disable Insecure Login Methods:** Remove cookie, trial, and MAC authentication options
3. **Prevent Authentication Bypass:** Ensure all captive portal files respect security configuration
4. **Maintain User Experience:** Keep legitimate purchase/voucher workflows intact

---

## Current Security Status

### ✅ **Already Secure (No Changes Needed)**

#### 1. **login.html** - Main Login Page

- **Status:** ✅ **SECURE**
- **Location:** `captive-portal-files/login.html`
- **Authentication Methods:**
  - ✅ Buy Package (M-Pesa purchase)
  - ✅ Voucher Code Entry
  - ✅ M-Pesa Payment Verification
- **No Insecure Methods Found:** File only supports legitimate payment/voucher authentication
- **Action Required:** **NONE**

#### 2. **alogin.html** - Successful Login Page

- **Status:** ✅ **SECURE**
- **Location:** `captive-portal-files/alogin.html`
- **Purpose:** Post-authentication success page with redirect
- **Security Risk:** None (passive display page)
- **Action Required:** **NONE**

#### 3. **error.html** - Error Display Page

- **Status:** ✅ **SECURE**
- **Location:** `captive-portal-files/error.html`
- **Purpose:** Display login errors
- **Security Risk:** None (passive error page)
- **Action Required:** **NONE**

#### 4. **logout.html** - Logout Page

- **Status:** ✅ **SECURE**
- **Location:** `captive-portal-files/logout.html`
- **Purpose:** Session termination confirmation
- **Security Risk:** None (logout functionality)
- **Action Required:** **NONE**

#### 5. **rlogin.html** - Redirect Login Handler

- **Status:** ✅ **SECURE**
- **Location:** `captive-portal-files/rlogin.html`
- **Purpose:** MikroTik redirect handler (WISP protocol)
- **Security Risk:** None (protocol compliance)
- **Action Required:** **NONE**

#### 6. **redirect.html** - Redirect Handler

- **Status:** ✅ **SECURE**
- **Location:** `captive-portal-files/redirect.html`
- **Purpose:** Generic redirect page
- **Security Risk:** None (passive redirect)
- **Action Required:** **NONE**

#### 7. **radvert.html** - Advertisement Page

- **Status:** ✅ **SECURE**
- **Location:** `captive-portal-files/radvert.html`
- **Purpose:** Optional advertisement display
- **Security Risk:** None (display only)
- **Action Required:** **NONE**

---

### ⚠️ **Requires Review (Potential Security Concern)**

#### 8. **status.html** - Active Session Status Page

- **Status:** ⚠️ **NEEDS REVIEW**
- **Location:** `captive-portal-files/status.html`
- **Security Concern:** Contains conditional logic for trial mode
- **Findings:**
  ```html
  $(if login-by == 'trial')
  <h1>Trial Session Active</h1>
  $(elif login-by != 'mac')
  <h1>Welcome, $(username)!</h1>
  $(else)
  <h1>Session Active</h1>
  $(endif)
  ```

**Analysis:**

- MikroTik template variables (`login-by`) check for 'trial' and 'mac' authentication
- **This is DISPLAY LOGIC only** - does not enable trial mode
- Trial mode is controlled by **MikroTik hotspot profile configuration**, not HTML files
- Since Phase 2 disables trial mode at the **router level** (`login-by: 'http-chap'`), these
  conditionals will never match

**Risk Level:** **LOW**

- Router configuration takes precedence over captive portal files
- HTML conditionals cannot bypass router security settings
- Display logic is harmless when underlying authentication is disabled

**Recommended Action:**

- **Option 1 (Recommended):** Leave as-is - conditionals are safe and won't trigger
- **Option 2 (Clean Code):** Remove trial/MAC conditionals for clarity
  ```html
  <!-- Simplified version -->
  <h1>Welcome, $(username)!</h1>
  <p>You are connected to WiFi</p>
  ```

**Action Required:** **OPTIONAL CLEANUP** (cosmetic only, no security impact)

---

## XML Files (MikroTik Protocol)

### **xml/ Directory**

- **Status:** ✅ **SECURE**
- **Location:** `captive-portal-files/xml/`
- **Files:**
  - `WISPAccessGatewayParam.html`
  - `WISPAccessGatewayParam.xsd`
  - `alogin.html`
  - `error.html`
  - `flogout.html`
  - `login.html`
  - `logout.html`
  - `rlogin.html`

**Purpose:** MikroTik WISP (Wireless Internet Service Provider) protocol compliance  
**Security Risk:** None - protocol templates used by MikroTik router internally  
**Action Required:** **NONE** (system files, do not modify)

---

## Static Assets

### **css/style.css**

- **Status:** ✅ **SECURE**
- **Location:** `captive-portal-files/css/style.css`
- **Purpose:** Styling for captive portal pages
- **Security Risk:** None (CSS cannot bypass authentication)
- **Action Required:** **NONE**

### **md5.js**

- **Status:** ✅ **SECURE** (but deprecated)
- **Location:** `captive-portal-files/md5.js`
- **Purpose:** MD5 hashing for MikroTik HTTP CHAP authentication
- **Security Note:** MD5 is cryptographically weak but required by MikroTik HTTP CHAP protocol
- **Action Required:** **NONE** (MikroTik protocol requirement)

### **img/ Directory**

- **Status:** ✅ **SECURE**
- **Location:** `captive-portal-files/img/`
- **Purpose:** Logo and branding images
- **Security Risk:** None
- **Action Required:** **NONE**

### **api.json**

- **Status:** ✅ **SECURE**
- **Location:** `captive-portal-files/api.json`
- **Purpose:** Runtime API configuration (generated during upload)
- **Security Risk:** None (configuration data only)
- **Action Required:** **NONE**

---

## Security Architecture

### **How Phase 2 Security Works**

```
┌─────────────────────────────────────────────────────────────┐
│                  SECURITY ENFORCEMENT LAYERS                 │
└─────────────────────────────────────────────────────────────┘

Layer 1: MikroTik Router Configuration (PRIMARY ENFORCEMENT)
┌──────────────────────────────────────────────────────────────┐
│ Hotspot Profile Security Settings:                           │
│ • login-by: 'http-chap'          ← ENFORCED AT ROUTER       │
│ • shared-users: '1'              ← ONE DEVICE PER USER       │
│ • use-radius: 'no'               ← LOCAL AUTH ONLY           │
│ • transparent-proxy: 'yes'       ← PROXY ENABLED             │
│                                                               │
│ ✓ Cookie auth: DISABLED (not in login-by)                   │
│ ✓ Trial mode: DISABLED (not in login-by)                    │
│ ✓ MAC auth: DISABLED (not in login-by)                      │
└──────────────────────────────────────────────────────────────┘
                              ↓
Layer 2: WiFi Security (WPA2-PSK/AES)
┌──────────────────────────────────────────────────────────────┐
│ WiFi Security Profile:                                        │
│ • authentication-types: 'wpa2-psk'                           │
│ • unicast-ciphers: 'aes-ccm'                                 │
│ • group-ciphers: 'aes-ccm'                                   │
│ • wpa2-pre-shared-key: <password>                            │
└──────────────────────────────────────────────────────────────┘
                              ↓
Layer 3: Captive Portal Files (DISPLAY ONLY)
┌──────────────────────────────────────────────────────────────┐
│ HTML/JS Files:                                                │
│ • login.html       → Displays login forms                    │
│ • status.html      → Shows session status                    │
│ • alogin.html      → Success page                            │
│                                                               │
│ NOTE: Cannot override router security settings!              │
└──────────────────────────────────────────────────────────────┘
```

### **Key Principle: Router Configuration is Authority**

**Important:** Captive portal HTML files **CANNOT** bypass or override MikroTik router security
settings.

- **Router enforces authentication:** Hotspot profile `login-by: 'http-chap'` setting
- **HTML files display UI:** Forms and status pages for user interaction
- **Authentication happens at router:** MikroTik validates credentials, not JavaScript

**Example:**

```html
<!-- Even if status.html contains trial mode UI... -->
$(if login-by == 'trial')
<h1>Trial Session Active</h1>
$(endif)

<!-- ...it NEVER displays because router has login-by: 'http-chap' -->
<!-- The conditional $(if login-by == 'trial') evaluates to FALSE -->
<!-- Router security settings take absolute precedence -->
```

---

## Verification Checklist

### **Phase 2 Security Verification**

After router configuration with Phase 2 security:

#### **Router-Level Verification:**

- [ ] WiFi security profile exists with name `secure-wifi`
- [ ] WiFi authentication type is `wpa2-psk`
- [ ] WiFi encryption is `aes-ccm` (unicast + group)
- [ ] Hotspot profile `login-by` is `http-chap` ONLY
- [ ] Hotspot profile `shared-users` is `1`
- [ ] Hotspot profile `use-radius` is `no`

#### **User Experience Testing:**

- [ ] WiFi connection requires password (WPA2-PSK)
- [ ] Captive portal login page loads correctly
- [ ] User can purchase package via M-Pesa
- [ ] User can login with voucher code
- [ ] User can verify M-Pesa payment
- [ ] Status page shows session information
- [ ] **Trial mode button does NOT appear** (not in UI)
- [ ] **Cookie login does NOT work** (router rejects)
- [ ] **MAC authentication does NOT work** (router rejects)

#### **Security Testing:**

- [ ] Attempt cookie-based login → Should FAIL (router rejects)
- [ ] Attempt to access internet without auth → Should REDIRECT to login
- [ ] Attempt MAC address bypass → Should FAIL (router enforces CHAP)
- [ ] Login with valid voucher → Should SUCCEED
- [ ] Check session limit → Only 1 device allowed per user

---

## Conclusion

### **Summary:**

✅ **All captive portal files are SECURE**  
✅ **No insecure authentication methods found in HTML**  
✅ **Trial/MAC conditionals in status.html are HARMLESS** (display logic only)  
✅ **Router-level security is PRIMARY enforcement mechanism**  
✅ **Captive portal files CANNOT bypass router security**

### **Required Actions:**

**NONE** - All captive portal files are compatible with Phase 2 security hardening.

### **Optional Improvements:**

1. **status.html cleanup** (cosmetic only):
   - Remove trial/MAC conditionals for code clarity
   - No security benefit, purely aesthetic

2. **Add security indicators to UI:**
   - Display "🔒 Secure Connection" badge
   - Show "WPA2 Protected Network" message
   - Inform users about enhanced security

### **Phase 2 Status:**

**Item 6: Document Captive Portal Security Requirements** → ✅ **COMPLETE**

---

## References

- **Phase 2 Implementation:** WiFi WPA2-PSK + Hotspot HTTP CHAP enforcement
- **Router Configuration:** `lib/services/mikrotik-orchestrator.ts`
- **Security Methods:**
  - `createSecureWiFiSecurityProfile()` in `mikrotik.ts`
  - `configureSecureHotspotAuth()` in `mikrotik.ts`
- **MikroTik Documentation:** HTTP CHAP Authentication Protocol

---

## Revision History

| Date       | Version | Author         | Changes                                       |
| ---------- | ------- | -------------- | --------------------------------------------- |
| 2025-11-07 | 1.0     | Security Audit | Initial captive portal security documentation |

---

**END OF DOCUMENT**
