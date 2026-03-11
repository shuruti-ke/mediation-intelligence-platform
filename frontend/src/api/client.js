import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // FormData must not have Content-Type set - browser adds multipart boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
  register: (data) => api.post('/auth/register', data),
};

export const cases = {
  list: (params) => api.get('/cases', { params }),
  get: (id) => api.get(`/cases/${id}`),
  create: (data) => api.post('/cases', data),
  update: (id, data) => api.patch(`/cases/${id}`, data),
  getLocations: (country = 'KE') => api.get('/cases/locations', { params: { country } }),
};

export const sessions = {
  create: (data) => api.post('/sessions', data),
  get: (id) => api.get(`/sessions/${id}`),
  getRoom: (id) => api.get(`/sessions/${id}/room`),
  start: (id) => api.post(`/sessions/${id}/start`),
  end: (id) => api.post(`/sessions/${id}/end`),
  listForCase: (caseId) => api.get(`/sessions/case/${caseId}`),
};

export const recordings = {
  start: (sessionId, consentConfirmed) =>
    api.post(`/sessions/${sessionId}/recording/start`, { consent_confirmed: consentConfirmed }),
  stop: (sessionId) => api.post(`/sessions/${sessionId}/recording/stop`),
};

export const caucus = {
  getRoom: (sessionId, party) => api.post(`/sessions/${sessionId}/caucus?party=${party}`),
};

export const billing = {
  getUsage: (params) => api.get('/billing/usage', { params }),
};

export const documents = {
  upload: (formData) => api.post('/documents/upload', formData),
  get: (id) => api.get(`/documents/${id}`),
};

export const knowledge = {
  ingest: (file, title, visibility = 'private') => {
    const fd = new FormData();
    fd.append('file', file);
    if (title) fd.append('title', title);
    fd.append('visibility', visibility);
    return api.post('/knowledge/ingest', fd);
  },
  ingestOrg: (file, title) => {
    const fd = new FormData();
    fd.append('file', file);
    if (title) fd.append('title', title);
    return api.post('/knowledge/org/ingest', fd);
  },
  search: (q, scope = 'all') => api.get('/knowledge/search', { params: { q, scope } }),
  query: (query, scope = 'all') => api.post('/knowledge/query', { query, scope }),
  listDocuments: (scope = 'all') => api.get('/knowledge/documents', { params: { scope } }),
  listOrgDocuments: () => api.get('/knowledge/org/documents'),
  deleteDocument: (id) => api.delete(`/knowledge/documents/${id}`),
};

export const judiciary = {
  search: (query, region) => api.post('/judiciary/search', { query, region }),
  sources: () => api.get('/judiciary/sources'),
};

// Public API (no auth required)
const publicApi = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export const publicApiClient = {
  awareness: () => publicApi.get('/public/awareness'),
  shouldIMediate: (data) => publicApi.post('/public/should-i-mediate', data),
  freeTierInfo: () => publicApi.get('/public/free-tier'),
  freeTierCheck: (email) => publicApi.get('/public/free-tier/check', { params: { email } }),
};

export const bookingsApi = {
  create: (data) => api.post('/bookings', data),
  list: (params) => api.get('/bookings', { params }),
  confirm: (id, caseId) => api.post(`/bookings/${id}/confirm`, null, { params: { case_id: caseId } }),
};

export const mediatorsApi = {
  match: (params) => api.get('/mediators/match', { params }),
};

export const paymentsApi = {
  createInvoice: (data) => api.post('/payments/invoices', data),
  initPayment: (data) => api.post('/payments/init', data),
  listInvoices: (params) => api.get('/payments/invoices', { params }),
};

export const trainingApi = {
  listModules: () => api.get('/training/modules'),
  getModule: (id) => api.get(`/training/modules/${id}`),
  updateProgress: (id, data) => api.put(`/training/modules/${id}/progress`, data),
  respondToStep: (moduleId, data) => api.post(`/training/modules/${moduleId}/respond`, data),
  getCpd: (year) => api.get('/training/cpd', year ? { params: { year } } : {}),
  getReflection: () => api.get('/training/reflection'),
  generateRolePlay: (data) => api.post('/training/role-play/generate', data),
  listRolePlays: () => api.get('/training/role-play'),
};

export const auditApi = {
  listLogs: (params) => api.get('/audit/logs', { params }),
};

export const tenantsApi = {
  list: () => api.get('/tenants'),
  create: (data) => api.post('/tenants', data),
};

export const usersApi = {
  list: (params) => api.get('/users', { params }),
  get: (id) => api.get(`/users/${id}`),
  onboard: (data) => api.post('/users', data),
  intake: (data) => api.post('/users/intake', data),
  updateStatus: (id, data) => api.patch(`/users/${id}`, data),
  reassignMediator: (userId, data) => api.post(`/users/${userId}/reassign-mediator`, data),
};

export const analyticsApi = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getTimeseries: (months = 12) => api.get('/analytics/timeseries', { params: { months } }),
  getGeographic: () => api.get('/analytics/geographic'),
  getMediators: () => api.get('/analytics/mediators'),
  getUnresolvedCases: (days = 30) => api.get('/analytics/reports/unresolved', { params: { days } }),
  getAfricaMetrics: () => api.get('/analytics/africa'),
};

export const calendarApi = {
  listAvailability: (params) => api.get('/calendar/availability', { params }),
  createAvailability: (data) => api.post('/calendar/availability', data),
  deleteAvailability: (id) => api.delete(`/calendar/availability/${id}`),
  listBookings: (params) => api.get('/calendar/bookings', { params }),
  createBooking: (data) => api.post('/calendar/bookings', data),
  updateBookingStatus: (id, status) => api.patch(`/calendar/bookings/${id}`, null, { params: { status } }),
  listMediators: () => api.get('/calendar/mediators'),
};
