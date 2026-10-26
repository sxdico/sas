
import { useState, useMemo, useEffect } from 'react';
import { orderAPI, productAPI, evidenciaAPI } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatDateTime } from '@/utils/permissions';
import type { RepairOrder, OrderStatus, Product } from '@/types';
import {
  PRIORITY_CONFIG, PRIORITY_ORDER, COLUMN_ORDER, ORDER_STATUS_FULL,
  getPriorityInfo, getWarrantyInfo, getPagoInfo, getPromisedInfo, goToCaja,
  type Priority
} from '@/constants/repairOrders';
import { Plus, X, Clock, Check, Shield, Lock, Calendar, Ban, Search, Hash } from 'lucide-react';
import OrderDetailModal from '@/components/OrderDetailModal';
import CreateOrderModal from '@/components/CreateOrderModal';

interface OrdersProps {
  onStatusChange?: (orderId: string, status: OrderStatus) => void;
  onNavigate?: (page: string) => void;
}

export default function Orders({ onStatusChange, onNavigate }: OrdersProps) {
  const auth = (() => { try { return useAuth(); } catch { return { license: null, isReadOnly: false } as any; } })();
  const isReadOnly = (auth as any).isReadOnly || false;
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

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((o:any) => (
        (o.folio || '').toLowerCase().includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.customer_phone || '').toLowerCase().includes(q) ||
        (o.device_brand || '').toLowerCase().includes(q) ||
        (o.device_model || '').toLowerCase().includes(q) ||
        (o.device_type || '').toLowerCase().includes(q) ||
        (o.problem_description || '').toLowerCase().includes(q) ||
        (o.imei || '').toLowerCase().includes(q) ||
        (o.technician_name || '').toLowerCase().includes(q)
      ));
    }

    if (priorityFilter !== 'todas') {
      filtered = filtered.filter((o:any) => (o.priority || 'normal') === priorityFilter);
    }

    if (quickFilter !== 'todos') {
      filtered = filtered.filter((o:any) => {
        if (quickFilter === 'sin_pagar') {
          const total = parseFloat(o.total || 0);
          const adv = parseFloat(o.advance_payment || 0);
          return total > 0 && (total - adv) > 0;
        }
        if (quickFilter === 'sin_garantia') return parseInt(o.warranty_value) === 0;
        if (quickFilter === 'con_bloqueo') return o.lock_type && o.lock_type !== 'Sin bloqueo';
        if (quickFilter === 'vencidas') return o.promised_at && new Date(o.promised_at) < new Date() && !['listo','entregado'].includes(o.status);
        return true;
      });
    }

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
    if (isReadOnly) { alert('Licencia vencida - Solo lectura'); return; }
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
    if (isReadOnly) { alert('Licencia vencida - No puedes crear órdenes'); return; }
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
        goToCaja(onNavigate);
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
    goToCaja(onNavigate);
  };

  const handleRemovePart = async (orderId: string, partId: string) => {
    const partToRemove = (selectedOrder as any)?.OrderParts?.find((p: any) => p.id === partId) || (selectedOrder as any)?.parts_used?.find((p: any) => p.id === partId);
    if (!partToRemove) return;
    if (!confirm(`¿Quitar ${partToRemove.product_name} x${partToRemove.quantity}?`)) return;
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
          <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Nueva orden</button>
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
                <div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${ORDER_STATUS_FULL[status].dot}`} /><span className="text-sm font-bold text-ink-700">{ORDER_STATUS_FULL[status].label}</span></div>
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
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onClick} className={`card p-3 cursor-pointer hover:shadow-md ${dragging? 'opacity-50 rotate-2 scale-95' : ''} ${pagado? 'bg-green-50/50 border-green-200' : ''} ${promised?.overdue ? 'border-2 border-red-500 bg-red-50/80 shadow-red-100' : ''} ${!promised?.overdue && warranty &&!warranty.expired && !(warranty as any).noWarranty? 'border-l-4 border-l-green-500' : ''} ${warranty?.expired? 'border-l-4 border-l-red-400 opacity-75' : ''} ${isNoWarranty && !promised?.overdue ? 'border-l-4 border-l-gray-400' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-primary-600">{order.folio}</span>
        {pagado ? <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1"><Check className="w-3 h-3" />Pagado</span> : <span className={`badge ${ORDER_STATUS_FULL[order.status as OrderStatus].color}`}>{ORDER_STATUS_FULL[order.status as OrderStatus].label}</span>}
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
          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded flex items-center gap-1"><Ban className="w-3 h-3" /> Sin garantía</span>
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
