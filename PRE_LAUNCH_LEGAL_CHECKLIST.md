# 🚀 PAY N BROWSE - Pre-Launch Legal Checklist

## ⚠️ CRITICAL: Before Going Live

This checklist must be completed before deploying to production. Items marked with 🔴 are mandatory.

---

## 📧 Email Addresses to Create

Set up these email addresses or configure email aliases:

- [ ] 🔴 **support@paynbrowse.com** - General customer support
- [ ] 🔴 **privacy@paynbrowse.com** - Privacy policy inquiries (can alias to support@)
- [ ] 🔴 **abuse@paynbrowse.com** - AUP violation reports
- [ ] 🔴 **security@paynbrowse.com** - Security vulnerability reports
- [ ] **appeals@paynbrowse.com** - AUP enforcement appeals (can alias to support@)
- [ ] **sla@paynbrowse.com** - SLA credit claims (can alias to support@)
- [ ] **dpo@paynbrowse.com** - Data Protection Officer (if required)

**Priority:** Create at minimum: support@, abuse@, security@ before launch.

---

## 📱 Contact Information Updates

Update placeholder contact information in these files:

### 1. Terms of Service (`/src/app/legal/terms-of-service/page.tsx`)

**Line ~540:**

```tsx
<p className="m-0">Phone: +254 [Your Phone Number]</p>
<p className="m-0">Address: [Your Business Address], Kenya</p>
```

- [ ] 🔴 Replace `+254 [Your Phone Number]` with actual phone
- [ ] 🔴 Replace `[Your Business Address]` with actual address

### 2. Cookie Policy (`/src/app/legal/cookie-policy/page.tsx`)

**Line ~475:**

```tsx
<p className="m-0">Phone: +254 [Your Phone Number]</p>
```

- [ ] 🔴 Replace `+254 [Your Phone Number]` with actual phone

### 3. Acceptable Use Policy (`/src/app/legal/acceptable-use/page.tsx`)

**Line ~530:**

```tsx
<p className="m-0 mt-2"><strong>Phone:</strong> +254 [Your Phone Number]</p>
```

- [ ] 🔴 Replace `+254 [Your Phone Number]` with actual phone

### 4. Service Level Agreement (`/src/app/legal/sla/page.tsx`)

**Line ~640:**

```tsx
<p className="m-0"><strong>Critical Issues (ISP Plans):</strong> +254 [Your Phone Number]</p>
```

- [ ] 🔴 Replace `+254 [Your Phone Number]` with actual phone

### 5. Privacy Policy (`/src/app/legal/privacy-policy/page.tsx`)

**Lines ~215 and ~230:**

```tsx
<p className="m-0">Phone: +254 [Your Phone Number]</p>
```

- [ ] 🔴 Replace `+254 [Your Phone Number]` with actual phone (appears twice)

---

## 🌐 Status Page Setup

- [ ] 🔴 Set up status page at **status.paynbrowse.com**
  - Options: StatusPage.io, Atlassian Statuspage, self-hosted Cachet, Uptime Robot Status Page
  - Must display: Current status, scheduled maintenance, incident history
- [ ] Update SLA page with correct status page URL (currently placeholder)

---

## 💰 Business Details Verification

Review and confirm these are accurate:

- [ ] 🔴 **Commission Rate - Individual:** 80% (stated in Terms of Service)
- [ ] 🔴 **Commission Rate - ISP Plans:** 0% (stated in Terms of Service)
- [ ] 🔴 **ISP Basic Price:** KES 2,500/month (stated in Terms of Service)
- [ ] 🔴 **ISP Pro Price:** KES 3,900/month (stated in Terms of Service)
- [ ] **Free Trial Period:** 15 days for ISP plans (stated in Terms of Service)
- [ ] **Minimum Payout:** KES 1,000 (stated in Terms of Service)
- [ ] **Company Paybill Number:** Verify this is disclosed correctly

If any of these need to change, update in `/src/app/legal/terms-of-service/page.tsx`.

---

## 🛡️ Legal & Compliance

### Kenya Data Protection Act Compliance

- [ ] 🔴 **ODPC Contact Verified:** Confirm contact details are current
  - Email: complaints@odpc.go.ke
  - Phone: +254 (020) 2675316
  - Website: www.odpc.go.ke
  - Address: KISM Building, 2nd Floor, Kabuku Rd, Off Ngong Rd, Nairobi
- [ ] **DPO Appointed:** If required, appoint Data Protection Officer
- [ ] **ODPC Registration:** Check if your business requires registration with ODPC

### Communications Authority of Kenya (CA)

- [ ] **ISP License:** Verify if you need CA licensing (check with CA)
- [ ] **Compliance:** Ensure operations meet CA requirements

### Kenya Revenue Authority (KRA)

- [ ] **Tax Compliance:** Ensure VAT and income tax obligations are met
- [ ] **M-Pesa Reporting:** Ensure transaction reporting is compliant

### Optional Legal Review

- [ ] **Lawyer Review:** Have a Kenyan lawyer review all legal documents
  - Recommended: Lawyer specializing in tech/data protection
  - Can help identify jurisdiction-specific issues

---

## 🔐 Security Setup

