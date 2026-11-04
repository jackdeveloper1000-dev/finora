import http from './http';

const unwrap = (promise) => promise.then((res) => res.data);

export const authApi = {
  register: (payload) => unwrap(http.post('/auth/register', payload)),
  login: (payload) => unwrap(http.post('/auth/login', payload)),
  verifyMfa: (payload) => unwrap(http.post('/auth/mfa/verify', payload)),
  config: () => unwrap(http.get('/auth/config')),
  google: (credential) => unwrap(http.post('/auth/google', { credential })),
  verifyEmail: (payload) => unwrap(http.post('/auth/verify-email', payload)),
  resendCode: (email) => http.post('/auth/resend-code', { email }),
  forgotPassword: (email) => http.post('/auth/forgot-password', { email }),
  resetPassword: (payload) => http.post('/auth/reset-password', payload),
  logout: () => http.post('/auth/logout'),
  logoutAll: () => http.post('/auth/logout-all'),
};

export const profileApi = {
  get: () => unwrap(http.get('/profile')),
  save: (payload) => unwrap(http.put('/profile', payload)),
};

export const casesApi = {
  list: () => unwrap(http.get('/cases')),
  get: (id) => unwrap(http.get(`/cases/${id}`)),
  remove: (id) => http.delete(`/cases/${id}`),
  years: () => unwrap(http.get('/cases/years')),
  create: (assessmentYear) => unwrap(http.post('/cases', { assessmentYear })),
};

export const documentsApi = {
  list: (caseId) => unwrap(http.get(`/cases/${caseId}/documents`)),
  upload: (caseId, { file, docType }, onProgress) => {
    const body = new FormData();
    body.append('docType', docType);
    body.append('file', file);
    return unwrap(
      http.post(`/cases/${caseId}/documents`, body, {
        timeout: 120000,
        onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
      }),
    );
  },
  remove: (id) => http.delete(`/documents/${id}`),
  link: (id) => unwrap(http.post(`/documents/${id}/link`)),
};

export const ledgerApi = {
  process: (documentId) => unwrap(http.post(`/documents/${documentId}/process`)),
  summary: (caseId) => unwrap(http.get(`/cases/${caseId}/ledger`)),
  transactions: (caseId, params) => unwrap(http.get(`/cases/${caseId}/transactions`, { params })),
};

export const classificationApi = {
  categories: () => unwrap(http.get('/categories')),
  similarCount: (id) => unwrap(http.get(`/transactions/${id}/similar`)),
  update: (id, payload) => unwrap(http.patch(`/transactions/${id}`, payload)),
  confirmHighConfidence: (caseId) => unwrap(http.post(`/cases/${caseId}/transactions/confirm-high-confidence`)),
};

export const reconcileApi = {
  facts: (caseId) => unwrap(http.get(`/cases/${caseId}/tax-facts`)),
  saveFacts: (caseId, source, payload) => unwrap(http.put(`/cases/${caseId}/tax-facts/${source}`, payload)),
  items: (caseId) => unwrap(http.get(`/cases/${caseId}/reconciliation`)),
  resolve: (id, payload) => http.patch(`/reconciliation/${id}`, payload),
};

export const taxApi = {
  eligibility: (caseId) => unwrap(http.get(`/cases/${caseId}/eligibility`)),
  saveEligibility: (caseId, answers) => unwrap(http.put(`/cases/${caseId}/eligibility`, { answers })),
  calculation: (caseId) => unwrap(http.get(`/cases/${caseId}/tax-calculation`)),
  calculate: (caseId) => unwrap(http.post(`/cases/${caseId}/tax-calculation`)),
  chooseRegime: (caseId, regime) => unwrap(http.put(`/cases/${caseId}/tax-regime`, { regime })),
};

export const itrApi = {
  get: (caseId) => unwrap(http.get(`/cases/${caseId}/itr`)),
  approve: (caseId, confirmations) => unwrap(http.post(`/cases/${caseId}/itr/approve`, { confirmations })),
  exportPackage: async (caseId) => {
    const res = await http.get(`/cases/${caseId}/itr/export`, { responseType: 'blob' });
    const name = /filename="([^"]+)"/.exec(res.headers['content-disposition'] ?? '')?.[1] ?? 'finora-return.json';
    return { blob: res.data, name };
  },
};

export const quickApi = {
  prepare: (caseId) => unwrap(http.post(`/cases/${caseId}/quick-prepare`, null, { timeout: 120000 })),
};

export const submissionApi = {
  get: (caseId) => unwrap(http.get(`/cases/${caseId}/filing-submission`)),
  record: (caseId, payload) => unwrap(http.post(`/cases/${caseId}/filing-submission`, payload)),
};

export const filingApi = {
  get: (caseId) => unwrap(http.get(`/cases/${caseId}/filing`)),
};

export const accountApi = {
  get: () => unwrap(http.get('/account')),
  rename: (name) => unwrap(http.put('/account', { name })),
  savePreferences: (prefs) => unwrap(http.put('/account/preferences', prefs)),
  exportData: async () => {
    const res = await http.get('/account/export', { responseType: 'blob' });
    return { blob: res.data, name: 'finora-my-data.json' };
  },
  clearData: (password) => http.post('/account/clear-data', { password }),
  deleteAccount: (password) => http.post('/account/delete', { password }),
};

export const securityApi = {
  changePassword: (payload) => http.post('/auth/password', payload),
  sessions: () => unwrap(http.get('/auth/sessions')),
  revokeSession: (id) => http.delete(`/auth/sessions/${id}`),
  mfaSetup: () => unwrap(http.post('/auth/mfa/setup')),
  mfaEnable: (code) => unwrap(http.post('/auth/mfa/enable', { code })),
  mfaDisable: (payload) => http.post('/auth/mfa/disable', payload),
};

export const notificationsApi = {
  list: () => unwrap(http.get('/notifications')),
  unread: () => unwrap(http.get('/notifications/unread-count')),
  markRead: (id) => http.patch(`/notifications/${id}/read`),
  markAllRead: () => http.post('/notifications/read-all'),
};

export const historyApi = {
  list: () => unwrap(http.get('/history')),
};

export const reviewApi = {
  get: (caseId) => unwrap(http.get(`/cases/${caseId}/review`)),
  request: (caseId, note) => unwrap(http.post(`/cases/${caseId}/review`, { note })),
  reply: (caseId, body) => unwrap(http.post(`/cases/${caseId}/review/messages`, { body })),
  cancel: (caseId) => unwrap(http.post(`/cases/${caseId}/review/cancel`)),
};

export const expertApi = {
  queue: (scope) => unwrap(http.get('/expert/reviews', { params: { scope } })),
  get: (id) => unwrap(http.get(`/expert/reviews/${id}`)),
  claim: (id) => unwrap(http.post(`/expert/reviews/${id}/claim`)),
  message: (id, body) => unwrap(http.post(`/expert/reviews/${id}/messages`, { body })),
  decide: (id, payload) => unwrap(http.post(`/expert/reviews/${id}/decision`, payload)),
};
