import { useState, useMemo, useEffect } from 'react';
import { orderAPI, productAPI, evidenciaAPI } from '@/api/client'
import { ORDER_STATUS_CONFIG, formatCurrency, formatDateTime } from '@/utils/permissions';
import type { RepairOrder, OrderStatus, Product } from '@/types';
import {
  Plus, X, Phone, Wrench, Clock, Package, FileText,
  Check, DollarSign, Shield, Lock, Calendar, Trash2, Wallet, ChevronRight, Camera, Image as ImageIcon, Upload
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

  // ===== NUEVO: CREAR ORDEN + SUBIR FOTOS DE INGRESO AUTOMATICO =====
  const handleCreateOrder = async (formData: any, fotosIngreso: File[]) => {
    try {
      const res = await orderAPI.create(formData);
      const order = res.data.order;

      // Si hay fotos de ingreso seleccionadas en el modal de crear, subirlas ahora
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
    if (!confirm(`¿Quitar ${partToRemove.product_name} x${partToRemove.quantity}?`)) return;
    try {
      const res = await orderAPI.removePart(orderId, partId);
      const updatedOrder = res.data.order;
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, cost_parts: updatedOrder.cost_parts, total: updatedOrder.total, OrderParts: (o as any).OrderParts?.filter((x: any) => x.id !== partId) } as any : o));
      setSelectedOrder(prev => prev ? { ...prev, cost_parts: updatedOrder.cost_parts, total: updatedOrder.total, OrderParts: (prev as any).OrderParts?.filter((x: any) => x.id !== partId), parts_used: (prev as any).parts_used?.filter((x: any) => x.id !== partId) } as any : null);
      setApiProducts(prev => prev.map(prod => prod.id === partToRemove.product_id ? { ...prod, stock: prod.stock + partToRemove.quantity } as any : prod));
    } catch (err: any) { alert(err.response?.data?.error || 'Error quitando refacción'); }
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
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onClick} className={`card p-3 cursor-pointer hover:shadow-md ${dragging? 'opacity-50' : ''} ${pagado? 'bg-green-50/50' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-primary-600">{order.folio}</span>
        {pagado ? <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1"><Check className="w-3 h-3" />Pagado</span> : <span className={`badge ${ORDER_STATUS_CONFIG[order.status as OrderStatus].color}`}>{ORDER_STATUS_CONFIG[order.status as OrderStatus].label}</span>}
      </div>
      <p className="text-sm font-semibold truncate">{order.customer_name}</p>
      <p className="text-xs text-ink-500 mb-2 truncate">{order.device_brand} {order.device_model}</p>
      <p className="text-xs text-ink-400 line-clamp-2 mb-2">{order.problem_description}</p>
      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-xs text-ink-400 flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(order.created_at)}</span>
        <span className="text-sm font-bold">{formatCurrency(order.total)}</span>
      </div>
    </div>
  );
}

function OrderDetailModal({ order, onClose, products, onAddPart, onRemovePart, onDelete, onPagarResto, onStatusChange }: any) {
  const [activeTab, setActiveTab] = useState<'info' | 'diagnostic' | 'parts' | 'warranty' | 'evidencia'>('info');
  const [showPartPicker, setShowPartPicker] = useState(false);
  const [partQty, setPartQty] = useState(1);
  const warrantyInfo = getWarrantyInfo(order);
  const { total, anticipo, resto, pagado } = getPagoInfo(order);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-primary-600">{order.folio}</span>
              <span className={`badge ${ORDER_STATUS_CONFIG[order.status as OrderStatus].color}`}>{ORDER_STATUS_CONFIG[order.status as OrderStatus].label}</span>
            </div>
            <p className="text-sm text-ink-500">{order.customer_name} · {order.device_brand} {order.device_model}</p>
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
                <div><p className="text-xs text-ink-400 uppercase font-semibold">Teléfono</p><p className="text-sm font-medium">{order.customer_phone}</p></div>
                <div><p className="text-xs text-ink-400 uppercase font-semibold">Dispositivo</p><p className="text-sm font-medium">{order.device_type}</p></div>
                <div><p className="text-xs text-ink-400 uppercase font-semibold">Marca/Modelo</p><p className="text-sm font-medium">{order.device_brand} {order.device_model}</p></div>
              </div>
              <div><p className="text-xs text-ink-400 uppercase font-semibold mb-1">Problema</p><p className="text-sm bg-ink-50 rounded-lg p-3">{order.problem_description}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center"><p className="text-xs text-blue-600">Anticipo</p><p className="text-lg font-bold text-blue-700">{formatCurrency(anticipo)}</p></div>
                <div className="bg-primary-50 rounded-lg p-3 text-center"><p className="text-xs text-primary-600">Total</p><p className="text-lg font-bold text-primary-700">{formatCurrency(total)}</p></div>
              </div>
            </div>
          )}
          {activeTab === 'diagnostic' && (<div><p className="text-sm bg-ink-50 rounded-lg p-3 min-h-[60px]">{order.diagnostic || 'Sin diagnóstico'}</p></div>)}
          {activeTab === 'parts' && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm mb-2 flex items-center gap-2"><Package className="w-4 h-4" /> Refacciones</h4>
              {(order.OrderParts || order.parts_used || []).map((part: any, i: number) => (
                <div key={part.id || i} className="flex items-center justify-between bg-ink-50 rounded-lg px-3 py-2.5 border">
                  <div><p className="text-sm font-medium">{part.product_name}</p><p className="text-xs text-ink-500">{part.quantity} × {formatCurrency(part.unit_cost)}</p></div>
                  <button onClick={() => onRemovePart(order.id, part.id)} className="p-1.5 rounded-lg bg-red-50 text-red-600"><X className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => setShowPartPicker(true)} className="btn-secondary w-full"><Plus className="w-4 h-4" /> Agregar refacción</button>
            </div>
          )}
          {activeTab === 'warranty' && (
            <div className="space-y-4">
              <div className="bg-ink-50 rounded-lg p-4">
                <p className="font-bold">Garantía: {order.warranty_value} {order.warranty_unit}</p>
                {order.warranty_ends_at && <p className="text-sm">Vence: {formatDateTime(order.warranty_ends_at)} - {warrantyInfo?.text}</p>}
              </div>
            </div>
          )}
          {activeTab === 'evidencia' && (<EvidenciaTabContent ordenId={order.id} />)}
        </div>

        <div className="border-t p-4 flex gap-2">
          <button onClick={() => onDelete(order.id)} className="px-4 py-2.5 rounded-lg bg-red-50 text-red-600 border border-red-200 font-semibold"><Trash2 className="w-4 h-4" /> Eliminar</button>
          <button onClick={onClose} className="flex-1 btn-secondary">Cerrar</button>
        </div>
      </div>

      {showPartPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPartPicker(false)}>
          <div className="card w-full max-w-md p-5 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-3">Agregar refacción</h3>
            <div className="flex-1 overflow-auto space-y-2">
              {products.map((p: any) => (
                <button key={p.id} onClick={() => { onAddPart(p.id, partQty); setShowPartPicker(false); }} className="w-full flex justify-between px-3 py-2.5 rounded-lg border text-left">
                  <div><p className="text-sm font-medium">{p.name}</p><p className="text-xs">Stock: {p.stock}</p></div><ChevronRight className="w-4 h-4" />
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
    try { const res = await evidenciaAPI.list(ordenId); setDatos(res.data); } catch (e) { console.error(e); }
  };
  useEffect(() => { cargar(); }, [ordenId]);

  const subir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append('foto', file); fd.append('orden_id', ordenId); fd.append('tipo', tipoActivo); fd.append('nota', nota);
    try { await evidenciaAPI.upload(fd); setNota(''); e.target.value = ''; await cargar(); } catch (err: any) { alert(err.response?.data?.error || 'Error'); } finally { setUploading(false); }
  };

  const borrar = async (id: string) => { if (!confirm('¿Borrar?')) return; await evidenciaAPI.delete(id); await cargar(); };
  const fotos = datos[tipoActivo] || [];

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-700 font-semibold flex items-center gap-1"><Camera className="w-4 h-4"/> Evidencia fotográfica</p>
        <p className="text-xs text-blue-600 mt-1">Ingreso / Durante / Salida - Te protege de reclamos</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {(['ingreso','durante','salida'] as const).map(t => (
          <button key={t} onClick={() => setTipoActivo(t)} className={`px-3 py-1.5 rounded-full text-sm border font-semibold ${tipoActivo===t ? 'bg-gray-900 text-white' : 'bg-gray-50'}`}>{t} ({datos[t]?.length || 0})</button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <label className="bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer font-semibold text-sm">{uploading ? 'Subiendo...' : '📷 Subir foto'}<input type="file" accept="image/*" capture="environment" hidden onChange={subir} disabled={uploading} /></label>
        <input value={nota} onChange={e=>setNota(e.target.value)} placeholder="Nota ej: pantalla estrellada" className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {fotos.length===0 && <p className="col-span-full text-center text-gray-400 py-8 text-sm border-2 border-dashed rounded-xl">Sin fotos en {tipoActivo}</p>}
        {fotos.map((f: any) => (
          <div key={f.id} className="border rounded-xl overflow-hidden relative bg-gray-50">
            <img src={`/${f.thumbnail_url || f.url}`} className="w-full h-32 object-cover cursor-pointer" onClick={()=>setPreview(`/${f.url}`)} />
            <button onClick={()=>borrar(f.id)} className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center"><X size={12}/></button>
            <div className="p-2 text-[11px]">{f.nota && <div className="font-semibold truncate">{f.nota}</div>}<div>{new Date(f.created_at).toLocaleString()}</div></div>
          </div>
        ))}
      </div>
      {preview && (<div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4" onClick={()=>setPreview(null)}><img src={preview} className="max-w-full max-h-full rounded-xl" /></div>)}
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
  const [fotosIngreso, setFotosIngreso] = useState<File[]>([]);
  const [previewFotos, setPreviewFotos] = useState<string[]>([]);
  const saldo = (form.total || 0) - (form.advance_payment || 0);

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
            <div className={`rounded-lg p-3 text-center font-bold text-base ${saldo <= 0 && form.total > 0? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{saldo <= 0 && form.total > 0? '¡Pagado completo! ✅' : `Resta: ${formatCurrency(saldo)}`}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Bloqueo</label><select className="input" value={form.lock_type} onChange={(e) => setForm({...form, lock_type: e.target.value })}>{LOCK_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Garantía</label><input type="number" min="1" className="input" value={form.warranty_value} onChange={(e) => setForm({...form, warranty_value: parseInt(e.target.value) || 10 })} /></div>
              <div><label className="label">Unidad</label><select className="input" value={form.warranty_unit} onChange={(e) => setForm({...form, warranty_unit: e.target.value as 'Días' | 'Meses' })}><option>Días</option><option>Meses</option></select></div>
            </div>
          </div>

          {/* ===== NUEVO: EVIDENCIA AL CREAR ===== */}
          <div className="border-2 border-dashed border-blue-300 rounded-xl p-4 bg-blue-50/50 space-y-3">
            <h4 className="font-bold text-sm flex items-center gap-2 text-blue-700"><Camera className="w-4 h-4"/> Evidencia de Ingreso (recomendado)</h4>
            <p className="text-xs text-blue-600">Toma fotos del equipo al recibirlo para evitar reclamos</p>
            <label className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg cursor-pointer font-semibold text-sm hover:bg-blue-700 w-full">
              <Upload className="w-4 h-4"/> {fotosIngreso.length>0 ? `${fotosIngreso.length} fotos seleccionadas` : 'Tomar / Seleccionar fotos de ingreso'}
              <input type="file" multiple accept="image/*" capture="environment" hidden onChange={handleFotos} />
            </label>
            {previewFotos.length>0 && (
              <div className="grid grid-cols-3 gap-2">
                {previewFotos.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} className="w-full h-20 object-cover rounded-lg border" />
                    <button onClick={()=>quitarFoto(i)} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"><X size={10}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
        <div className="p-6 border-t flex gap-3 bg-white">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => onCreate(form, fotosIngreso)} disabled={!form.customer_name ||!form.device_brand} className="btn-primary flex-1">
            <Check className="w-4 h-4" /> {fotosIngreso.length>0 ? `Crear con ${fotosIngreso.length} fotos` : form.advance_payment>0? `Crear y cobrar ${formatCurrency(form.advance_payment)}` : 'Crear orden'}
          </button>
        </div>
      </div>
    </div>
  );
}