- [ ] 🔴 **Security Email Monitored:** Ensure security@paynbrowse.com is actively monitored
- [ ] **Vulnerability Disclosure Policy:** Confirm responsible disclosure process
- [ ] **Incident Response Plan:** Have plan for data breaches (required by Kenya DPA)
- [ ] **SSL/TLS Certificate:** Ensure HTTPS is enforced site-wide
- [ ] **Data Encryption:** Verify encryption at rest and in transit

---

## 📊 Monitoring & Analytics

### Cookie Consent Integration

- [ ] **Test Cookie Banner:** Verify banner appears and choices are respected
- [ ] **Analytics Integration:** If using Google Analytics or similar:
  - Update Cookie Policy with specific service names
  - Respect user cookie choices (disable analytics if declined)
  - Add opt-out links if required

### Status Monitoring

- [ ] **Uptime Monitoring:** Set up monitoring to track SLA commitments
  - ISP Pro: 99.9% uptime
  - ISP Basic: 99.5% uptime
  - Individual: 99.0% uptime
- [ ] **Alert System:** Configure alerts for on-call engineers
- [ ] **Incident Response:** Have team ready for 24/7 critical issues (ISP Pro)

---

## 🧪 Testing Before Launch

### Cookie Consent

- [ ] Test on desktop (Chrome, Firefox, Safari, Edge)
- [ ] Test on mobile (iOS Safari, Android Chrome)
- [ ] Verify localStorage persistence
- [ ] Confirm banner doesn't reappear after choice
- [ ] Test all legal page links from banner

### Legal Pages

- [ ] All 5 pages render without errors
- [ ] "Back to Home" button works
- [ ] Footer navigation between legal pages works
- [ ] All external links work and open in new tabs
- [ ] Mobile responsive design works
- [ ] Dark mode (if enabled) displays correctly

### Signup Form

- [ ] Cannot submit without checking terms checkbox
- [ ] Error message displays clearly
- [ ] All 3 legal document links work
- [ ] Links open in new tabs
- [ ] Can complete signup after accepting terms

---

## 📝 Documentation

- [ ] **LEGAL_FRAMEWORK_IMPLEMENTATION.md:** Review and update any outdated info
- [ ] **README.md:** Add section about legal compliance
- [ ] **Developer Docs:** Document where legal content is stored
- [ ] **Change Log:** Keep log of legal document updates

---

## 🚀 Deployment Steps

### Pre-Deployment

1. [ ] 🔴 Complete ALL mandatory items (marked with 🔴) above
2. [ ] Replace all placeholder text with real contact information
3. [ ] Run `npm run build` and fix any build errors
4. [ ] Test legal pages in production-like environment

### Post-Deployment

1. [ ] Verify all legal pages are accessible via `/legal/*` routes
2. [ ] Test cookie banner on production domain
3. [ ] Submit sitemap to Google (include legal pages)
4. [ ] Monitor error logs for any legal page issues
5. [ ] Set up analytics to track legal page views

### First Week After Launch

1. [ ] Monitor abuse@paynbrowse.com for reports
2. [ ] Monitor security@paynbrowse.com for vulnerability reports
3. [ ] Review user feedback on legal terms clarity
4. [ ] Check SLA uptime tracking is accurate
5. [ ] Verify cookie consent is being respected

---

## 📞 Emergency Contacts

Keep these contacts readily available:

- **Hosting Provider Support:** [Your hosting provider]
- **Domain Registrar:** [Your domain provider]
- **Legal Counsel:** [Your lawyer's contact]
- **ODPC:** complaints@odpc.go.ke, +254-020-2675316
- **CA Kenya:** info@ca.go.ke, +254-020-4242000
- **Safaricom M-Pesa:** [Business support line]

---

## 🎯 Quick Find & Replace

Use your code editor to find and replace these placeholders across all files:

1. **Find:** `+254 [Your Phone Number]`  
   **Replace with:** Your actual phone number

2. **Find:** `[Your Business Address]`  
   **Replace with:** Your actual business address

3. **Find:** `support@paynbrowse.com` (if using different email)  
   **Replace with:** Your actual support email

4. **Find:** `status.paynbrowse.com`  
   **Replace with:** Your actual status page URL (if different)

---

## ✅ Sign-Off

**Before marking complete, have at least 2 people review:**

- [ ] Technical Lead - Verified all contact info updated
- [ ] Legal/Compliance - Reviewed all legal documents
- [ ] Business Owner - Approved pricing and commission rates
- [ ] Security Lead - Verified security email monitoring

**Launch Approval:**

- Approved by: ******\_\_\_******
- Date: ******\_\_\_******
- Notes: ******\_\_\_******

---

## 🆘 Need Help?

**Common Questions:**

**Q: Do I need ODPC registration?**  
A: Check [ODPC website](https://www.odpc.go.ke) for registration requirements. Generally required if
processing personal data at scale.

**Q: Do I need a CA license?**  
A: Contact Communications Authority of Kenya to confirm. ISPs typically need licensing.

**Q: Can I launch before lawyer review?**  
A: Technically yes, but highly recommended to get review first. Reduces legal risk significantly.

**Q: What if user reports GDPR issue from EU?**  
A: Current framework addresses GDPR basics. For EU users at scale, may need additional compliance
measures.

**Q: How often should I update legal documents?**  
A: Review quarterly, update when: (1) Business model changes, (2) Kenya laws change, (3) New
features added.

---

_Last Updated: December 2024_  
_Version: 1.0_  
_Platform: PAY N BROWSE_
