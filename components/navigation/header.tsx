// components/navigation/header.tsx
'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Menu, 
  Bell, 
  User, 
  Settings, 
  LogOut,
  HelpCircle,
  CreditCard,
  MessageSquare
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();
  const [smsCredits, setSmsCredits] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

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

  // Fetch unread notifications count with polling (every 30 seconds)
  useEffect(() => {
    if (!session?.user?.id) return;

    // Initial fetch
    const fetchUnreadCount = async () => {
      try {
        const res = await fetch('/api/notifications/unread-count');
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.count || 0);
        }
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    fetchUnreadCount();

    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    // Listen for notification events (from notifications page)
    const handleNotificationEvent = () => {
      fetchUnreadCount();
    };
    
    window.addEventListener('notificationRead', handleNotificationEvent);
    window.addEventListener('focus', fetchUnreadCount);

    return () => {
      clearInterval(interval);
      window.removeEventListener('notificationRead', handleNotificationEvent);
      window.removeEventListener('focus', fetchUnreadCount);
    };
  }, [session?.user?.id]);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/signin' });
  };

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

  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-background px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <span className="sr-only">Open sidebar</span>
        <Menu className="h-6 w-6" />
      </Button>

      {/* Separator */}
      <div className="h-6 w-px bg-border lg:hidden" />

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        {/* Search - Future feature */}
        <div className="relative flex flex-1">
          {/* Search component can be added here */}
        </div>

        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* SMS Credits */}
          <Button 
            variant="outline" 
            size="sm"
            className="relative hidden sm:flex"
            asChild
          >
            <Link href="/sms-credits">
              <MessageSquare className="mr-2 h-4 w-4" />
              <span className="font-medium">
                {smsCredits !== null ? smsCredits : '...'} SMS
              </span>
              {smsCredits !== null && smsCredits < 10 && (
                <Badge 
                  variant="destructive" 
                  className="ml-2 h-5 px-1 text-[10px]"
                >
                  Low
                </Badge>
              )}
            </Link>
          </Button>

          {/* Notifications */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative"
            asChild
          >
            <Link href="/notifications">
              <span className="sr-only">View notifications</span>
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-[10px]"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Link>
          </Button>

          {/* Separator */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-border" />

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="relative h-8 w-8 rounded-full"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage 
                    src={session?.user?.image || undefined} 
                    alt={session?.user?.name || 'User'} 
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getUserInitials(session?.user?.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {session?.user?.name || 'User'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {session?.user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/profile" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/billing" className="cursor-pointer">
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Billing</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/support" className="cursor-pointer">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  <span>Support</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}