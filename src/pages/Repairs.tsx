import { useEffect, useState, useMemo } from 'react';
import { Search, MessageCircle, Image as ImageIcon, Plus, FileText, Eye, Printer, Trash2 } from 'lucide-react';
import { orderAPI, productAPI, evidenciaAPI } from '@/api/client';
import { estadoConfig, getPagoInfo, goToCaja } from '@/constants/repairOrders';
import OrderDetailModal from '@/components/OrderDetailModal';
import CreateOrderModal from '@/components/CreateOrderModal';

export default function RepairsPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordsRes, prodsRes] = await Promise.all([orderAPI.list(), productAPI.list()]);
      setOrders(ordsRes.data.orders || ordsRes.data || []);
      setProducts(prodsRes.data.products || prodsRes.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    return orders.filter((r: any) => {
      const term = search.toLowerCase();
      return `${r.folio} ${r.customer_name} ${r.device_brand} ${r.device_model}`.toLowerCase().includes(term) && (filtro === 'todos' || r.status === filtro);
    });
  }, [orders, search, filtro]);

  const handleCreateOrder = async (formData: any, fotosIngreso: File[] = []) => {
    try {
      const res = await orderAPI.create(formData);
      const order = res.data.order;
      if (fotosIngreso?.length > 0) {
        for (const file of fotosIngreso) {
          const fd = new FormData(); fd.append('foto', file); fd.append('orden_id', order.id); fd.append('tipo', 'ingreso'); fd.append('nota', 'Foto al ingreso');
          try { await evidenciaAPI.upload(fd); } catch {}
        }
      }
      setShowCreate(false); await loadData();
      if (formData.advance_payment && parseFloat(formData.advance_payment) > 0) {
        const pending = { folio: order.folio, orderId: order.id, customer: formData.customer_name, device: `${formData.device_brand} ${formData.device_model || ''}`.trim(), amount: formData.advance_payment, method: formData.payment_method_anticipo || 'efectivo', type: 'anticipo' };
        localStorage.setItem('pendingAnticipo', JSON.stringify(pending)); goToCaja(onNavigate);
      }
    } catch (err: any) { alert(err.response?.data?.error || 'Error creando orden'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar orden?')) return;
    try { await orderAPI.delete(id); setSelected(null); loadData(); } catch (e: any) { alert(e.response?.data?.error || 'Error'); }
  };
  const handleStatusChange = async (newStatus: string) => {
    if (!selected) return;
    try { await orderAPI.updateStatus(selected.id, newStatus); setSelected(null); loadData(); } catch { alert('Error cambiando estado'); }
  };
  const handleAddPart = async (productId: string, qty: number) => {
    try {
      const res = await orderAPI.addPart(selected.id, { product_id: productId, quantity: qty });
      setSelected((prev: any) => prev ? { ...prev, ...res.data.order, OrderParts: [...(prev.OrderParts||[]), res.data.part] } : null);
      loadData();
    } catch (e: any) { alert(e.response?.data?.error || 'Error'); }
  };
  const handleRemovePart = async (orderId: string, partId: string) => {
    if (!confirm('¿Quitar refacción?')) return;
    try { const res = await orderAPI.removePart(orderId, partId); setSelected((prev: any) => prev ? { ...prev, total: res.data.order.total, cost_parts: res.data.order.cost_parts, OrderParts: prev.OrderParts?.filter((x:any)=>x.id!==partId) } : null); loadData(); } catch {}
  };
  const handlePagarResto = (order: any) => {
    const { resto } = getPagoInfo(order);
    if (resto <= 0) return;
    const pending = { folio: order.folio, orderId: order.id, customer: order.customer_name, device: `${order.device_brand} ${order.device_model}`, amount: resto, method: 'efectivo', type: 'liquidacion' };
    localStorage.setItem('pendingAnticipo', JSON.stringify(pending));
    setSelected(null);
    goToCaja(onNavigate);
  };
  const openWhatsApp = (order: any) => {
    const phone = order.customer_phone?.replace(/\D/g, ''); if (!phone) return;
    const text = `Hola ${order.customer_name}, tu equipo ${order.device_brand} ${order.device_model} folio ${order.folio} está: ${estadoConfig[order.status as keyof typeof estadoConfig]?.label}`;
    window.open(`https://wa.me/52${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };
  const handlePrint = (order: any) => {
    const win = window.open('', '_blank'); if (!win) return;
    win.document.write(`<html><body><h2>${order.folio} - ${order.customer_name}</h2><p>${order.device_brand} ${order.device_model}</p><p>Total: $${order.total}</p><script>window.print();window.close();</script></body></html>`);
    win.document.close();
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <div className="p-4 md:p-6 bg-[#f8fafc] min-h-full">
      <div className="flex items-center gap-2 text-sm text-ink-500 mb-4"><span className="font-semibold text-ink-900">Reparaciones</span><span>›</span><span>Taller</span><span>›</span><span>Historial</span><span className="ml-2 text-xs bg-ink-900 text-white px-2 py-0.5 rounded-full">{orders.length} total</span></div>

      <div className="bg-white rounded-2xl border border-ink-200 p-3 mb-4 flex flex-col lg:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="flex gap-2 w-full lg:w-auto flex-1">
          <select value={filtro} onChange={e=>setFiltro(e.target.value)} className="px-3 py-2 rounded-xl border text-sm bg-white"><option value="todos">Filtros - todos</option><option value="por_revisar">Por revisar</option><option value="en_reparacion">En reparación</option><option value="listo">Listo</option><option value="entregado">Entregado</option></select>
          <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." className="w-full pl-9 pr-3 py-2 rounded-xl border text-sm bg-ink-50" /></div>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded-xl border bg-white text-sm flex items-center gap-2"><FileText className="w-4 h-4"/>Cotizaciones</button>
          {/* AZUL UNIFICADO IGUAL QUE ORDERS - btn-primary = rgb(37 99 235) */}
          <button onClick={() => setShowCreate(true)} className="btn-primary px-4 py-2 rounded-xl text-sm flex items-center gap-2"><Plus className="w-4 h-4"/>Nueva reparación</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-[#f8fafc] border-b font-bold tracking-widest text-ink-500 uppercase text-xs"><th className="text-left py-3 px-4">Folio</th><th className="text-left py-3 px-4">Cliente</th><th className="text-left py-3 px-4">Equipo/Servicio</th><th className="text-left py-3 px-4">Estado</th><th className="text-left py-3 px-4">Fotos</th><th className="text-left py-3 px-4">Acciones</th></tr></thead>
            <tbody>
              {filtered.map((r: any) => {
                const cfg = estadoConfig[r.status as keyof typeof estadoConfig] || estadoConfig.por_revisar;
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-ink-50/50">
                    <td className="py-3 px-4"><div className="flex items-center gap-3"><span className={`w-1 h-8 rounded-full ${cfg.border}`} /><span className="text-sm font-semibold">{r.folio}</span></div></td>
                    <td className="py-3 px-4"><p className="text-sm font-medium truncate max-w-[150px]">{r.customer_name}</p><p className="text-xs text-ink-500">{r.customer_phone||'0'}</p></td>
                    <td className="py-3 px-4"><p className="text-sm truncate max-w-[200px]">{r.device_brand} {r.device_model}</p><p className="text-xs text-ink-500 uppercase truncate max-w-[200px]">{r.problem_description?.slice(0,35)}</p></td>
                    <td className="py-3 px-4"><span className={`text-xs ${cfg.text}`}>• {cfg.label}</span></td>
                    <td className="py-3 px-4"><span className="text-xs text-ink-400 flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" />0</span></td>
                    <td className="py-3 px-4"><div className="flex items-center gap-1.5"><button onClick={()=>setSelected(r)} className="w-8 h-8 rounded-lg bg-ink-100 hover:bg-ink-200 flex items-center justify-center"><Eye className="w-4 h-4" /></button><button onClick={()=>openWhatsApp(r)} className="w-8 h-8 rounded-lg bg-[#22c55e] text-white flex items-center justify-center"><MessageCircle className="w-4 h-4 fill-white" /></button><button onClick={()=>handlePrint(r)} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Printer className="w-4 h-4" /></button><button onClick={()=>handleDelete(r.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <OrderDetailModal order={selected} onClose={()=>setSelected(null)} products={products} onAddPart={handleAddPart} onRemovePart={handleRemovePart} onDelete={handleDelete} onPagarResto={handlePagarResto} onStatusChange={handleStatusChange} />}
      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} onCreate={handleCreateOrder} />}
    </div>
  );
}
