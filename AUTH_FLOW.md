# Authentication Flow Documentation

## Overview

PAY N BROWSE uses **NextAuth.js** with **MongoDB Adapter** for authentication. Users can sign in via:
- 🔐 **Email Magic Links** (passwordless)
- 🌐 **Google OAuth**

## How User Creation Works

### 🔄 Automatic User Creation (No Pre-Registration)

**Anyone can sign in - users are created on-the-fly!**

When someone tries to sign in for the first time:

1. **Email Magic Link Flow:**
   ```
   User enters email → Magic link sent → User clicks link → 
   NextAuth creates user in DB → Session created
   ```

2. **Google OAuth Flow:**
   ```
   User clicks "Continue with Google" → Google auth → 
   NextAuth creates user in DB → Session created
   ```

### 📊 Database Structure After Sign-In

#### New User Creation Process:

**Step 1: NextAuth MongoDB Adapter creates base user**
```javascript
{
  _id: ObjectId("..."),
  name: "John Doe",
  email: "john@example.com",
  emailVerified: ISODate("2025-10-28T..."),
  image: "https://...", // For Google OAuth
  // No role or customerId yet!
}
```

**Step 2: Our custom `signIn` callback validates**
- Checks if user exists
- Logs warnings if customer record is missing

**Step 3: Our custom `session` callback completes setup**
- Sets default role: `homeowner`
- Creates customer record with:
  - Personal Plan (20% commission)
  - 1-year subscription
  - Default business info
- Updates user with `customerId`

#### Final User Record:
```javascript
{
  _id: ObjectId("690092b8d09c47b3266b29b5"),
  name: "John Doe",
  email: "john@example.com",
  emailVerified: ISODate("2025-10-28T11:24:32.729Z"),
  role: "homeowner", // ✅ Set by our callback
  customerId: ObjectId("690092b8d09c47b3266b29b6"), // ✅ Created by our callback
  status: "active",
  preferences: {
    language: "en",
    notifications: { email: true, sms: true, push: true },
    theme: "system"
  },
  metadata: {
    loginCount: 0,
    lastLogin: ISODate("2025-10-28T...")
  },
  createdAt: ISODate("2025-10-28T09:54:00.747Z"),
  updatedAt: ISODate("2025-10-28T09:54:00.747Z")
}
```

#### Linked Customer Record:
```javascript
{
  _id: ObjectId("690092b8d09c47b3266b29b6"),
  userId: ObjectId("690092b8d09c47b3266b29b5"),
  businessInfo: {
    name: "John Doe's WiFi",
    type: "homeowner",
    contact: { phone: "", email: "john@example.com" }
  },
  paymentSettings: {
    preferredMethod: "company_paybill",
    commissionRate: 20, // 20% for Personal Plan
    autoPayouts: true
  },
  subscription: {
    plan: "personal",
    status: "active",
    startDate: ISODate("2025-10-28T..."),
    endDate: ISODate("2026-10-28T..."), // 1 year
    features: ["single_router", "basic_analytics", "email_support"]
  },
  statistics: {
    totalRouters: 0,
    activeUsers: 0,
    totalRevenue: 0,
    monthlyRevenue: 0
  },
  status: "active"
}
```

## 🎭 User Roles

### Default Role: `homeowner`
All new users get this role automatically. It represents the **Personal Plan**.

### Available Roles:
- `system_admin` - Full system access (manually assigned)
- `homeowner` - Personal WiFi sharers (20% commission)
- `isp` - Internet Service Providers (KSh 2,500 or 3,900/month)
- `end_user` - WiFi consumers (no dashboard access)

## 🔐 Security & Validation

### Current Setup:
✅ **No passwords** - Magic links are more secure
✅ **Email verification** - Required for magic link
✅ **Automatic role assignment** - Everyone starts as homeowner
✅ **Customer record creation** - Automatic on first login
✅ **Session management** - NextAuth handles tokens securely

### What's NOT Validated:
❌ **No email whitelist** - Anyone can sign up
❌ **No domain restrictions** - Any email domain accepted
❌ **No manual approval** - Instant access after email verification
❌ **No invitation system** - Open registration

## 🛠️ How to Restrict Access

If you want to restrict who can sign up, you have options:

### Option 1: Email Domain Whitelist
Add to `signIn` callback:
```typescript
async signIn({ user }) {
  const allowedDomains = ['yourcompany.com', 'partner.com'];
  const emailDomain = user.email?.split('@')[1];
  
  if (!allowedDomains.includes(emailDomain)) {
    return false; // Reject sign-in
  }
  return true;
}
```

### Option 2: Invitation System
1. Create `invitations` collection
2. Admin sends invite with token
3. Check token in `signIn` callback:
```typescript
async signIn({ user }) {
  const invitationsCollection = db.collection('invitations');
  const invite = await invitationsCollection.findOne({
    email: user.email,
    status: 'pending'
  });
  
  if (!invite) {
    return false; // No invitation found
  }
  
  // Mark invitation as used
  await invitationsCollection.updateOne(
    { _id: invite._id },
    { $set: { status: 'used', usedAt: new Date() } }
  );
  
  return true;
}
```

### Option 3: Manual Approval
1. New users get `status: 'pending'`
2. Admin reviews and approves
3. Check status in middleware:
```typescript
// middleware.ts
if (token.status === 'pending') {
  return NextResponse.redirect(new URL('/pending-approval', request.url));
}
```

## 📧 Email Templates

Custom email templates are in `/lib/auth.ts`:
- **Minimalist Apple-style design**
- White background, black text
- Centered button with fallback link
- Professional and clean

## 🔍 Debugging

### Check if user has proper setup:
```javascript
// In MongoDB shell
db.users.find({ email: "user@example.com" })

// Should have:
// - role: "homeowner" 
// - customerId: ObjectId("...")

// Check customer record:
db.customers.find({ userId: ObjectId("user's _id") })
```

### Test authentication:
```bash
# Check auth configuration
curl http://localhost:3000/api/auth/providers

# Check what providers are available
curl http://localhost:3000/api/auth/config-check
```

## 🚀 Production Considerations

Before going live:

1. **Set up proper SMTP** (not localhost MailDev)
2. **Add NEXTAUTH_SECRET** environment variable
3. **Configure Google OAuth** for production domain
4. **Decide on access control** (open vs restricted)
5. **Set up monitoring** for failed sign-ins
6. **Test email delivery** in production
7. **Consider rate limiting** for magic link requests

## 📝 Current Database Schema

Your existing users follow this pattern - our callbacks maintain compatibility!

```javascript
// Your admin user (manually created)
{
  _id: ObjectId('690092b8d09c47b3266b29b4'),
  email: 'admin@mikrotikbilling.com',
  role: 'system_admin', // Manually set
  permissions: ['*'], // Full access
  // No customerId - admins don't need one
}

// Your homeowner users (can be auto-created now)
{
  _id: ObjectId('690092b8d09c47b3266b29b5'),
  email: 'homeowner@demo.com',
  role: 'homeowner',
  customerId: ObjectId('690092b8d09c47b3266b29b6'), // Links to customers
}
```

## ✨ Summary

**The system now:**
- ✅ Creates users automatically on first sign-in
- ✅ Assigns `homeowner` role by default
- ✅ Creates customer record with Personal Plan (20% commission)
- ✅ Sets up 1-year subscription automatically
- ✅ Maintains compatibility with your existing database structure
- ✅ Allows seamless onboarding for new WiFi sharers

**Users get instant access after:**
1. Entering email
2. Clicking magic link (or Google auth)
3. Redirected to dashboard
4. Can immediately add routers and start earning!
