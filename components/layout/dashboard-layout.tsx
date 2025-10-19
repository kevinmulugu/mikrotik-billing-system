// components/layout/dashboard-layout.tsx
'use client';

import { ReactNode, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Sidebar } from '@/components/navigation/sidebar';
import { Header } from '@/components/navigation/header';
import { MobileNav } from '@/components/navigation/mobile-nav';
import { Breadcrumbs } from '@/components/navigation/breadcrumbs';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Loading state with skeleton
  if (status === 'loading') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-4 px-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  // Unauthenticated - middleware will redirect
  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      <MobileNav 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

      {/* Desktop sidebar - fixed */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <Sidebar />
      </div>

      {/* Main content area - matches sidebar width of w-64 (256px) */}
      <div className="lg:pl-64">
        {/* Header with mobile menu button */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {/* Breadcrumbs */}
            <Breadcrumbs />

            {/* Page content */}
            <div className="mt-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}