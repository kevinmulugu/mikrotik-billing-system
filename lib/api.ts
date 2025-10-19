import { getSession } from 'next-auth/react';
import { type } from 'node:os';

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | undefined;
  body?: any;
  headers?: Record<string, string> | undefined;
  params?: Record<string, string | number> | undefined;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
  }

  private async request<T = any>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', body, headers = {}, params } = options;

    // Build URL with query parameters
    const url = new URL(`${this.baseUrl}${endpoint}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    // Get session for authentication
    const session = await getSession();

    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      ...(body && { body: JSON.stringify(body) }),
    };

    // Add authorization header if user is authenticated
    const accessToken = (session as any)?.accessToken || (session as any)?.user?.accessToken;
    if (accessToken) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${accessToken}`,
      };
    }

    try {
      const response = await fetch(url.toString(), config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Router API methods
  async getRouters(params?: { page?: number; limit?: number }) {
    return this.request('/routers', { params });
  }

  async getRouter(id: string) {
    return this.request(`/routers/${id}`);
  }

  async createRouter(data: any) {
    return this.request('/routers', {
      method: 'POST',
      body: data,
    });
  }

  async updateRouter(id: string, data: any) {
    return this.request(`/routers/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteRouter(id: string) {
    return this.request(`/routers/${id}`, {
      method: 'DELETE',
    });
  }

  // User API methods
  async getUsers(params?: { 
    routerId?: string; 
    type?: 'hotspot' | 'pppoe' | 'all';
    page?: number; 
    limit?: number;
  }) {
    return this.request('/users', { params });
  }

  async createPPPoEUser(data: any) {
    return this.request('/users', {
      method: 'POST',
      body: data,
    });
  }

  async updateUser(id: string, data: any) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteUser(id: string) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  async disconnectUser(id: string) {
    return this.request(`/users/${id}/disconnect`, {
      method: 'POST',
    });
  }

  // Voucher API methods
  async getVouchers(params?: {
    routerId?: string;
    status?: 'active' | 'used' | 'expired' | 'all';
    page?: number;
    limit?: number;
  }) {
    return this.request('/vouchers', { params });
  }

  async generateVouchers(data: {
    routerId: string;
    packageType: string;
    quantity: number;
    duration: number;
    price: number;
    bandwidth: { upload: number; download: number };
  }) {
    return this.request('/vouchers', {
      method: 'POST',
      body: data,
    });
  }

  async deleteVoucher(id: string) {
    return this.request(`/vouchers/${id}`, {
      method: 'DELETE',
    });
  }

  // Payment API methods
  async getPayments(params?: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    return this.request('/payments', { params });
  }

  async getPaymentStats() {
    return this.request('/payments/stats');
  }

  async reconcilePayments() {
    return this.request('/payments/reconcile', {
      method: 'POST',
    });
  }

  async getCommissionData(params?: {
    startDate?: string;
    endDate?: string;
  }) {
    return this.request('/payments/commission', { params });
  }

  // Support API methods
  async getTickets(params?: {
    status?: string;
    priority?: string;
    page?: number;
    limit?: number;
  }) {
    return this.request('/support/tickets', { params });
  }

  async getTicket(id: string) {
    return this.request(`/support/tickets/${id}`);
  }

  async createTicket(data: {
    title: string;
    description: string;
    category: string;
    priority: string;
    routerId?: string;
  }) {
    return this.request('/support/tickets', {
      method: 'POST',
      body: data,
    });
  }

  async updateTicket(id: string, data: any) {
    return this.request(`/support/tickets/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async addTicketMessage(ticketId: string, message: string) {
    return this.request(`/support/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: { message },
    });
  }

  // Analytics API methods
  async getDashboardStats() {
    return this.request('/analytics/dashboard');
  }

  async getRouterAnalytics(routerId: string, params?: {
    period?: 'day' | 'week' | 'month' | 'year';
    startDate?: string;
    endDate?: string;
  }) {
    return this.request(`/analytics/routers/${routerId}`, { params });
  }

  async getRevenueAnalytics(params?: {
    period?: 'day' | 'week' | 'month' | 'year';
    startDate?: string;
    endDate?: string;
  }) {
    return this.request('/analytics/revenue', { params });
  }

  async getUserAnalytics(params?: {
    routerId?: string;
    period?: 'day' | 'week' | 'month' | 'year';
  }) {
    return this.request('/analytics/users', { params });
  }

  // Settings API methods
  async getUserProfile() {
    return this.request('/settings/profile');
  }

  async updateUserProfile(data: any) {
    return this.request('/settings/profile', {
      method: 'PUT',
      body: data,
    });
  }

  async getNotificationSettings() {
    return this.request('/settings/notifications');
  }

  async updateNotificationSettings(data: any) {
    return this.request('/settings/notifications', {
      method: 'PUT',
      body: data,
    });
  }

  async getBillingSettings() {
    return this.request('/settings/billing');
  }

  async updateBillingSettings(data: any) {
    return this.request('/settings/billing', {
      method: 'PUT',
      body: data,
    });
  }

  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    return this.request('/settings/password', {
      method: 'PUT',
      body: data,
    });
  }

  // File upload methods
  async uploadFile(file: File, type: 'avatar' | 'document' | 'backup') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const session = await getSession();
    
    const accessToken = (session as any)?.accessToken || (session as any)?.user?.accessToken;

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers: {
        ...(accessToken && {
          Authorization: `Bearer ${accessToken}`,
        }),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('File upload failed');
    }

    return response.json();
  }

  async exportData(type: string, params?: Record<string, string | number>) {
    const session = await getSession();
    const accessToken = (session as any)?.accessToken || (session as any)?.user?.accessToken;

    const url = new URL(`${this.baseUrl}/export/${type}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        ...(accessToken && {
          Authorization: `Bearer ${accessToken}`,
        }),
      },
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    // Handle file download
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${type}-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export individual methods for convenience
export const {
  getRouters,
  getRouter,
  createRouter,
  updateRouter,
  deleteRouter,
  getUsers,
  createPPPoEUser,
  updateUser,
  deleteUser,
  disconnectUser,
  getVouchers,
  generateVouchers,
  deleteVoucher,
  getPayments,
  getPaymentStats,
  reconcilePayments,
  getCommissionData,
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
  addTicketMessage,
  getDashboardStats,
  getRouterAnalytics,
  getRevenueAnalytics,
  getUserAnalytics,
  getUserProfile,
  updateUserProfile,
  getNotificationSettings,
  updateNotificationSettings,
  getBillingSettings,
  updateBillingSettings,
  changePassword,
  uploadFile,
  exportData,
} = apiClient;

export default apiClient;