import { useState, useEffect, useRef } from 'react';
import { X, Check, Paperclip, Calendar } from 'lucide-react';
import { supportAPI } from '@/api/client';
import { useAuth } from '@/context/AuthContext';

const TYPE_LABEL: Record<string, string> = { bug: 'Bug/Error', duda: 'Duda/Consulta', mejora: 'Mejora/Sugerencia', otro: 'Otro' };
const PRIORITY_STYLE: Record<string, string> = { alta: 'bg-red-500 text-white', media: 'bg-orange-400 text-white', baja: 'bg-emerald-500 text-white' };
const STATUS_STYLE: Record<string, string> = { abierto: 'bg-blue-500 text-white', en_revision: 'bg-amber-400 text-white', en_progreso: 'bg-amber-400 text-white', resuelto: 'bg-emerald-500 text-white', cerrado: 'bg-gray-400 text-white' };
const STATUS_LABEL: Record<string, string> = { abierto: 'Abierto', en_revision: 'En revisión', en_progreso: 'En progreso', resuelto: 'Resuelto', cerrado: 'Cerrado' };

export default function TicketDetailModal({ ticket, onClose, onUpdated }: { ticket: any; onClose: () => void; onUpdated: () => void }) {
  const { user } = useAuth();
  // Solo Super Admin ve el botón de resuelto, el dropdown y los datos del taller
  const isSupportUser = user?.role === 'super_admin';

  const [currentStatus, setCurrentStatus] = useState(ticket.status);
  const [comments, setComments] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [marking, setMarking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadComments = async () => {
    try {
      const res = await supportAPI.comments(ticket.id);
      setComments(res.data.comments || []);
    } catch {}
  };
  useEffect(() => { loadComments(); }, [ticket.id]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [comments]);

  const handleSend = async () => {
    if (!reply.trim() && !file) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('message', reply.trim());
      if (file) fd.append('captura', file);
      await supportAPI.addComment(ticket.id, fd);
      setReply(''); setFile(null); loadComments(); onUpdated();
    } catch (e: any) { alert(e.response?.data?.error || 'Error enviando respuesta'); } finally { setSending(false); }
  };

  const handleChangeStatus = async (newStatus: string) => {
    setCurrentStatus(newStatus);
    try {
      await supportAPI.updateStatus(ticket.id, newStatus);
      onUpdated();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error cambiando estado');
      setCurrentStatus(ticket.status);
    }
  };

  const handleMarkResolved = async () => {
    if (!confirm('¿Marcar este ticket como resuelto?')) return;
    setMarking(true);
    try {
      await supportAPI.updateStatus(ticket.id, 'resuelto');
      setCurrentStatus('resuelto');
      onUpdated(); onClose();
    } catch (e: any) { alert(e.response?.data?.error || 'Error'); } finally { setMarking(false); }
  };

  const isResolved = currentStatus === 'resuelto' || currentStatus === 'cerrado';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 1100, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white', borderRadius: 20, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>

        {/* HEADER */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-b border-ink-100 shrink-0">
          <h2 className="text-xl md:text-2xl font-extrabold flex-1 min-w-0 truncate">#{ticket.folio} - {ticket.subject}</h2>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${PRIORITY_STYLE[ticket.priority] || 'bg-gray-100'}`}>Prioridad {ticket.priority === 'alta' ? 'Alta' : ticket.priority === 'media' ? 'Media' : 'Baja'}</span>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${STATUS_STYLE[currentStatus] || 'bg-gray-100'}`}>Estado: {STATUS_LABEL[currentStatus] || currentStatus}</span>

          {/* DROPDOWN DE ESTADO - SOLO SUPER ADMIN */}
          {isSupportUser && (
            <select value={currentStatus} onChange={(e) => handleChangeStatus(e.target.value)} className="text-sm font-bold border border-ink-200 rounded-lg px-3 py-1.5 bg-white outline-none">
              <option value="abierto">Abierto</option>
              <option value="en_revision">En Revisión</option>
              <option value="en_progreso">En progreso</option>
              <option value="resuelto">Resuelto</option>
              <option value="cerrado">Cerrado</option>
            </select>
          )}

          <span className="text-xs bg-ink-100 px-3 py-1.5 rounded-full flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {new Date(ticket.created_at).toLocaleDateString('es-MX')}</span>
          <span className="text-xs text-ink-500 hidden md:inline">creado por {ticket.user_name}</span>

          {/* BOTÓN RESUELTO - SOLO SUPER ADMIN */}
          {isSupportUser && !isResolved && (
            <button onClick={handleMarkResolved} disabled={marking} className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-full flex items-center gap-1 disabled:opacity-50">
              <Check className="w-4 h-4" /> {marking ? 'Marcando...' : 'Marcar como resuelto'}
            </button>
          )}
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0"><X className="w-5 h-5" /></button>
        </div>

        {/* CUERPO 2 COLUMNAS */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[340px_1fr]">
          {/* DETALLES */}
          <div className="p-6 border-r border-ink-100 overflow-y-auto hidden md:block">
            <h3 className="text-2xl font-extrabold mb-5">Detalles</h3>
            <p className="text-ink-500">Descripción</p>
            <p className="text-lg mt-1 mb-5 leading-snug">{ticket.description}</p>
            <p className="text-ink-500">Tipo</p>
            <p className="text-lg mt-1 mb-5">{TYPE_LABEL[ticket.type] || ticket.type}</p>

            {/* DATOS DEL TALLER - SOLO SUPER ADMIN */}
            {isSupportUser && (
              <>
                <p className="text-ink-500">Taller:</p>
                <p className="text-lg mt-1 mb-5">{ticket.tenant_name || 'Sin taller'}</p>
                <p className="text-ink-500">Plan del taller:</p>
                <p className="text-lg font-bold mt-1 mb-5">{ticket.tenant_plan ? `${ticket.tenant_plan} ${ticket.tenant_plan_price ? `$${ticket.tenant_plan_price}` : ''}` : '—'}</p>
                <p className="text-ink-500">Usuario:</p>
                <p className="text-lg mt-1 mb-5 flex items-center gap-2">{ticket.user_name} 👤</p>
              </>
            )}

            <p className="text-ink-500">Captura</p>
            {ticket.attachment_url ? (
              <div className="mt-2">
                <a href={ticket.attachment_url} target="_blank" rel="noreferrer">
                  <img src={ticket.attachment_url} className="w-28 h-20 object-cover rounded-lg border" />
                </a>
                <a href={ticket.attachment_url} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 underline mt-1">🖼️ Ver captura</a>
              </div>
            ) : <p className="text-sm text-ink-400 mt-2">Sin captura</p>}
            {ticket.system_info && (
              <div className="mt-6 bg-ink-50 rounded-xl p-3">
                <p className="text-xs font-bold text-ink-500 mb-1">Info del sistema</p>
                <p className="text-xs text-ink-600 break-words">{typeof ticket.system_info === 'string' ? ticket.system_info : JSON.stringify(ticket.system_info)}</p>
              </div>
            )}
          </div>

          {/* ACTIVIDAD / CONVERSACIÓN */}
          <div className="flex flex-col min-h-0">
            <div className="px-6 pt-5 pb-3 shrink-0">
              <h3 className="text-2xl font-extrabold md:hidden">Detalles</h3>
              <p className="text-sm text-ink-500 md:hidden mt-2">{ticket.description}</p>
              {isSupportUser && <p className="text-sm text-ink-500 md:hidden mt-1">Taller: {ticket.tenant_name || 'Sin taller'}</p>}
              <h3 className="text-2xl font-extrabold mt-2 md:mt-0">Actividad / Conversación</h3>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 space-y-5 pb-4">
              {/* Mensaje inicial */}
              <div className="flex gap-3">
                <div className="w-11 h-11 rounded-full bg-ink-100 flex items-center justify-center text-lg shrink-0">👤</div>
                <div className="min-w-0">
                  <p className="font-bold">{ticket.user_name}</p>
                  <p className="text-sm text-ink-500">Hoy {new Date(ticket.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                  <div className="bg-ink-50 rounded-xl px-4 py-3 mt-2 text- leading-snug max-w-xl">
                    {ticket.description}
                    {ticket.attachment_url && <a href={ticket.attachment_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 underline mt-2 text-sm">📎 captura adjunta <img src={ticket.attachment_url} className="w-10 h-8 object-cover rounded" /></a>}
                  </div>
                </div>
              </div>

              {/* Respuestas */}
              {comments.map((c: any) => {
                const isSupport = c.role === 'super_admin' || c.is_support;
                return (
                  <div key={c.id} className="flex gap-3">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg shrink-0 ${isSupport ? 'bg-blue-100' : 'bg-ink-100'}`}>{isSupport ? '🎧' : '👤'}</div>
                    <div className="min-w-0">
                      <p className={`font-bold ${isSupport ? 'text-blue-600' : ''}`}>{isSupport ? 'Soporte' : c.user_name}</p>
                      <p className="text-sm text-ink-500">{new Date(c.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      <div className="bg-blue-50 rounded-xl px-4 py-3 mt-2 text- leading-snug max-w-xl">
                        {c.message}
                        {c.attachment_url && <a href={c.attachment_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 underline mt-2 text-sm">📎 captura adjunta <img src={c.attachment_url} className="w-10 h-8 object-cover rounded" /></a>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* INPUT RESPUESTA */}
            {!isResolved ? (
              <div className="p-4 border-t border-ink-100 shrink-0">
                {file && <p className="text-xs text-blue-600 mb-2">📎 {file.name} <button onClick={() => setFile(null)} className="text-red-500 font-bold ml-1">x</button></p>}
                <div className="flex flex-wrap gap-2">
                  <input value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSend(); }} placeholder={isSupportUser ? "Escribe tu respuesta como Super Admin..." : "Escribe tu respuesta..."} className="flex-1 min-w- rounded-full border border-ink-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" hidden onChange={e => setFile(e.target.files?.[0] || null)} />
                  <button onClick={() => fileRef.current?.click()} className="border border-ink-200 rounded-full px-4 py-2.5 text-sm font-bold flex items-center gap-1 hover:bg-ink-50">📎 Adjuntar captura</button>
                  <button onClick={handleSend} disabled={sending} className={`${isSupportUser ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'} text-white rounded-full px-5 py-2.5 text-sm font-bold flex items-center gap-1 disabled:opacity-50`}><Paperclip className="w-4 h-4" /> {sending ? 'Enviando...' : 'Enviar'}</button>
                </div>
              </div>
            ) : (
              <div className="p-4 border-t border-ink-100 bg-emerald-50 text-center text-sm font-bold text-emerald-700 shrink-0">✅ Ticket resuelto</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}