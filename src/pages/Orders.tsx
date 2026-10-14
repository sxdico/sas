import { useState, useMemo, useEffect } from 'react';
import { orderAPI, productAPI, evidenciaAPI } from '@/api/client'
import { LicenseExpiredBanner } from '@/components/LicenseBanner'
import { useAuth } from '@/context/AuthContext'
import { ORDER_STATUS_CONFIG, formatCurrency, formatDateTime } from '@/utils/permissions';
import type { RepairOrder, OrderStatus, Product } from '@/types';
import {
  Plus, X, Phone, Wrench, Clock, Package, FileText,
  Check, DollarSign, Shield, Lock, Calendar, Trash2, Wallet, ChevronRight, Camera, Upload, KeyRound, Eye, EyeOff, Ban, Search, Filter, Smartphone, Hash
} from 'lucide-react';

const COLUMN_ORDER: OrderStatus[] = ['por_revisar', 'en_reparacion', 'esperando_refaccion', 'listo', 'entregado'];
const PRIORITY_CONFIG = {
  baja: { label: 'Baja', emoji: '🔵', color: 'bg-gray-100 text-gray-600 border border-gray-200', dot: 'bg-gray-400', ring: '' },
  normal: { label: 'Normal', emoji: '⚪', color: 'bg-blue-50 text-blue-700 border border-blue-200', dot: 'bg-blue-500', ring: '' },
  alta: { label: 'Alta', emoji: '🟠', color: 'bg-orange-100 text-orange-700 border border-orange-200', dot: 'bg-orange-500', ring: '' },
  urgente: { label: 'Urgente', emoji: '🔴', color: 'bg-red-100 text-red-700 border border-red-300', dot: 'bg-red-600', ring: 'ring-2 ring-red-200' },
  garantia: { label: 'Garantía', emoji: '🛡️', color: 'bg-purple-100 text-purple-700 border border-purple-200', dot: 'bg-purple-600', ring: '' },
} as const;
type Priority = keyof typeof PRIORITY_CONFIG;
const PRIORITY_ORDER: Priority[] = ['urgente','garantia','alta','normal','baja'];

function getPriorityInfo(order: any) {
  const p = (order.priority || 'normal') as Priority;
  return PRIORITY_CONFIG[p] || PRIORITY_CONFIG.normal;
}

const LOCK_TYPES = ['Sin bloqueo','Patrón','PIN','Contraseña','Cuenta Google','iCloud','MDM','Otro'];
const LOCK_TYPES_WITH_CODE = ['PIN','Contraseña'];

function getWarrantyInfo(order: RepairOrder) {
  // Si es 0 días = sin garantía
  if ((order as any).warranty_value === 0) return { expired: false, days: 0, text: 'Sin garantía', noWarranty: true } as any;
  if (!order.warranty_ends_at) return null;
  const endDate = new Date(order.warranty_ends_at);
  const today = new Date();
  const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { expired: true, days: Math.abs(diffDays), text: `Vencida hace ${Math.abs(diffDays)} días` };
  if (diffDays === 0) return { expired: false, days: 0, text: 'Vence hoy' };
  return { expired: false, days: diffDays, text: `${diffDays} días restantes` };
}

function getPagoInfo(order: RepairOrder) {
  const total = parseFloat(String(order.total || 0));
  const anticipo = parseFloat(String(order.advance_payment || 0));
  const resto = total - anticipo;
  const pagado = resto <= 0 && total > 0;
  return { total, anticipo, resto, pagado };
}

function getPromisedInfo(order: RepairOrder) {
  if (!order.promised_at) return null;
  const promised = new Date(order.promised_at);
  const now = new Date();
  const diffMs = promised.getTime() - now.getTime();
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isOverdue = diffMs < 0 && !['listo','entregado'].includes(order.status);
  const isToday = diffDays === 0 && diffMs >= 0;
  const isTomorrow = diffDays === 1;
  
  let text = '';
  let color = '';
  if (isOverdue) {
    const absDays = Math.abs(diffDays);
    text = absDays === 0 ? '¡Vencida hoy!' : `¡Vencida hace ${absDays} día${absDays>1?'s':''}!`;
    color = 'red';
  } else if (isToday) {
    text = `Vence hoy ${promised.toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})}`;
    color = 'amber';
  } else if (isTomorrow) {
    text = 'Vence mañana';
    color = 'amber';
  } else if (diffDays > 0 && diffDays <= 2) {
    text = `Vence en ${diffDays} días`;
    color = 'blue';
  } else if (diffDays > 0) {
    text = `${diffDays} días restantes`;
    color = 'gray';
  } else {
    text = formatDateTime(order.promised_at);
    color = 'gray';
  }
  
  return { overdue: isOverdue, isToday, isTomorrow, diffHours, diffDays, text, color, date: promised };
}

interface OrdersProps {
  onStatusChange?: (orderId: string, status: OrderStatus) => void;
  onNavigate?: (page: string) => void;
}

