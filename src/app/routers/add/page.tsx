//src/app/routers/add/page.tsx
import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AddRouterWizard } from '@/components/routers/add-router-wizard';
import { ArrowLeft, Info } from 'lucide-react';
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

      {/* Before You Start Info */}
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>Before you start</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Make sure your MikroTik router is powered on and connected to the internet</li>
            <li>Enable REST API on your router: <code className="text-xs bg-muted px-1 py-0.5 rounded">/ip/service/enable rest-ssl</code></li>
            <li>You'll need the router's IP address and admin credentials</li>
            <li>Ensure your router's firewall allows API connections</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Add Router Wizard */}
      <AddRouterWizard />
    </div>
  );
}