# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PAY N BROWSE** — a Next.js SaaS platform for WiFi hotspot and PPPoE billing, targeting ISPs, homeowners, and businesses in the Kenyan market. Key features: MikroTik/UniFi router management, M-Pesa payment processing, captive portal voucher system, PPPoE user management, and commission tracking.

## Commands

```bash
# Development
pnpm dev          # Start dev server (Turbopack)
pnpm build        # Production build
pnpm lint         # Run ESLint

# Database
pnpm db:init      # Initialize collections, indexes, default data
pnpm db:seed      # Seed test data
pnpm db:reset     # Full database reset
pnpm db:setup     # init + seed + SMS plans

# Utilities
pnpm sync:vouchers       # Sync vouchers with router
pnpm expire:vouchers     # Expire old vouchers
pnpm aggregate:commissions  # Recalculate commission totals
pnpm verify:security     # Verify hotspot security config
```

No test runner is configured — testing is done via manual scripts in `scripts/` and the `test:router*` npm commands.

## Architecture

### Layer Structure

```
UI (src/app + components/)
    ↓
Application (hooks/ + lib/providers.tsx)
    ↓
API Routes (src/app/api/)
    ↓
Services (lib/services/)
    ↓
MongoDB (lib/database.ts / lib/mongodb.ts)
```

### Key Services (`lib/services/`)

| Service | Purpose |
|---|---|
| `mikrotik.ts` (~89KB) | Full MikroTik RouterOS API: hotspot profiles, IP pools, NAT, firewall, WiFi security, SSH management |
| `unifi.ts` | UniFi Controller API: WiFi profiles, VLAN, hotspot user provisioning |
| `router-provisioning.ts` (~48KB) | Automated router setup wizard — generates config, syncs packages, injects captive portal HTML |
| `router-sync.ts` | Syncs router state to database; health monitoring, connected user tracking |
| `mpesa.ts` | M-Pesa Daraja API: OAuth tokens, STK Push, payment callbacks, paybill credential management |
| `messaging.ts` | SMS + email abstraction over AfricasTalking/Twilio + NodeMailer |
| `notification.ts` | In-app notifications with 90-day TTL auto-cleanup |
| `captive-portal-config.ts` | Generates branded captive portal HTML with M-Pesa payment forms |
| `vpn-provisioner.ts` | PPPoE user creation, IP pool allocation, bandwidth profiles |

### Data Flow: Voucher Purchase (Captive Portal)

1. Customer connects to WiFi → captive portal loads
2. `GET /api/captive/packages` → available packages
3. `POST /api/captive/purchase` → generates voucher code + initiates M-Pesa STK Push
4. Customer approves M-Pesa payment
5. M-Pesa webhook → `POST /api/captive/payment-status` → marks voucher as sold
6. Customer enters voucher code in hotspot login → MikroTik validates

### Data Flow: Router Setup

1. User submits router credentials at `/routers/add`
2. `POST /api/routers/add` — validates connection, fetches model/serial/firmware
3. `POST /api/routers/[id]/provision` — applies: WiFi profiles, hotspot config, IP pools, NAT rules, captive portal redirect
4. `POST /api/routers/[id]/sync` — pulls current state back into database

### Authentication (`lib/auth.ts`)

NextAuth.js with MongoDB adapter. Providers configured conditionally via env vars:
- Email magic links (requires SMTP config)
- Google OAuth (requires `GOOGLE_CLIENT_ID`/`SECRET`)

Session callbacks enrich the session with business profile, subscription plan, unread notification count, and role.

### State Management

- **React Query** — server state (routers, vouchers, payments). 5-minute stale time, 3 retries (skipped for 401/403).
- **Zustand** — client state (router status, real-time updates)
- **React Hook Form + Zod** — form validation
- **NextAuth session** — authentication state

### MongoDB Collections

Primary collections: `users`, `routers`, `packages`, `vouchers`, `payments`, `paybills`, `tickets`, `notifications`, `vpn_users`, `sms_credits`

Two connection patterns coexist:
- `lib/database.ts` — Mongoose-based (used by models in `models/`)
- `lib/mongodb.ts` — Native MongoDB driver client singleton (used by most API routes directly)

Most API routes use the native driver pattern, not Mongoose. Only `Notification` and `Ticket` have Mongoose models.

### Router Type Handling

The codebase supports two router types: `mikrotik` and `unifi`. When adding logic that touches router APIs, check `router.type` and branch accordingly. UniFi routers don't have a VPN IP — guard against this in sync/provisioning code.

### API Route Conventions

- Protected routes validate session via `getServerSession(authOptions)`
- User scoping: most queries filter by `userId` from session
- Captive portal routes (`/api/captive/*`) are public (no auth required)
- Zod schemas validate request bodies before processing

### Page File Conventions

Every new page must include a `loading.tsx` sibling that mirrors the page layout using shadcn `<Skeleton>` components. Add `layout.tsx` or `error.tsx` only when the design specifically requires a persistent shell or error boundary for that route segment.

### Path Aliases

`@/*` maps to `src/*` (configured in `tsconfig.json`). Use `@/lib/...`, `@/components/...`, etc.

## Environment Variables

Critical vars: `MONGODB_URI`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`. M-Pesa requires `MPESA_*` vars. See existing `.env.example` or docs in `MPESA_PURCHASE_IMPLEMENTATION.md` and `AUTHENTICATION.md` for full list.
