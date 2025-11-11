# MikroTik & UniFi Billing Portal 🚀

A comprehensive multi-router billing and hotspot management system for ISPs and WiFi service
providers. Supports both **MikroTik** and **UniFi** routers with automated voucher generation,
M-Pesa payments, and real-time monitoring.

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## 🌟 Features

### Multi-Router Support

- ✅ **MikroTik RouterOS** - Full hotspot and PPPoE support
- ✅ **UniFi Controller** - Hotspot voucher management
- ✅ **Extensible Architecture** - Easy to add new router types

### Service Management

- 🔥 **Hotspot Service** - WiFi captive portal with voucher system
- 🌐 **PPPoE Service** - Internet service via PPPoE credentials (MikroTik only)
- 📊 **Package Management** - Sync packages from routers automatically
- 🎫 **Voucher Generation** - Bulk voucher creation for both services

### Payment Integration

- 💰 **M-Pesa STK Push** - Instant mobile payments
- 💳 **KopoKopo** - Payment gateway integration
- 🔔 **Real-time Webhooks** - Automatic voucher assignment after payment
- 💵 **Multi-currency Support** - KES primary, extensible to others

### Admin Dashboard

- 📈 **Real-time Analytics** - Revenue, users, and usage statistics
- 🎛️ **Router Management** - Add, configure, and monitor routers
- 👥 **User Management** - Customer accounts and subscriptions
- 🎫 **Voucher Management** - Generate, track, and manage vouchers
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile

### Security & Authentication

- 🔐 **NextAuth.js** - Secure authentication with credentials and OAuth
- 🛡️ **Role-based Access** - Admin, ISP, and Customer roles
- 🔒 **API Security** - Protected endpoints with JWT tokens
- 🚨 **Audit Logging** - Track all critical operations

---

## 🏗️ Architecture

### Multi-Router Provider Pattern

```typescript
// Router Provider Interface
interface RouterProvider {
  testConnection(): Promise<boolean>;
  syncPackagesFromRouter(serviceType: ServiceType): Promise<Package[]>;
  generateVouchersForService(serviceType: ServiceType, params): Promise<Voucher[]>;
  deactivateVoucher(serviceType: ServiceType, voucherData): Promise<boolean>;
  getVoucherStatus(serviceType: ServiceType, voucherData): Promise<VoucherStatus>;
}

// Factory Pattern
const provider = RouterProviderFactory.create(routerType, config);
const packages = await provider.syncPackagesFromRouter('hotspot');
```

### Supported Router Types

| Router Type | Hotspot | PPPoE | VPN | Status     |
| ----------- | ------- | ----- | --- | ---------- |
| MikroTik    | ✅      | ✅    | ✅  | Production |
| UniFi       | ✅      | ⏳    | ⏳  | Production |
| pfSense     | ⏳      | ⏳    | ⏳  | Planned    |
| OpenWRT     | ⏳      | ⏳    | ⏳  | Planned    |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- MongoDB 7.0+
- MikroTik router with API enabled OR UniFi Controller
- M-Pesa Business Till (optional for payments)

### Installation

