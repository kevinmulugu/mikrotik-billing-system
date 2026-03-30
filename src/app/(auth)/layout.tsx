import { ReactNode } from 'react';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

interface AuthLayoutProps {
  children: ReactNode;
}

export default async function AuthLayout({ children }: AuthLayoutProps) {
  const session = await getServerSession(authOptions);
  if (session) redirect('/dashboard');
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background relative">
      {/* Logo/Brand Header */}
      <div className="absolute top-4 left-4 sm:top-8 sm:left-8 z-10">
        <Link href="/" className="flex items-center space-x-2">
          <div className="bg-primary w-8 h-8 rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">PB</span>
          </div>
          <span className="font-semibold text-foreground hidden sm:block">
            PAY N BROWSE
          </span>
        </Link>
      </div>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
        <p className="text-xs text-muted-foreground text-center">
          © {currentYear} PAY N BROWSE. All rights reserved.
        </p>
      </footer>
    </div>
  );
}