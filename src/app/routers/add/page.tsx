//src/app/routers/add/page.tsx
import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AddRouterWizard } from '@/components/routers/add-router-wizard';
import { ArrowLeft, Info, Wifi, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const metadata: Metadata = {
  title: 'Add Router - MikroTik Billing',
  description: 'Connect a new MikroTik router to start earning money from your WiFi',
};

export default async function AddRouterPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
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
            Connect your MikroTik router in a few simple steps
          </p>
        </div>
      </div>

      {/* CRITICAL: Network Connection Warning */}
      <Alert className="mb-6 border-amber-500 bg-amber-500/10">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <AlertTitle className="text-amber-500 text-lg font-bold">
          ⚠️ IMPORTANT - You Must Be Connected to Your Router's WiFi
        </AlertTitle>
        <AlertDescription className="mt-3 space-y-3">
          <div className="flex items-start gap-3">
            <Wifi className="h-5 w-5 text-amber-500 mt-1 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-600 mb-2">
                Before starting setup, connect your device (phone/computer) to your router's WiFi network.
              </p>
              <p className="text-sm text-muted-foreground">
                This is required for the initial setup. After setup is complete, your router will be accessible from anywhere.
              </p>
            </div>
          </div>
          
          <div className="bg-background/50 rounded-lg p-3 border border-amber-200">
            <p className="text-sm font-medium mb-2">Quick Check:</p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>✓ Are you connected to your router's WiFi right now?</li>
              <li>✓ Can you access your router at 192.168.88.1 in your browser?</li>
              <li>✓ Will you stay connected for the next 3 minutes?</li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground italic">
            💡 Tip: Setup takes about 2-3 minutes. Stay connected until you see the success message.
          </p>
        </AlertDescription>
      </Alert>

      {/* Before You Start Info */}
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>What you'll need</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
            <li>Your router must be powered on and connected to the internet</li>
            <li>Router's IP address (usually 192.168.88.1)</li>
            <li>Router's admin username and password</li>
            <li>Your WiFi network name (SSID) for customers</li>
          </ul>
          
          <div className="mt-3 p-3 bg-muted rounded-lg">
            <p className="text-xs font-medium mb-1">Optional (for advanced users):</p>
            <p className="text-xs text-muted-foreground">
              Enable REST API: <code className="bg-background px-1 py-0.5 rounded">/ip/service/enable rest-ssl</code>
            </p>
          </div>
        </AlertDescription>
      </Alert>

      {/* Add Router Wizard */}
      <AddRouterWizard />
    </div>
  );
}