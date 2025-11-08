# Phase 2 Quick Reference

## 🚀 Run Security Verification

```bash
npm run verify:security
```

## 📋 Security Checklist

### WiFi Security

- [ ] WPA2-PSK authentication
- [ ] AES-CCM encryption
- [ ] Security profile: "secure-wifi" (NOT "default")
- [ ] Password: Minimum 8 characters

### Hotspot Security

- [ ] Login by: "http-chap" ONLY
- [ ] Cookie auth: DISABLED
- [ ] Trial mode: DISABLED
- [ ] MAC auth: DISABLED
- [ ] Shared users: 1 (one device per user)

## 🔧 Manual Router Check

```bash
# SSH to router, then run:

# Check WiFi profile
/interface/wireless/security-profiles/print where name="secure-wifi"

# Check hotspot security
/ip/hotspot/profile/print detail where name="hsprof1"
```

## ✅ Expected Configuration

**WiFi Security Profile:**

```
name: secure-wifi
authentication-types: wpa2-psk
unicast-ciphers: aes-ccm
group-ciphers: aes-ccm
```

**Hotspot Profile:**

```
name: hsprof1
login-by: http-chap
shared-users: 1
use-radius: no
```

## 📖 Full Documentation

- **Testing Guide:** `PHASE_2_TESTING_GUIDE.md`
- **Security Audit:** `CAPTIVE_PORTAL_SECURITY.md`
- **Complete Summary:** `PHASE_2_COMPLETION_SUMMARY.md`

## 🎯 Success Criteria

✅ WiFi requires password to connect  
✅ Hotspot requires username/password login  
✅ Cookie/trial/MAC auth DO NOT work  
✅ One device per voucher enforced

## 🆘 Troubleshooting

**Issue:** WiFi connection fails  
**Fix:** Check password is at least 8 characters

**Issue:** Multiple devices using same voucher  
**Fix:** Verify `shared-users=1` in hotspot profile

**Issue:** Cookie auth still works  
**Fix:** Re-run orchestrator or manually set `login-by=http-chap`

## 📞 Support

Run verification script for detailed diagnostics:

```bash
npm run verify:security
```
