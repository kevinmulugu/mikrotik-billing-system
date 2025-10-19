import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { RouterAnalytics } from '@/components/analytics/router-analytics';
import { Button } from '@/components/ui/button';
import { BarChart3, ArrowLeft } from 'lucide-react';

interface RouterAnalyticsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: RouterAnalyticsPageProps): Promise<Metadata> {
  return {
    title: `Router Analytics - MikroTik Billing`,
    description: 'Detailed analytics for your router performance and revenue',
  };
}

export default async function RouterAnalyticsPage({ params }: RouterAnalyticsPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }
  const { id } = await params;
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <a href={`/routers/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Router Analytics
          </h1>
          <p className="text-gray-600 mt-1">
            Detailed performance and revenue analytics for this router
          </p>
        </div>
        
        <Button variant="outline">
          Export Report
        </Button>
      </div>

      {/* Router Analytics */}
      <RouterAnalytics routerId={id} routerName={"Router"} />
    </div>
  );
}