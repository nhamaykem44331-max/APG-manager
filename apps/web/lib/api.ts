// APG Manager RMS - API Client (Axios với auto-inject token)
import axios, { AxiosError } from 'axios';
import { getSession } from 'next-auth/react';

// Tạo axios instance với base config
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api/v1',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: tự động thêm JWT token vào mỗi request
apiClient.interceptors.request.use(async (config) => {
  const session = await getSession();

  if (session?.user?.accessToken) {
    config.headers.Authorization = `Bearer ${session.user.accessToken}`;
  }

  return config;
});

// Interceptor: xử lý lỗi response
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // 401 - Token hết hạn, chuyển về login
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;

// ===== API Functions =====

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  me: () => apiClient.get('/auth/me'),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.put('/auth/change-password', data),
};

// Dashboard
export const dashboardApi = {
  getStats: () => apiClient.get('/reports/daily'),
  getRevenueChart: (days = 7) =>
    apiClient.get(`/reports/revenue-chart?days=${days}`),
};

// Bookings
export const bookingsApi = {
  list: (params?: Record<string, string | number>) =>
    apiClient.get('/bookings', { params }),
  get: (id: string) => apiClient.get(`/bookings/${id}`),
  create: (data: unknown) => apiClient.post('/bookings', data),
  update: (id: string, data: unknown) => apiClient.patch(`/bookings/${id}`, data),
  updateStatus: (id: string, toStatus: string, reason?: string) =>
    apiClient.patch(`/bookings/${id}/status`, { toStatus, reason }),
  addTicket: (id: string, data: unknown) =>
    apiClient.post(`/bookings/${id}/tickets`, data),
  addPayment: (id: string, data: unknown) =>
    apiClient.post(`/bookings/${id}/payments`, data),
};

// Customers
export const customersApi = {
  list: (params?: Record<string, string | number>) =>
    apiClient.get('/customers', { params }),
  get: (id: string) => apiClient.get(`/customers/${id}`),
  create: (data: unknown) => apiClient.post('/customers', data),
  update: (id: string, data: unknown) => apiClient.patch(`/customers/${id}`, data),
  getStats: (id: string) => apiClient.get(`/customers/${id}/stats`),
  searchByPhone: (phone: string) =>
    apiClient.get(`/customers?search=${phone}&pageSize=1`),
};

// Finance
export const financeApi = {
  getDashboard: () => apiClient.get('/finance/dashboard'),
  getDebts: (params?: Record<string, string | number>) =>
    apiClient.get('/finance/debts', { params }),
  getDebtAging: () => apiClient.get('/finance/debts/aging'),
  getDeposits: () => apiClient.get('/finance/deposits'),
  updateDeposit: (id: string, data: { amount: number; notes?: string }) =>
    apiClient.patch(`/finance/deposits/${id}`, data),
};

// Customer Intelligence
export const customerIntelligenceApi = {
  getRfm: (id: string) => apiClient.get(`/customer-intelligence/${id}/rfm`),
  getTimeline: (id: string) =>
    apiClient.get(`/customer-intelligence/${id}/timeline`),
  getSegments: () => apiClient.get('/customer-intelligence/segments'),
  getAtRisk: () => apiClient.get('/customer-intelligence/at-risk'),
  getFollowUps: () => apiClient.get('/customer-intelligence/follow-ups'),
};

// Customer Interactions & Notes
export const interactionsApi = {
  list: (customerId: string, page = 1) =>
    apiClient.get(`/customers/${customerId}/interactions`, { params: { page } }),
  create: (customerId: string, data: unknown) =>
    apiClient.post(`/customers/${customerId}/interactions`, data),
  listNotes: (customerId: string) =>
    apiClient.get(`/customers/${customerId}/notes`),
  createNote: (customerId: string, data: { content: string; isPinned?: boolean }) =>
    apiClient.post(`/customers/${customerId}/notes`, data),
  updateNote: (customerId: string, noteId: string, data: unknown) =>
    apiClient.patch(`/customers/${customerId}/notes/${noteId}`, data),
  deleteNote: (customerId: string, noteId: string) =>
    apiClient.delete(`/customers/${customerId}/notes/${noteId}`),
};

