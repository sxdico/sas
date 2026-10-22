import { useState, useEffect } from 'react';
import { broadcastAPI } from '@/api/client';
import { Megaphone, Send, Trash2, Users, Calendar, Filter, Check, AlertTriangle } from 'lucide-react';

const PLAN_OPTIONS = [
  { id: 'all', label: 'Todos los planes' },
  { id: 'trial', label: 'Trial' },
  { id: 'basic', label: 'Básico $299' },
  { id: 'pro', label: 'Pro $399' },
  { id: 'premium', label: 'Premium $499' },
];

const ROLE_OPTIONS = [
  { id: 'owner', label: 'Dueño' },
  { id: 'secretary', label: 'Secretaria' },
  { id: 'technician', label: 'Técnico' },
  { id: 'cashier', label: 'Cajero' },
];

const TYPE_OPTIONS = [
  { id: 'info', label: 'Info', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'success', label: 'Éxito', color: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'warning', label: 'Aviso', color: 'bg-amber-100 text-amber-700 border-amber-200' },
];

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: '',
    message: '',
    type: 'info',
    target_plans: 'all',
    target_roles: 'owner,secretary,cashier,technician',
    expires_at: ''
  });
  const [selectedPlans, setSelectedPlans] = useState<string[]>(['all']);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['owner','secretary','cashier','technician']);
  const [preview, setPreview] = useState<{ count: number; byPlan: Record<string,number> } | null>(null);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await broadcastAPI.list();
      setBroadcasts(res.data.broadcasts);
    } catch(e){ console.error(e); } finally { setLoading(false); }
  };

  useEffect(()=>{ load(); }, []);

  const updatePreview = async (plans: string[]) => {
    const plansStr = plans.includes('all') ? 'all' : plans.join(',');
    try {
      const res = await broadcastAPI.preview({ plans: plansStr, status: 'active' });
      setPreview(res.data);
    } catch(e){ console.error(e); }
  };

  useEffect(()=>{
    updatePreview(selectedPlans);
    const plansStr = selectedPlans.includes('all') ? 'all' : selectedPlans.join(',');
    const rolesStr = selectedRoles.join(',');
    setForm(f => ({ ...f, target_plans: plansStr, target_roles: rolesStr }));
  }, [selectedPlans, selectedRoles]);

  const togglePlan = (id: string) => {
    if (id === 'all') { setSelectedPlans(['all']); return; }
    let next = selectedPlans.filter(p=>p!=='all');
    if (next.includes(id)) next = next.filter(p=>p!==id);
    else next = [...next, id];
    if (next.length===0) next=['all'];
    setSelectedPlans(next);
  };

  const toggleRole = (id: string) => {
    let next = selectedRoles.includes(id) ? selectedRoles.filter(r=>r!==id) : [...selectedRoles, id];
    if (next.length===0) next=['owner'];
    setSelectedRoles(next);
  };

  const handleSend = async () => {
    if (!form.title || !form.message) { alert('Título y mensaje requeridos'); return; }
    if (!confirm(`¿Enviar a ${preview?.count || 0} talleres? Aparecerá en su campanita 🔔`)) return;
    setSending(true);
    try {
      const res = await broadcastAPI.create({
        title: form.title,
        message: form.message,
        type: form.type,
        target_plans: form.target_plans,
        target_roles: form.target_roles,
        expires_at: form.expires_at || null
      });
      setSuccess(`Enviado a ${res.data.sent_to} talleres`);
      setForm({ title:'', message:'', type:'info', target_plans:'all', target_roles:'owner,secretary,cashier,technician', expires_at:'' });
      setSelectedPlans(['all']);
      load();
      setTimeout(()=>setSuccess(null), 4000);
    } catch(err:any){ alert(err.response?.data?.error || 'Error enviando'); } finally { setSending(false); }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center"><Megaphone className="w-5 h-5 text-white" /></div>
        <div><h1 className="text-xl font-bold">Broadcasts a Tenants</h1><p className="text-sm text-gray-500">Mensajes que aparecen en la campanita 🔔 de los usuarios</p></div>
      </div>

      {success && <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg flex items-center gap-2"><Check className="w-5 h-5" /> {success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5 space-y-4">
          <h3 className="font-bold">Nuevo anuncio</h3>
          <div>
            <label className="label">Título (max 100)</label>
            <input className="input w-full" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ej: Nueva función de reportes disponible" maxLength={100} />
          </div>
          <div>
            <label className="label">Mensaje</label>
            <textarea className="input w-full min-h-[100px]" value={form.message} onChange={e=>setForm({...form,message:e.target.value})} placeholder="Hola, hemos lanzado..." />
          </div>
          <div>
            <label className="label">Tipo</label>
            <div className="flex gap-2">
              {TYPE_OPTIONS.map(t=>(
                <button key={t.id} onClick={()=>setForm({...form,type:t.id})} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${form.type===t.id ? t.color+' ring-2 ring-offset-1' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>{t.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-1"><Filter className="w-3 h-3" /> Filtrar por planes</label>
            <div className="flex flex-wrap gap-2">
              {PLAN_OPTIONS.map(p=>(
                <button key={p.id} onClick={()=>togglePlan(p.id)} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${selectedPlans.includes(p.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{p.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Roles que lo verán</label>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map(r=>(
                <button key={r.id} onClick={()=>toggleRole(r.id)} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${selectedRoles.includes(r.id) ? 'bg-ink-800 text-white border-ink-800' : 'bg-white border-gray-200 text-gray-600'}`}>{r.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-1"><Calendar className="w-3 h-3" /> Expira (opcional)</label>
            <input type="date" className="input w-full" value={form.expires_at} onChange={e=>setForm({...form,expires_at:e.target.value})} />
          </div>
          <button onClick={handleSend} disabled={sending || !form.title || !form.message} className="btn-primary w-full justify-center py-3">
            <Send className="w-4 h-4" /> {sending ? 'Enviando...' : `Enviar a ${preview?.count ?? 0} talleres`}
          </button>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h4 className="font-bold text-sm flex items-center gap-2"><Users className="w-4 h-4" /> Alcance</h4>
            <div className="mt-3">
              <p className="text-3xl font-bold">{preview?.count ?? 0}</p>
              <p className="text-xs text-gray-500">talleres activos recibirán la notificación</p>
              {preview?.byPlan && Object.keys(preview.byPlan).length>0 && (
                <div className="mt-3 space-y-1">
                  {Object.entries(preview.byPlan).map(([plan,c])=>(
                    <div key={plan} className="flex justify-between text-xs"><span className="text-gray-600">{plan}</span><span className="font-bold">{c}</span></div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800 flex gap-1"><AlertTriangle className="w-3 h-3 mt-0.5" /> Aparecerá en la campanita 🔔 y aumentará el contador notificationCount que ya tienes en Layout.</p>
            </div>
          </div>
          <div className="card p-4">
            <h4 className="font-bold text-sm mb-2">Preview notificación</h4>
            <div className="border rounded-lg p-3 bg-white">
              <p className="text-sm font-bold">[📢 {form.type.toUpperCase()}] {form.title || 'Título aquí'}</p>
              <p className="text-xs text-gray-600 mt-1">{form.message || 'Mensaje aquí'}</p>
              <span className={`mt-2 inline-block text-[10px] px-2 py-0.5 rounded-full border ${TYPE_OPTIONS.find(t=>t.id===form.type)?.color}`}>{form.type}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-bold mb-4">Historial de envíos</h3>
        {loading ? <p className="text-sm text-gray-500">Cargando...</p> : broadcasts.length===0 ? <p className="text-sm text-gray-400">Sin envíos aún</p> : (
          <div className="space-y-2">
            {broadcasts.map((b:any)=>(
              <div key={b.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{b.title}</p>
                  <p className="text-xs text-gray-500 truncate">{b.message} · {b.tenant_count} talleres · Planes: {b.target_plans} · Roles: {b.target_roles}</p>
                  <p className="text-[11px] text-gray-400">{new Date(b.created_at).toLocaleString('es-MX')} por {b.created_by_name}</p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${TYPE_OPTIONS.find(t=>t.id===b.type)?.color}`}>{b.type}</span>
                  <button onClick={async()=>{ if(confirm('Borrar historial?')){ await broadcastAPI.delete(b.id); load(); } }} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-500" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
