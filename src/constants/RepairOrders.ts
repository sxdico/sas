import type { RepairOrder, OrderStatus } from '@/types';
import { formatDateTime } from '@/utils/permissions';

// ================= PRIORIDAD =================
export const PRIORITY_CONFIG = {
  baja: { label: 'Baja', emoji: '🔵', color: 'bg-gray-100 text-gray-600 border border-gray-200', dot: 'bg-gray-400', ring: '' },
  normal: { label: 'Normal', emoji: '⚪', color: 'bg-blue-50 text-blue-700 border border-blue-200', dot: 'bg-blue-500', ring: '' },
  alta: { label: 'Alta', emoji: '🟠', color: 'bg-orange-100 text-orange-700 border border-orange-200', dot: 'bg-orange-500', ring: '' },
  urgente: { label: 'Urgente', emoji: '🔴', color: 'bg-red-100 text-red-700 border border-red-300', dot: 'bg-red-600', ring: 'ring-2 ring-red-200' },
  garantia: { label: 'Garantía', emoji: '🛡', color: 'bg-purple-100 text-purple-700 border border-purple-200', dot: 'bg-purple-600', ring: '' },
} as const;

export type Priority = keyof typeof PRIORITY_CONFIG;
export const PRIORITY_ORDER: Priority[] = ['urgente','garantia','alta','normal','baja'];

export function getPriorityInfo(order: any) {
  const p = (order.priority || 'normal') as Priority;
  return PRIORITY_CONFIG[p] || PRIORITY_CONFIG.normal;
}

// ================= ESTADOS / KANBAN =================
export const COLUMN_ORDER: OrderStatus[] = ['por_revisar', 'en_reparacion', 'esperando_refaccion', 'listo', 'entregado'];

// Unificado: sirve para kanban y para tabla historial
export const ORDER_STATUS_FULL: Record<OrderStatus, { label: string; color: string; dot: string; text: string; border: string }> = {
  por_revisar: { label: 'Por Revisar', color: 'bg-ink-100 text-ink-700', dot: 'bg-ink-400', text: 'text-red-600', border: 'bg-red-500' },
  en_reparacion: { label: 'En Reparación', color: 'bg-primary-100 text-primary-700', dot: 'bg-primary-500', text: 'text-orange-600', border: 'bg-orange-500' },
  esperando_refaccion: { label: 'Esperando Refacción', color: 'bg-warning-100 text-warning-700', dot: 'bg-warning-500', text: 'text-yellow-600', border: 'bg-yellow-500' },
  listo: { label: 'Listo', color: 'bg-success-100 text-success-700', dot: 'bg-success-500', text: 'text-blue-600', border: 'bg-blue-500' },
  entregado: { label: 'Entregado', color: 'bg-blue-100 text-slate-600 border border-blue-200', dot: 'bg-slate-500', text: 'text-green-600', border: 'bg-green-500' },
};

// Para compatibilidad con RepairsPage que usa estadoConfig con label en minúsculas
export const estadoConfig = {
  por_revisar: { label: 'pendiente', dot: 'bg-red-500', text: 'text-red-600', border: 'bg-red-500' },
  en_reparacion: { label: 'en reparación', dot: 'bg-orange-500', text: 'text-orange-600', border: 'bg-orange-500' },
  esperando_refaccion: { label: 'esperando refacción', dot: 'bg-yellow-500', text: 'text-yellow-600', border: 'bg-yellow-500' },
  listo: { label: 'listo', dot: 'bg-blue-500', text: 'text-blue-600', border: 'bg-blue-500' },
  entregado: { label: 'entregado', dot: 'bg-green-500', text: 'text-green-600', border: 'bg-green-500' },
};

// ================= BLOQUEO =================
export const LOCK_TYPES = ['Sin bloqueo','Patrón','PIN','Contraseña','Cuenta Google','iCloud','MDM','Otro'];
export const LOCK_TYPES_WITH_CODE = ['PIN','Contraseña'];

// ================= HELPERS =================
export function getWarrantyInfo(order: RepairOrder) {
  if ((order as any).warranty_value === 0) return { expired: false, days: 0, text: 'Sin garantía', noWarranty: true } as any;
  if (!order.warranty_ends_at) return null;
  const endDate = new Date(order.warranty_ends_at);
  const today = new Date();
  const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { expired: true, days: Math.abs(diffDays), text: `Vencida hace ${Math.abs(diffDays)} días` };
  if (diffDays === 0) return { expired: false, days: 0, text: 'Vence hoy' };
  return { expired: false, days: diffDays, text: `${diffDays} días restantes` };
}

export function getPagoInfo(order: RepairOrder) {
  const total = parseFloat(String(order.total || 0));
  const anticipo = parseFloat(String(order.advance_payment || 0));
  const resto = total - anticipo;
  const pagado = resto <= 0 && total > 0;
  return { total, anticipo, resto, pagado, saldo: resto };
}

export function getPromisedInfo(order: RepairOrder) {
  if (!order.promised_at) return null;
  const promised = new Date(order.promised_at);
  const now = new Date();
  const diffMs = promised.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isOverdue = diffMs < 0 && !['listo','entregado'].includes(order.status);
  const isToday = diffDays === 0 && diffMs >= 0;
  const isTomorrow = diffDays === 1;
  let text = ''; let color = '';
  if (isOverdue) { const absDays = Math.abs(diffDays); text = absDays === 0 ? '¡Vencida hoy!' : `¡Vencida hace ${absDays} día${absDays>1?'s':''}!`; color = 'red'; }
  else if (isToday) { text = `Vence hoy ${promised.toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})}`; color = 'amber'; }
  else if (isTomorrow) { text = 'Vence mañana'; color = 'amber'; }
  else if (diffDays > 0 && diffDays <= 2) { text = `Vence en ${diffDays} días`; color = 'blue'; }
  else if (diffDays > 0) { text = `${diffDays} días restantes`; color = 'gray'; }
  else { text = formatDateTime(order.promised_at); color = 'gray'; }
  return { overdue: isOverdue, isToday, isTomorrow, diffDays, text, color, date: promised };
}

// Navegación a caja centralizada
export function goToCaja(onNavigate?: (page: string) => void) {
  if (onNavigate) onNavigate('caja');
  window.location.hash = '#caja';
}
