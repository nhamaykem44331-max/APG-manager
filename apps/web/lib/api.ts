import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api/v1',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Groq Vision calls can take 30-60s for large multi-pax PNRs — needs longer timeout
const parserClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api/v1',
  timeout: 90_000, // 90 seconds for Groq processing
  headers: {
    'Content-Type': 'application/json',
  },
});

const TOKEN_CACHE_TTL_MS = 7.5 * 60 * 60 * 1000;

let cachedToken: string | null = null;
let tokenExpiry = 0;
let pendingTokenRequest: Promise<string | null> | null = null;
let pendingUnauthorizedHandler: Promise<void> | null = null;

export function setAuthToken(token: string | null) {
  cachedToken = token;
  tokenExpiry = token ? Date.now() + TOKEN_CACHE_TTL_MS : 0;
  if (!token) {
    pendingTokenRequest = null;
  }
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

async function handleUnauthorized() {
  setAuthToken(null);

  if (typeof window === 'undefined') {
    return;
  }

  if (!pendingUnauthorizedHandler) {
    pendingUnauthorizedHandler = import('next-auth/react')
      .then(async ({ signOut }) => {
        if (window.location.pathname.startsWith('/auth/login')) {
          return;
        }

        await signOut({ redirect: false });
        window.location.replace('/auth/login?reason=session-expired');
      })
      .catch(() => {
        window.location.replace('/auth/login?reason=session-expired');
      })
      .finally(() => {
        pendingUnauthorizedHandler = null;
      });
  }

  return pendingUnauthorizedHandler;
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
      await handleUnauthorized();
    }

    return Promise.reject(error);
  },
);

// Attach same auth interceptors to parserClient
parserClient.interceptors.request.use(async (config) => {
  const token = cachedToken && Date.now() < tokenExpiry
    ? cachedToken
    : await getCachedSessionToken();
  return withAuthHeader(config, token);
});
parserClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await handleUnauthorized();
    }
    return Promise.reject(error);
  },
);

export default apiClient;

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  me: () => apiClient.get('/auth/me'),
  updateProfile: (data: { fullName?: string; email?: string; phone?: string }) =>
    apiClient.put('/auth/profile', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.put('/auth/change-password', data),
};

export const usersApi = {
  list: () => apiClient.get('/users'),
  create: (data: unknown) => apiClient.post('/users', data),
  update: (id: string, data: unknown) => apiClient.patch(`/users/${id}`, data),
};

export const dashboardApi = {
  getOverview: () => apiClient.get('/reports/dashboard-overview'),
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
  getNamedCredits: (params?: Record<string, string>) =>
    apiClient.get('/bookings/named-credits', { params }),
  getNamedCreditsSummary: () =>
    apiClient.get('/bookings/named-credits/summary'),
  applyCredit: (creditId: string, data: { bookingId: string; amount: number }) =>
    apiClient.post(`/bookings/named-credits/${creditId}/apply`, data),
  create: (data: unknown) => apiClient.post('/bookings', data),
  update: (id: string, data: unknown) => apiClient.patch(`/bookings/${id}`, data),
  updateStatus: (id: string, toStatus: string, reason?: string) =>
    apiClient.patch(`/bookings/${id}/status`, { toStatus, reason }),
  addTicket: (id: string, data: unknown) =>
    apiClient.post(`/bookings/${id}/tickets`, data),
  clearTickets: (id: string) =>
    apiClient.delete(`/bookings/${id}/tickets`),
  addPayment: (id: string, data: unknown) =>
    apiClient.post(`/bookings/${id}/payments`, data),
  addAdjustment: (id: string, data: {
    type: string;
    changeFee?: number;
    chargeToCustomer?: number;
    refundAmount?: number;
    airlineRefund?: number;
    penaltyFee?: number;
    apgServiceFee?: number;
    fundAccount?: string;
    passengerName?: string;
    expiryDate?: string;
    serviceCode?: string;
    notes?: string;
  }) =>
    apiClient.post(`/bookings/${id}/adjustments`, data),
  hardDelete: (id: string) =>
    apiClient.delete(`/bookings/${id}/permanent`),
};

