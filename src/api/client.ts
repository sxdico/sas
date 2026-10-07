import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fixpro_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('fixpro_token');
      localStorage.removeItem('fixpro_user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;

// ===== Auth API =====
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

// ===== Tenants API =====
export const tenantAPI = {
  list: () => api.get('/tenants'),
  create: (data: { name_taller: string; name_dueno: string; email: string; phone: string; plan?: string }) =>
    api.post('/tenants', data),
  suspend: (id: string) => api.put(`/tenants/${id}/suspend`),
  reactivate: (id: string) => api.put(`/tenants/${id}/reactivate`),
};

// ===== Users API =====
export const userAPI = {
  list: () => api.get('/users'),
  create: (data: { name: string; email: string; phone: string; role: string; password?: string }) =>
    api.post('/users', data),
  updateRole: (id: string, role: string) => api.put(`/users/${id}/role`, { role }),
  toggleActive: (id: string) => api.put(`/users/${id}/toggle-active`),
};

// ===== Products API =====
export const productAPI = {
  list: (params?: { search?: string; category_id?: string }) =>
    api.get('/products', { params }),
  lowStock: () => api.get('/products/low-stock'),
  get: (id: string) => api.get(`/products/${id}`),
  create: (data: Record<string, unknown>) => api.post('/products', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/products/${id}`, data),
  adjustStock: (id: string, data: { quantity: number; reason: string; type?: string }) =>
    api.put(`/products/${id}/stock`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  movements: (id: string) => api.get(`/products/${id}/movements`),
  categories: () => api.get('/products/categories/all'),
};

// ===== Orders API =====
export const orderAPI = {
  list: () => api.get('/orders'),
  get: (id: string) => api.get(`/orders/${id}`),
  create: (data: Record<string, unknown>) => api.post('/orders', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/orders/${id}`, data),
  updateStatus: (id: string, status: string) =>
    api.put(`/orders/${id}/status`, { status }),
  addPart: (orderId: string, data: { product_id: string; quantity: number }) =>
    api.post(`/orders/${orderId}/parts`, data),
  delete: (id: string) => api.delete(`/orders/${id}`),
};

// ===== Sales API =====
export const saleAPI = {
  list: () => api.get('/sales'),
  get: (id: string) => api.get(`/sales/${id}`),
  create: (data: {
    items: Array<{ product_id?: string; name: string; price: number; quantity: number; discount?: number }>;
    payment_method: string;
    cash_received?: number;
    customer_id?: string;
    discount?: number;
  }) => api.post('/sales', data),
};

// ===== Deliveries API =====
export const deliveryAPI = {
  ready: () => api.get('/deliveries/ready'),
  deliver: (id: string) => api.put(`/deliveries/${id}/deliver`),
};

// ===== Notifications API =====
export const notificationAPI = {
  list: () => api.get('/notifications'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
};
