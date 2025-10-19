// app/dashboard/page.tsx
import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Plus, Settings } from 'lucide-react';
import Link from 'next/link';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { UsageChart } from '@/components/dashboard/usage-chart';
import { RecentActivity } from '@/components/dashboard/recent-activity';

export const metadata: Metadata = {
  title: 'Dashboard - MikroTik Billing',
  description: 'Overview of your routers, revenue, and system performance',
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back, {session.user?.name}
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your routers today
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/routers/add">
              <Plus className="mr-2 h-4 w-4" />
              Add Router
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <StatsCards />

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueChart />
        <UsageChart />
      </div>

      {/* Recent Activity */}
      <RecentActivity />
    </div>
  );
}