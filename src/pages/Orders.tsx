import { useState, useMemo, useEffect } from 'react';
import { orderAPI, productAPI } from '@/api/client'
import { ORDER_STATUS_CONFIG, formatCurrency, formatDateTime } from '@/utils/permissions';
import type { RepairOrder, OrderStatus, Product } from '@/types';
import {
  Plus, X, Phone, Wrench, Clock, Package, FileText,
  Check, DollarSign, Shield, Lock, Banknote, CreditCard, Smartphone, Calendar, Trash2, Wallet
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

function getPagoInfo(order: RepairOrder) {
  const total = parseFloat(String(order.total || 0));
  const anticipo = parseFloat(String(order.advance_payment || 0));
  const resto = total - anticipo;
  const pagado = resto <= 0 && total > 0;
  return { total, anticipo, resto, pagado };
}

interface OrdersProps {
  onStatusChange?: (orderId: string, status: OrderStatus) => void;
  onNavigate?: (page: string) => void;
}

export default function Orders({ onStatusChange, onNavigate }: OrdersProps) {
  const [orders, setOrders] = useState<RepairOrder[]>([]);
  const [apiProducts, setApiProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<RepairOrder | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<OrderStatus | null>(null);

  const goToPOS = () => {
    if (onNavigate) {
      onNavigate('pos');
    } else {
      // fallback para tu sistema de currentPage
      window.dispatchEvent(new CustomEvent('fixpro-navigate', { detail: 'pos' }));
      // ultimo fallback
      setTimeout(() => {
        const btn = document.querySelector('[data-nav="pos"]') as HTMLButtonElement;
        btn?.click();
      }, 100);
    }
  };

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

  const handleCreateOrder = async (formData: any) => {
    try {
      const res = await orderAPI.create(formData);
      const order = res.data.order;
      setShowCreate(false);
      await loadData();
      if (formData.advance_payment && parseFloat(formData.advance_payment) > 0) {
        const pending = {
          folio: order.folio,
          orderId: order.id,
          customer: formData.customer_name,
          device: `${formData.device_brand} ${formData.device_model || ''}`.trim(),
          amount: formData.advance_payment,
          method: formData.payment_method_anticipo || 'efectivo',
          type: 'anticipo'
        };
        localStorage.setItem('pendingAnticipo', JSON.stringify(pending));
        goToPOS();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error creando orden');
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm('¿Seguro que quieres eliminar esta orden? Esta acción no se puede deshacer.')) return;
    try {
      await orderAPI.delete(id);
      setSelectedOrder(null);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error eliminando orden');
    }
  };

  const handleLiquidate = async (order: RepairOrder, method: string = 'efectivo') => {
    const { resto } = getPagoInfo(order);
    if (resto <= 0) return alert('Esta orden ya está pagada');
    if (!confirm(`¿Liquidar ${formatCurrency(resto)} de la orden ${order.folio}? Se registrará en corte de caja.`)) return;
    try {
      await orderAPI.liquidate(order.id, method);
      alert('Orden liquidada correctamente ✅');
      setSelectedOrder(null);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error liquidando');
    }
  };

  const handleLiquidateViaPOS = (order: RepairOrder) => {
    const { resto } = getPagoInfo(order);
    const pending = {
      folio: order.folio,
      orderId: order.id,
      customer: order.customer_name,
      device: `${order.device_brand} ${order.device_model}`.trim(),
      amount: resto,
      method: 'efectivo',
      type: 'liquidacion'
    };
    localStorage.setItem('pendingAnticipo', JSON.stringify(pending));
    setSelectedOrder(null);
    goToPOS();
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
          onLiquidate={handleLiquidate}
          onLiquidateViaPOS={handleLiquidateViaPOS}
          onAddPart={async (productId: string, qty: number) => {
            try {
              const res = await orderAPI.addPart(selectedOrder.id, { product_id: productId, quantity: qty });
              const newPart = res.data.part; const updatedOrder = res.data.order;
              setOrders((prev) => prev.map((o) => o.id === selectedOrder.id? {...o, parts_used: [...(o.parts_used || []), newPart], cost_parts: updatedOrder.cost_parts, total: updatedOrder.total } as any : o));
              setSelectedOrder((prev) => prev? {...prev, parts_used: [...(prev.parts_used || []), newPart], cost_parts: updatedOrder.cost_parts, total: updatedOrder.total } as any : null);
            } catch (err: any) { alert(err.response?.data?.error || 'Error agregando refacción'); }
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
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onClick} className={`card p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${dragging? 'opacity-50 rotate-2 scale-95' : ''} ${warranty &&!warranty.expired? 'border-l-4 border-l-green-500' : ''} ${warranty?.expired? 'border-l-4 border-l-red-400 opacity-75' : ''} ${pagado? 'bg-green-50/50 border-green-200' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold bg-ink-100 px-2 py-0.5 rounded">{order.folio}</span>
        {pagado ? (
          <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1"><Check className="w-3 h-3" />Pagado</span>
        ) : order.advance_payment > 0 ? (
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold">Debe {formatCurrency(resto)}</span>
        ) : null}
      </div>
      <p className="font-semibold text-sm truncate">{order.customer_name}</p>
      <p className="text-xs text-ink-500 flex items-center gap-1"><Phone className="w-3 h-3" />{order.customer_phone || 'Sin teléfono'}</p>
      <div className="mt-2 text-xs bg-ink-50 rounded px-2 py-1 flex items-center gap-1">
        <Wrench className="w-3 h-3" />{order.device_brand} {order.device_model}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs font-bold">{formatCurrency(order.total)}</span>
        <span className="text-xs text-ink-400 flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(order.created_at)}</span>
      </div>
      {warranty && <div className={`mt-2 text-xs px-2 py-1 rounded flex items-center gap-1 ${warranty.expired? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}><Shield className="w-3 h-3" />{warranty.text}</div>}
    </div>
  );
}

function OrderDetailModal({ order, onClose, products, onAddPart, onDelete, onLiquidate, onLiquidateViaPOS }: any) {
  const [tab, setTab] = useState<'info' | 'parts'>('info');
  const warranty = getWarrantyInfo(order);
  const { total, anticipo, resto, pagado } = getPagoInfo(order);
  const [payMethod, setPayMethod] = useState<'efectivo' | 'tarjeta' | 'transferencia'>('efectivo');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between">
          <h3 className="font-bold text-lg">{order.folio} - {order.customer_name}</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-2 p-3 border-b bg-ink-50">
          <button onClick={() => setTab('info')} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === 'info'? 'bg-white shadow' : ''}`}><FileText className="w-4 h-4 inline mr-1" />Info</button>
          <button onClick={() => setTab('parts')} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === 'parts'? 'bg-white shadow' : ''}`}><Package className="w-4 h-4 inline mr-1" />Refacciones</button>
        </div>
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {tab === 'info' && (
            <>
              <p className="text-sm"><b>Equipo:</b> {order.device_brand} {order.device_model} ({order.device_type})</p>
              <p className="text-sm"><b>Falla:</b> {order.problem_description}</p>
              
              <div className={`rounded-xl p-4 border-2 ${pagado? 'bg-green-50 border-green-300' : 'bg-ink-50 border-ink-200'} space-y-2`}>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-ink-400 text-xs">Total</p><p className="font-bold text-base">{formatCurrency(total)}</p></div>
                  <div><p className="text-ink-400 text-xs">Anticipo</p><p className="font-bold text-green-600">{formatCurrency(anticipo)}</p></div>
                </div>
                
                {pagado ? (
                  <div className="bg-green-600 text-white rounded-lg p-3 text-center font-bold flex items-center justify-center gap-2">
                    <Check className="w-5 h-5" /> Pagado completo ✅
                  </div>
                ) : (
                  <>
                    <div className="bg-orange-100 border-2 border-orange-200 rounded-lg p-3 text-center">
                      <p className="text-xs text-orange-600 font-semibold">RESTA POR PAGAR</p>
                      <p className="text-2xl font-bold text-orange-700">{formatCurrency(resto)}</p>
                    </div>
                    
                    <div className="space-y-2 pt-2">
                      <label className="label text-xs">Método de pago liquidación</label>
                      <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value as any)}>
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="transferencia">Transferencia</option>
                      </select>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => onLiquidate(order, payMethod)} className="btn-primary py-2.5">
                          <Wallet className="w-4 h-4" /> Liquidar {formatCurrency(resto)}
                        </button>
                        <button onClick={() => onLiquidateViaPOS(order)} className="btn-secondary py-2.5 border-2 border-primary-300 text-primary-700">
                          <Banknote className="w-4 h-4" /> Cobrar en POS
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {warranty && <div className={`rounded-lg p-3 text-sm ${warranty.expired? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}><Shield className="w-4 h-4 inline mr-1" />Garantía: {warranty.text} - vence {formatDateTime(order.warranty_ends_at)}</div>}
              <p className="text-xs text-ink-400"><Calendar className="w-3 h-3 inline mr-1" />Bloqueo: {order.lock_type} | Garantía: {order.warranty_value} {order.warranty_unit}</p>
            </>
          )}
          {tab === 'parts' && (
            <div className="space-y-3">
              {order.OrderParts?.map((p: any) => <div key={p.id} className="flex justify-between text-sm border-b py-2"><span>{p.product_name} x{p.quantity}</span><span>{formatCurrency(p.unit_cost * p.quantity)}</span></div>)}
              <AddPartForm products={products} onAdd={onAddPart} />
            </div>
          )}
        </div>
        
        <div className="p-4 border-t bg-white flex gap-2">
          <button onClick={() => onDelete(order.id)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 text-red-600 border border-red-200 font-semibold hover:bg-red-100">
            <Trash2 className="w-4 h-4" /> Eliminar
          </button>
          <button onClick={onClose} className="flex-1 btn-secondary">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function AddPartForm({ products, onAdd }: any) {
  const [pid, setPid] = useState(''); const [qty, setQty] = useState(1);
  return (
    <div className="flex gap-2 mt-3">
      <select className="input flex-1" value={pid} onChange={(e) => setPid(e.target.value)}><option value="">Selecciona refacción</option>{products.map((p: any) => <option key={p.id} value={p.id}>{p.name} - {p.stock}pz</option>)}</select>
      <input type="number" min={1} className="input w-20" value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 1)} />
      <button onClick={() => pid && onAdd(pid, qty)} className="btn-primary"><Plus className="w-4 h-4" /></button>
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
          <div><label className="label">Problema reportado</label><textarea className="input min-h-[70px]" value={form.problem_description} onChange={(e) => setForm({...form, problem_description: e.target.value })} /></div>

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
