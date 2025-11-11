// src/app/routers/add/page.tsx
"use client";

import { useSession } from 'next-auth/react';
import { redirect, useRouter } from 'next/navigation';
import { AddRouterWizard } from '@/components/routers/add-router-wizard';
import { ArrowLeft, Info, Shield, Zap, Smartphone, AlertTriangle, Network, Wifi } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const planLimits: Record<string, { maxRouters: number; name: string }> = {
  individual: { maxRouters: 1, name: 'Individual Plan' },
  isp: { maxRouters: 5, name: 'ISP Basic Plan' },
  isp_pro: { maxRouters: Infinity, name: 'ISP Pro Plan' },
  // Legacy/backward compatibility
  basic: { maxRouters: 1, name: 'Individual Plan' },
  isp_5_routers: { maxRouters: 5, name: 'ISP Basic Plan' },
};

export default function AddRouterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [routerType, setRouterType] = useState<'mikrotik' | 'unifi'>('mikrotik');
  const [hasReachedLimit, setHasReachedLimit] = useState(false);
  const [currentRouters, setCurrentRouters] = useState(0);
  const [currentPlan, setCurrentPlan] = useState('individual');
  const [planLimit, setPlanLimit] = useState(planLimits['individual']);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin');
    }
  }, [status, router]);

  useEffect(() => {
    const checkRouterLimit = async () => {
      if (!session?.user?.id) return;

      try {
        const response = await fetch('/api/customer/profile');
        const data = await response.json();
        
        const plan = data.customer?.subscription?.plan || 'individual';
        const limit = planLimits[plan] || planLimits['individual'];
        
        const routersResponse = await fetch('/api/routers');
        const routersData = await routersResponse.json();
        const count = routersData.routers?.length || 0;
        
        setCurrentPlan(plan);
        setCurrentRouters(count);
        setPlanLimit(limit!);
        setHasReachedLimit(limit!.maxRouters !== Infinity && count >= limit!.maxRouters);
      } catch (error) {
        console.error('Error checking router limit:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      checkRouterLimit();
    }
  }, [session]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

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
                  Your <strong>{planLimit?.name}</strong> allows up to {planLimit?.maxRouters === Infinity ? 'unlimited' : planLimit?.maxRouters} router{planLimit?.maxRouters === 1 ? '' : 's'}.
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
            Connect your router to start managing vouchers and packages
          </p>
        </div>
      </div>

      {/* Router Type Tabs for Instructions */}
      <Tabs value={routerType} onValueChange={(v) => setRouterType(v as 'mikrotik' | 'unifi')} className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="mikrotik" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            MikroTik Setup
          </TabsTrigger>
          <TabsTrigger value="unifi" className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            UniFi Setup
          </TabsTrigger>
        </TabsList>

        {/* MikroTik Instructions */}
        <TabsContent value="mikrotik" className="space-y-6 mt-6">
          {/* VPN Setup Info */}
          <Alert className="border-primary">
            <Shield className="h-4 w-4 text-primary" />
            <AlertTitle>Secure VPN-Based Setup</AlertTitle>
            <AlertDescription>
              <p className="text-sm mb-3">
                Your MikroTik router will connect to our management system through a secure VPN tunnel.
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
          <Alert>
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

          {/* Factory Reset Instructions */}
          <Alert className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950">
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
          <div className="p-4 border rounded-lg bg-muted/50">
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
        </TabsContent>

        {/* UniFi Instructions */}
        <TabsContent value="unifi" className="space-y-6 mt-6">
          {/* UniFi Controller Info */}
          <Alert className="border-primary">
            <Wifi className="h-4 w-4 text-primary" />
            <AlertTitle>UniFi Controller Connection</AlertTitle>
            <AlertDescription>
              <p className="text-sm mb-3">
                Connect to your UniFi Controller to enable voucher management. 
                Your existing WiFi settings and networks will remain unchanged.
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Connects directly to your UniFi Controller (no VPN needed)</li>
                <li>Manages vouchers through UniFi's built-in guest portal</li>
                <li>WiFi settings (SSID, password) configured in UniFi Controller</li>
                <li>Works with Dream Machines, Cloud Keys, and self-hosted controllers</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* What You'll Need */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>What you'll need</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                <li>
                  <strong>UniFi Controller URL</strong> - e.g., <code className="bg-background px-1 py-0.5 rounded">https://192.168.1.1</code> or <code className="bg-background px-1 py-0.5 rounded">https://unifi.ui.com</code>
                </li>
                <li>
                  <strong>Controller admin credentials</strong> - Username and password with full access
                </li>
                <li>
                  <strong>Controller accessible</strong> - Make sure controller is reachable from this device
                </li>
                <li>
                  <strong>Guest network configured</strong> - Set up in UniFi Controller for hotspot
                </li>
              </ul>

              <div className="mt-3 p-3 bg-muted rounded-lg">
                <p className="text-xs font-medium mb-1 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Setup steps:
                </p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Ensure your UniFi Controller is running and accessible</li>
                  <li>Have your controller admin credentials ready</li>
                  <li>Complete the wizard below to connect to controller</li>
                  <li>Select the site you want to manage vouchers for</li>
                  <li>System will sync with your UniFi setup automatically</li>
                </ol>
              </div>
            </AlertDescription>
          </Alert>

          {/* Controller Types */}
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-900 dark:text-blue-100">
              Supported UniFi Controllers
            </AlertTitle>
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <div className="text-sm space-y-2 mt-2">
                <div>
                  <p className="font-medium">✓ UniFi Dream Machine / Pro / SE</p>
                  <p className="text-xs ml-4">Built-in controller at <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">https://[device-ip]</code></p>
                </div>
                <div>
                  <p className="font-medium">✓ Cloud Key Gen2 / Plus</p>
                  <p className="text-xs ml-4">Dedicated controller at <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">https://[cloudkey-ip]</code></p>
                </div>
                <div>
                  <p className="font-medium">✓ Self-Hosted Controller</p>
                  <p className="text-xs ml-4">Running on your own server</p>
                </div>
                <div>
                  <p className="font-medium">✓ UniFi Cloud (Coming Soon)</p>
                  <p className="text-xs ml-4">Hosted at <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">https://unifi.ui.com</code></p>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Setup Flow */}
          <div className="p-4 border rounded-lg bg-muted/50">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              How UniFi Integration Works
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <div>
                  <p className="font-medium text-foreground">Connect to Controller</p>
                  <p className="text-xs">Enter your UniFi Controller URL and credentials</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <div>
                  <p className="font-medium text-foreground">Select Site</p>
                  <p className="text-xs">Choose which UniFi site to manage vouchers for</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <div>
                  <p className="font-medium text-foreground">Enable Voucher Management</p>
                  <p className="text-xs">System enables voucher generation for your guest network</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  4
                </div>
                <div>
                  <p className="font-medium text-foreground">Ready to Use</p>
                  <p className="text-xs">Start generating and selling voucher codes immediately</p>
                </div>
              </div>
            </div>
          </div>

          {/* Important Note */}
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900 dark:text-amber-100">
              Important: WiFi Settings
            </AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
              This platform only manages voucher codes. Configure your WiFi networks (SSID, password, security) 
              directly in the UniFi Controller interface as usual. We'll work with your existing setup.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

      {/* Mobile App Note */}
      <Alert className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">Coming Soon: Mobile App</AlertTitle>
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <p className="text-sm">
            We're developing a mobile app that will make router setup even easier for both MikroTik and UniFi devices.
          </p>
        </AlertDescription>
      </Alert>

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