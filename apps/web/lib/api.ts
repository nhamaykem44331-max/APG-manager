import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api/v1',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const TOKEN_CACHE_TTL_MS = 7.5 * 60 * 60 * 1000;

let cachedToken: string | null = null;
let tokenExpiry = 0;
let pendingTokenRequest: Promise<string | null> | null = null;

export function setAuthToken(token: string | null) {
  cachedToken = token;
  tokenExpiry = token ? Date.now() + TOKEN_CACHE_TTL_MS : 0;
}

function withAuthHeader(
  config: InternalAxiosRequestConfig,
  token: string | null,
) {
  if (!token) {
    return config;
  }

  config.headers = config.headers ?? {};
  config.headers.Authorization = `Bearer ${token}`;
  return config;
}

async function getCachedSessionToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  if (!pendingTokenRequest) {
    pendingTokenRequest = import('next-auth/react')
      .then(({ getSession }) => getSession())
      .then((session) => {
        const token = session?.user?.accessToken ?? null;
        setAuthToken(token);
        return token;
      })
      .finally(() => {
        pendingTokenRequest = null;
      });
  }

  return pendingTokenRequest;
}

apiClient.interceptors.request.use(async (config) => {
  const token = cachedToken && Date.now() < tokenExpiry
    ? cachedToken
    : await getCachedSessionToken();

  return withAuthHeader(config, token);
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      setAuthToken(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  me: () => apiClient.get('/auth/me'),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.put('/auth/change-password', data),
};

export const dashboardApi = {
  getStats: () => apiClient.get('/reports/daily'),
  getRevenueChart: (days = 7) =>
    apiClient.get(`/reports/revenue-chart?days=${days}`),
};

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

export const financeApi = {
  getDashboard: () => apiClient.get('/finance/dashboard'),
  getDebts: (params?: Record<string, string | number>) =>
    apiClient.get('/finance/debts', { params }),
  getDebtAging: () => apiClient.get('/finance/debts/aging'),
  getDeposits: () => apiClient.get('/finance/deposits'),
  updateDeposit: (id: string, data: { amount: number; notes?: string }) =>
    apiClient.patch(`/finance/deposits/${id}`, data),
};

export const customerIntelligenceApi = {
  getRfm: (id: string) => apiClient.get(`/customer-intelligence/${id}/rfm`),
  getTimeline: (id: string) =>
    apiClient.get(`/customer-intelligence/${id}/timeline`),
  getSegments: () => apiClient.get('/customer-intelligence/segments'),
  getAtRisk: () => apiClient.get('/customer-intelligence/at-risk'),
  getFollowUps: () => apiClient.get('/customer-intelligence/follow-ups'),
};

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
