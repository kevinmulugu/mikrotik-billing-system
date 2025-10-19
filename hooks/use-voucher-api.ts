import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

interface Voucher {
  id: string;
  code: string;
  profile: string;
  price: number;
  validity: number;
  status: 'available' | 'sold' | 'expired';
  routerId: string;
  createdAt: string;
  soldAt?: string;
  usedAt?: string;
}

interface GenerateVoucherData {
  quantity: number;
  profile: string;
  validity: number;
  price: number;
  prefix?: string;
}

export function useRouterVouchers(routerId: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['vouchers', routerId],
    queryFn: async (): Promise<Voucher[]> => {
      const response = await fetch(`/api/routers/${routerId}/vouchers`);
      if (!response.ok) {
        throw new Error('Failed to fetch vouchers');
      }
      const data = await response.json();
      return data.vouchers;
    },
    enabled: !!session && !!routerId,
  });
}

export function useVoucherHistory(routerId?: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['voucher-history', routerId],
    queryFn: async (): Promise<Voucher[]> => {
      const url = routerId
        ? `/api/routers/${routerId}/vouchers/history`
        : '/api/vouchers/history';

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch voucher history');
      }
      const data = await response.json();
      return data.vouchers;
    },
    enabled: !!session,
  });
}

export function useGenerateVouchers(routerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: GenerateVoucherData): Promise<Voucher[]> => {
      const response = await fetch(`/api/routers/${routerId}/vouchers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to generate vouchers');
      }

      const result = await response.json();
      return result.vouchers;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vouchers', routerId] });
      queryClient.invalidateQueries({ queryKey: ['voucher-history', routerId] });
    },
  });
}

export function useVoucherStats(routerId?: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['voucher-stats', routerId],
    queryFn: async () => {
      const url = routerId
        ? `/api/routers/${routerId}/vouchers/stats`
        : '/api/vouchers/stats';

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch voucher stats');
      }
      const data = await response.json();
      return data.stats;
    },
    enabled: !!session,
  });
}