import { useEffect, useState, useMemo } from 'react';
import { Search, Filter, MessageCircle, Image as ImageIcon, Plus, FileText } from 'lucide-react';

type RepairOrder = {
  id: string;
  folio: string;
  customer_name: string;
  customer_phone: string;
  device_brand: string;
  device_model: string;
  device_type: string;
  problem_description: string;
  status: string;
  total: number;
  advance_payment: number;
  created_at: string;
  priority: string;
};

const estadoConfig: Record<string, { label: string; dot: string; text: string; border: string }> = {
  por_revisar: { label: 'pendiente', dot: 'bg-red-500', text: 'text-red-600', border: 'bg-red-500' },
  en_revision: { label: 'en revisión', dot: 'bg-yellow-500', text: 'text-yellow-600', border: 'bg-yellow-500' },
  en_reparacion: { label: 'en reparación', dot: 'bg-orange-500', text: 'text-orange-600', border: 'bg-orange-500' },
  listo: { label: 'listo', dot: 'bg-blue-500', text: 'text-blue-600', border: 'bg-blue-500' },
  entregado: { label: 'entregado', dot: 'bg-green-500', text: 'text-green-600', border: 'bg-green-500' },
  cancelado: { label: 'cancelado', dot: 'bg-ink-400', text: 'text-ink-500', border: 'bg-ink-300' },
};

export default function RepairsPage() {
  const [orders, setOrders] = useState<RepairOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/orders', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setOrders(data.orders || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const filtered = useMemo(() => {
    return orders.filter(r => {
      const term = search.toLowerCase();
      const matchSearch = `${r.folio} ${r.customer_name} ${r.device_brand} ${r.device_model} ${r.customer_phone}`.toLowerCase().includes(term);
      const matchEstado = filtro === 'todos' || r.status === filtro;
      return matchSearch && matchEstado;
    });
  }, [orders, search, filtro]);

  const openWhatsApp = (order: RepairOrder) => {
    const phone = order.customer_phone.replace(/\D/g, '');
    const text = `Hola ${order.customer_name}, te escribimos de iFixSoft sobre tu equipo ${order.device_brand} ${order.device_model} - Folio ${order.folio}. Estado: ${estadoConfig[order.status]?.label || order.status}`;
    window.open(`https://wa.me/52${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading) {
    return <div className="p-6 text-ink-500">Cargando reparaciones...</div>;
  }

  return (
    <div className="p-4 md:p-6 bg-[#f8fafc] min-h-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-ink-500 mb-4">
        <span className="font-semibold text-ink-900">Reparaciones</span>
        <span className="text-ink-300">›</span>
        <span>Taller</span>
        <span className="text-ink-300">›</span>
        <span>Historial</span>
        <div className="ml-auto hidden md:flex">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-ink-200 bg-white text-xs text-ink-600">
            <span className="w-4 h-4 rounded-full bg-teal-100 flex items-center justify-center">?</span>
            Tutorial
          </button>
        </div>
      </div>

      {/* Barra acciones - idéntica a tu foto */}
      <div className="bg-white rounded-2xl border border-ink-200 p-3 mb-4 flex flex-col lg:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="flex gap-2 w-full lg:w-auto flex-1">
          <div className="relative">
            <select
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
              className="appearance-none flex items-center gap-2 pl-3 pr-8 py-2 rounded-xl border border-ink-200 text-sm text-ink-700 bg-white hover:bg-ink-50"
            >
              <option value="todos">Filtros - todos</option>
              <option value="por_revisar">Por revisar</option>
              <option value="en_revision">En revisión</option>
              <option value="listo">Listo</option>
              <option value="entregado">Entregado</option>
            </select>
            <Filter className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink-400" />
          </div>
          <div className="relative flex-1 lg:max-w-">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por folio, cliente, equipo, notas..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-ink-200 text-sm bg-ink-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
        </div>
        <div className="flex gap-2 w-full lg:w-auto justify-end">
          <button 
            onClick={() => window.location.href = '/cotizaciones'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-ink-200 bg-white text-sm font-medium hover:bg-ink-50"
          >
            <FileText className="w-4 h-4" />
            Cotizaciones
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4f46e5] text-white text-sm font-semibold shadow-sm hover:bg-[#4338ca]">
            <Plus className="w-4 h-4" />
            Agregar reparación
          </button>
        </div>
      </div>

      {/* Tabla Desktop */}
      <div className="bg-white rounded-2xl border border-ink-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-ink-200 text- font-bold tracking-widest text-ink-500 uppercase">
                <th className="text-left py-3 px-4">Folio</th>
                <th className="text-left py-3 px-4">Cliente</th>
                <th className="text-left py-3 px-4">Equipo/Servicio</th>
                <th className="text-left py-3 px-4">Estado</th>
                <th className="text-left py-3 px-4">Fotos</th>
                <th className="text-left py-3 px-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const cfg = estadoConfig[r.status] || estadoConfig.por_revisar;
                return (
                  <tr key={r.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span className={`w-1 h-8 rounded-full ${cfg.border}`} />
                        <span className="text-sm font-semibold text-ink-900">{r.folio}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="leading-tight">
                        <p className="text-sm font-medium text-ink-900 lowercase truncate max-w-">{r.customer_name}</p>
                        <p className="text- text-ink-500">{r.customer_phone}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="leading-tight">
                        <p className="text-sm font-medium text-ink-900 truncate max-w-">{r.device_brand} {r.device_model}</p>
                        <p className="text- text-ink-500 uppercase truncate max-w-">{r.problem_description?.slice(0,30)}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        <span className={`text-xs font-medium ${cfg.text}`}>• {cfg.label}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-ink-400 text-xs">
                        <ImageIcon className="w-3.5 h-3.5" />
                        0
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <button 
                        onClick={() => openWhatsApp(r)}
                        className="w-8 h-8 rounded-lg bg-[#22c55e] hover:bg-[#16a34a] text-white flex items-center justify-center transition-colors"
                        title="Enviar WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4 fill-white" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-ink-400 text-sm">
                    No se encontraron reparaciones
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}