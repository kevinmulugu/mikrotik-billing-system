# Authentication Setup

The application now supports **Google OAuth** and **Email Magic Links** for authentication. However, both require proper configuration to work.

## 🔧 Quick Setup

### Option 1: Google OAuth (Recommended)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add your environment variables:

```bash
# .env.local
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Option 2: Email Magic Links
1. Configure SMTP settings in your environment:

```bash
# .env.local
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

## 🎯 Current Status

- ✅ **Simplified Authentication**: Only essential providers
- ✅ **Smart Detection**: Only shows configured auth methods
- ✅ **Error Prevention**: Won't attempt SMTP if not configured
- ✅ **Graceful Fallback**: Shows helpful message if nothing is configured

## 🚀 Development Mode

If no authentication is configured, the login pages will show:
> "Authentication is not configured. Please check your environment variables."

This prevents the SMTP connection errors you were experiencing.

## 📱 User Flow

1. **With Google configured**: Shows Google sign-in button
2. **With Email configured**: Shows email input + Google (if both)
3. **Nothing configured**: Shows helpful setup message

Simple and clean! 🎉