import { useState, useMemo } from 'react';
import { tenants as initialTenants } from '@/data/mock';
import { generatePassword, formatDate, ROLE_LABELS } from '@/utils/permissions';
import type { Tenant } from '@/types';
import {
  Building2, Plus, Search, Power, RefreshCw, X, Check, Copy,
  Users, ClipboardList, Crown, Shield, AlertTriangle,
} from 'lucide-react';

const PLANS = [
  { id: 'starter', name: 'Starter', price: '$499/mes', color: 'bg-ink-100 text-ink-700' },
  { id: 'pro', name: 'Pro', price: '$999/mes', color: 'bg-primary-100 text-primary-700' },
  { id: 'enterprise', name: 'Enterprise', price: '$1,999/mes', color: 'bg-accent-100 text-accent-700' },
] as const;

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createdTenant, setCreatedTenant] = useState<{ name: string; email: string; password: string } | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<Tenant | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return tenants;
    const q = search.toLowerCase();
    return tenants.filter((t) => t.name_taller.toLowerCase().includes(q) || t.name_dueño.toLowerCase().includes(q) || t.email.toLowerCase().includes(q));
  }, [tenants, search]);

  const activeCount = tenants.filter((t) => t.status === 'active').length;
  const suspendedCount = tenants.filter((t) => t.status === 'suspended').length;

  const toggleStatus = (id: string) => {
    setTenants((prev) => prev.map((t) => t.id === id ? { ...t, status: t.status === 'active' ? 'suspended' : 'active' } : t));
    setConfirmSuspend(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Stats */}
      <div className="px-4 md:px-6 pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-500">Talleres totales</p>
                <p className="text-2xl font-bold text-ink-900">{tenants.length}</p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-primary-100 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-500">Licencias activas</p>
                <p className="text-2xl font-bold text-success-600">{activeCount}</p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-success-100 flex items-center justify-center">
                <Check className="w-6 h-6 text-success-600" />
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-500">Suspendidas</p>
                <p className="text-2xl font-bold text-error-600">{suspendedCount}</p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-error-100 flex items-center justify-center">
                <Power className="w-6 h-6 text-error-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input className="input pl-10" placeholder="Buscar taller, dueño o email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Nuevo taller
        </button>
      </div>

      {/* Tenants table */}
      <div className="flex-1 overflow-auto px-4 md:px-6 pb-6">
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ink-50 border-b border-ink-200">
                <tr>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3">Taller</th>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3 hidden md:table-cell">Dueño</th>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3 hidden lg:table-cell">Plan</th>
                  <th className="text-center text-xs font-bold text-ink-500 uppercase px-4 py-3 hidden sm:table-cell">Usuarios</th>
                  <th className="text-center text-xs font-bold text-ink-500 uppercase px-4 py-3 hidden sm:table-cell">Órdenes</th>
                  <th className="text-center text-xs font-bold text-ink-500 uppercase px-4 py-3">Estado</th>
                  <th className="text-right text-xs font-bold text-ink-500 uppercase px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink-800 truncate">{t.name_taller}</p>
                          <p className="text-xs text-ink-500 truncate">{t.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm font-medium text-ink-700">{t.name_dueño}</p>
                      <p className="text-xs text-ink-500">{t.phone}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`badge ${PLANS.find((p) => p.id === t.plan)?.color}`}>{PLANS.find((p) => p.id === t.plan)?.name}</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className="text-sm font-semibold text-ink-700 flex items-center justify-center gap-1">
                        <Users className="w-3.5 h-3.5 text-ink-400" /> {t.user_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className="text-sm font-semibold text-ink-700 flex items-center justify-center gap-1">
                        <ClipboardList className="w-3.5 h-3.5 text-ink-400" /> {t.order_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${t.status === 'active' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'active' ? 'bg-success-500' : 'bg-error-500'}`} />
                        {t.status === 'active' ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setConfirmSuspend(t)}
                          className={`p-2 rounded-lg transition-colors ${t.status === 'active' ? 'text-warning-600 hover:bg-warning-50' : 'text-success-600 hover:bg-success-50'}`}
                          title={t.status === 'active' ? 'Suspender' : 'Reactivar'}
                        >
                          {t.status === 'active' ? <Power className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create tenant modal */}
      {showCreate && (
        <CreateTenantModal
          onClose={() => setShowCreate(false)}
          onCreate={(data) => {
            const password = generatePassword(12);
            const newTenant: Tenant = {
              id: `t${Date.now()}`, name_taller: data.name_taller, name_dueño: data.name_dueño,
              email: data.email, phone: data.phone, status: 'active', created_at: new Date().toISOString().split('T')[0],
              plan: 'starter', user_count: 1, order_count: 0,
            };
            setTenants((prev) => [...prev, newTenant]);
            setShowCreate(false);
            setCreatedTenant({ name: data.name_dueño, email: data.email, password });
          }}
        />
      )}

      {/* Created tenant — show password once */}
      {createdTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="card w-full max-w-md p-6 animate-slide-up">
            <div className="w-14 h-14 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-success-600" />
            </div>
            <h3 className="text-lg font-bold text-ink-900 text-center mb-1">Taller creado con éxito</h3>
            <p className="text-sm text-ink-500 text-center mb-5">
              Se ha generado una contraseña temporal para <span className="font-semibold text-ink-700">{createdTenant.name}</span>.
              Compártela con el dueño. <span className="text-error-600 font-semibold">Se mostrará solo esta vez.</span>
            </p>
            <div className="space-y-3 mb-5">
              <div className="bg-ink-50 rounded-lg p-3">
                <p className="text-xs text-ink-400 mb-0.5">Correo de acceso</p>
                <p className="text-sm font-medium text-ink-800">{createdTenant.email}</p>
              </div>
              <div className="bg-primary-50 rounded-lg p-3 border-2 border-primary-200">
                <p className="text-xs text-primary-600 mb-0.5 font-semibold">Contraseña temporal</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-lg font-bold text-primary-700 font-mono">{createdTenant.password}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(createdTenant.password)}
                    className="p-2 rounded-lg bg-white text-primary-600 hover:bg-primary-100"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <button onClick={() => setCreatedTenant(null)} className="btn-primary w-full">Entendido</button>
          </div>
        </div>
      )}

      {/* Confirm suspend/reactivate */}
      {confirmSuspend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={() => setConfirmSuspend(null)}>
          <div className="card w-full max-w-sm p-6 text-center animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmSuspend.status === 'active' ? 'bg-warning-100' : 'bg-success-100'}`}>
              {confirmSuspend.status === 'active' ? <AlertTriangle className="w-7 h-7 text-warning-600" /> : <RefreshCw className="w-7 h-7 text-success-600" />}
            </div>
            <h3 className="text-lg font-bold text-ink-900 mb-1">
              {confirmSuspend.status === 'active' ? '¿Suspender licencia?' : '¿Reactivar licencia?'}
            </h3>
            <p className="text-sm text-ink-500 mb-5">
              {confirmSuspend.status === 'active'
                ? `El taller "${confirmSuspend.name_taller}" perderá acceso inmediatamente.`
                : `El taller "${confirmSuspend.name_taller}" volverá a tener acceso al sistema.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmSuspend(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => toggleStatus(confirmSuspend.id)} className={`flex-1 ${confirmSuspend.status === 'active' ? 'btn-danger' : 'btn-primary'}`}>
                {confirmSuspend.status === 'active' ? 'Suspender' : 'Reactivar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateTenantModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (data: { name_taller: string; name_dueño: string; email: string; phone: string }) => void;
}) {
  const [form, setForm] = useState({ name_taller: '', name_dueño: '', email: '', phone: '' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-md p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-ink-900">Crear nuevo taller</h2>
            <p className="text-sm text-ink-500 mt-0.5">Se generará una contraseña automática</p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div><label className="label">Nombre del taller</label><input className="input" placeholder="Ej. FixCell Reparaciones" value={form.name_taller} onChange={(e) => setForm({ ...form, name_taller: e.target.value })} autoFocus /></div>
          <div><label className="label">Nombre del dueño</label><input className="input" placeholder="Ej. María González" value={form.name_dueño} onChange={(e) => setForm({ ...form, name_dueño: e.target.value })} /></div>
          <div><label className="label">Email</label><input type="email" className="input" placeholder="dueño@taller.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Celular</label><input className="input" placeholder="5512345678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => onCreate(form)} disabled={!form.name_taller || !form.name_dueño || !form.email} className="btn-primary flex-1">
            <Crown className="w-4 h-4" /> Crear y generar acceso
          </button>
        </div>
      </div>
    </div>
  );
}
