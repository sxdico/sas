import type { Role, OrderStatus } from '@/types';

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  owner: 'Dueño',
  technician: 'Técnico',
  secretary: 'Secretaria',
  cashier: 'Cajera',
};

export const ROLE_COLORS: Record<Role, string> = {
  super_admin: 'bg-ink-900 text-white',
  owner: 'bg-primary-600 text-white',
  technician: 'bg-accent-600 text-white',
  secretary: 'bg-success-600 text-white',
  cashier: 'bg-warning-500 text-ink-900',
};

export const PERMISSIONS = {
  pos: ['owner', 'technician', 'secretary', 'cashier'],
  orders: ['owner', 'technician'],
  ordersView: ['owner', 'technician'],
  deliveries: ['owner', 'secretary', 'cashier'],
  inventory: ['owner', 'technician'],
  reports: ['owner'],
  users: ['owner'],
  tenants: ['super_admin'],
  customers: ['owner', 'secretary', 'cashier', 'technician'],
} as const;

export function can(role: Role, permission: keyof typeof PERMISSIONS): boolean {
  if (role === 'super_admin') return permission === 'tenants';
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

export const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; dot: string }> = {
  por_revisar: { label: 'Por Revisar', color: 'bg-ink-100 text-ink-700', dot: 'bg-ink-400' },
  en_reparacion: { label: 'En Reparación', color: 'bg-primary-100 text-primary-700', dot: 'bg-primary-500' },
  esperando_refaccion: { label: 'Esperando Refacción', color: 'bg-warning-100 text-warning-700', dot: 'bg-warning-500' },
  listo: { label: 'Listo', color: 'bg-success-100 text-success-700', dot: 'bg-success-500' },
  entregado: { label: 'Entregado', color: 'bg-blue-100 text-slate-600 border border-blue-200', dot: 'bg-slate-500' },
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  credito: 'Crédito',
};

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

export function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(s: string): string {
  return new Date(s).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let result = '';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    result += chars[arr[i] % chars.length];
  }
  return result;
}

export function generateFolio(prefix: string, num: number): string {
  return `${prefix}-${String(num).padStart(3, '0')}`;
}