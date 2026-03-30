'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Wifi,
  Users,
  DollarSign,
  MessageSquare,
  HelpCircle,
  Settings,
  Building2,
  Percent,
  Shield,
  BarChart3,
  FileText,
  CreditCard,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Routers', href: '/routers', icon: Wifi },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Messages', href: '/messages', icon: MessageSquare },
  { name: 'Payments', href: '/payments', icon: DollarSign },
  { name: 'Commission', href: '/commission', icon: Percent },
  { name: 'Support', href: '/support', icon: HelpCircle },
  { name: 'Settings', href: '/settings', icon: Settings },
];

function UserFooter() {
  const { data: session } = useSession();
  const { state } = useSidebar();
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchPaymentMethod = async () => {
      try {
        const res = await fetch('/api/user/payment-method');
        if (res.ok) {
          const data = await res.json();
          setPaymentMethod(data.method || 'company_paybill');
        }
      } catch {
        setPaymentMethod(
          (session.user as { paymentSettings?: { method?: string } }).paymentSettings?.method ||
            'company_paybill',
        );
      }
    };

    fetchPaymentMethod();
    const onFocus = () => fetchPaymentMethod();
    const onPaymentChange = () => fetchPaymentMethod();
    window.addEventListener('focus', onFocus);
    window.addEventListener('paymentMethodChanged', onPaymentChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('paymentMethodChanged', onPaymentChange);
    };
  }, [session?.user?.id]);

  const initials = (name?: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <SidebarFooter>
      {/* Payment method card — hidden when icon-only */}
      {paymentMethod && state === 'expanded' && (
        <div className="mx-2 rounded-lg bg-sidebar-accent p-3">
          <div className="mb-1 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-sidebar-primary" />
            <span className="text-xs font-medium">Payment Method</span>
          </div>
          <p className="text-xs text-sidebar-foreground/60">
            {paymentMethod === 'own_paybill' ? 'Your Paybill' : 'Company Paybill'}
          </p>
          <Link
            href="/payments/setup"
            className="text-xs font-medium text-sidebar-primary hover:underline"
          >
            Change →
          </Link>
        </div>
      )}

      {/* User row — shows avatar + name/email when expanded, avatar-only tooltip when collapsed */}
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" asChild tooltip={session?.user?.name ?? 'Profile'}>
            <Link href="/settings/profile">
              <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                <AvatarImage
                  src={session?.user?.image ?? undefined}
                  alt={session?.user?.name ?? 'User'}
                />
                <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                  {initials(session?.user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 overflow-hidden text-left text-sm leading-tight">
                <span className="truncate font-medium">{session?.user?.name ?? 'User'}</span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {session?.user?.email}
                </span>
              </div>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}

const adminNavigation = [
  { name: 'Admin Overview', href: '/admin', icon: Shield },
  { name: 'All Users', href: '/admin/users', icon: Users },
  { name: 'All Payments', href: '/admin/payments', icon: DollarSign },
  { name: 'All Routers', href: '/admin/routers', icon: Wifi },
  { name: 'Tickets', href: '/admin/tickets', icon: HelpCircle },
  { name: 'Messages', href: '/admin/messages', icon: MessageSquare },
  { name: 'SMS Plans', href: '/admin/sms-plans', icon: CreditCard },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: FileText },
  { name: 'Analytics', href: '/admin', icon: BarChart3 },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'PAY N BROWSE';
  const appShortName = process.env.NEXT_PUBLIC_APP_SHORT_NAME || 'PB';
  const isAdmin = (session?.user as { role?: string })?.role === 'system_admin';

  return (
    <Sidebar collapsible="icon">
      {/* Logo */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip={appName}>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <span className="text-sm font-bold">{appShortName}</span>
                </div>
                <span className="truncate font-semibold">{appName}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Nav items */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith('/admin')}
                    tooltip="Admin Panel"
                    className="font-medium"
                  >
                    <Link href="/admin">
                      <Shield />
                      <span>Admin Panel</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {adminNavigation.slice(1).map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <UserFooter />

      {/* Draggable rail to resize/collapse */}
      <SidebarRail />
    </Sidebar>
  );
}
