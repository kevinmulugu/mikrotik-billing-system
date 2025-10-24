'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { apiClient } from './api';
import { toast } from 'sonner';

// Auth hooks
export function useAuth() {
  const { data: session, status } = useSession();
  
  return {
    user: session?.user,
    isLoading: status === 'loading',
    isAuthenticated: !!session,
    role: session?.user?.role,
    customerId: session?.user?.customerId,
  };
}

// API data fetching hooks
export function useRouters() {
  const [routers, setRouters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRouters = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getRouters();
      setRouters(response.data?.routers || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch routers');
      toast.error('Failed to load routers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRouters();
  }, [fetchRouters]);

  return {
    routers,
    loading,
    error,
    refetch: fetchRouters,
  };
}

export function useRouter(id: string) {
  const [router, setRouter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRouter = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await apiClient.getRouter(id);
      setRouter(response.data?.router || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch router');
      toast.error('Failed to load router details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRouter();
  }, [fetchRouter]);

  return {
    router,
    loading,
    error,
    refetch: fetchRouter,
  };
}

export function useVouchers(
  routerId?: string,
  status?: 'active' | 'used' | 'expired' | 'all'
) {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVouchers = useCallback(async () => {
    try {
      setLoading(true);
      const params: { routerId?: string; status?: 'active' | 'used' | 'expired' | 'all' } = {};
      if (routerId !== undefined) params.routerId = routerId;
      if (status !== undefined) params.status = status;
      const response = await apiClient.getVouchers(params);
      setVouchers(response.data?.vouchers || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vouchers');
      toast.error('Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  }, [routerId, status]);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  return {
    vouchers,
    loading,
    error,
    refetch: fetchVouchers,
  };
}

export function usePayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalPages: 0,
    totalItems: 0,
  });

  const fetchPayments = useCallback(async (params?: any) => {
    try {
      setLoading(true);
      const response = await apiClient.getPayments(params);
      setPayments(response.data?.payments || []);
      setPagination(response.pagination || {
        page: 1,
        limit: 20,
        totalPages: 0,
        totalItems: 0,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch payments');
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return {
    payments,
    loading,
    error,
    pagination,
    refetch: fetchPayments,
  };
}

export function useTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async (params?: any) => {
    try {
      setLoading(true);
      const response = await apiClient.getTickets(params);
      setTickets(response.data?.tickets || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tickets');
      toast.error('Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  return {
    tickets,
    loading,
    error,
    refetch: fetchTickets,
  };
}

// Utility hooks
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue] as const;
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  options?: IntersectionObserverInit
) {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(!!entry && entry.isIntersecting),
      options
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef, options]);

  return isIntersecting;
}

export function useOnClickOutside<T extends HTMLElement = HTMLElement>(
  ref: React.RefObject<T>,
  handler: (event: Event) => void
) {
  useEffect(() => {
    const listener = (event: Event) => {
      const el = ref?.current;
      if (!el || el.contains((event?.target as Node) || null)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

export function useCopyToClipboard() {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = useCallback(async (text: string) => {
    if (!navigator?.clipboard) {
      console.warn('Clipboard not supported');
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setIsCopied(false), 2000);
      return true;
    } catch (error) {
      console.warn('Copy failed', error);
      setIsCopied(false);
      toast.error('Failed to copy');
      return false;
    }
  }, []);

  return { isCopied, copyToClipboard };
}

export function useToggle(defaultValue?: boolean) {
  const [value, setValue] = useState(!!defaultValue);

  const toggle = useCallback(() => setValue(x => !x), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);

  return { value, toggle, setTrue, setFalse };
}

export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback.current(), delay);
      return () => clearInterval(id);
    }
    return undefined
  }, [delay]);
}

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export function useUpdateEffect(effect: React.EffectCallback, deps?: React.DependencyList) {
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    } else {
      return effect();
    }
  }, deps);
}

// Dashboard stats types
interface DashboardStats {
  totalRevenue: number;
  monthlyRevenue: number;
  todayRevenue: number;
  activeUsers: number;
  totalUsers: number;
  onlineRouters: number;
  totalRouters: number;
  commission: number;
  revenueChange: number;
  userChange: number;
  routerUptime: number;
  commissionChange: number;
}

// Dashboard-specific hooks
export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getDashboardStats();
      
      // Mock data for development - replace with actual API response
      const mockStats: DashboardStats = {
        totalRevenue: response.data?.totalRevenue || 87650,
        monthlyRevenue: response.data?.monthlyRevenue || 15750,
        todayRevenue: response.data?.todayRevenue || 2850,
        activeUsers: response.data?.activeUsers || 127,
        totalUsers: response.data?.totalUsers || 345,
        onlineRouters: response.data?.onlineRouters || 3,
        totalRouters: response.data?.totalRouters || 4,
        commission: response.data?.commission || 13147.5,
        revenueChange: response.data?.revenueChange || 12.5,
        userChange: response.data?.userChange || 8.3,
        routerUptime: response.data?.routerUptime || 99.2,
        commissionChange: response.data?.commissionChange || 15.7,
      };
      
      setStats(mockStats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
      
      // Fallback to mock data on error for better UX
      const fallbackStats: DashboardStats = {
        totalRevenue: 87650,
        monthlyRevenue: 15750,
        todayRevenue: 2850,
        activeUsers: 127,
        totalUsers: 345,
        onlineRouters: 3,
        totalRouters: 4,
        commission: 13147.5,
        revenueChange: 12.5,
        userChange: 8.3,
        routerUptime: 99.2,
        commissionChange: 15.7,
      };
      setStats(fallbackStats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}