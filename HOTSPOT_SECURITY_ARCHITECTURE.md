# Hotspot Security Architecture

## Critical Understanding: WiFi vs Hotspot Authentication

### ❌ Common Mistake (What We Fixed)

Many people think securing a hotspot means adding WPA2-PSK WiFi password protection. **This breaks
the captive portal!**

```
❌ WRONG APPROACH:
WiFi (WPA2-PSK with password) → User enters WiFi password → Connected to internet
                                                            ↑
                                                   No captive portal!
```

### ✅ Correct Architecture

**Hotspot captive portals require OPEN WiFi networks!** Security is enforced at the **hotspot
authentication layer**, not the WiFi layer.

```
✅ CORRECT APPROACH:
WiFi (OPEN, no password) → User connects → Captive Portal → Enter voucher → Internet access
                                              ↑
                                    Security enforced here!
```

---

## 🔒 Two-Layer Security Model

### Layer 1: WiFi (Physical Layer)

- **Configuration**: OPEN network, no password
- **Security Profile**: `default` (no encryption)
- **Purpose**: Allow devices to connect and see the captive portal

### Layer 2: Hotspot Authentication (Application Layer)

- **Configuration**: HTTP CHAP authentication (username/password)
- **Security Methods Disabled**:
  - ❌ Cookie authentication
  - ❌ Trial/free access
  - ❌ MAC authentication
- **Security Methods Enabled**:
  - ✅ HTTP CHAP (voucher code + password)
  - ✅ One device per voucher
  - ✅ Session timeout enforcement
  - ✅ Rate limiting per profile

---

## 📋 Current Implementation

### WiFi Configuration (Open Network)

```typescript
// lib/services/mikrotik-orchestrator.ts
await MikroTikNetworkConfig.configureWiFi(
  config,
  'wlan1',
  options.ssid,
  'default'  // MUST use 'default' (open) for captive portal to work
);
```

**Why `default`?**

- MikroTik's `default` security profile = OPEN network
- Allows devices to connect without WiFi password
- Captive portal intercepts HTTP requests
- Browser automatically opens portal login page

### Hotspot Authentication (Secure Layer)

```typescript
// lib/services/mikrotik.ts - configureSecureHotspotAuth()
await MikroTikService.makeRequest(
  config,
  `/rest/ip/hotspot/profile/${profile['.id']}`,
  'PATCH',
  {
    'login-by': 'http-chap',  // Only allow username/password
    'use-radius': 'no',        // Local authentication
  }
);
```

**Security Enforced:**

- Users MUST authenticate with voucher code
- No bypass methods (cookie/trial/MAC)
- Session tracked per user
- One device per voucher (enforced in user profiles)

---

## 🎯 User Experience Flow

### Step 1: User Connects to WiFi

```
User's Device
  ↓
Scans for WiFi networks
  ↓
Sees: "PAY N BROWSE" (open network)
  ↓
Connects without password ✅
```

### Step 2: Captive Portal Triggers

```
User opens browser
  ↓
HTTP request intercepted by hotspot
  ↓
Redirected to: http://192.168.x.1/login.html
  ↓
Captive portal page appears 🎨
```

### Step 3: Authentication

```
User sees login options:
  1. Buy Package (M-Pesa payment)
  2. Enter Voucher Code
  3. Existing User Login
  ↓
User authenticates
  ↓
Hotspot validates credentials
  ↓
Internet access granted ✅
```

---

## 🛡️ Security Features

### 1. HTTP CHAP Authentication

- **What it does**: Encrypts password during authentication
- **Prevents**: Password sniffing over open WiFi
- **How it works**: Challenge-response protocol

### 2. Session Management

- **Per-user sessions**: Tracked by hotspot
- **Timeout enforcement**: Automatic logout after session expires
- **Device limit**: One device per voucher (shared-users=1)

### 3. Rate Limiting

- **Per-profile limits**: Different speeds for different packages
- **Examples**:
  - 1 hour package: 2M/5M (download/upload)
  - 1 day package: 6M/12M
  - 1 month package: 15M/25M

### 4. Access Control

- **IP binding**: Optional MAC address binding
- **Time limits**: Session timeout per package
- **Idle timeout**: Disconnect inactive users
- **Keepalive**: Monitor connection health

---

## 🚫 What We Removed (And Why)

### ❌ WPA2-PSK WiFi Encryption

**Removed from**: `lib/services/mikrotik-orchestrator.ts`

**Before (Wrong):**

```typescript
// Created WPA2-PSK security profile
await MikroTikNetworkConfig.createSecureWiFiSecurityProfile(
  config,
  'secure-wifi',
  wifiPassword
);

// Applied to WiFi interface
await MikroTikNetworkConfig.configureWiFi(
  config,
  'wlan1',
  options.ssid,
  'secure-wifi'  // ❌ This breaks captive portal!
);
```

