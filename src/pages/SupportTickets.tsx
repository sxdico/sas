import { useState, useEffect, useMemo } from 'react';
import { Plus, Calendar, Search } from 'lucide-react';
import { supportAPI } from '@/api/client';
import NewTicketModal from '@/components/NewTicketModal';
import TicketDetailModal from '@/components/TicketDetailModal';

type Filter = 'todos' | 'abierto' | 'en_revision' | 'resuelto' | 'cerrado';

const STATUS_LABEL: Record<string, string> = {
  abierto: 'Abierto',
  en_revision: 'En revisión',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
};

const STATUS_STYLE: Record<string, string> = {
  abierto: 'bg-sky-100 text-sky-700',
  en_revision: 'bg-amber-400 text-white',
  en_progreso: 'bg-amber-400 text-white',
  resuelto: 'bg-emerald-100 text-emerald-700',
  cerrado: 'bg-gray-200 text-gray-600',
};

const PRIORITY_STYLE: Record<string, string> = {
  alta: 'bg-red-500 text-white',
  media: 'bg-orange-400 text-white',
  baja: 'bg-emerald-500 text-white',
};

export default function SupportTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('todos');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await supportAPI.list();
      setTickets(res.data.tickets || []);
    } catch (e) { console.error(e); } finally { if (!silent) setLoading(false); }
  };
  useEffect(() => {
  load();
  // Si viene desde la campanita, abre ese ticket solo
  const folioToOpen = localStorage.getItem('fixpro_open_ticket');
  if (folioToOpen) {
    localStorage.removeItem('fixpro_open_ticket');
    // Espera a que carguen los tickets
    setTimeout(async () => {
      try {
        const res = await supportAPI.list();
        const found = (res.data.tickets || []).find((t: any) => t.folio === folioToOpen);
        if (found) setSelectedTicket(found);
      } catch {}
    }, 500);
  }
}, []);

  const stats = useMemo(() => ({
    abiertos: tickets.filter(t => t.status === 'abierto').length,
    revision: tickets.filter(t => ['en_revision', 'en_progreso'].includes(t.status)).length,
    resueltos: tickets.filter(t => t.status === 'resuelto').length,
  }), [tickets]);

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      const q = search.toLowerCase();
      const matchSearch = !q || `${t.folio} ${t.subject} ${t.description}`.toLowerCase().includes(q);
      const matchFilter = filter === 'todos' || t.status === filter || (filter === 'en_revision' && t.status === 'en_progreso');
      return matchSearch && matchFilter;
    });
  }, [tickets, filter, search]);

  const getIcon = (t: any) => {
    if (t.status === 'resuelto' || t.status === 'cerrado') return <span className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl">✓</span>;
    if (t.priority === 'alta') return <span className="w-14 h-14 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-2xl">🐞</span>;
    if (t.priority === 'media') return <span className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-2xl">🐞</span>;
    return <span className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl">✓</span>;
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mr-3" />Cargando tickets...</div>;

  return (
    <div className="p-4 md:p-6 bg-[#f8fafc] min-h-full">
      {/* HEADER - IGUAL QUE EN TU CANVA */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-ink-500 mt-2">Si encontraste un error o necesitas ayuda abre un ticket</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1 shadow"><Plus className="w-4 h-4" /> Nuevo Ticket</button>
      </div>
      {/* BUSCADOR + FILTROS - IGUAL QUE CLIENTES */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-3 mb-5 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ticket..."
            className="w-full rounded-xl border border-ink-200 bg-white pl-10 pr-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {([
            { k: 'todos', label: 'Todos' },
            { k: 'abierto', label: 'Abiertos' },
            { k: 'en_revision', label: 'En progreso' },
            { k: 'resuelto', label: 'Resuelto' },
            { k: 'cerrado', label: 'Cerrado' },
          ] as const).map(f => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                filter === f.k
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-ink-600 border-ink-200 hover:bg-ink-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {/* STATS - MISMO TAMAÑO QUE CLIENTES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-ink-100">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl shrink-0">🎫</span>
            <p className="text- text-ink-600">Tickets Abiertos</p>
          </div>
          <p className="text-4xl font-extrabold text-ink-900 mt-4 leading-none">{stats.abiertos}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-ink-100">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl shrink-0">🔄</span>
            <p className="text- text-ink-600">En Revisión</p>
          </div>
          <p className="text-4xl font-extrabold text-ink-900 mt-4 leading-none">{stats.revision}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-ink-100">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl shrink-0">✓</span>
            <p className="text- text-ink-600">Resueltos</p>
          </div>
          <p className="text-4xl font-extrabold text-ink-900 mt-4 leading-none">{stats.resueltos}</p>
        </div>
      </div>

      {/* LISTA */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-ink-100">
          <div className="text-5xl mb-3">🐞</div>
          <h3 className="font-bold text-lg">Sin tickets</h3>
          <p className="text-ink-500 text-sm mt-1">Cuando algo falle, repórtalo aquí y lo revisamos.</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-5"><Plus className="w-4 h-4" /> Nuevo Ticket</button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(t => (
            <div key={t.id} onClick={() => setSelectedTicket(t)} className="bg-white rounded-2xl p-5 shadow-sm border border-ink-100 flex gap-4 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all">
              {getIcon(t)}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">#{t.folio}</p>
                <p className="font-extrabold text-lg leading-tight truncate">{t.subject}</p>
                <p className="text-ink-600 text-sm mt-1 line-clamp-2">{t.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${PRIORITY_STYLE[t.priority] || 'bg-gray-100'}`}>Prioridad {t.priority === 'alta' ? 'Alta' : t.priority === 'media' ? 'Media' : 'Baja'}</span>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_STYLE[t.status] || 'bg-gray-100'}`}>Estado: {STATUS_LABEL[t.status] || t.status}</span>
                  <span className="text-sm text-ink-500 flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(t.created_at).toLocaleDateString('es-MX')}</span>
                  {t.attachment_url && <a href={t.attachment_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs font-bold text-blue-600 underline">Ver captura</a>}
                </div>
              </div>
              <div className="hidden sm:flex flex-col items-center gap-1 shrink-0">
                <div className="w-10 h-10 rounded-full bg-ink-200 flex items-center justify-center text-ink-500">👤</div>
                <span className="text-xs text-ink-500">{t.user_name || 'Soporte'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <NewTicketModal onClose={() => setShowModal(false)} onCreated={() => load()} />}
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