```bash
# Clone repository
git clone https://github.com/kevinmulugu/mikrotik-billing-system.git
cd mikrotik-billing-system

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Configure .env.local with your settings
# - DATABASE_URL (MongoDB connection string)
# - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)
# - MPESA_* credentials (optional)

# Initialize database
pnpm db:init

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### First-Time Setup

1. **Create Admin Account**
   - Visit `/auth/signup`
   - First user becomes admin automatically

2. **Add Your First Router**
   - Navigate to `/routers/add`
   - Select router type (MikroTik or UniFi)
   - Enter connection details
   - Enable desired services (Hotspot, PPPoE)

3. **Sync Packages**
   - Go to router details page
   - Click "Sync Packages"
   - Packages will be imported from your router

4. **Generate Vouchers**
   - Select a package
   - Choose service type (Hotspot or PPPoE)
   - Specify quantity
   - Vouchers are created instantly

---

## 📖 Documentation

### Core Documentation

- [**PHASE_6_TESTING.md**](./PHASE_6_TESTING.md) - Testing and migration guide
- [**AUTHENTICATION.md**](./AUTHENTICATION.md) - Auth setup and security
- [**VOUCHER_PURCHASE_FLOW.md**](./VOUCHER_PURCHASE_FLOW.md) - Purchase workflow
- [**MPESA_PURCHASE_IMPLEMENTATION.md**](./MPESA_PURCHASE_IMPLEMENTATION.md) - M-Pesa integration

### API Documentation

#### Router Management

```bash
# Add Router (MikroTik)
POST /api/routers/add
{
  "name": "Main Office Router",
  "routerType": "mikrotik",
  "model": "MikroTik hAP ac²",
  "ipAddress": "192.168.88.1",
  "port": 8728,
  "apiUser": "admin",
  "apiPassword": "password",
  "hotspotEnabled": true,
  "pppoeEnabled": true
}

# Add Router (UniFi)
POST /api/routers/add
{
  "name": "UniFi Dream Machine",
  "routerType": "unifi",
  "controllerUrl": "https://unifi.local:8443",
  "apiUser": "admin",
  "apiPassword": "password",
  "siteId": "default",
  "hotspotEnabled": true
}

# Sync Packages
POST /api/routers/{id}/packages/sync?service=hotspot

# Generate Vouchers
POST /api/routers/{id}/vouchers/generate?service=hotspot
{
  "packageId": "1hour-10ksh",
  "quantity": 10
}
```

---

## 🗄️ Database Schema

### Router Document

```typescript
{
  _id: ObjectId,
  customerId: string,
  routerType: 'mikrotik' | 'unifi',
  routerInfo: {
    name: string,
    model: string,
    location: { name, city, county }
  },
  services: {
    hotspot?: {
      enabled: boolean,
      packages: Package[],
      lastSynced: Date
    },
    pppoe?: {
      enabled: boolean,
      interface: string,
      packages: Package[],
      lastSynced: Date
    }
  },
  capabilities: {
    supportsVPN: boolean,
    supportedServices: ['hotspot', 'pppoe'],
    captivePortalMethod: 'http_upload' | 'ssh_deploy',
    voucherFormat: 'username_password' | 'numeric_code'
  },
  vendorConfig: {
    mikrotik?: { firmwareVersion, identity, architecture },
    unifi?: { controllerVersion, selectedSite, sites }
  }
}
```

### Voucher Document

```typescript
{
  _id: ObjectId,
  routerId: string,
  routerType: 'mikrotik' | 'unifi',
  serviceType: 'hotspot' | 'pppoe',
  voucherInfo: {
    packageType: string,
    packageDisplayName: string,
    duration: number,
    price: number
  },
  vendorSpecific: {
    mikrotik?: {
      username: string,
      password: string,
      profile: string,
      service: 'hotspot' | 'pppoe'
    },
    unifi?: {
      code: string,
      createTime: number,
      quota: number
    }
  },
  status: 'active' | 'assigned' | 'used' | 'expired',
  payment?: { transactionId, phoneNumber, paymentDate },
  usage?: { deviceMac, loginTime, logoutTime, bytesIn, bytesOut }
}
```

---

## 🛠️ Technology Stack

### Frontend

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety and better DX
- **Tailwind CSS** - Utility-first styling
- **Shadcn/UI** - Beautiful component library
- **React Hook Form** - Form validation
- **Zustand** - State management

### Backend

- **Next.js API Routes** - Serverless API endpoints
- **MongoDB** - NoSQL database
- **NextAuth.js** - Authentication
- **Zod** - Schema validation

### Router Integration

- **RouterOS API** - MikroTik communication
- **UniFi Controller API** - UniFi communication
- **SSH2** - Backup communication method

### Payment Processing

- **M-Pesa Daraja API** - STK Push and C2B
- **KopoKopo API** - Payment gateway
- **Africa's Talking** - SMS notifications

---

## 🔧 Configuration

### Environment Variables

```env
# Database
DATABASE_URL=mongodb://localhost:27017/mikrotik-billing
MONGODB_URI=mongodb://localhost:27017/mikrotik-billing

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# M-Pesa (Production)
MPESA_CONSUMER_KEY=your-consumer-key
MPESA_CONSUMER_SECRET=your-consumer-secret
MPESA_PASSKEY=your-passkey
MPESA_SHORTCODE=your-shortcode
MPESA_ENVIRONMENT=production

