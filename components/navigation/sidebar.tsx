// components/navigation/sidebar.tsx
'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  LayoutDashboard,
  Wifi,
  Users,
  DollarSign,
  MessageSquare,
  HelpCircle,
  Settings,
  Building2
} from 'lucide-react';

const navigation = [
  { 
    name: 'Dashboard', 
    href: '/dashboard', 
    icon: LayoutDashboard,
  },
  {
    name: 'Routers',
    href: '/routers',
    icon: Wifi,
  },
  {
    name: 'Customers',
    href: '/customers',
    icon: Users,
  },
  {
    name: 'Messages',
    href: '/messages',
    icon: MessageSquare,
  },
  {
    name: 'Payments',
    href: '/payments', 
    icon: DollarSign,
  },
  { 
    name: 'Support', 
    href: '/support', 
    icon: HelpCircle,
  },
  { 
    name: 'Settings', 
    href: '/settings', 
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Get user initials for avatar fallback
  const getUserInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get app name from env or default
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'MikroTik Billing';
  const appShortName = process.env.NEXT_PUBLIC_APP_SHORT_NAME || 'MB';

  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r bg-background px-6 pb-4">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">{appShortName}</span>
          </div>
          <span className="font-semibold">{appName}</span>
        </Link>
      </div>

      {/* User Info */}
      <div className="border-b pb-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage 
              src={session?.user?.image || undefined} 
              alt={session?.user?.name || 'User'} 
            />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getUserInitials(session?.user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {session?.user?.name || 'User'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {session?.user?.email}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`
                        group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-colors
                        ${isActive 
                          ? 'bg-primary/10 text-primary' 
                          : 'text-foreground hover:bg-muted hover:text-primary'
                        }
                      `}
                    >
                      <item.icon
                        className={`h-6 w-6 shrink-0 transition-colors ${
                          isActive 
                            ? 'text-primary' 
                            : 'text-muted-foreground group-hover:text-primary'
                        }`}
                      />
                      <span className="flex-1">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>

          {/* Payment Method Indicator - Fetch from customer data */}
          {session?.user?.id && (
            <li className="mt-auto">
              <div className="rounded-lg bg-muted p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Payment Method</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {session.user.paymentMethod === 'customer' 
                    ? 'Your Paybill' 
                    : 'Company Paybill'}
                </p>
                <Link 
                  href="/payments/setup"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Change →
                </Link>
              </div>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}