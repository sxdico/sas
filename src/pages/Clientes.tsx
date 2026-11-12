import { useState, useEffect } from 'react';
import { Search, Plus, Star, Phone, Calendar, X, Trash2 } from 'lucide-react';
import { customerAPI } from '@/api/client';
import { formatCurrency } from '@/utils/permissions';
import NuevoClienteModal from '@/components/NuevoClienteModal';

interface Props { onNavigate?: (page: string) => void; }
const AVATAR_COLORS = ['bg-blue-500','bg-green-500','bg-purple-500','bg-orange-500','bg-pink-500','bg-teal-500','bg-red-500','bg-indigo-500'];

export default function Clientes({ onNavigate }: Props) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, frecuentes: 0, nuevos_mes: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todos'|'frecuentes'|'nuevos'>('todos');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await customerAPI.list({ search, filter });
      setCustomers(res.data.customers || []);
      setStats(res.data.stats || { total: 0, frecuentes: 0, nuevos_mes: 0 });
    } catch(e){ console.error(e); } finally { setLoading(false); }
  };
  useEffect(()=>{ const t = setTimeout(load, 300); return ()=> clearTimeout(t); }, [search, filter]);

  const handleCreate = async (data: any) => {
    await customerAPI.create(data);
    setShowModal(false);
    await load();
    if (data.send_welcome) {
      const msg = encodeURIComponent(`Hola ${data.name} 👋 ¡Bienvenido a iFixSoft! Ya estás registrado como cliente. Cuando necesites reparación, escríbenos aquí.`);
      window.open(`https://wa.me/52${data.phone.replace(/\D/g,'')}?text=${msg}`, '_blank');
    }
  };
  const handleDelete = async (id: string, name: string) => {
    if(!confirm(`¿Eliminar a ${name}?`)) return;
    await customerAPI.delete(id); load();
  };
  const handleNuevaOrden = (c: any) => {
    localStorage.setItem('prefillCliente', JSON.stringify({ customer_name: c.name, customer_phone: c.phone, customer_id: c.id }));
    if (onNavigate) onNavigate('orders');
  };
  const getInitial = (name: string) => name?.charAt(0)?.toUpperCase() || '?';
  const getColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  const formatDate = (d: any) => d ? new Date(d).toLocaleDateString('es-MX',{ day:'2-digit', month:'short' }) : 'Sin visitas';

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mr-3"/>Cargando clientes...</div>;

  return (
    <div className="p-4 md:p-6 bg-[#f1f5f9] min-h-full">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-slate-500 mt-1">Registra a tus clientes que regresan para agilizar ventas y reparaciones</p>
        </div>
        {/* MISMA LINEA EXACTA QUE NUEVA ORDEN EN Orders.tsx */}
        <button onClick={()=> setShowModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> Nuevo Cliente</button>
      </div>

      {/* BUSCADOR - MISMO TAMAÑO QUE HISTORIAL DE CLIENTES / Repairs.tsx */}
      <div className="bg-white rounded-2xl border border-ink-200 p-3 mb-4 flex flex-col lg:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="flex gap-2 w-full lg:w-auto flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={e=> setSearch(e.target.value)} placeholder="Buscar por nombre o teléfono" className="w-full pl-9 pr-3 py-2 rounded-xl border text-sm bg-ink-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {search && <button onClick={()=> setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-slate-400"/></button>}
          </div>
        </div>
        <div className="flex gap-2">
          {(['todos','frecuentes','nuevos'] as const).map(f=> (
            <button key={f} onClick={()=> setFilter(f)} className={`px-4 py-2 rounded-xl text-sm font-bold border ${filter===f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'}`}>{f==='todos'?'Todos': f==='frecuentes'?'Frecuentes':'Nuevos'}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm"><div className="flex items-center gap-3"><span className="bg-blue-50 p-2.5 rounded-xl text-xl">👥</span><span className="text-slate-700">Total Clientes</span></div><p className="text-4xl font-extrabold mt-2">{stats.total}</p></div>
        <div className="bg-white rounded-2xl p-5 shadow-sm"><div className="flex items-center gap-3"><span className="bg-amber-50 p-2.5 rounded-xl text-xl">⭐</span><span className="text-slate-700">Frecuentes</span></div><p className="text-4xl font-extrabold mt-2">{stats.frecuentes} <span className="text-amber-500 text-2xl">☆</span></p></div>
        <div className="bg-white rounded-2xl p-5 shadow-sm"><div className="flex items-center gap-3"><span className="bg-green-50 p-2.5 rounded-xl text-xl">👤+</span><span className="text-slate-700">Nuevos este mes</span></div><p className="text-4xl font-extrabold mt-2">{stats.nuevos_mes}</p></div>
      </div>
      
      {customers.length===0 ? (
        <div className="bg-white rounded-2xl p-12 text-center">
          <div className="text-6xl mb-4">👥</div>
          <h3 className="font-bold text-xl">Aún no tienes clientes registrados</h3>
          <p className="text-slate-500 mt-1 mb-5">Crea tu primer cliente y agiliza tus próximas ventas.</p>
          <button onClick={()=> setShowModal(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">+ Nuevo Cliente</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {customers.map(c=> (
            <div key={c.id} className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition">
              <div className="flex gap-3">
                <div className={`w-14 h-14 rounded-full ${getColor(c.name)} text-white flex items-center justify-center text-2xl font-bold shrink-0`}>{getInitial(c.name)}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-lg truncate">{c.name}</p>
                  <p className="text-slate-500 text-sm flex items-center gap-1"><Phone className="w-3.5 h-3.5"/> {c.phone}</p>
                  {c.is_frequent && <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full mt-1"><Star className="w-3 h-3 fill-amber-500 text-amber-500"/> Frecuente</span>}
                </div>
                <button onClick={()=> handleDelete(c.id, c.name)} className="text-slate-300 hover:text-red-500 self-start"><Trash2 className="w-4 h-4"/></button>
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-slate-600">
                <p>📶 {c.visits || 0} visitas 👥</p>
                <p className="flex items-center gap-1.5"><Calendar className="w-4 h-4"/> Última visita 📅 {formatDate(c.last_visit)}</p>
                <p className="text-lg font-extrabold text-slate-900">{formatCurrency(c.total_spent || 0)} gastado</p>
                {c.notes && <p className="text-xs bg-slate-50 p-2 rounded-lg italic">“{c.notes}”</p>}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={()=> setSelected(c)} className="flex-1 border border-slate-900 rounded-xl py-2.5 font-bold text-sm">Ver historial</button>
                <button onClick={()=> handleNuevaOrden(c)} className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 font-bold text-sm">Nueva Orden</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {showModal && <NuevoClienteModal onClose={()=> setShowModal(false)} onSave={handleCreate} />}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={()=> setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e=> e.stopPropagation()}>
            <div className="flex justify-between"><h3 className="font-bold text-xl">{selected.name}</h3><button onClick={()=> setSelected(null)}><X/></button></div>
            <p className="text-slate-500">{selected.phone} • {selected.email || 'Sin correo'}</p>
            <p className="mt-3 text-sm"><b>Visitas:</b> {selected.visits} • <b>Gastado:</b> {formatCurrency(selected.total_spent||0)}</p>
            <p className="text-sm mt-1"><b>Notas:</b> {selected.notes || 'Sin notas'}</p>
            <button onClick={()=> { setSelected(null); handleNuevaOrden(selected); }} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold mt-5">Nueva Orden para {selected.name.split(' ')[0]}</button>
          </div>
        </div>
      )}
    </div>
  );
}