'use client';

import { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { Session } from 'next-auth';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

interface ProvidersProps {
  children: ReactNode;
  session: Session | null;
}

export function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          {process.env.NODE_ENV === 'development' && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}

// Individual context providers for specific features
import { createContext, useContext, useState } from 'react';
import { useLocalStorage } from './hooks';

// Notification Context
interface NotificationContextType {
  notifications: any[];
  addNotification: (notification: any) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<any[]>([]);

  const addNotification = (notification: any) => {
    const newNotification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

// Router Status Context
interface RouterStatusContextType {
  routerStatuses: Record<string, string>;
  updateRouterStatus: (routerId: string, status: string) => void;
  isRouterOnline: (routerId: string) => boolean;
}

const RouterStatusContext = createContext<RouterStatusContextType | undefined>(undefined);

export function RouterStatusProvider({ children }: { children: ReactNode }) {
  const [routerStatuses, setRouterStatuses] = useState<Record<string, string>>({});

  const updateRouterStatus = (routerId: string, status: string) => {
    setRouterStatuses(prev => ({
      ...prev,
      [routerId]: status,
    }));
  };

  const isRouterOnline = (routerId: string) => {
    return routerStatuses[routerId] === 'online';
  };

  // TODO: Set up WebSocket connection for real-time router status updates
  // useEffect(() => {
  //   const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL);
  //   ws.onmessage = (event) => {
  //     const data = JSON.parse(event.data);
  //     if (data.type === 'router_status') {
  //       updateRouterStatus(data.routerId, data.status);
  //     }
  //   };
  //   return () => ws.close();
  // }, []);

  return (
    <RouterStatusContext.Provider
      value={{
        routerStatuses,
        updateRouterStatus,
        isRouterOnline,
      }}
    >
      {children}
    </RouterStatusContext.Provider>
  );
}

export function useRouterStatus() {
  const context = useContext(RouterStatusContext);
  if (context === undefined) {
    throw new Error('useRouterStatus must be used within a RouterStatusProvider');
  }
  return context;
}

// Settings Context
interface SettingsContextType {
  settings: {
    theme: string;
    language: string;
    notifications: any;
    paymentMethod: string;
  };
  updateSettings: (newSettings: Partial<SettingsContextType['settings']>) => void;
  resetSettings: () => void;
}

const defaultSettings = {
  theme: 'system',
  language: 'en',
  notifications: {
    email: true,
    sms: true,
    push: true,
  },
  paymentMethod: 'company_paybill',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useLocalStorage('user-settings', defaultSettings);

  const updateSettings = (newSettings: Partial<typeof settings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        resetSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

// Combined Providers Component
export function AppProviders({ children, session }: ProvidersProps) {
  return (
    <Providers session={session}>
      <NotificationProvider>
        <RouterStatusProvider>
          <SettingsProvider>
            {children}
          </SettingsProvider>
        </RouterStatusProvider>
      </NotificationProvider>
    </Providers>
  );
}