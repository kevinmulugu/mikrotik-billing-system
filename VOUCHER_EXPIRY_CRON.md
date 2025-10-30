# Voucher Expiry Cron Job

This document explains how to schedule the voucher expiry script to run automatically.

## What it does

The `scripts/expire-vouchers.ts` script:
- Expires vouchers past their **activation expiry** date (when `expiry.expiresAt` is set)
- Expires vouchers past their **purchase expiry** window (when `usage.purchaseExpiresAt` is set)
- Expires active vouchers past their **usage deadline** (when `usage.expectedEndTime` is reached)
- Removes expired hotspot users from MikroTik routers when possible
- Logs audit entries for all expired vouchers

## Manual run

Run the script manually with:

```bash
pnpm expire:vouchers
```

Or directly:

```bash
tsx scripts/expire-vouchers.ts
```

## Automated scheduling

### Option 1: Linux/macOS cron

Edit your crontab:

```bash
crontab -e
```

Add one of these lines:

```cron
# Run every hour
0 * * * * cd /path/to/mikrotik-billing-system && pnpm expire:vouchers >> /var/log/voucher-expiry.log 2>&1

# Run every 15 minutes
*/15 * * * * cd /path/to/mikrotik-billing-system && pnpm expire:vouchers >> /var/log/voucher-expiry.log 2>&1

# Run daily at 2 AM
0 2 * * * cd /path/to/mikrotik-billing-system && pnpm expire:vouchers >> /var/log/voucher-expiry.log 2>&1
```

**Important:** Ensure your cron environment has:
- Node.js and pnpm in PATH
- Environment variables loaded (`.env` file or sourced in crontab)
- Correct working directory

### Option 2: systemd timer (Linux)

Create `/etc/systemd/system/expire-vouchers.service`:

```ini
[Unit]
Description=Expire MikroTik Vouchers
After=network.target

[Service]
Type=oneshot
User=your-username
WorkingDirectory=/path/to/mikrotik-billing-system
Environment="NODE_ENV=production"
EnvironmentFile=/path/to/mikrotik-billing-system/.env
ExecStart=/usr/bin/pnpm expire:vouchers
StandardOutput=journal
StandardError=journal
```

Create `/etc/systemd/system/expire-vouchers.timer`:

```ini
[Unit]
Description=Run voucher expiry every hour
Requires=expire-vouchers.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=1h
Unit=expire-vouchers.service

[Install]
WantedBy=timers.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable expire-vouchers.timer
sudo systemctl start expire-vouchers.timer
sudo systemctl status expire-vouchers.timer
```

View logs:

```bash
sudo journalctl -u expire-vouchers.service -f
```

### Option 3: PM2 cron (if using PM2)

Add to your `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    // ... your existing apps
    {
      name: 'expire-vouchers-cron',
      script: 'scripts/expire-vouchers.ts',
      interpreter: 'tsx',
      cron_restart: '0 * * * *', // Every hour
      autorestart: false,
      watch: false,
    },
  ],
};
```

### Option 4: GitHub Actions (for cloud/CI)

Create `.github/workflows/expire-vouchers.yml`:

```yaml
name: Expire Vouchers

on:
  schedule:
    - cron: '0 * * * *' # Every hour
  workflow_dispatch: # Manual trigger

jobs:
  expire:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm expire:vouchers
        env:
          MONGODB_URI: ${{ secrets.MONGODB_URI }}
          MONGODB_DB_NAME: ${{ secrets.MONGODB_DB_NAME }}
```

## Monitoring

Check logs to ensure the script runs successfully:

```bash
# For cron
tail -f /var/log/voucher-expiry.log

# For systemd
sudo journalctl -u expire-vouchers.service -f

# For PM2
pm2 logs expire-vouchers-cron
```

## Recommended schedule

- **High-traffic ISPs:** Every 15 minutes
- **Medium usage:** Every hour
- **Low usage:** Every 6 hours or daily

## Troubleshooting

If vouchers aren't expiring:

1. Check the script runs without errors:
   ```bash
   pnpm expire:vouchers
   ```

2. Verify MongoDB connection in `.env`:
   ```
   MONGODB_URI=mongodb://...
   MONGODB_DB_NAME=mikrotik_billing
   ```

3. Check voucher data has the correct fields:
   - `expiry.expiresAt` (for activation expiry)
   - `usage.purchaseExpiresAt` (for purchase expiry)
   - `usage.expectedEndTime` (for usage deadline)

4. Verify router connectivity (for removing hotspot users)

5. Check audit logs in database for expiry events:
   ```javascript
   db.audit_logs.find({ 'action.type': 'expire' }).sort({ timestamp: -1 }).limit(10)
   ```
