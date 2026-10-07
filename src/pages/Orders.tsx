import { useState, useMemo, useEffect } from 'react';
import { orderAPI, productAPI } from '@/api/client'
import { ORDER_STATUS_CONFIG, formatCurrency, formatDateTime } from '@/utils/permissions';
import type { RepairOrder, OrderStatus, Product } from '@/types';
import {
  Plus, X, Phone, Wrench, Clock, Package, FileText, ChevronRight,
  Check, DollarSign, Shield, Lock, Banknote, CreditCard, Smartphone, Calendar
} from 'lucide-react';

const COLUMN_ORDER: OrderStatus[] = ['por_revisar', 'en_reparacion', 'esperando_refaccion', 'listo', 'entregado'];
const LOCK_TYPES = ['Sin bloqueo','Patrón','PIN','Contraseña','Cuenta Google','iCloud','MDM','Otro'];

function getWarrantyInfo(order: RepairOrder) {
  if (!order.warranty_ends_at) return null;
  const endDate = new Date(order.warranty_ends_at);
  const today = new Date();
  const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { expired: true, days: Math.abs(diffDays), text: `Vencida hace ${Math.abs(diffDays)} días` };
  if (diffDays === 0) return { expired: false, days: 0, text: 'Vence hoy' };
  return { expired: false, days: diffDays, text: `${diffDays} días restantes` };
}

export default function Orders({ onStatusChange }: { onStatusChange?: (orderId: string, status: OrderStatus) => void }) {
  const [orders, setOrders] = useState<RepairOrder[]>([]);
  const [apiProducts, setApiProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<RepairOrder | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<OrderStatus | null>(null);

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
    orders.forEach((o) => { if (map[o.status]) map[o.status].push(o); });
    return map;
  }, [orders]);

  const handleDrop = async (status: OrderStatus) => {
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
      <div className="px-4 md:px-6 py-3 bg-white border-b border-ink-200 flex items-center justify-between">
        <p className="text-sm text-ink-500">{orders.length} órdenes totales</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Nueva orden</button>
      </div>
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {COLUMN_ORDER.map((status) => (
            <div key={status} className={`rounded-xl border-2 ${dragOverCol === status? 'border-primary-400 bg-primary-50' : 'border-ink-200 bg-ink-50'}`} onDragOver={(e) => { e.preventDefault(); setDragOverCol(status); }} onDragLeave={() => setDragOverCol(null)} onDrop={() => handleDrop(status)}>
              <div className="px-3 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${ORDER_STATUS_CONFIG[status].dot}`} /><span className="text-sm font-bold text-ink-700">{ORDER_STATUS_CONFIG[status].label}</span></div>
                <span className="text-xs font-semibold bg-white px-2 py-0.5 rounded-full">{ordersByStatus[status]?.length || 0}</span>
              </div>
              <div className="px-2 pb-2 space-y-2 min-h-">
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
          onAddPart={async (productId: string, qty: number) => {
            try {
              const res = await orderAPI.addPart(selectedOrder.id, { product_id: productId, quantity: qty });
              const newPart = res.data.part; const updatedOrder = res.data.order;
              setOrders((prev) => prev.map((o) => o.id === selectedOrder.id? {...o, parts_used: [...(o.parts_used || []), newPart], cost_parts: updatedOrder.cost_parts, total: updatedOrder.total } as any : o));
              setSelectedOrder((prev) => prev? {...prev, parts_used: [...(prev.parts_used || []), newPart], cost_parts: updatedOrder.cost_parts, total: updatedOrder.total } as any : null);
              setApiProducts((prev) => prev.map((p) => p.id === productId? {...p, stock: Math.max(0, p.stock - qty) } : p));
            } catch (err: any) { alert(err.response?.data?.error || 'Error agregando refacción'); }
          }}
          onStatusChange={async (newStatus: OrderStatus) => {
            try { await orderAPI.updateStatus(selectedOrder.id, newStatus); setSelectedOrder(null); loadData(); onStatusChange?.(selectedOrder.id, newStatus); } catch (err: any) { alert(err.response?.data?.error || 'Error cambiando estado'); }
          }}
        />
      )}

      {showCreate && (
        <CreateOrderModal
          onClose={() => setShowCreate(false)}
          onCreate={async (data: any) => {
            try {
              const res = await orderAPI.create(data);
              const newOrder = res.data.order || res.data;
              setOrders((prev) => [...prev, newOrder]);
              setShowCreate(false);
              const anticipo = parseFloat(data.advance_payment || 0);
              if (anticipo > 0) {
                localStorage.setItem('pendingAnticipo', JSON.stringify({
                  folio: newOrder.folio,
                  customer: data.customer_name,
                  device: `${data.device_brand} ${data.device_model}`.trim(),
                  amount: anticipo,
                  method: data.payment_method_anticipo || 'efectivo',
                  total: data.total
                }));
                window.location.hash = '#/pos';
                window.location.href = '/#/pos';
              }
            } catch (err: any) {
              alert(err.response?.data?.error || err.response?.data?.detail || 'Error creando orden');
            }
          }}
        />
      )}
    </div>
  );
}