export const customersApi = {
  list: (params?: Record<string, string | number>) =>
    apiClient.get('/customers', { params }),
  summary: () => apiClient.get('/customers/summary'),
  get: (id: string) => apiClient.get(`/customers/${id}`),
  create: (data: unknown) => apiClient.post('/customers', data),
  update: (id: string, data: unknown) => apiClient.patch(`/customers/${id}`, data),
  delete: (id: string) => apiClient.delete(`/customers/${id}`),
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
  updateDeposit: (
    id: string,
    data: {
      amount: number;
      notes?: string;
      fundAccount?: string;
      reference?: string;
      date?: string;
      pic?: string;
    },
  ) =>
    apiClient.patch(`/finance/deposits/${id}`, data),
  createDeposit: (data: { airline: string; alertThreshold?: number }) =>
    apiClient.post('/finance/deposits', data),
  getLedgerSummary: () => apiClient.get('/finance/ledger/summary'),
  getFundBalances: () => apiClient.get('/finance/cashflow/fund-balances'),
};

export const invoiceApi = {
  getSummary: () => apiClient.get('/finance/invoices/summary'),
  getCoverage: (params?: Record<string, string | number>) =>
    apiClient.get('/finance/invoices/coverage', { params }),
  list: (params?: Record<string, string | number>) =>
    apiClient.get('/finance/invoices', { params }),
  getDebtStatement: (params?: Record<string, string | number>) =>
    apiClient.get('/finance/invoices/debt-statement', { params }),
  get: (id: string) => apiClient.get(`/finance/invoices/${id}`),
  create: (data: unknown) => apiClient.post('/finance/invoices', data),
  createIncomingFromBookings: (data: {
    bookingIds: string[];
    invoiceDate?: string;
    periodFrom?: string;
    periodTo?: string;
    notes?: string;
    tags?: string[];
  }) => apiClient.post('/finance/invoices/incoming-from-bookings', data),
  createOutgoingFromBookings: (data: {
    bookingIds: string[];
    invoiceDate?: string;
    periodFrom?: string;
    periodTo?: string;
    notes?: string;
    tags?: string[];
  }) => apiClient.post('/finance/invoices/outgoing-from-bookings', data),
  update: (id: string, data: unknown) => apiClient.patch(`/finance/invoices/${id}`, data),
  addAttachment: (id: string, data: unknown) =>
    apiClient.post(`/finance/invoices/${id}/attachments`, data),
  getImportBatches: (params?: Record<string, string | number>) =>
    apiClient.get('/finance/invoices/import-batches', { params }),
  getImportBatch: (id: string) => apiClient.get(`/finance/invoices/import-batches/${id}`),
  uploadImportBatch: (data: {
    file: File;
    supplierId?: string;
    notes?: string;
    externalUrl?: string;
  }) => {
    const formData = new FormData();
    formData.append('file', data.file);
    if (data.supplierId) {
      formData.append('supplierId', data.supplierId);
    }
    if (data.notes) {
      formData.append('notes', data.notes);
    }
    if (data.externalUrl) {
      formData.append('externalUrl', data.externalUrl);
    }
    return apiClient.post('/finance/invoices/import-batches/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  reviewImportBatch: (id: string, data: unknown) =>
    apiClient.patch(`/finance/invoices/import-batches/${id}/review`, data),
  commitImportBatch: (id: string) =>
    apiClient.post(`/finance/invoices/import-batches/${id}/commit`, {}),
  getExportBatches: (params?: Record<string, string | number>) =>
    apiClient.get('/finance/invoices/export-batches', { params }),
  createDebtStatementExport: (data: { customerId: string; dateFrom: string; dateTo: string }) =>
    apiClient.post('/finance/invoices/export-batches/debt-statement', data),
  createOutgoingRequestExport: (data: { invoiceId: string }) =>
    apiClient.post('/finance/invoices/export-batches/outgoing-request', data),
  downloadExportBatch: (id: string) =>
    apiClient.get(`/finance/invoices/export-batches/${id}/download`, {
      responseType: 'blob',
    }),
};

export const fundsApi = {
  getSummary: () => apiClient.get('/finance/funds/summary'),
  listLedger: (params?: Record<string, string | number>) =>
    apiClient.get('/finance/funds/ledger', { params }),
  createEntry: (data: unknown) => apiClient.post('/finance/funds/entry', data),
  updateEntry: (id: string, data: unknown) => apiClient.patch(`/finance/funds/entry/${id}`, data),
  removeEntry: (id: string) => apiClient.delete(`/finance/funds/entry/${id}`),
  adjustBalance: (data: unknown) => apiClient.post('/finance/funds/adjust', data),
  transfer: (data: unknown) => apiClient.post('/finance/funds/transfer', data),
  updateTransfer: (id: string, data: unknown) => apiClient.patch(`/finance/funds/transfer/${id}`, data),
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
  pay: (id: string, data: { amount: number; method: string; fundAccount?: string; reference?: string; paidAt?: string; notes?: string }) =>
    apiClient.post(`/finance/ledger/${id}/pay`, data),
  payBatch: (data: {
    ledgerIds: string[];
    amount: number;
    method: string;
    fundAccount?: string;
    reference?: string;
    paidAt?: string;
    notes?: string;
  }) => apiClient.post('/finance/ledger/pay-batch', data),
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
    parserClient.post('/tickets/parse/text', { text }),
  parseFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return parserClient.post('/tickets/parse/file', formData, {
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
  previewExcel: (file: File, startRow?: number, maxRows?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/sheet-sync/excel/preview', formData, {
      params: { startRow, maxRows },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importExcel: (file: File, rowIndices: number[]) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('rowIndices', JSON.stringify(rowIndices));
    return apiClient.post('/sheet-sync/excel/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  exportUrl: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return `${apiClient.defaults.baseURL || 'http://localhost:3001/api/v1'}/sheet-sync/export?${params}`;
  },
};

export const systemApi = {
  resetOperationalData: (data: { adminEmail: string; adminPassword: string }) =>
    apiClient.post('/system/data/reset-operational', data, { timeout: 60_000 }),
};

// ==========================================
// AIRPORTS API (Cách 2 & 3 - DB Search + Distance)
// ==========================================
export interface AirportRecord {
  id: string;
  iata: string;
  icao?: string;
  name: string;
  nameVi?: string;
  region: string;
  countryCode: string;
  latitude: number;
  longitude: number;
}

export const airportsApi = {
  /** Cách 2: Full-text search by IATA, name, or city */
  search: (q: string, limit = 10) =>
    apiClient.get<{ data: AirportRecord[]; total: number }>('/airports/search', { params: { q, limit } }),
  /** Cách 3: Haversine distance + transit suggestions */
  distance: (origin: string, destination: string) =>
    apiClient.get<{ data: { distanceKm: number; estimatedFlightHours: number; transitSuggestions: { hub: string; route: string }[] } }>(
      '/airports/distance', { params: { origin, destination } },
    ),
};

// ==========================================
// DOCUMENTS API (PDF: Hóa đơn, Báo giá, Phiếu thu/chi)
// ==========================================
const docsBase = () => apiClient.defaults.baseURL || 'http://localhost:3001/api/v1';

export const documentsApi = {
  /** URL tải hóa đơn PDF */
  invoiceUrl: (bookingId: string) => `${docsBase()}/documents/invoice/${bookingId}`,
  /** URL tải báo giá PDF */
  quotationUrl: (bookingId: string) => `${docsBase()}/documents/quotation/${bookingId}`,
  /** URL tải phiếu thu PDF */
  receiptUrl: (paymentId: string) => `${docsBase()}/documents/receipt/${paymentId}?type=THU`,
  /** URL tải phiếu chi PDF */
  voucherUrl: (cashflowId: string) => `${docsBase()}/documents/receipt/${cashflowId}?type=CHI`,
};
