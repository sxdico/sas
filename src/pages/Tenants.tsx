import { useState, useEffect, useMemo } from 'react';
import { tenantAPI } from '@/api/client'; // tu api.ts
import { formatDate } from '@/utils/permissions';
import type { Tenant } from '@/types';
import {
  Building2, Plus, Search, Power, RefreshCw, X, Check, Copy,
  Users, AlertTriangle,
} from 'lucide-react';

const PLANS = [
  { id: 'starter', name: 'Starter', price: '$499/mes', color: 'bg-ink-100 text-ink-700' },
  { id: 'pro', name: 'Pro', price: '$999/mes', color: 'bg-primary-100 text-primary-700' },
  { id: 'enterprise', name: 'Enterprise', price: '$1,999/mes', color: 'bg-accent-100 text-accent-700' },
] as const;

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createdTenant, setCreatedTenant] = useState<{ name: string; email: string; password: string } | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const res = await tenantAPI.list();
      setTenants(res.data.tenants);
    } catch (e) {
      console.error('Error cargando tenants', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTenants(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return tenants;
    const q = search.toLowerCase();
    return tenants.filter((t) => 
      t.name_taller.toLowerCase().includes(q) || 
      t.name_dueno.toLowerCase().includes(q) || 
      t.email.toLowerCase().includes(q)
    );
  }, [tenants, search]);

  const toggleStatus = async (t: Tenant) => {
    try {
      if (t.status === 'active') {
        await tenantAPI.suspend(t.id);
      } else {
        await tenantAPI.reactivate(t.id);
      }
      await loadTenants();
    } catch (e) {
      console.error(e);
    } finally {
      setConfirmSuspend(null);
    }
  };

  if (loading) return <div className="p-6">Cargando talleres...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input className="input pl-10" placeholder="Buscar taller, dueño o email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Nuevo taller
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 md:px-6 pb-6">
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ink-50 border-b border-ink-200">
                <tr>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3">Taller</th>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3 hidden md:table-cell">Dueño</th>
                  <th className="text-center text-xs font-bold text-ink-500 uppercase px-4 py-3">Estado</th>
                  <th className="text-right text-xs font-bold text-ink-500 uppercase px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-ink-800">{t.name_taller}</p>
                      <p className="text-xs text-ink-500">{t.email}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm font-medium text-ink-700">{t.name_dueno}</p>
                      <p className="text-xs text-ink-500">{t.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${t.status === 'active' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setConfirmSuspend(t)} className="p-2 rounded-lg">
                        {t.status === 'active' ? <Power className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateTenantModal
          onClose={() => setShowCreate(false)}
          onCreate={async (data) => {
            try {
              const res = await tenantAPI.create(data);
              const creds = res.data.credentials;
              setShowCreate(false);
              setCreatedTenant({ name: data.name_dueno, email: creds.email, password: creds.password });
              await loadTenants();
            } catch (err: any) {
              alert(err.response?.data?.error || err.message);
            }
          }}
        />
      )}

      {createdTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-center mb-5">Taller creado con éxito</h3>
            <div className="bg-ink-50 rounded-lg p-3 mb-3">
              <p className="text-xs text-ink-400">Correo</p>
              <p className="text-sm font-medium">{createdTenant.email}</p>
            </div>
            <div className="bg-primary-50 rounded-lg p-3 border-2 border-primary-200 mb-5">
              <p className="text-xs text-primary-600 font-semibold">Contraseña temporal (se muestra solo una vez)</p>
              <div className="flex items-center justify-between gap-2">
                <code className="text-lg font-bold font-mono">{createdTenant.password}</code>
                <button onClick={() => navigator.clipboard.writeText(createdTenant.password)} className="p-2 bg-white rounded-lg"><Copy className="w-4 h-4" /></button>
              </div>
            </div>
            <button onClick={() => setCreatedTenant(null)} className="btn-primary w-full">Entendido</button>
          </div>
        </div>
      )}

      {confirmSuspend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmSuspend(null)}>
          <div className="card w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5">{confirmSuspend.status === 'active' ? '¿Suspender?' : '¿Reactivar?'} {confirmSuspend.name_taller}</h3>
            <div className="flex gap-3">
              <button onClick={() => setConfirmSuspend(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => toggleStatus(confirmSuspend)} className="btn-primary flex-1">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateTenantModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (data: any) => void;
}) {
  const [form, setForm] = useState({ name_taller: '', name_dueno: '', email: '', phone: '', plan: 'starter' });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-5">Crear nuevo taller</h2>
        <div className="space-y-4">
          <input className="input w-full" placeholder="Nombre del taller" value={form.name_taller} onChange={(e) => setForm({ ...form, name_taller: e.target.value })} />
          <input className="input w-full" placeholder="Nombre del dueño" value={form.name_dueno} onChange={(e) => setForm({ ...form, name_dueno: e.target.value })} />
          <input className="input w-full" placeholder="Email (debe ser nuevo)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input w-full" placeholder="Celular" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => onCreate(form)} className="btn-primary flex-1">Crear</button>
        </div>
      </div>
    </div>
  );
}