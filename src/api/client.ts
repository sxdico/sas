import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fixpro_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('fixpro_token');
      localStorage.removeItem('fixpro_user');
      localStorage.removeItem('fixpro_license');
      window.location.href = '/';
    }
    if (error.response?.data?.code === 'LICENSE_EXPIRED') {
      // No cerramos sesión, solo mostramos error, el banner ya está
      console.warn('Licencia vencida - solo lectura');
    }
    return Promise.reject(error);
  }
);

export default api;

export const authAPI = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

export const tenantAPI = {
  list: () => api.get('/tenants'),
  create: (data: any) => api.post('/tenants', data),
  suspend: (id: string) => api.put(`/tenants/${id}/suspend`),
  reactivate: (id: string) => api.put(`/tenants/${id}/reactivate`),
  delete: (id: string) => api.delete(`/tenants/${id}`),
  listUsers: (tenantId: string) => api.get(`/tenants/${tenantId}/users`),
  resetUserPassword: (userId: string, newPassword?: string) => api.put(`/tenants/users/${userId}/reset-password`, { newPassword }),
  renewPlan: (id: string, data: { plan: string; add_days: number; custom_price?: number }) => api.put(`/tenants/${id}/renew`, data),
};

export const userAPI = {
  list: () => api.get('/users'),
  create: (data: any) => api.post('/users', data),
  updateRole: (id: string, role: string) => api.put(`/users/${id}/role`, { role }),
  toggleActive: (id: string) => api.put(`/users/${id}/toggle-active`),
  resetPassword: (id: string, newPassword?: string) => api.put(`/users/${id}/reset-password`, { newPassword }),
};
export const broadcastAPI = {
  list: () => api.get('/broadcasts'),
  preview: (params: any) => api.get('/broadcasts/preview', { params }),
  create: (data: any) => api.post('/broadcasts', data),
  delete: (id: string) => api.delete(`/broadcasts/${id}`),
};

export const productAPI = {
  list: (params?: any) => api.get('/products', { params }),
  lowStock: () => api.get('/products/low-stock'),
  get: (id: string) => api.get(`/products/${id}`),
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.put(`/products/${id}`, data),
  adjustStock: (id: string, data: any) => api.put(`/products/${id}/stock`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  movements: (id: string) => api.get(`/products/${id}/movements`),
  categories: () => api.get('/products/categories/all'),
};

export const orderAPI = {
  list: () => api.get('/orders'),
  get: (id: string) => api.get(`/orders/${id}`),
  create: (data: any) => api.post('/orders', data),
  update: (id: string, data: any) => api.put(`/orders/${id}`, data),
  updateStatus: (id: string, status: string) => api.put(`/orders/${id}/status`, { status }),
  addPart: (orderId: string, data: any) => api.post(`/orders/${orderId}/parts`, data),
  delete: (id: string) => api.delete(`/orders/${id}`),
  liquidate: (id: string, payment_method: string) => api.post(`/orders/${id}/liquidate`, { payment_method }),
  markPaid: (id: string) => api.put(`/orders/${id}/mark-paid`),
  removePart: (orderId: string, partId: string) => api.delete(`/orders/${orderId}/parts/${partId}`),
};

export const cashAPI = {
  current: () => api.get('/cash/current'),
  open: (opening_amount: number) => api.post('/cash/open', { opening_amount }),
  close: (data: any) => api.post('/cash/close', data),
  history: () => api.get('/cash/history'),
  get: (id: string) => api.get(`/cash/${id}`),

  // --- SALIDAS ---
  expenses: () => api.get('/cash/expenses'),
  createExpense: (data: any) => {
    if (data instanceof FormData) {
      return api.post('/cash/expenses', data, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return api.post('/cash/expenses', data);
  },
  deleteExpense: (id: string) => api.delete(`/cash/expenses/${id}`),

  // --- ENTRADAS (NUEVO) ---
  incomes: () => api.get('/cash/incomes'),
  createIncome: (data: any) => {
    if (data instanceof FormData) {
      return api.post('/cash/incomes', data, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return api.post('/cash/incomes', data);
  },
  deleteIncome: (id: string) => api.delete(`/cash/incomes/${id}`),
};

export const saleAPI = {
  list: () => api.get('/sales'),
  get: (id: string) => api.get(`/sales/${id}`),
  create: (data: any) => api.post('/sales', data),
};

export const deliveryAPI = {
  ready: () => api.get('/deliveries/ready'),
  deliver: (id: string) => api.put(`/deliveries/${id}/deliver`),
};

export const notificationAPI = {
  list: () => api.get('/notifications'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
};

export const evidenciaAPI = {
  list: (orden_id: string) => api.get(`/evidencias?orden_id=${orden_id}`),
  upload: (formData: FormData) => api.post('/evidencias', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: string) => api.delete(`/evidencias/${id}`),
};
