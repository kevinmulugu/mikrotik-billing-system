// components/navigation/mobile-nav.tsx
'use client';

import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  X,
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
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Routers', href: '/routers', icon: Wifi },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Messages', href: '/messages', icon: MessageSquare },
  { name: 'Payments', href: '/payments', icon: DollarSign },
  { name: 'Support', href: '/support', icon: HelpCircle },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [smsCredits, setSmsCredits] = useState<number | null>(null);

  // Fetch SMS credits balance
  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/sms-credits/balance')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.balance !== undefined) {
            setSmsCredits(data.balance);
          }
        })
        .catch(err => console.error('Failed to fetch SMS credits:', err));
    }
  }, [session?.user?.id]);

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
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50 lg:hidden" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="transition-opacity ease-linear duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-linear duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/80" />
        </Transition.Child>

        <div className="fixed inset-0 flex">
          <Transition.Child
            as={Fragment}
            enter="transition ease-in-out duration-300 transform"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in-out duration-300 transform"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
              {/* Close button */}
              <Transition.Child
                as={Fragment}
                enter="ease-in-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in-out duration-300"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="text-white hover:bg-white/10 hover:text-white"
                  >
                    <span className="sr-only">Close sidebar</span>
                    <X className="h-6 w-6" />
                  </Button>
                </div>
              </Transition.Child>

              {/* Sidebar content */}
              <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r bg-background px-6 pb-4">
                {/* Logo */}
                <div className="flex h-16 shrink-0 items-center">
                  <Link 
                    href="/dashboard" 
                    className="flex items-center space-x-2" 
                    onClick={onClose}
                  >
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
                  
                  {/* SMS Credits Display for Mobile */}
                  <Link 
                    href="/sms-credits"
                    onClick={onClose}
                    className="mt-3 flex items-center justify-between rounded-md bg-muted px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">SMS Credits</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-primary">
                        {smsCredits !== null ? smsCredits : '...'}
                      </span>
                      {smsCredits !== null && smsCredits < 10 && (
                        <Badge variant="destructive" className="h-5 px-1 text-[10px]">
                          Low
                        </Badge>
                      )}
                    </div>
                  </Link>
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
                                onClick={onClose}
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

                    {/* Payment Method Indicator */}
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
                            onClick={onClose}
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
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}