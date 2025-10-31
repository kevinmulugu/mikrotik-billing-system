// src/app/routers/add/page.tsx
import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AddRouterWizard } from '@/components/routers/add-router-wizard';
import { ArrowLeft, Info, Shield, Zap, Smartphone, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const metadata: Metadata = {
  title: 'Add Router - MikroTik Billing',
  description: 'Connect a new MikroTik router to start earning money from your WiFi',
};

const planLimits: Record<string, { maxRouters: number; name: string }> = {
  individual: { maxRouters: 1, name: 'Individual Plan' },
  isp: { maxRouters: 5, name: 'ISP Basic Plan' },
  isp_pro: { maxRouters: Infinity, name: 'ISP Pro Plan' },
  // Legacy/backward compatibility
  basic: { maxRouters: 1, name: 'Individual Plan' },
  isp_5_routers: { maxRouters: 5, name: 'ISP Basic Plan' },
};

export default async function AddRouterPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  // Check user's router limit
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

  const user = await db.collection('users').findOne({
    _id: new ObjectId(session.user.id)
  });

  if (!user) {
    redirect('/dashboard');
  }

  const currentPlan = user.subscription?.plan || 'individual';
  
  // Count actual routers owned by this user
  const currentRouters = await db.collection('routers').countDocuments({
    userId: new ObjectId(session.user.id)
  });
  
  // Get plan limit with guaranteed fallback to individual
  const planLimit = planLimits[currentPlan] ? planLimits[currentPlan] : planLimits['individual'];
  
  // Ensure planLimit is defined (TypeScript safety)
  if (!planLimit) {
    throw new Error('Invalid plan configuration');
  }
  
  // Check if user has reached router limit (Infinity check for ISP Pro)
  const hasReachedLimit = planLimit.maxRouters !== Infinity && currentRouters >= planLimit.maxRouters;

  // If limit reached, show upgrade page instead
  if (hasReachedLimit) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/routers"
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Router Limit Reached</h1>
            <p className="text-muted-foreground mt-1">
              Upgrade your plan to add more routers
            </p>
          </div>
        </div>

        <Card className="border border-border bg-card">
          <CardHeader>
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-foreground/80 mt-1" />
              <div>
                <CardTitle className="text-foreground">
                  You've reached your plan limit
                </CardTitle>
                <CardDescription className="text-muted-foreground mt-2">
                  Your <strong>{planLimit.name}</strong> allows up to {planLimit.maxRouters === Infinity ? 'unlimited' : planLimit.maxRouters} router{planLimit.maxRouters === 1 ? '' : 's'}.
                  You currently have <strong>{currentRouters} router{currentRouters === 1 ? '' : 's'}</strong>.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted">
              <h3 className="font-semibold mb-3">Upgrade Options:</h3>
              <div className="space-y-3">
                {currentPlan === 'individual' && (
                  <>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">ISP Basic Plan</p>
                        <p className="text-sm text-muted-foreground">Up to 5 routers</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">KES 2,500/month</p>
                        <p className="text-xs text-muted-foreground">0% commission</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">ISP Pro Plan</p>
                        <p className="text-sm text-muted-foreground">Unlimited routers</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">KES 3,900/month</p>
                        <p className="text-xs text-muted-foreground">0% commission</p>
                      </div>
                    </div>
                  </>
                )}
                {currentPlan === 'isp' && (
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">ISP Pro Plan</p>
                      <p className="text-sm text-muted-foreground">Unlimited routers</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">KES 3,900/month</p>
                      <p className="text-xs text-muted-foreground">Only KES 1,400 more/month</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button asChild size="lg" className="flex-1">
                <Link href="/settings/billing">
                  Upgrade Plan
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/routers">
                  Back to Routers
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Alert className="mt-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Need help choosing a plan?</AlertTitle>
          <AlertDescription>
            <p className="text-sm">
              Contact our support team or check our{' '}
              <Link href="/pricing" className="text-primary hover:underline">
                pricing page
              </Link>
              {' '}for detailed plan comparisons.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/routers"
          className="p-2 hover:bg-accent rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Add New Router</h1>
          <p className="text-muted-foreground mt-1">
            Connect your MikroTik router via secure VPN tunnel
          </p>
        </div>
      </div>

      {/* VPN Setup Info */}
      <Alert className="mb-6 border-primary">
        <Shield className="h-4 w-4 text-primary" />
        <AlertTitle>Secure VPN-Based Setup</AlertTitle>
        <AlertDescription>
          <p className="text-sm mb-3">
            Your router will connect to our management system through a secure VPN tunnel.
            You don't need to be on the same network as your router.
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Router will be managed remotely via encrypted VPN connection</li>
            <li>Your router's WiFi will be automatically named <strong>"PAY N BROWSE"</strong></li>
            <li>You can change settings and monitor usage from anywhere</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* What You'll Need */}
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>What you'll need</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
            <li>
              <strong>Router reset to factory defaults</strong> - This ensures clean setup
            </li>
            <li>
              <strong>Router's IP address</strong> - Usually <code className="bg-background px-1 py-0.5 rounded">192.168.88.1</code> after reset
            </li>
            <li>
              <strong>Admin password</strong> - Blank by default after reset (you'll be prompted to set one)
            </li>
            <li>
              <strong>Router connected to internet</strong> - Via WAN port or cellular
            </li>
          </ul>

          <div className="mt-3 p-3 bg-muted rounded-lg">
            <p className="text-xs font-medium mb-1 flex items-center gap-1">
              <Zap className="h-3 w-3" />
              First-time setup:
            </p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Reset router to factory defaults</li>
              <li>Connect router WAN port to internet source</li>
              <li>Note router's IP address (check via Winbox Neighbor Discovery or use default)</li>
              <li>Complete the wizard below to generate VPN setup script</li>
              <li>Paste script into router terminal to establish secure connection</li>
            </ol>
          </div>
        </AlertDescription>
      </Alert>

      {/* Mobile App Note */}
      <Alert className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">Coming Soon: Mobile App</AlertTitle>
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <p className="text-sm">
            We're developing a mobile app that will make router setup even easier.
            The app will automatically configure your router without needing to paste scripts manually.
          </p>
        </AlertDescription>
      </Alert>

      {/* Factory Reset Instructions */}
      <Alert className="mb-6 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950">
        <Info className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        <AlertTitle className="text-orange-900 dark:text-orange-100">
          How to Factory Reset Your MikroTik Router
        </AlertTitle>
        <AlertDescription className="text-orange-800 dark:text-orange-200">
          <div className="space-y-2 text-sm mt-2">
            <div>
              <p className="font-medium">Method 1: Reset Button (Recommended)</p>
              <ol className="list-decimal list-inside space-y-1 ml-2 mt-1">
                <li>Power off the router</li>
                <li>Hold the reset button</li>
                <li>Power on while still holding reset button</li>
                <li>Keep holding for 5-10 seconds until LED starts flashing</li>
                <li>Release button and wait for router to reboot</li>
              </ol>
            </div>

            <div className="mt-3">
              <p className="font-medium">Method 2: Via Terminal (if you have access)</p>
              <p className="ml-2 mt-1">
                <code className="bg-orange-100 dark:bg-orange-900 px-2 py-1 rounded text-xs">
                  /system reset-configuration no-defaults=yes skip-backup=yes
                </code>
              </p>
            </div>

            <p className="mt-3 text-xs">
              ⚠️ <strong>Important:</strong> Factory reset will erase all current configuration.
              Make sure this is what you want before proceeding.
            </p>
          </div>
        </AlertDescription>
      </Alert>

      {/* Setup Flow Explanation */}
      <div className="mb-6 p-4 border rounded-lg bg-muted/50">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          How VPN Setup Works
        </h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              1
            </div>
            <div>
              <p className="font-medium text-foreground">Generate VPN Script</p>
              <p className="text-xs">We create a unique WireGuard VPN configuration for your router</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              2
            </div>
            <div>
              <p className="font-medium text-foreground">Execute Script on Router</p>
              <p className="text-xs">Copy and paste the script into your router's terminal</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              3
            </div>
            <div>
              <p className="font-medium text-foreground">VPN Tunnel Established</p>
              <p className="text-xs">Router connects to our VPN server and can be managed remotely</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              4
            </div>
            <div>
              <p className="font-medium text-foreground">Automatic Configuration</p>
              <p className="text-xs">System configures packages, hotspot, and branding automatically</p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Router Wizard */}
      <AddRouterWizard />

      {/* Support Note */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        <p>
          Need help? Contact support or check our{' '}
          <Link href="/support/knowledge-base" className="text-primary hover:underline">
            knowledge base
          </Link>
          {' '}for detailed guides.
        </p>
      </div>
    </div>
  );
}