**After (Correct):**

```typescript
// Use default (open) security profile
await MikroTikNetworkConfig.configureWiFi(
  config,
  'wlan1',
  options.ssid,
  'default'  // ✅ Captive portal works!
);
```

**Why this change?**

- WPA2-PSK = password at WiFi level
- WiFi password = direct network access
- No captive portal = no voucher system
- Open WiFi = captive portal triggers = security at hotspot layer

---

## 📊 Security Comparison

### Option A: WPA2-PSK WiFi (❌ Wrong for Hotspot)

```
Pros:
  - Encrypted WiFi traffic
  - Prevents eavesdropping
  - Standard home/office setup

Cons:
  - ❌ Captive portal doesn't work
  - ❌ Can't sell vouchers
  - ❌ Everyone with password has access
  - ❌ No per-user control
```

### Option B: Open WiFi + Hotspot Auth (✅ Correct for Hotspot)

```
Pros:
  - ✅ Captive portal works
  - ✅ Per-user authentication
  - ✅ Voucher system functional
  - ✅ Session control
  - ✅ Rate limiting per user
  - ✅ Revenue generation

Cons:
  - WiFi traffic not encrypted at WiFi layer
  - Mitigated by: HTTPS websites (most sites use HTTPS)
  - Mitigated by: HTTP CHAP authentication
```

---

## 🔧 Configuration Files

### Modified Files

1. **lib/services/mikrotik-orchestrator.ts**
   - Removed: WiFi security profile creation
   - Changed: WiFi configuration to use 'default' profile
   - Kept: Hotspot authentication security

2. **lib/services/mikrotik.ts**
   - Kept: `configureSecureHotspotAuth()` method
   - Removed: `transparent-proxy` from hotspot profile
   - Removed: `shared-users` from hotspot profile (moved to user profiles)

### Unchanged (Still Secure)

- Hotspot authentication: HTTP CHAP only
- User profiles: `shared-users: '1'` per profile
- Cookie/trial/MAC auth: Disabled
- Session management: Active

---

## 📝 Best Practices

### DO ✅

1. Keep WiFi OPEN for hotspot captive portal
2. Secure at hotspot authentication layer
3. Use HTTP CHAP for password security
4. Enforce one device per voucher
5. Set appropriate session timeouts
6. Use rate limiting per package

### DON'T ❌

1. Don't add WPA2-PSK to hotspot WiFi
2. Don't enable cookie/trial/MAC authentication
3. Don't allow shared users (except admin profile)
4. Don't disable session timeouts
5. Don't forget to configure user profiles

---

## 🎓 Key Takeaways

1. **Hotspot ≠ Regular WiFi**
   - Hotspot requires open WiFi for captive portal
   - Security is at application layer, not WiFi layer

2. **Captive Portal = Open WiFi**
   - Captive portals only work with open networks
   - Password protection breaks the portal

3. **Two-Layer Security**
   - Layer 1 (WiFi): Open access
   - Layer 2 (Hotspot): Authentication required

4. **Modern Web is HTTPS**
   - Most websites use HTTPS (encrypted)
   - Open WiFi doesn't mean unencrypted browsing
   - HTTP CHAP protects login credentials

---

## 🚀 Future Enhancements (Optional)

### Option 1: HTTPS for Captive Portal

- Add SSL certificate to hotspot
- Encrypt portal login traffic
- Requires valid domain and certificate

### Option 2: RADIUS Server

- Centralized authentication
- Enterprise-grade security
- Database-backed user management

### Option 3: MAC Filtering (Whitelist)

- Optional device whitelisting
- For trusted admin devices
- Not recommended for customers

---

## 📚 References

- MikroTik HotSpot Documentation: https://wiki.mikrotik.com/wiki/HotSpot
- Captive Portal Best Practices: https://wiki.mikrotik.com/wiki/Manual:Captive_Portal
- HTTP CHAP Authentication: https://wiki.mikrotik.com/wiki/Manual:IP/Hotspot/User

---

## 🔍 Troubleshooting

### Problem: Captive portal not appearing

**Solution**: Verify WiFi is using 'default' (open) security profile

### Problem: Users connect but can't browse

**Solution**: Check hotspot authentication is configured

### Problem: Users can browse without login

**Solution**: Verify `login-by: 'http-chap'` is set in hotspot profile

### Problem: Multiple devices using one voucher

**Solution**: Check `shared-users: '1'` in user profiles

---

**Last Updated**: November 8, 2025 **Configuration Version**: v2.0 (Fixed WiFi Security)