export default function Orders({ onStatusChange, onNavigate }: OrdersProps) {
  const { license, isReadOnly } = useAuth();
  const [orders, setOrders] = useState<RepairOrder[]>([]);
  const [apiProducts, setApiProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<RepairOrder | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<OrderStatus | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'todas'>('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<'todos'|'sin_pagar'|'sin_garantia'|'con_bloqueo'|'vencidas'>('todos');

  const goToPOS = () => { if (onNavigate) onNavigate('pos'); };

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordsRes, prodsRes] = await Promise.all([ orderAPI.list(), productAPI.list() ]);
      setOrders(ordsRes.data.orders || ordsRes.data || []);
      setApiProducts(prodsRes.data.products || prodsRes.data || []);
    } catch (e: any) {
      console.error('Error cargando órdenes', e.response?.data || e.message);
      setOrders([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const ordersByStatus = useMemo(() => {
    const map: Record<OrderStatus, RepairOrder[]> = { por_revisar: [], en_reparacion: [], esperando_refaccion: [], listo: [], entregado: [] } as any;
    let filtered = [...orders];

    // Buscador por folio, cliente, telefono, marca, modelo, imei, problema
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((o:any) => {
        return (
          (o.folio || '').toLowerCase().includes(q) ||
          (o.customer_name || '').toLowerCase().includes(q) ||
          (o.customer_phone || '').toLowerCase().includes(q) ||
          (o.device_brand || '').toLowerCase().includes(q) ||
          (o.device_model || '').toLowerCase().includes(q) ||
          (o.device_type || '').toLowerCase().includes(q) ||
          (o.problem_description || '').toLowerCase().includes(q) ||
          (o.imei || '').toLowerCase().includes(q) ||
          (o.technician_name || '').toLowerCase().includes(q)
        );
      });
    }

    // Filtro prioridad
    if (priorityFilter !== 'todas') {
      filtered = filtered.filter((o:any) => (o.priority || 'normal') === priorityFilter);
    }

    // Filtros rapidos pro
    if (quickFilter !== 'todos') {
      filtered = filtered.filter((o:any) => {
        if (quickFilter === 'sin_pagar') {
          const total = parseFloat(o.total || 0);
          const adv = parseFloat(o.advance_payment || 0);
          return total > 0 && (total - adv) > 0;
        }
        if (quickFilter === 'sin_garantia') {
          return parseInt(o.warranty_value) === 0;
        }
        if (quickFilter === 'con_bloqueo') {
          return o.lock_type && o.lock_type !== 'Sin bloqueo';
        }
        if (quickFilter === 'vencidas') {
          if (!o.promised_at) return false;
          const promised = new Date(o.promised_at);
          const now = new Date();
          return promised < now && !['listo','entregado'].includes(o.status);
        }
        return true;
      });
    }

    // Sort by priority then promised_at
    const sorted = [...filtered].sort((a:any,b:any) => {
      const pa = PRIORITY_ORDER.indexOf((a.priority || 'normal') as Priority);
      const pb = PRIORITY_ORDER.indexOf((b.priority || 'normal') as Priority);
      if (pa !== pb) return pa - pb;
      if (a.promised_at && b.promised_at) return new Date(a.promised_at).getTime() - new Date(b.promised_at).getTime();
      return 0;
    });
    sorted.forEach((o) => { if (map[o.status]) map[o.status].push(o); });
    return map;
  }, [orders, priorityFilter, searchQuery, quickFilter]);

  const handleDrop = async (status: OrderStatus) => {
    if (isReadOnly) { alert('Licencia vencida - Solo lectura. Contacta a soporte para renovar.'); return; }
    if (!draggingId) return;
    const order = orders.find((o) => o.id === draggingId);
    if (!order) return;
    const prevStatus = order.status;
    setOrders((prev) => prev.map((o) => o.id === draggingId? {...o, status, ready_at: status === 'listo'? new Date().toISOString() : o.ready_at, delivered_at: status === 'entregado'? new Date().toISOString() : o.delivered_at } as any : o));
    try {
      await orderAPI.updateStatus(order.id, status);
      onStatusChange?.(order.id, status);
      if (status === 'entregado') loadData();
    } catch { setOrders((prev) => prev.map((o) => o.id === order.id? {...o, status: prevStatus } : o)); }
    setDraggingId(null); setDragOverCol(null);
  };

  const handleCreateOrder = async (formData: any, fotosIngreso: File[] = []) => {
    if (isReadOnly) { alert('Licencia vencida - No puedes crear órdenes.'); return; }
    try {
      const res = await orderAPI.create(formData);
      const order = res.data.order;
      if (fotosIngreso && fotosIngreso.length > 0) {
        for (const file of fotosIngreso) {
          const fd = new FormData();
          fd.append('foto', file);
          fd.append('orden_id', order.id);
          fd.append('tipo', 'ingreso');
          fd.append('nota', 'Foto al ingreso - creación');
          try { await evidenciaAPI.upload(fd); } catch (e) { console.error('Error subiendo foto ingreso', e); }
        }
      }
      setShowCreate(false);
      await loadData();
      if (formData.advance_payment && parseFloat(formData.advance_payment) > 0) {
        const pending = {
          folio: order.folio, orderId: order.id, customer: formData.customer_name,
          device: `${formData.device_brand} ${formData.device_model || ''}`.trim(),
          amount: formData.advance_payment, method: formData.payment_method_anticipo || 'efectivo', type: 'anticipo'
        };
        localStorage.setItem('pendingAnticipo', JSON.stringify(pending));
        goToPOS();
      }
    } catch (err: any) { alert(err.response?.data?.error || 'Error creando orden'); }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm('¿Seguro que quieres eliminar esta orden?')) return;
    try { await orderAPI.delete(id); setSelectedOrder(null); await loadData(); }
    catch (err: any) { alert(err.response?.data?.error || 'Error eliminando'); }
  };

  const handlePagarRestoPOS = (order: RepairOrder) => {
    const { resto } = getPagoInfo(order);
    if (resto <= 0) return;
    const pending = {
      folio: order.folio, orderId: order.id, customer: order.customer_name,
      device: `${order.device_brand} ${order.device_model}`.trim(),
      amount: resto, method: 'efectivo', type: 'liquidacion'
    };
    localStorage.setItem('pendingAnticipo', JSON.stringify(pending));
    setSelectedOrder(null);
    goToPOS();
  };

  const handleRemovePart = async (orderId: string, partId: string) => {
    const partToRemove = (selectedOrder as any)?.OrderParts?.find((p: any) => p.id === partId) || (selectedOrder as any)?.parts_used?.find((p: any) => p.id === partId);
    if (!partToRemove) return;
    if (!confirm(`¿Quitar ${partToRemove.product_name} x${partToRemove.quantity}? Se regresará ${partToRemove.quantity}pz al inventario y se descontará del total.`)) return;
    try {
      const res = await orderAPI.removePart(orderId, partId);
      const updatedOrder = res.data.order;
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, cost_parts: updatedOrder.cost_parts, total: updatedOrder.total, OrderParts: (o as any).OrderParts?.filter((x: any) => x.id !== partId) } as any : o));
      setSelectedOrder(prev => {
        if (!prev) return null;
        return { ...prev, cost_parts: updatedOrder.cost_parts, total: updatedOrder.total, OrderParts: (prev as any).OrderParts?.filter((x: any) => x.id !== partId), parts_used: (prev as any).parts_used?.filter((x: any) => x.id !== partId) } as any;
      });
      setApiProducts(prev => prev.map(prod => prod.id === partToRemove.product_id ? { ...prod, stock: prod.stock + partToRemove.quantity } as any : prod));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error quitando refacción');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mr-3" />
        Cargando órdenes...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {license && <LicenseExpiredBanner license={license} />}
      <div className="px-4 md:px-6 py-3 bg-white border-b border-ink-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="Buscar folio, cliente, teléfono, equipo, IMEI..." className="input pl-9 h-9 text-sm w-full bg-gray-50 border-gray-200" />
              {searchQuery && <button onClick={()=>setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4"/></button>}
            </div>
            <p className="text-xs text-gray-500 hidden md:block">{Object.values(ordersByStatus).flat().length} de {orders.length}</p>
          </div>
          <button onClick={() => setShowCreate(true)} disabled={isReadOnly} className={`btn-primary ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}><Plus className="w-4 h-4" /> {isReadOnly ? 'Solo lectura' : 'Nueva orden'}</button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
            <button onClick={() => setPriorityFilter('todas')} className={`px-3 py-1 rounded-full text-xs font-bold transition ${priorityFilter==='todas' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>Todas</button>
            {(Object.keys(PRIORITY_CONFIG) as Priority[]).map(p => {
              const cfg = PRIORITY_CONFIG[p];
              return (
                <button key={p} onClick={() => setPriorityFilter(p)} className={`px-2.5 py-1 rounded-full text-xs font-bold transition flex items-center gap-1 ${priorityFilter===p ? cfg.color + ' shadow' : 'text-gray-500 hover:text-gray-700'}`}>
                  {cfg.emoji} {cfg.label}
                </button>
              )
            })}
          </div>
          <div className="h-6 w-px bg-gray-300 hidden md:block" />
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={() => setQuickFilter('todos')} className={`px-3 py-1 rounded-full text-xs font-bold border transition ${quickFilter==='todos' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>Todos</button>
            <button onClick={() => setQuickFilter('sin_pagar')} className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 transition ${quickFilter==='sin_pagar' ? 'bg-orange-600 text-white border-orange-600' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>💰 Sin pagar</button>
            <button onClick={() => setQuickFilter('sin_garantia')} className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 transition ${quickFilter==='sin_garantia' ? 'bg-gray-700 text-white border-gray-700' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>🚫 Sin garantía</button>
            <button onClick={() => setQuickFilter('con_bloqueo')} className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 transition ${quickFilter==='con_bloqueo' ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>🔒 Con bloqueo</button>
            <button onClick={() => setQuickFilter('vencidas')} className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 transition ${quickFilter==='vencidas' ? 'bg-red-600 text-white border-red-600' : 'bg-red-50 text-red-700 border-red-200'}`}>⏰ Vencidas</button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {COLUMN_ORDER.map((status) => (
            <div key={status} className={`rounded-xl border-2 ${dragOverCol === status? 'border-primary-400 bg-primary-50' : 'border-ink-200 bg-ink-50'}`} onDragOver={(e) => { e.preventDefault(); setDragOverCol(status); }} onDragLeave={() => setDragOverCol(null)} onDrop={() => handleDrop(status)}>
              <div className="px-3 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${ORDER_STATUS_CONFIG[status].dot}`} /><span className="text-sm font-bold text-ink-700">{ORDER_STATUS_CONFIG[status].label}</span></div>
                <span className="text-xs font-semibold bg-white px-2 py-0.5 rounded-full">{ordersByStatus[status]?.length || 0}</span>
              </div>
              <div className="px-2 pb-2 space-y-2 min-h-[100px]">
                {ordersByStatus[status]?.map((order) => (<OrderCard key={order.id} order={order} dragging={draggingId === order.id} onDragStart={() => setDraggingId(order.id)} onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }} onClick={() => setSelectedOrder(order)} />))}
                {(!ordersByStatus[status] || ordersByStatus[status].length === 0) && <div className="text-center py-8 text-ink-300 text-xs">Sin órdenes</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedOrder && (
        <OrderDetailModal 
          order={selectedOrder} 
          onClose={() => setSelectedOrder(null)} 
          products={apiProducts} 
          onDelete={handleDeleteOrder}
          onPagarResto={handlePagarRestoPOS}
          onAddPart={async (productId: string, qty: number) => {
            try {
              const res = await orderAPI.addPart(selectedOrder.id, { product_id: productId, quantity: qty });
              const newPart = res.data.part; const updatedOrder = res.data.order;
              setOrders((prev) => prev.map((o) => o.id === selectedOrder.id? {...o, parts_used: [...(o.parts_used || []), newPart], cost_parts: updatedOrder.cost_parts, total: updatedOrder.total } as any : o));
              setSelectedOrder((prev) => prev? {...prev, parts_used: [...(prev.parts_used || []), newPart], cost_parts: updatedOrder.cost_parts, total: updatedOrder.total, OrderParts: [...(prev as any).OrderParts || [], newPart] } as any : null);
              setApiProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: Math.max(0, (p as any).stock - qty) } as any : p));
            } catch (err: any) { alert(err.response?.data?.error || 'Error agregando refacción'); }
          }}
          onRemovePart={handleRemovePart}
          onStatusChange={async (newStatus: OrderStatus) => {
            try {
              await orderAPI.updateStatus(selectedOrder.id, newStatus);
              setSelectedOrder(null);
              loadData();
              onStatusChange?.(selectedOrder.id, newStatus);
            } catch (err: any) { alert(err.response?.data?.error || 'Error cambiando estado'); }
          }}
        />
      )}

      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} onCreate={handleCreateOrder} />}
    </div>
  );
}

