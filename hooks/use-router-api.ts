import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

interface Router {
  id: string;
  name: string;
  model: string;
  status: 'online' | 'offline' | 'pending';
  ipAddress: string;
  location: {
    name: string;
    address?: string;
  };
  connectedUsers?: number;
  uptime?: string;
  createdAt: string;
}

interface CreateRouterData {
  name: string;
  model: string;
  ipAddress: string;
  apiUser: string;
  apiPassword: string;
  location: {
    name: string;
    address?: string;
    coordinates?: {
      latitude?: number;
      longitude?: number;
    };
  };
}

export function useRouters() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['routers'],
    queryFn: async (): Promise<Router[]> => {
      const response = await fetch('/api/routers');
      if (!response.ok) {
        throw new Error('Failed to fetch routers');
      }
      const data = await response.json();
      return data.routers;
    },
    enabled: !!session,
  });
}

export function useRouter(routerId: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['router', routerId],
    queryFn: async (): Promise<Router> => {
      const response = await fetch(`/api/routers/${routerId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch router');
      }
      const data = await response.json();
      return data.router;
    },
    enabled: !!session && !!routerId,
  });
}

export function useCreateRouter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateRouterData): Promise<Router> => {
      const response = await fetch('/api/routers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create router');
      }

      const result = await response.json();
      return result.router;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routers'] });
    },
  });
}

export function useUpdateRouter(routerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<CreateRouterData>): Promise<Router> => {
      const response = await fetch(`/api/routers/${routerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update router');
      }

      const result = await response.json();
      return result.router;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routers'] });
      queryClient.invalidateQueries({ queryKey: ['router', routerId] });
    },
  });
}

export function useDeleteRouter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (routerId: string): Promise<void> => {
      const response = await fetch(`/api/routers/${routerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete router');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routers'] });
    },
  });
}