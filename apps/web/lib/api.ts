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

export const reportsApi = {
  getStats: () => apiClient.get('/reports/daily'),
  getRevenueChart: (days = 7) => apiClient.get(`/reports/revenue-chart?days=${days}`),
  getKpi: () => apiClient.get('/reports/kpi'),
  getMonthlySummary: (months = 6) => apiClient.get(`/reports/monthly-summary?months=${months}`),
  getAirlineBreakdown: (from?: string, to?: string) =>
    apiClient.get('/reports/airline-breakdown', { params: { from, to } }),
  getRouteAnalysis: (from?: string, to?: string, limit = 20) =>
    apiClient.get('/reports/route-analysis', { params: { from, to, limit } }),
  getSourceAnalysis: (from?: string, to?: string) =>
    apiClient.get('/reports/source-analysis', { params: { from, to } }),
  getStaffPerformance: (from?: string, to?: string) =>
    apiClient.get('/reports/staff-performance', { params: { from, to } }),
  getCustomerRanking: (from?: string, to?: string, limit = 20) =>
    apiClient.get('/reports/customer-ranking', { params: { from, to, limit } }),
  getPaymentAnalysis: (from?: string, to?: string) =>
    apiClient.get('/reports/payment-analysis', { params: { from, to } }),
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

// Sổ cái công nợ 2 chiều (AR/AP)
export const ledgerApi = {
  list: (params?: Record<string, string | number>) =>
    apiClient.get('/finance/ledger', { params }),
  get: (id: string) => apiClient.get(`/finance/ledger/${id}`),
  create: (data: unknown) => apiClient.post('/finance/ledger', data),
  update: (id: string, data: unknown) => apiClient.patch(`/finance/ledger/${id}`, data),
  pay: (id: string, data: { amount: number; method: string; reference?: string; notes?: string }) =>
    apiClient.post(`/finance/ledger/${id}/pay`, data),
  getSummary: () => apiClient.get('/finance/ledger/summary'),
  getAging: (direction?: string) =>
    apiClient.get('/finance/ledger/aging', { params: direction ? { direction } : {} }),
  getOverdue: () => apiClient.get('/finance/ledger/overdue'),
  getStatement: (customerId: string) =>
    apiClient.get(`/finance/ledger/statement/${customerId}`),
};

// Nhà cung cấp / Đối tác
export const supplierApi = {
  list: () => apiClient.get('/finance/suppliers'),
  get: (id: string) => apiClient.get(`/finance/suppliers/${id}`),
  create: (data: unknown) => apiClient.post('/finance/suppliers', data),
  update: (id: string, data: unknown) => apiClient.patch(`/finance/suppliers/${id}`, data),
  getLedger: (id: string) => apiClient.get(`/finance/suppliers/${id}/ledger`),
  seedDefaults: () => apiClient.post('/finance/suppliers/seed-defaults', {}),
};

// Phase B: Dòng tiền thực tế
export const cashflowApi = {
  list: (params?: Record<string, string | number>) =>
    apiClient.get('/finance/cashflow', { params }),
  create: (data: unknown) => apiClient.post('/finance/cashflow', data),
  update: (id: string, data: unknown) => apiClient.patch(`/finance/cashflow/${id}`, data),
  remove: (id: string) => apiClient.delete(`/finance/cashflow/${id}`),
  getSummary: (dateFrom?: string, dateTo?: string) =>
    apiClient.get('/finance/cashflow/summary', { params: { dateFrom, dateTo } }),
  getMonthly: (year?: number) =>
    apiClient.get('/finance/cashflow/monthly', { params: year ? { year } : {} }),
  getByPic: () => apiClient.get('/finance/cashflow/by-pic'),
};

// Phase B: Chi phí vận hành
export const expenseApi = {
  list: (params?: Record<string, string | number>) =>
    apiClient.get('/finance/expenses', { params }),
  create: (data: unknown) => apiClient.post('/finance/expenses', data),
  update: (id: string, data: unknown) => apiClient.patch(`/finance/expenses/${id}`, data),
  remove: (id: string) => apiClient.delete(`/finance/expenses/${id}`),
  getSummary: (dateFrom?: string, dateTo?: string) =>
    apiClient.get('/finance/expenses/summary', { params: { dateFrom, dateTo } }),
  getMonthly: (year?: number) =>
    apiClient.get('/finance/expenses/monthly', { params: year ? { year } : {} }),
};

// Phase D: CRM Sales Pipeline
export const salesApi = {
  getPipeline: (salesPerson?: string) =>
    apiClient.get('/sales/pipeline', { params: salesPerson ? { salesPerson } : {} }),
  getAll: (salesPerson?: string, status?: string) =>
    apiClient.get('/sales', { params: { salesPerson, status } }),
  getOne: (id: string) => apiClient.get(`/sales/${id}`),
  getUpcoming: () => apiClient.get('/sales/upcoming'),
  create: (data: unknown) => apiClient.post('/sales', data),
  update: (id: string, data: unknown) => apiClient.patch(`/sales/${id}`, data),
  updateStatus: (id: string, status: string, notes?: string) =>
    apiClient.patch(`/sales/${id}/status`, { status, notes }),
  remove: (id: string) => apiClient.delete(`/sales/${id}`),
  seedSample: () => apiClient.post('/sales/seed-sample', {}),
};

// ==========================================
// SMART TICKET IMPORT
// ==========================================
export const ticketParserApi = {
  parseText: (text: string) =>
    apiClient.post('/tickets/parse/text', { text }),
  parseFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/tickets/parse/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ==========================================
// SHEET SYNC API
// ==========================================
export const sheetSyncApi = {
  getInfo: () => apiClient.get('/sheet-sync/info'),
  push: (data: { mode: 'APPEND' | 'REPLACE_ALL'; from?: string; to?: string; statuses?: string[] }) =>
    apiClient.post('/sheet-sync/push', data),
  preview: (startRow?: number, maxRows?: number) =>
    apiClient.get('/sheet-sync/preview', { params: { startRow, maxRows } }),
  importRows: (rowIndices: number[]) =>
    apiClient.post('/sheet-sync/import', { rowIndices }),
  exportUrl: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return `${apiClient.defaults.baseURL || 'http://localhost:3001/api/v1'}/sheet-sync/export?${params}`;
  },
};