# SMS (Africa's Talking)
AT_API_KEY=your-api-key
AT_USERNAME=your-username

# Optional: UniFi SSL
NODE_TLS_REJECT_UNAUTHORIZED=0
```

### MikroTik Router Setup

1. **Enable API**

   ```
   /ip service enable api
   /ip service set api port=8728
   ```

2. **Create API User**

   ```
   /user add name=api password=secure-password group=full
   ```

3. **Configure Hotspot** (if using hotspot)

   ```
   /ip hotspot setup
   # Follow wizard
   ```

4. **Configure PPPoE Server** (if using PPPoE)
   ```
   /interface pppoe-server server add interface=ether1 service-name=isp
   /ppp profile add name=default local-address=10.0.0.1 remote-address=pool1
   ```

### UniFi Controller Setup

1. **Enable API Access**
   - Settings → System → Advanced
   - Enable "Advanced Features"

2. **Create Admin User**
   - Settings → Admins
   - Create new admin with full permissions

3. **Note Controller URL**
   - Usually `https://unifi.local:8443` or Cloud URL

---

## 📊 Migration from Single-Router

If you're upgrading from the old MikroTik-only version:

```bash
# 1. Backup database
mongodump --uri="$MONGODB_URI" --out=./backup

# 2. Run router migration
npx tsx scripts/migrate-routers-to-multi-vendor.ts

# 3. Run voucher migration
npx tsx scripts/migrate-vouchers-to-multi-vendor.ts

# 4. Verify migrations
# Check PHASE_6_TESTING.md for verification steps
```

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run type checking
pnpm type-check

# Run linting
pnpm lint

# Test multi-router functionality
npx tsx scripts/test-multi-router.ts
```

---

## 🚀 Deployment

### Production Deployment

```bash
# Build for production
pnpm build

# Start production server
pnpm start

# Or use PM2
pm2 start npm --name "billing-portal" -- start
```

### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Docker Deployment

```bash
# Build image
docker build -t billing-portal .

# Run container
docker run -p 3000:3000 --env-file .env.local billing-portal
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Adding New Router Types

To add support for a new router type (e.g., pfSense):

1. **Create Service Class** (`lib/services/pfsense.ts`)
   - Implement router-specific API calls

2. **Create Provider** (`lib/providers/pfsense-provider.ts`)
   - Implement `RouterProvider` interface
   - Handle service-specific logic

3. **Update Factory** (`lib/providers/router-provider-factory.ts`)
   - Add new case for router type

4. **Update Types** (`types/router.ts`)
   - Add router type to union
   - Add vendor-specific config interface

5. **Update UI** (`components/routers/add-router-wizard.tsx`)
   - Add router type option
   - Add model list

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Shadcn/UI](https://ui.shadcn.com/) - Component library
- [MikroTik](https://mikrotik.com/) - RouterOS
- [Ubiquiti](https://www.ui.com/) - UniFi products
- [Safaricom](https://www.safaricom.co.ke/) - M-Pesa API

---

## 📧 Support

For support, email support@paynbrowse.com or open an issue on GitHub.

---

## 🗺️ Roadmap

- [x] Multi-router architecture (MikroTik + UniFi)
- [x] PPPoE service support
- [x] M-Pesa payment integration
- [ ] pfSense router support
- [ ] OpenWRT router support
- [ ] API rate limiting
- [ ] Multi-tenant support
- [ ] White-label customization
- [ ] Mobile app (React Native)

---

Made with ❤️ in Kenya 🇰🇪