function OrderCard({ order, dragging, onDragStart, onDragEnd, onClick }: any) {
  const warranty = getWarrantyInfo(order);
  const { resto, pagado } = getPagoInfo(order);
  const promised = getPromisedInfo(order);
  const saldo = resto;
  const isNoWarranty = (order as any).warranty_value === 0;
  return (
    <div draggable={!isReadOnly} onDragStart={isReadOnly ? undefined : onDragStart} onDragEnd={onDragEnd} onClick={onClick} className={`card p-3 cursor-pointer hover:shadow-md ${dragging? 'opacity-50 rotate-2 scale-95' : ''} ${pagado? 'bg-green-50/50 border-green-200' : ''} ${promised?.overdue ? 'border-2 border-red-500 bg-red-50/80 shadow-red-100' : ''} ${!promised?.overdue && warranty &&!warranty.expired && !(warranty as any).noWarranty? 'border-l-4 border-l-green-500' : ''} ${warranty?.expired? 'border-l-4 border-l-red-400 opacity-75' : ''} ${isNoWarranty && !promised?.overdue ? 'border-l-4 border-l-gray-400' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-primary-600">{order.folio}</span>
        {pagado ? <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1"><Check className="w-3 h-3" />Pagado</span> : <span className={`badge ${ORDER_STATUS_CONFIG[order.status as OrderStatus].color}`}>{ORDER_STATUS_CONFIG[order.status as OrderStatus].label}</span>}
      </div>
      <p className="text-sm font-semibold truncate">{order.customer_name}</p>
      <p className="text-xs text-ink-500 mb-1 truncate">{order.device_brand} {order.device_model}</p>
      {(order as any).imei && <p className="text-[11px] font-mono text-gray-500 mb-2 truncate flex items-center gap-1"><Hash className="w-3 h-3"/> {(order as any).imei}</p>}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {(() => { const pri = getPriorityInfo(order); return (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${pri.color} ${pri.ring} ${pri.label==='Urgente'?'animate-pulse':''}`}>
            <span className={`w-2 h-2 rounded-full ${pri.dot}`} /> {pri.emoji} {pri.label}
          </span>
        )})()}
        {promised && (
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${promised.overdue ? 'bg-red-100 text-red-700 border-red-300 animate-pulse' : promised.isToday ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
            <Calendar className="w-3 h-3" /> {promised.text}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {order.lock_type && order.lock_type!== 'Sin bloqueo' && (<span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded flex items-center gap-1"><Lock className="w-3 h-3" /> {order.lock_type}{order.lock_code ? ' ••••' : ''}</span>)}
        {order.advance_payment > 0 && !pagado && (<span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Anticipo: {formatCurrency(order.advance_payment)}</span>)}
        {isNoWarranty ? (
          <span className="text-xs px-2 py-0.5 rounded flex items-center gap-1 bg-gray-200 text-gray-600"><Ban className="w-3 h-3" /> Sin garantía</span>
        ) : warranty && (
          <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${warranty.expired? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}><Shield className="w-3 h-3" /> {warranty.expired? 'Vencida' : `${warranty.days}d`}</span>
        )}
      </div>
      <p className="text-xs text-ink-400 line-clamp-2 mb-2">{order.problem_description}</p>
      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-xs text-ink-400 flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(order.created_at)}</span>
        <div className="text-right">
          <span className="text-sm font-bold">{formatCurrency(order.total)}</span>
          {saldo > 0 && !pagado && <p className="text-xs text-red-600">Debe: {formatCurrency(saldo)}</p>}
        </div>
      </div>
    </div>
  );
}

function OrderDetailModal({ order, onClose, products, onAddPart, onRemovePart, onDelete, onPagarResto, onStatusChange }: any) {
  const [activeTab, setActiveTab] = useState<'info' | 'diagnostic' | 'parts' | 'warranty' | 'evidencia'>('info');
  const [showPartPicker, setShowPartPicker] = useState(false);
  const [partQty, setPartQty] = useState(1);
  const [showLockCode, setShowLockCode] = useState(false);
  const warrantyInfo = getWarrantyInfo(order);
  const { total, anticipo, resto, pagado } = getPagoInfo(order);
  const saldo = resto;
  const isNoWarranty = (order as any).warranty_value === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-primary-600">{order.folio}</span>
              <span className={`badge ${ORDER_STATUS_CONFIG[order.status as OrderStatus].color}`}>{ORDER_STATUS_CONFIG[order.status as OrderStatus].label}</span>
              {pagado && <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1"><Check className="w-3 h-3" />Pagado</span>}
              {isNoWarranty && <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-bold flex items-center gap-1"><Ban className="w-3 h-3" />Sin garantía</span>}
            </div>
            <p className="text-sm text-ink-500">{order.customer_name} · {order.device_brand} {order.device_model} {(order as any).imei ? `· ${(order as any).imei}` : ''}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="flex gap-1 px-6 pt-4 border-b overflow-x-auto">
          {([
            { key: 'info', label: 'Info', icon: FileText }, 
            { key: 'diagnostic', label: 'Diagnóstico', icon: Wrench }, 
            { key: 'parts', label: 'Refacciones', icon: Package }, 
            { key: 'warranty', label: 'Garantía', icon: Shield },
            { key: 'evidencia', label: 'Evidencia', icon: Camera }
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap ${activeTab === key? 'border-primary-600 text-primary-600' : 'border-transparent text-ink-500'}`}><Icon className="w-4 h-4" /> {label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-ink-400 uppercase font-semibold">Cliente</p><p className="text-sm font-medium">{order.customer_name}</p></div>
                <div><p className="text-xs text-ink-400 uppercase font-semibold">Teléfono</p><p className="text-sm font-medium flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {order.customer_phone || 'Sin teléfono'}</p></div>
                <div><p className="text-xs text-ink-400 uppercase font-semibold">Dispositivo</p><p className="text-sm font-medium">{order.device_type}</p></div>
                <div><p className="text-xs text-ink-400 uppercase font-semibold">Marca/Modelo</p><p className="text-sm font-medium">{order.device_brand} {order.device_model}</p></div>
                <div className="bg-gray-50 rounded-lg p-2 border">
                  <p className="text-xs text-ink-400 uppercase font-semibold flex items-center gap-1"><Hash className="w-3 h-3"/> IMEI / Serie</p>
                  <p className="text-sm font-mono font-bold">{(order as any).imei || 'Sin IMEI'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 border">
                  <p className="text-xs text-ink-400 uppercase font-semibold flex items-center gap-1"><Smartphone className="w-3 h-3"/> Color / Capacidad</p>
                  <p className="text-sm font-medium">{(order as any).device_color || 'No especificado'}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-400 uppercase font-semibold">Tipo de bloqueo</p>
                  <p className="text-sm font-medium flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> {order.lock_type || 'Sin bloqueo'}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-400 uppercase font-semibold">Garantía</p>
                  <p className={`text-sm font-medium ${isNoWarranty ? 'text-gray-500 font-bold' : ''}`}>{isNoWarranty ? 'Sin garantía (0 días)' : `${order.warranty_value} ${order.warranty_unit}`}</p>
                </div>
              </div>

              {order.promised_at && (() => { const p = getPromisedInfo(order); if (!p) return null; return (
                <div className={`rounded-lg p-3 border-2 ${p.overdue ? 'bg-red-50 border-red-400' : 'bg-purple-50 border-purple-200'}`}>
                  <p className={`text-xs uppercase font-bold flex items-center gap-1 ${p.overdue ? 'text-red-700' : 'text-purple-700'}`}><Calendar className="w-3.5 h-3.5"/> Fecha prometida</p>
                  <p className={`text-sm font-bold mt-1 ${p.overdue ? 'text-red-800' : 'text-purple-800'}`}>{formatDateTime(order.promised_at)} · {p.text}</p>
                  {p.overdue && <p className="text-xs text-red-600 mt-1 font-bold">⚠️ Esta orden está atrasada, priorizar!</p>}
                </div>
              ); })()}

              {order.lock_code && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-amber-700 uppercase font-semibold flex items-center gap-1"><KeyRound className="w-3.5 h-3.5"/> Código / Contraseña de desbloqueo</p>
                    <p className="text-sm font-mono font-bold mt-1">{showLockCode ? order.lock_code : '••••••••'}</p>
                  </div>
                  <button onClick={() => setShowLockCode(!showLockCode)} className="p-2 rounded-lg bg-white border hover:bg-amber-100">
                    {showLockCode ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              )}

              <div><p className="text-xs text-ink-400 uppercase font-semibold mb-1">Problema reportado</p><p className="text-sm bg-ink-50 rounded-lg p-3">{order.problem_description || 'Sin descripción'}</p></div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-ink-50 rounded-lg p-3 text-center"><p className="text-xs text-ink-400">Refacciones</p><p className="text-lg font-bold">{formatCurrency(order.cost_parts || 0)}</p></div>
                <div className="bg-ink-50 rounded-lg p-3 text-center"><p className="text-xs text-ink-400">Mano obra</p><p className="text-lg font-bold">{formatCurrency(order.cost_labor || 0)}</p></div>
                <div className="bg-blue-50 rounded-lg p-3 text-center"><p className="text-xs text-blue-600">Anticipo</p><p className="text-lg font-bold text-blue-700">{formatCurrency(anticipo)}</p></div>
                <div className="bg-primary-50 rounded-lg p-3 text-center"><p className="text-xs text-primary-600">Total</p><p className="text-lg font-bold text-primary-700">{formatCurrency(total)}</p></div>
              </div>

              {pagado ? (
                <div className="bg-green-600 text-white rounded-xl p-4 text-center font-bold flex items-center justify-center gap-2 text-lg">
                  <Check className="w-6 h-6" /> Pagado completo ✅
                </div>
              ) : (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 space-y-3">
                  <div className="text-center">
                    <p className="text-xs text-orange-600 font-semibold uppercase">Resta por pagar</p>
                    <p className="text-3xl font-bold text-orange-700">{formatCurrency(saldo)}</p>
                  </div>
                  <button onClick={() => onPagarResto(order)} className="btn-primary w-full py-3 text-base">
                    <Wallet className="w-5 h-5" /> Pagar {formatCurrency(saldo)} en POS
                  </button>
                  <p className="text-xs text-ink-400 text-center">Se cargará en POS como "Liquidación Orden {order.folio}" y quedará en corte</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'diagnostic' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-ink-400 uppercase font-semibold mb-1">Diagnóstico técnico</p>
                <p className="text-sm bg-ink-50 rounded-lg p-3 min-h-[60px]">{order.diagnostic || 'Sin diagnóstico aún'}</p>
              </div>
              <div>
                <p className="text-xs text-ink-400 uppercase font-semibold mb-1">Notas privadas</p>
                <p className="text-sm bg-amber-50 rounded-lg p-3 border border-amber-200 min-h-[60px]">{order.private_notes || 'Sin notas privadas'}</p>
              </div>
            </div>
          )}

          {activeTab === 'parts' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm mb-2 flex items-center gap-2"><Package className="w-4 h-4" /> Refacciones usadas</h4>
                {(order.parts_used?.length > 0 || order.OrderParts?.length > 0) ? (
                  <div className="space-y-2">
                    {(order.OrderParts || order.parts_used).map((part: any, i: number) => (
                      <div key={part.id || i} className="flex items-center justify-between bg-ink-50 rounded-lg px-3 py-2.5 border">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{part.product_name}</p>
                          <p className="text-xs text-ink-500">{part.quantity} × {formatCurrency(part.unit_cost)} = {formatCurrency(part.unit_cost * part.quantity)}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <span className="text-sm font-bold">{formatCurrency(part.unit_cost * part.quantity)}</span>
                          <button
                            onClick={() => onRemovePart(order.id, part.id)}
                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                            title="Quitar refacción y regresar al inventario"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-ink-400 text-center py-8 bg-ink-50 rounded-lg">No se han usado refacciones</p>}
              </div>
              <button onClick={() => setShowPartPicker(true)} className="btn-secondary w-full"><Plus className="w-4 h-4" /> Agregar refacción</button>
            </div>
          )}

          {activeTab === 'warranty' && (
            <div className="space-y-4">
              <div className={`rounded-lg p-4 ${isNoWarranty ? 'bg-gray-100 border-2 border-gray-300' : 'bg-ink-50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  {isNoWarranty ? <Ban className="w-5 h-5 text-gray-500" /> : <Shield className="w-5 h-5 text-primary-600" />}
                  <h3 className="font-bold">Garantía del servicio</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-ink-400 uppercase font-semibold">Período</p>
                    <p className={`text-lg font-bold ${isNoWarranty ? 'text-gray-600' : ''}`}>{isNoWarranty ? 'Sin garantía' : `${order.warranty_value} ${order.warranty_unit || 'Días'}`}</p>
                  </div>
                  {order.delivered_at && !isNoWarranty && (
                    <div>
                      <p className="text-xs text-ink-400 uppercase font-semibold">Entregado</p>
                      <p className="text-sm font-medium">{formatDateTime(order.delivered_at)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-ink-400 uppercase font-semibold">Bloqueo</p>
                    <p className="text-sm font-medium">{order.lock_type}</p>
                  </div>
                  {isNoWarranty && (
                    <div className="col-span-2 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                      <p className="text-xs text-amber-800 font-semibold">⚠️ Este servicio se entregó sin garantía. No aplica devolución por garantía.</p>
                    </div>
                  )}
                </div>
              </div>

              {!isNoWarranty && order.warranty_ends_at ? (
                <div className={`rounded-lg p-4 border-2 ${warrantyInfo?.expired? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className={`w-5 h-5 ${warrantyInfo?.expired? 'text-red-600' : 'text-green-600'}`} />
                    <p className="text-sm font-semibold">Vence el</p>
                  </div>
                  <p className={`text-2xl font-bold ${warrantyInfo?.expired? 'text-red-700' : 'text-green-700'}`}>
                    {formatDateTime(order.warranty_ends_at)}
                  </p>
                  <p className={`text-xs mt-1 ${warrantyInfo?.expired? 'text-red-600' : 'text-green-600'}`}>
                    {warrantyInfo?.text}
                  </p>
                </div>
              ) : isNoWarranty ? (
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Ban className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="font-bold text-gray-600">Servicio sin garantía</p>
                  <p className="text-xs text-gray-500 mt-1">El cliente fue informado que este servicio no cuenta con garantía</p>
                </div>
              ) : (
                <p className="text-sm text-ink-400 text-center py-6 bg-ink-50 rounded-lg">
                  La garantía se activa cuando cambias el estado a "Entregado"
                </p>
              )}
            </div>
          )}

          {activeTab === 'evidencia' && (
            <EvidenciaTabContent ordenId={order.id} />
          )}
        </div>

        <div className="border-t p-4 space-y-3 bg-white">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-ink-500 font-medium">Cambiar estado:</span>
            {(['por_revisar', 'en_reparacion', 'esperando_refaccion', 'listo', 'entregado'] as OrderStatus[]).map((s) => (
              <button key={s} onClick={() => onStatusChange(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${order.status === s? ORDER_STATUS_CONFIG[s].color : 'bg-ink-100 text-ink-500'}`}>{ORDER_STATUS_CONFIG[s].label}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onDelete(order.id)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 text-red-600 border border-red-200 font-semibold hover:bg-red-100">
              <Trash2 className="w-4 h-4" /> Eliminar
            </button>
            <button onClick={onClose} className="flex-1 btn-secondary">Cerrar</button>
          </div>
        </div>
      </div>

      {showPartPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPartPicker(false)}>
          <div className="card w-full max-w-md p-5 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">Agregar refacción</h3>
              <button onClick={() => setShowPartPicker(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm">Cantidad:</label>
              <input type="number" min="1" value={partQty} onChange={(e) => setPartQty(Math.max(1, parseInt(e.target.value) || 1))} className="input w-20" />
            </div>
            <div className="flex-1 overflow-auto space-y-2">
              {products.map((p: any) => (
                <button key={p.id} onClick={() => { onAddPart(p.id, partQty); setShowPartPicker(false); }} disabled={p.stock <= 0} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border hover:bg-primary-50 text-left disabled:opacity-50">
                  <div><p className="text-sm font-medium">{p.name}</p><p className="text-xs">Stock: {p.stock} · {formatCurrency(p.cost_price)}</p></div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenciaTabContent({ ordenId }: { ordenId: string }) {
  const [tipoActivo, setTipoActivo] = useState<'ingreso'|'durante'|'salida'>('ingreso');
  const [datos, setDatos] = useState<any>({ ingreso: [], durante: [], salida: [] });
  const [nota, setNota] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const cargar = async () => {
    try {
      const res = await evidenciaAPI.list(ordenId);
      setDatos(res.data);
    } catch (e) { console.error(e); }
  };
  useEffect(() => { cargar(); }, [ordenId]);

  const subir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('foto', file);
    fd.append('orden_id', ordenId);
    fd.append('tipo', tipoActivo);
    fd.append('nota', nota);
    try {
      await evidenciaAPI.upload(fd);
      setNota('');
      e.target.value = '';
      await cargar();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error subiendo foto');
    } finally { setUploading(false); }
  };

  const borrar = async (id: string) => {
    if (!confirm('¿Borrar esta foto?')) return;
    await evidenciaAPI.delete(id);
    await cargar();
  };

  const fotos = datos[tipoActivo] || [];

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-700 font-semibold flex items-center gap-1"><Camera className="w-4 h-4"/> Evidencia fotográfica del equipo</p>
        <p className="text-xs text-blue-600 mt-1">Toma foto al ingresar, durante la reparación y al entregar. Te protege de reclamos de "ya venía rayado".</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['ingreso','durante','salida'] as const).map(t => (
          <button key={t} onClick={() => setTipoActivo(t)}
            className={`px-3 py-1.5 rounded-full text-sm border font-semibold ${tipoActivo===t ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-600'}`}>
            {t==='ingreso' ? 'Ingreso' : t==='durante' ? 'Durante reparación' : 'Salida'} ({datos[t]?.length || 0})
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <label className="bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer font-semibold text-sm hover:bg-blue-700">
          {uploading ? 'Subiendo...' : '📷 Tomar / Subir foto'}
          <input type="file" accept="image/*" capture="environment" hidden onChange={subir} disabled={uploading} />
        </label>
        <input value={nota} onChange={e=>setNota(e.target.value)} placeholder="Nota: pantalla estrellada, carcasa rayada..." className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 text-sm" maxLength={100} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {fotos.length===0 && <p className="col-span-full text-center text-gray-400 py-8 text-sm border-2 border-dashed rounded-xl">No hay fotos en {tipoActivo}. Sube la primera.</p>}
        {fotos.map((f: any) => (
          <div key={f.id} className="border rounded-xl overflow-hidden relative bg-gray-50">
            <img src={`/${f.thumbnail_url || f.url}`} className="w-full h-32 object-cover cursor-pointer" onClick={()=>setPreview(`/${f.url}`)} loading="lazy" />
            <button onClick={()=>borrar(f.id)} className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"><X size={12}/></button>
            <div className="p-2 text-[11px] text-gray-600">
              <div>{new Date(f.created_at).toLocaleString()}</div>
              {f.nota && <div className="font-semibold text-gray-900 truncate">{f.nota}</div>}
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4" onClick={()=>setPreview(null)}>
          <img src={preview} className="max-w-full max-h-full rounded-xl" />
          <button className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"><X/></button>
        </div>
      )}
    </div>
  );
}

function CreateOrderModal({ onClose, onCreate }: any) {
  const getDefaultPromised = () => { const d = new Date(); d.setDate(d.getDate()+2); d.setHours(18,0,0,0); const pad = (n:number)=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', device_type: 'Smartphone',
    device_brand: '', device_model: '', problem_description: '',
    total: 0, advance_payment: 0,
    payment_method_anticipo: 'efectivo' as 'efectivo' | 'tarjeta' | 'transferencia',
    lock_type: 'Sin bloqueo', lock_code: '',
    warranty_value: 0,
    warranty_unit: 'Días' as 'Días' | 'Meses',
    promised_at: getDefaultPromised(),
    priority: 'normal' as Priority,
    imei: ''
  });
  const [showCode, setShowCode] = useState(false);
  const [fotosIngreso, setFotosIngreso] = useState<File[]>([]);
  const [previewFotos, setPreviewFotos] = useState<string[]>([]);
  const [warrantyText, setWarrantyText] = useState('0');
  const saldo = (form.total || 0) - (form.advance_payment || 0);
  const isNoWarranty = form.warranty_value === 0 || warrantyText === '' || warrantyText === '0';

  const needsCode = LOCK_TYPES_WITH_CODE.includes(form.lock_type);

  const handleFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFotosIngreso(prev => [...prev, ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => setPreviewFotos(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const quitarFoto = (index: number) => {
    setFotosIngreso(prev => prev.filter((_, i) => i !== index));
    setPreviewFotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleLockTypeChange = (newType: string) => {
    setForm(prev => ({
      ...prev,
      lock_type: newType,
      lock_code: LOCK_TYPES_WITH_CODE.includes(newType) ? prev.lock_code : ''
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">Nueva Orden</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Cliente *</label><input className="input" value={form.customer_name} onChange={(e) => setForm({...form, customer_name: e.target.value })} /></div>
            <div><label className="label">Teléfono</label><input className="input" value={form.customer_phone} onChange={(e) => setForm({...form, customer_phone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Tipo</label><select className="input" value={form.device_type} onChange={(e) => setForm({...form, device_type: e.target.value })}><option>Smartphone</option><option>Tablet</option><option>Laptop</option><option>Consola</option><option>Otro</option></select></div>
            <div><label className="label">Marca *</label><input className="input" value={form.device_brand} onChange={(e) => setForm({...form, device_brand: e.target.value })} /></div>
            <div><label className="label">Modelo</label><input className="input" value={form.device_model} onChange={(e) => setForm({...form, device_model: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label flex items-center gap-1"><Hash className="w-3.5 h-3.5" /> IMEI / Serie</label><input className="input font-mono" placeholder="355123456789012" value={form.imei} onChange={(e) => setForm({...form, imei: e.target.value })} /></div>
            <div><label className="label flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> Color / Capacidad</label><input className="input" placeholder="Ej: 128GB Azul" value={(form as any).device_color || ''} onChange={(e) => setForm({...form, device_color: e.target.value } as any)} /></div>
          </div>
          <div><label className="label">Problema reportado</label><textarea className="input min-h-[70px]" value={form.problem_description} onChange={(e) => setForm({...form, problem_description: e.target.value })} /></div>

          <div className="bg-ink-50 rounded-xl p-4 space-y-3 border-2 border-dashed border-primary-200">
            <h4 className="font-bold text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary-600"/> Costos + Anticipo a POS</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label font-bold text-primary-700">Costo total $ *</label><input type="number" min="0" className="input font-bold text-lg border-primary-300" value={form.total} onChange={(e) => setForm({...form, total: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className="label font-bold text-green-700">Anticipo $</label><input type="number" min="0" className="input font-bold border-green-300" value={form.advance_payment} onChange={(e) => setForm({...form, advance_payment: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className={`rounded-lg p-3 text-center font-bold text-base ${saldo <= 0 && form.total > 0? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-orange-100 text-orange-700 border-2 border-orange-200'}`}>
              {saldo <= 0 && form.total > 0? `¡Pagado completo! ✅` : `Resta por pagar: ${formatCurrency(saldo)}`}
            </div>
          </div>

          <div className="bg-purple-50 rounded-xl p-4 space-y-2 border-2 border-dashed border-purple-200">
            <label className="label flex items-center gap-1 font-bold text-purple-800"><Calendar className="w-3.5 h-3.5" /> Fecha y hora prometida al cliente *</label>
            <input type="datetime-local" className="input border-purple-300 font-semibold" value={form.promised_at} onChange={(e) => setForm({...form, promised_at: e.target.value})} />
            <p className="text-xs text-purple-600">Se pintará en rojo en el kanban si se pasa de esta fecha. Por defecto: +2 días a las 6pm</p>
          </div>

          <div className="space-y-2">
            <label className="label font-bold flex items-center gap-1">🔥 Prioridad / Etiqueta</label>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(PRIORITY_CONFIG) as Priority[]).map(p => {
                const cfg = PRIORITY_CONFIG[p];
                const active = form.priority === p;
                return (
                  <button key={p} type="button" onClick={() => setForm({...form, priority: p})} className={`px-2 py-2.5 rounded-xl text-xs font-bold border-2 transition-all flex flex-col items-center gap-1 ${active ? cfg.color + ' ring-2 ring-offset-1 ' + (p==='urgente'?'ring-red-300': p==='garantia'?'ring-purple-300':'ring-blue-200') + ' scale-105' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    <span className="text-base">{cfg.emoji}</span>
                    <span>{cfg.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Tipo de bloqueo</label>
              <select className="input" value={form.lock_type} onChange={(e) => handleLockTypeChange(e.target.value)}>{LOCK_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Garantía</label>
                <div className="relative">
                  <input 
                    type="text" 
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    className={`input pr-8 ${isNoWarranty ? 'bg-gray-100 border-gray-300 text-gray-600 font-bold' : ''}`} 
                    value={warrantyText} 
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      if (raw === '') {
                        setWarrantyText('');
                        setForm(prev => ({ ...prev, warranty_value: 0 }));
                        return;
                      }
                      let num = parseInt(raw);
                      if (isNaN(num)) num = 0;
                      if (num > 365) num = 365;
                      // Evitar 02 visual
                      setWarrantyText(String(num));
                      setForm(prev => ({ ...prev, warranty_value: num }));
                    }}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => {
                      if (warrantyText === '') {
                        setWarrantyText('0');
                        setForm(prev => ({ ...prev, warranty_value: 0 }));
                      }
                    }}
                  />
                  {isNoWarranty && <Ban className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />}
                </div>
              </div>
              <div><label className="label">Unidad</label><select className="input" value={form.warranty_unit} onChange={(e) => setForm({...form, warranty_unit: e.target.value as 'Días' | 'Meses' })} disabled={isNoWarranty}><option>Días</option><option>Meses</option></select></div>
            </div>
          </div>

          {isNoWarranty && (
            <div className="bg-gray-100 border-2 border-gray-300 rounded-xl p-3 flex items-center gap-2">
              <Ban className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-sm font-bold text-gray-700">Servicio sin garantía</p>
                <p className="text-xs text-gray-500">El cliente acepta que este servicio no tendrá garantía.</p>
              </div>
            </div>
          )}

          {needsCode && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-2">
              <label className="label flex items-center gap-1 font-bold text-amber-800"><KeyRound className="w-4 h-4" /> {form.lock_type === 'PIN' ? 'Código PIN' : 'Contraseña'} *</label>
              <div className="relative">
                <input type={showCode ? "text" : "password"} className="input pr-10 font-mono font-bold border-amber-300 bg-white" placeholder={form.lock_type === 'PIN' ? 'Ej: 1234' : 'Ej: MiClave123'} value={form.lock_code} onChange={(e) => setForm({...form, lock_code: e.target.value })} />
                <button type="button" onClick={() => setShowCode(!showCode)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-amber-100">{showCode ? <EyeOff className="w-4 h-4 text-amber-700"/> : <Eye className="w-4 h-4 text-amber-700"/>}</button>
              </div>
            </div>
          )}

          <div className="border-2 border-dashed border-blue-300 rounded-xl p-4 bg-blue-50/50 space-y-3">
            <h4 className="font-bold text-sm flex items-center gap-2 text-blue-700"><Camera className="w-4 h-4"/> Evidencia de Ingreso</h4>
            <label className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg cursor-pointer font-semibold text-sm hover:bg-blue-700 w-full">
              <Upload className="w-4 h-4"/> {fotosIngreso.length>0 ? `${fotosIngreso.length} fotos` : 'Tomar / Seleccionar fotos'}
              <input type="file" multiple accept="image/*" capture="environment" hidden onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setFotosIngreso(prev => [...prev, ...files]);
                files.forEach(file => {
                  const reader = new FileReader();
                  reader.onload = (ev) => setPreviewFotos(prev => [...prev, ev.target?.result as string]);
                  reader.readAsDataURL(file);
                });
              }} />
            </label>
            {previewFotos.length>0 && (
              <div className="grid grid-cols-3 gap-2">
                {previewFotos.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} className="w-full h-20 object-cover rounded-lg border" />
                    <button type="button" onClick={() => {
                      setFotosIngreso(prev => prev.filter((_, idx) => idx !== i));
                      setPreviewFotos(prev => prev.filter((_, idx) => idx !== i));
                    }} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"><X size={10}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="p-6 border-t flex gap-3 bg-white">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => onCreate(form, fotosIngreso)} disabled={!form.customer_name ||!form.device_brand || (needsCode && !form.lock_code)} className="btn-primary flex-1">
            <Check className="w-4 h-4" /> {fotosIngreso.length>0 ? `Crear con ${fotosIngreso.length} fotos` : form.advance_payment>0? `Crear y cobrar ${formatCurrency(form.advance_payment)} en POS` : 'Crear orden'}
          </button>
        </div>
      </div>
    </div>
  );
}
