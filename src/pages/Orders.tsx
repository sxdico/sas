import { useState, useMemo, useEffect } from 'react';
import { orderAPI, productAPI } from '@/api/client'
import { ORDER_STATUS_CONFIG, formatCurrency, formatDateTime } from '@/utils/permissions';
import type { RepairOrder, OrderStatus, Product } from '@/types';
import {
  Plus, X, Phone, Wrench, Clock, Package, FileText, ChevronRight,
  Check,
} from 'lucide-react';

const COLUMN_ORDER: OrderStatus[] = ['por_revisar', 'en_reparacion', 'esperando_refaccion', 'listo', 'entregado'];

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
      const [ordsRes, prodsRes] = await Promise.all([
        orderAPI.list(),
        productAPI.list(),
      ]);
      setOrders(ordsRes.data.orders || ordsRes.data || []);
      setApiProducts(prodsRes.data.products || prodsRes.data || []);
    } catch (e: any) {
      console.error('Error cargando órdenes', e.response?.data || e.message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
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
    setOrders((prev) => prev.map((o) => o.id === draggingId? {
     ...o, status,
      ready_at: status === 'listo'? new Date().toISOString() : o.ready_at,
      delivered_at: status === 'entregado'? new Date().toISOString() : null,
    } as any : o));

    try {
      await orderAPI.updateStatus(order.id, status);
      onStatusChange?.(order.id, status);
    } catch {
      setOrders((prev) => prev.map((o) => o.id === order.id? {...o, status: prevStatus } : o));
    }
    setDraggingId(null);
    setDragOverCol(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mr-3" />
        Cargando órdenes reales...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 py-3 bg-white border-b border-ink-200 flex items-center justify-between">
        <p className="text-sm text-ink-500">{orders.length} órdenes totales</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Nueva orden
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {COLUMN_ORDER.map((status) => (
            <div
              key={status}
              className={`rounded-xl border-2 ${dragOverCol === status? 'border-primary-400 bg-primary-50' : 'border-ink-200 bg-ink-50'}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(status); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(status)}
            >
              <div className="px-3 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${ORDER_STATUS_CONFIG[status].dot}`} />
                  <span className="text-sm font-bold text-ink-700">{ORDER_STATUS_CONFIG[status].label}</span>
                </div>
                <span className="text-xs font-semibold bg-white px-2 py-0.5 rounded-full">{ordersByStatus[status]?.length || 0}</span>
              </div>
              <div className="px-2 pb-2 space-y-2 min-h-">
                {ordersByStatus[status]?.map((order) => (
                  <div
                    key={order.id}
                    draggable
                    onDragStart={() => setDraggingId(order.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                    onClick={() => setSelectedOrder(order)}
                    className={`card p-3 cursor-pointer hover:shadow-md ${draggingId === order.id? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-primary-600">{order.folio}</span>
                      <span className={`badge ${ORDER_STATUS_CONFIG[order.status].color}`}>{ORDER_STATUS_CONFIG[order.status].label}</span>
                    </div>
                    <p className="text-sm font-semibold">{order.customer_name}</p>
                    <p className="text-xs text-ink-500 mb-2">{order.device_brand} {order.device_model}</p>
                    <p className="text-xs text-ink-400 line-clamp-2 mb-2">{order.problem_description}</p>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-ink-400 flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(order.created_at)}</span>
                      {order.total > 0 && <span className="text-sm font-bold">{formatCurrency(order.total)}</span>}
                    </div>
                  </div>
                ))}
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
          onAddPart={async (productId, qty) => {
            try {
              const res = await orderAPI.addPart(selectedOrder.id, { product_id: productId, quantity: qty });
              const newPart = res.data.part;
              const updatedOrder = res.data.order;
              setOrders((prev) => prev.map((o) => o.id === selectedOrder.id? {...o, parts_used: [...(o.parts_used || []), newPart], cost_parts: updatedOrder.cost_parts, total: updatedOrder.total } as any : o));
              setSelectedOrder((prev) => prev? {...prev, parts_used: [...(prev.parts_used || []), newPart], cost_parts: updatedOrder.cost_parts, total: updatedOrder.total } as any : null);
              setApiProducts((prev) => prev.map((p) => p.id === productId? {...p, stock: Math.max(0, p.stock - qty) } : p));
            } catch (err: any) {
              alert(err.response?.data?.error || 'Error agregando refacción');
            }
          }}
          onStatusChange={async (newStatus) => {
            try {
              await orderAPI.updateStatus(selectedOrder.id, newStatus);
              setOrders((prev) => prev.map((o) => o.id === selectedOrder.id? {...o, status: newStatus } as any : o));
              setSelectedOrder((prev) => prev? {...prev, status: newStatus } as any : null);
              onStatusChange?.(selectedOrder.id, newStatus);
            } catch (err: any) {
              alert(err.response?.data?.error || 'Error cambiando estado');
            }
          }}
        />
      )}

      {showCreate && (
        <CreateOrderModal
          onClose={() => setShowCreate(false)}
          onCreate={async (data) => {
            try {
              const res = await orderAPI.create(data);
              setOrders((prev) => [...prev, res.data.order]);
              setShowCreate(false);
            } catch (err: any) {
              alert(err.response?.data?.error || 'Error creando orden');
            }
          }}
        />
      )}
    </div>
  );
}

function OrderDetailModal({ order, onClose, products, onAddPart, onStatusChange }: any) {
  const [activeTab, setActiveTab] = useState<'info' | 'diagnostic' | 'parts'>('info');
  const [showPartPicker, setShowPartPicker] = useState(false);
  const [partQty, setPartQty] = useState(1);
  const statusOptions: OrderStatus[] = ['por_revisar', 'en_reparacion', 'esperando_refaccion', 'listo', 'entregado'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl max-h- flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-primary-600">{order.folio}</span>
              <span className={`badge ${ORDER_STATUS_CONFIG[order.status].color}`}>{ORDER_STATUS_CONFIG[order.status].label}</span>
            </div>
            <p className="text-sm text-ink-500">{order.customer_name} · {order.device_brand} {order.device_model}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="flex gap-1 px-6 pt-4 border-b">
          {([{ key: 'info', label: 'Info', icon: FileText }, { key: 'diagnostic', label: 'Diagnóstico', icon: Wrench }, { key: 'parts', label: 'Refacciones', icon: Package }] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 ${activeTab === key? 'border-primary-600 text-primary-600' : 'border-transparent text-ink-500'}`}><Icon className="w-4 h-4" /> {label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-ink-400 uppercase font-semibold">Cliente</p><p className="text-sm font-medium">{order.customer_name}</p></div>
                <div><p className="text-xs text-ink-400 uppercase font-semibold">Teléfono</p><p className="text-sm font-medium flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {order.customer_phone}</p></div>
                <div><p className="text-xs text-ink-400 uppercase font-semibold">Dispositivo</p><p className="text-sm font-medium">{order.device_type}</p></div>
                <div><p className="text-xs text-ink-400 uppercase font-semibold">Marca/Modelo</p><p className="text-sm font-medium">{order.device_brand} {order.device_model}</p></div>
              </div>
              <div><p className="text-xs text-ink-400 uppercase font-semibold mb-1">Problema</p><p className="text-sm bg-ink-50 rounded-lg p-3">{order.problem_description}</p></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-ink-50 rounded-lg p-3 text-center"><p className="text-xs text-ink-400">Refacciones</p><p className="text-lg font-bold">{formatCurrency(order.cost_parts || 0)}</p></div>
                <div className="bg-ink-50 rounded-lg p-3 text-center"><p className="text-xs text-ink-400">Mano obra</p><p className="text-lg font-bold">{formatCurrency(order.cost_labor || 0)}</p></div>
                <div className="bg-primary-50 rounded-lg p-3 text-center"><p className="text-xs text-primary-600">Total</p><p className="text-lg font-bold text-primary-700">{formatCurrency(order.total || 0)}</p></div>
              </div>
            </div>
          )}
          {activeTab === 'diagnostic' && (
            <div className="space-y-4">
              <p className="text-sm bg-ink-50 rounded-lg p-3">{order.diagnostic || 'Sin diagnóstico aún'}</p>
              <p className="text-sm bg-warning-50 rounded-lg p-3 border border-warning-200">{order.private_notes || 'Sin notas privadas'}</p>
            </div>
          )}
          {activeTab === 'parts' && (
            <div className="space-y-3">
              {(order.parts_used || []).length > 0? order.parts_used.map((part: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-ink-50 rounded-lg px-3 py-2.5">
                  <div><p className="text-sm font-medium">{part.product_name}</p><p className="text-xs text-ink-500">{part.quantity} × {formatCurrency(part.unit_cost)}</p></div>
                  <span className="text-sm font-bold">{formatCurrency(part.unit_cost * part.quantity)}</span>
                </div>
              )) : <p className="text-sm text-ink-400 text-center py-6">No se han usado refacciones</p>}
              <button onClick={() => setShowPartPicker(true)} className="btn-secondary w-full"><Plus className="w-4 h-4" /> Agregar refacción</button>
            </div>
          )}
        </div>

        <div className="border-t p-4 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-ink-500 font-medium">Cambiar estado:</span>
          {statusOptions.map((s) => (
            <button key={s} onClick={() => onStatusChange(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${order.status === s? ORDER_STATUS_CONFIG[s].color : 'bg-ink-100 text-ink-500'}`}>{ORDER_STATUS_CONFIG[s].label}</button>
          ))}
        </div>
      </div>

      {showPartPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPartPicker(false)}>
          <div className="card w-full max-w-md p-5 max-h- flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-3">Agregar refacción</h3>
            <input type="number" min="1" value={partQty} onChange={(e) => setPartQty(Math.max(1, parseInt(e.target.value) || 1))} className="input w-20 mb-3" />
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

function CreateOrderModal({ onClose, onCreate }: any) {
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', device_type: 'Smartphone',
    device_brand: '', device_model: '', problem_description: '',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 max-h- overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="text-xl font-bold">Nueva Orden</h2><button onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Cliente</label><input className="input" value={form.customer_name} onChange={(e) => setForm({...form, customer_name: e.target.value })} /></div>
            <div><label className="label">Teléfono</label><input className="input" value={form.customer_phone} onChange={(e) => setForm({...form, customer_phone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Tipo</label><select className="input" value={form.device_type} onChange={(e) => setForm({...form, device_type: e.target.value })}><option>Smartphone</option><option>Tablet</option><option>Laptop</option><option>Consola</option><option>Otro</option></select></div>
            <div><label className="label">Marca</label><input className="input" value={form.device_brand} onChange={(e) => setForm({...form, device_brand: e.target.value })} /></div>
            <div><label className="label">Modelo</label><input className="input" value={form.device_model} onChange={(e) => setForm({...form, device_model: e.target.value })} /></div>
          </div>
          <div><label className="label">Problema reportado</label><textarea className="input min-h-" value={form.problem_description} onChange={(e) => setForm({...form, problem_description: e.target.value })} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => onCreate({...form })} disabled={!form.customer_name ||!form.device_brand} className="btn-primary flex-1"><Check className="w-4 h-4" /> Crear orden</button>
        </div>
      </div>
    </div>
  );
}