function OrderCard({ order, dragging, onDragStart, onDragEnd, onClick }: any) {
  const saldo = (order.total || 0) - (order.advance_payment || 0);
  const warrantyInfo = getWarrantyInfo(order);
  const status = order.status as OrderStatus;
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onClick} className={`card p-3 cursor-pointer hover:shadow-md ${dragging? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-primary-600">{order.folio}</span><span className={`badge ${ORDER_STATUS_CONFIG[status].color}`}>{ORDER_STATUS_CONFIG[status].label}</span></div>
      <p className="text-sm font-semibold">{order.customer_name}</p>
      <p className="text-xs text-ink-500 mb-2">{order.device_brand} {order.device_model}</p>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {order.lock_type && order.lock_type!== 'Sin bloqueo' && (<span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded flex items-center gap-1"><Lock className="w-3 h-3" /> {order.lock_type}</span>)}
        {order.advance_payment > 0 && (<span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">Anticipo: {formatCurrency(order.advance_payment)}</span>)}
        {warrantyInfo && (<span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${warrantyInfo.expired? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}><Shield className="w-3 h-3" /> {warrantyInfo.expired? 'Vencida' : `${warrantyInfo.days}d`}</span>)}
      </div>
      <p className="text-xs text-ink-400 line-clamp-2 mb-2">{order.problem_description}</p>
      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-xs text-ink-400 flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(order.created_at)}</span>
        {order.total > 0 && (<div className="text-right"><span className="text-sm font-bold">{formatCurrency(order.total)}</span>{saldo > 0 && <p className="text-xs text-red-600 font-bold">Debe: {formatCurrency(saldo)}</p>}</div>)}
      </div>
    </div>
  );
}

function OrderDetailModal({ order, onClose, products, onAddPart, onStatusChange }: any) {
  const [activeTab, setActiveTab] = useState<'info' | 'diagnostic' | 'parts' | 'warranty'>('info');
  const [showPartPicker, setShowPartPicker] = useState(false);
  const [partQty, setPartQty] = useState(1);
  const statusOptions: OrderStatus[] = ['por_revisar', 'en_reparacion', 'esperando_refaccion', 'listo', 'entregado'];
  const saldo = (order.total || 0) - (order.advance_payment || 0);
  const warrantyInfo = getWarrantyInfo(order);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl max-h- flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-center justify-between"><div><div className="flex items-center gap-3"><span className="text-lg font-bold text-primary-600">{order.folio}</span><span className={`badge ${ORDER_STATUS_CONFIG[order.status as OrderStatus].color}`}>{ORDER_STATUS_CONFIG[order.status as OrderStatus].label}</span></div><p className="text-sm text-ink-500">{order.customer_name} · {order.device_brand} {order.device_model}</p></div><button onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="flex gap-1 px-6 pt-4 border-b overflow-x-auto">{([{ key: 'info', label: 'Info', icon: FileText }, { key: 'diagnostic', label: 'Diagnóstico', icon: Wrench }, { key: 'parts', label: 'Refacciones', icon: Package }, { key: 'warranty', label: 'Garantía', icon: Shield }] as const).map(({ key, label, icon: Icon }) => (<button key={key} onClick={() => setActiveTab(key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap ${activeTab === key? 'border-primary-600 text-primary-600' : 'border-transparent text-ink-500'}`}><Icon className="w-4 h-4" /> {label}</button>))}</div>
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'info' && (<div className="space-y-4"><div className="grid grid-cols-2 gap-4"><div><p className="text-xs text-ink-400 uppercase font-semibold">Cliente</p><p className="text-sm font-medium">{order.customer_name}</p></div><div><p className="text-xs text-ink-400 uppercase font-semibold">Teléfono</p><p className="text-sm font-medium flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {order.customer_phone}</p></div><div><p className="text-xs text-ink-400 uppercase font-semibold">Dispositivo</p><p className="text-sm font-medium">{order.device_type}</p></div><div><p className="text-xs text-ink-400 uppercase font-semibold">Marca/Modelo</p><p className="text-sm font-medium">{order.device_brand} {order.device_model}</p></div></div><div><p className="text-xs text-ink-400 uppercase font-semibold mb-1">Problema</p><p className="text-sm bg-ink-50 rounded-lg p-3">{order.problem_description}</p></div><div className="grid grid-cols-2 gap-3"><div className="bg-blue-50 rounded-lg p-3 text-center"><p className="text-xs text-blue-600">Anticipo</p><p className="text-lg font-bold text-blue-700">{formatCurrency(order.advance_payment || 0)}</p></div><div className="bg-primary-50 rounded-lg p-3 text-center"><p className="text-xs text-primary-600">Total</p><p className="text-lg font-bold text-primary-700">{formatCurrency(order.total || 0)}</p></div></div>{saldo > 0? (<div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-center"><p className="text-xs text-red-600 font-semibold uppercase">Saldo pendiente</p><p className="text-2xl font-bold text-red-700">{formatCurrency(saldo)}</p></div>) : order.total > 0 && (<div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-center"><p className="text-xs text-green-600 font-semibold uppercase">¡Pagado completo!</p><p className="text-2xl font-bold text-green-700">{formatCurrency(order.total)}</p></div>)}</div>)}
          {activeTab === 'diagnostic' && (<div className="space-y-3"><p className="text-sm bg-ink-50 rounded-lg p-3">{order.diagnostic || order.problem_description || 'Sin diagnóstico aún'}</p></div>)}
          {activeTab === 'parts' && (<div className="space-y-3">{(order.parts_used || order.OrderParts || []).length > 0? (order.parts_used || order.OrderParts).map((part: any, i: number) => (<div key={i} className="flex items-center justify-between bg-ink-50 rounded-lg px-3 py-2.5"><div><p className="text-sm font-medium">{part.product_name}</p><p className="text-xs text-ink-500">{part.quantity} × {formatCurrency(part.unit_cost)}</p></div><span className="text-sm font-bold">{formatCurrency(part.unit_cost * part.quantity)}</span></div>)) : <p className="text-sm text-ink-400 text-center py-6">No se han usado refacciones</p>}<button onClick={() => setShowPartPicker(true)} className="btn-secondary w-full"><Plus className="w-4 h-4" /> Agregar refacción</button></div>)}
          {activeTab === 'warranty' && (<div className="space-y-4"><div className="bg-ink-50 rounded-lg p-4"><div className="flex items-center gap-2 mb-3"><Shield className="w-5 h-5 text-primary-600" /><h3 className="font-bold">Garantía del servicio</h3></div><div className="grid grid-cols-2 gap-4"><div><p className="text-xs text-ink-400 uppercase font-semibold">Período</p><p className="text-lg font-bold flex items-center gap-1"><Calendar className="w-4 h-4"/>{order.warranty_value || 10} {order.warranty_unit || 'Días'}</p></div>{order.delivered_at && (<div><p className="text-xs text-ink-400 uppercase font-semibold">Entregado</p><p className="text-sm font-medium">{formatDateTime(order.delivered_at)}</p></div>)}</div></div>{order.warranty_ends_at && (<div className={`rounded-lg p-4 border-2 ${warrantyInfo?.expired? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}><p className="text-xs uppercase font-bold opacity-70">Vence el</p><p className={`text-2xl font-bold ${warrantyInfo?.expired? 'text-red-700' : 'text-green-700'}`}>{formatDateTime(order.warranty_ends_at)}</p><p className={`text-xs mt-1 font-semibold ${warrantyInfo?.expired? 'text-red-600' : 'text-green-600'}`}>{warrantyInfo?.text}</p></div>)}{!order.warranty_ends_at && (<p className="text-sm text-ink-400 text-center py-4">La garantía se calcula al entregar la orden: {order.warranty_value || 10} {order.warranty_unit || 'Días'} desde la entrega</p>)}</div>)}
        </div>
        <div className="border-t p-4 flex items-center gap-2 flex-wrap"><span className="text-sm text-ink-500 font-medium">Cambiar estado:</span>{statusOptions.map((s) => (<button key={s} onClick={() => onStatusChange(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${order.status === s? ORDER_STATUS_CONFIG[s].color : 'bg-ink-100 text-ink-500'}`}>{ORDER_STATUS_CONFIG[s].label}</button>))}</div>
      </div>
      {showPartPicker && (<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPartPicker(false)}><div className="card w-full max-w-md p-5 max-h- flex flex-col" onClick={(e) => e.stopPropagation()}><h3 className="font-bold mb-3">Agregar refacción</h3><input type="number" min="1" value={partQty} onChange={(e) => setPartQty(Math.max(1, parseInt(e.target.value) || 1))} className="input w-20 mb-3" /><div className="flex-1 overflow-auto space-y-2">{products.map((p: any) => (<button key={p.id} onClick={() => { onAddPart(p.id, partQty); setShowPartPicker(false); }} disabled={p.stock <= 0} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border hover:bg-primary-50 text-left disabled:opacity-50"><div><p className="text-sm font-medium">{p.name}</p><p className="text-xs">Stock: {p.stock} · {formatCurrency(p.cost_price)}</p></div><ChevronRight className="w-4 h-4" /></button>))}</div></div></div>)}
    </div>
  );
}

function CreateOrderModal({ onClose, onCreate }: any) {
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', device_type: 'Smartphone',
    device_brand: '', device_model: '', problem_description: '',
    total: 0, advance_payment: 0,
    payment_method_anticipo: 'efectivo' as 'efectivo' | 'tarjeta' | 'transferencia',
    lock_type: 'Sin bloqueo', warranty_value: 10, warranty_unit: 'Días' as 'Días' | 'Meses'
  });
  const saldo = (form.total || 0) - (form.advance_payment || 0);
  const icons = { efectivo: Banknote, tarjeta: CreditCard, transferencia: Smartphone } as any;
  const IconPay = icons[form.payment_method_anticipo];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg max-h- flex flex-col" onClick={(e) => e.stopPropagation()}>
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
          <div><label className="label">Problema reportado</label><textarea className="input min-h-" value={form.problem_description} onChange={(e) => setForm({...form, problem_description: e.target.value })} /></div>

          <div className="bg-ink-50 rounded-xl p-4 space-y-3 border-2 border-dashed border-primary-200">
            <h4 className="font-bold text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary-600"/> Costos + Anticipo a POS</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label font-bold text-primary-700">Costo total $ *</label><input type="number" min="0" className="input font-bold text-lg border-primary-300" value={form.total} onChange={(e) => setForm({...form, total: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className="label font-bold text-green-700">Anticipo $</label><input type="number" min="0" className="input font-bold border-green-300" value={form.advance_payment} onChange={(e) => setForm({...form, advance_payment: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            {form.advance_payment > 0 && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-green-800 font-bold text-sm"><Check className="w-4 h-4"/> Se cobrará en caja como venta POS</div>
                <div>
                  <label className="label flex items-center gap-1"><IconPay className="w-3.5 h-3.5"/> Método de pago anticipo</label>
                  <select className="input" value={form.payment_method_anticipo} onChange={(e) => setForm({...form, payment_method_anticipo: e.target.value as any })}>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                  <p className="text-xs text-green-700 mt-1.5 bg-white rounded px-2 py-1.5 border border-green-200">
                    Se cobrará en POS: <b>"Anticipo Orden RP-XXX - {form.customer_name || 'Cliente'}"</b> por <b>{formatCurrency(form.advance_payment)}</b>
                  </p>
                </div>
              </div>
            )}
            <div className={`rounded-lg p-3 text-center font-bold text-base ${saldo <= 0 && form.total > 0? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-orange-100 text-orange-700 border-2 border-orange-200'}`}>
              {saldo <= 0 && form.total > 0? `¡Pagado completo! ✅` : `Resta por pagar: ${formatCurrency(saldo)}`}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Tipo de bloqueo</label><select className="input" value={form.lock_type} onChange={(e) => setForm({...form, lock_type: e.target.value })}>{LOCK_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Garantía</label><input type="number" min="1" className="input" value={form.warranty_value} onChange={(e) => setForm({...form, warranty_value: parseInt(e.target.value) || 10 })} /></div>
              <div><label className="label">Unidad</label><select className="input" value={form.warranty_unit} onChange={(e) => setForm({...form, warranty_unit: e.target.value as 'Días' | 'Meses' })}><option>Días</option><option>Meses</option></select></div>
            </div>
          </div>
        </div>
        <div className="p-6 border-t flex gap-3 bg-white">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => onCreate(form)} disabled={!form.customer_name ||!form.device_brand} className="btn-primary flex-1">
            <Check className="w-4 h-4" /> {form.advance_payment>0? `Crear y cobrar ${formatCurrency(form.advance_payment)} en POS` : 'Crear orden'}
          </button>
        </div>
      </div>
    </div>
  );
}