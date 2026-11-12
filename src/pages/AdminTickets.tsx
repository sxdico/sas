import { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { supportAPI } from '@/api/client';
import TicketDetailModal from '@/components/TicketDetailModal';

type Filter = 'todos' | 'abierto' | 'en_revision' | 'resuelto';

const STATUS_LABEL: Record<string, string> = { abierto: 'Abierto', en_revision: 'En Revisión', en_progreso: 'En Revisión', resuelto: 'Resuelto', cerrado: 'Cerrado' };
const STATUS_STYLE: Record<string, string> = { abierto: 'bg-blue-100 text-blue-700', en_revision: 'bg-amber-100 text-amber-700', en_progreso: 'bg-amber-100 text-amber-700', resuelto: 'bg-emerald-100 text-emerald-700', cerrado: 'bg-gray-200 text-gray-600' };
const PRIORITY_STYLE: Record<string, string> = { alta: 'bg-red-100 text-red-700', media: 'bg-orange-100 text-orange-700', baja: 'bg-emerald-100 text-emerald-700' };

export default function AdminTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('todos');
  const [search, setSearch] = useState('');
  const [tallerFilter, setTallerFilter] = useState('todos');
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await supportAPI.list();
      const list = res.data.tickets || [];
      setTickets(list);
      // Si hay un ticket abierto, refresca sus datos sin cerrarlo
      if (selectedTicket) {
        const fresh = list.find((t: any) => t.id === selectedTicket.id);
        if (fresh) setSelectedTicket(fresh);
      }
    } catch (e) { console.error(e); } finally { if (!silent) setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const talleres = useMemo(() => {
    const names = [...new Set(tickets.map(t => t.tenant_name).filter(Boolean))];
    return names.sort();
  }, [tickets]);

  const stats = useMemo(() => ({
    total: tickets.length,
    abiertos: tickets.filter(t => t.status === 'abierto').length,
    revision: tickets.filter(t => ['en_revision', 'en_progreso'].includes(t.status)).length,
    resueltos: tickets.filter(t => t.status === 'resuelto').length,
  }), [tickets]);

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      const q = search.toLowerCase();
      const matchSearch = !q || `${t.folio} ${t.subject} ${t.user_name} ${t.tenant_name}`.toLowerCase().includes(q);
      const matchFilter = filter === 'todos' || t.status === filter || (filter === 'en_revision' && t.status === 'en_progreso');
      const matchTaller = tallerFilter === 'todos' || t.tenant_name === tallerFilter;
      return matchSearch && matchFilter && matchTaller;
    });
  }, [tickets, filter, search, tallerFilter]);

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mr-3" />Cargando tickets...</div>;

  return (
    <div className="p-4 md:p-6 bg-[#f8fafc] min-h-full">
      <p className="text-ink-500 mt-2 mb-5">Gestiona los tickets que abren todos tus talleres.</p>

      {/* STATS - 4 CUADROS COMO CANVA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Tickets', value: stats.total, icon: '📄', bg: 'bg-blue-100 text-blue-600' },
          { label: 'Abiertos', value: stats.abiertos, icon: '✉', bg: 'bg-blue-100 text-blue-600' },
          { label: 'En Revisión', value: stats.revision, icon: '🔍', bg: 'bg-amber-100 text-amber-600' },
          { label: 'Resueltos', value: stats.resueltos, icon: '✓', bg: 'bg-emerald-100 text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-ink-100">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0 bg-blue-100">{s.icon}</span>
              <p className="text-sm font-bold text-ink-900">{s.label}</p>
            </div>
            <p className="text-5xl font-extrabold text-ink-900 mt-3 leading-none">{s.value}</p>
          </div>
        ))}
      </div>

      {/* BUSCADOR + FILTROS + TALLER */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-3 mb-5 flex flex-col xl:flex-row xl:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por taller, ticket o usuario" className="w-full rounded-xl border border-ink-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {([
            { k: 'todos', label: 'Todos' },
            { k: 'abierto', label: 'Abiertos' },
            { k: 'en_revision', label: 'En progreso' },
            { k: 'resuelto', label: 'Resuelto' },
          ] as const).map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)} className={`px-4 py-2 rounded-full text-sm font-bold border ${filter === f.k ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-200 text-ink-700 border-gray-200 hover:bg-gray-300'}`}>{f.label}</button>
          ))}
        </div>
        <select value={tallerFilter} onChange={e => setTallerFilter(e.target.value)} className="rounded-xl border border-ink-200 px-3 py-2.5 text-sm font-bold outline-none bg-white shrink-0">
          <option value="todos">Filtrar por taller: Todos los talleres</option>
          {talleres.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* LISTA */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-ink-100">
          <div className="text-5xl mb-3">🐞</div>
          <h3 className="font-bold text-lg">Sin tickets</h3>
          <p className="text-ink-500 text-sm mt-1">Todavía ningún taller ha abierto un ticket.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(t => (
            <div
              key={t.id}
              onClick={() => setSelectedTicket(t)}
              className="bg-white rounded-2xl p-5 shadow-sm border border-ink-100 flex gap-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
            >
              <span className="w-14 h-14 rounded-xl bg-red-100 text-red-500 flex items-center justify-center text-2xl shrink-0">🐞</span>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-lg leading-tight">#{t.folio} {t.subject}</p>
                <p className="text-ink-600 text-sm mt-0.5">taller: {t.tenant_name || 'Sin taller'} - {t.user_name}</p>
                <div className="flex flex-wrap gap-2 mt-2 items-center">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${PRIORITY_STYLE[t.priority] || 'bg-gray-100'}`}>● Prioridad {t.priority === 'alta' ? 'Alta' : t.priority === 'media' ? 'Media' : 'Baja'}</span>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_STYLE[t.status] || 'bg-gray-100'}`}>● {STATUS_LABEL[t.status] || t.status}</span>
                  <span className="text-sm text-ink-500">📅 {new Date(t.created_at).toLocaleDateString('es-MX')}</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0 self-center">
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedTicket(t); }}
                  className="border border-blue-600 text-blue-600 px-5 py-2.5 rounded-full text-sm font-bold hover:bg-blue-50"
                >
                  Responder
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedTicket(t); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-sm"
                >
                  Ver detalle
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdated={() => load(true)}
        />
      )}
    </div>
  );
}