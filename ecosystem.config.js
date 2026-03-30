// PM2 Ecosystem Config — PAY N BROWSE
// Usage:
//   pm2 start ecosystem.config.js          # start all
//   pm2 start ecosystem.config.js --only app   # start app only
//   pm2 save && pm2 startup               # persist across reboots

module.exports = {
  apps: [
    // ─────────────────────────────────────────────
    // 1. Next.js Application
    // ─────────────────────────────────────────────
    {
      name: 'app',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: 'logs/app-error.log',
      out_file: 'logs/app-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ─────────────────────────────────────────────
    // 2. M-Pesa Token Refresh  (every 30 min)
    //    Tokens expire in ~1 hour — refresh early
    // ─────────────────────────────────────────────
    {
      name: 'refresh-mpesa-tokens',
      script: 'node_modules/.bin/tsx',
      args: 'scripts/refresh-mpesa-tokens.ts',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '*/30 * * * *',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/refresh-mpesa-tokens-error.log',
      out_file: 'logs/refresh-mpesa-tokens-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ─────────────────────────────────────────────
    // 3. Sync Vouchers with Routers  (every hour)
    //    Detects router-side session changes and
    //    updates voucher states in the database
    // ─────────────────────────────────────────────
    {
      name: 'sync-vouchers',
      script: 'node_modules/.bin/tsx',
      args: 'scripts/sync-vouchers-with-router.ts',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '0 * * * *',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/sync-vouchers-error.log',
      out_file: 'logs/sync-vouchers-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ─────────────────────────────────────────────
    // 4. Expire Vouchers  (every 6 hours)
    //    Marks time-expired vouchers and removes
    //    them from MikroTik hotspot users
    // ─────────────────────────────────────────────
    {
      name: 'expire-vouchers',
      script: 'node_modules/.bin/tsx',
      args: 'scripts/expire-vouchers.ts',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '0 */6 * * *',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/expire-vouchers-error.log',
      out_file: 'logs/expire-vouchers-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ─────────────────────────────────────────────
    // 5. Aggregate Commissions  (daily at 3 AM)
    //    Rolls up completed voucher sales into
    //    monthly commission records per user
    // ─────────────────────────────────────────────
    {
      name: 'aggregate-commissions',
      script: 'node_modules/.bin/tsx',
      args: 'scripts/aggregate-commissions.ts',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '0 3 * * *',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/aggregate-commissions-error.log',
      out_file: 'logs/aggregate-commissions-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
