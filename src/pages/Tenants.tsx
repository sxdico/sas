import { useState, useEffect, useMemo } from 'react';
import { tenantAPI } from '@/api/client';
import { formatDate } from '@/utils/permissions';
import type { Tenant, User } from '@/types';
import {
  Building2, Plus, Search, Power, RefreshCw, X, Check, Copy,
  Users, AlertTriangle, Trash2, KeyRound, Crown, Calendar, Clock, DollarSign, Zap
} from 'lucide-react';

const PLAN_CONFIG: Record<string, { label: string, price: number, max_users: number, days: number, color: string, bg: string, icon: string }> = {
  trial: { label: 'Prueba 7 días', price: 0, max_users: 2, days: 7, color: 'text-gray-700', bg: 'bg-gray-100 border-gray-200', icon: '🧪' },
  basic: { label: 'Básico $299', price: 299, max_users: 4, days: 30, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: '💙' },
  pro: { label: 'Pro $399', price: 399, max_users: 10, days: 30, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: '🔥' },
  premium: { label: 'Premium $499', price: 499, max_users: 9999, days: 30, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: '👑' },
  starter: { label: 'Starter (legacy)', price: 299, max_users: 4, days: 30, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: '💙' },
  enterprise: { label: 'Enterprise (legacy)', price: 499, max_users: 9999, days: 30, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: '👑' },
};

function getPlanInfo(plan: string) {
  return PLAN_CONFIG[plan] || PLAN_CONFIG.basic;
}

function getExpiryInfo(expiresAt: string | null) {
  if (!expiresAt) return { text: 'Sin fecha', color: 'gray', days: null };
  const exp = new Date(expiresAt);
  const now = new Date();
  const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000*60*60*24));
  if (diff < 0) return { text: `Vencido hace ${Math.abs(diff)} días`, color: 'red', days: diff };
  if (diff === 0) return { text: '¡Vence hoy!', color: 'red', days: diff };
  if (diff <= 5) return { text: `Vence en ${diff} días`, color: 'amber', days: diff };
  return { text: `${diff} días restantes`, color: 'green', days: diff };
}

export default function Tenants() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createdTenant, setCreatedTenant] = useState<{ name: string; email: string; password: string; plan: string; expires: string } | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [selectedTenantForUsers, setSelectedTenantForUsers] = useState<any>(null);
  const [tenantUsers, setTenantUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null);

  // Renew modal
  const [renewTenant, setRenewTenant] = useState<any>(null);
  const [renewForm, setRenewForm] = useState({ plan: 'basic', add_days: '30', custom_price: '' });
  const [renewLoading, setRenewLoading] = useState(false);

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
    return tenants.filter((t: any) =>
      t.name_taller.toLowerCase().includes(q) ||
      t.name_dueno.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      (t.plan || '').toLowerCase().includes(q)
    );
  }, [tenants, search]);

  const toggleStatus = async (t: any) => {
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

  const handleDelete = async () => {
    if (!confirmDelete) return;
    if (deleteInput.trim() !== confirmDelete.name_taller.trim()) {
      alert('Escribe exactamente el nombre del taller para confirmar');
      return;
    }
    setDeleting(true);
    try {
      await tenantAPI.delete(confirmDelete.id);
      setConfirmDelete(null);
      setDeleteInput('');
      await loadTenants();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error eliminando taller');
    } finally {
      setDeleting(false);
    }
  };

  const openUsers = async (t: any) => {
    setSelectedTenantForUsers(t);
    setLoadingUsers(true);
    try {
      const res = await tenantAPI.listUsers(t.id);
      setTenantUsers(res.data.users);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error cargando usuarios');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    try {
      const res = await tenantAPI.resetUserPassword(resetUser.id, newPassword || undefined);
      setResetResult({ email: res.data.credentials.email, password: res.data.credentials.password });
      setResetUser(null);
      setNewPassword('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error reseteando contraseña');
    }
  };

  const handleRenew = async () => {
    if (!renewTenant) return;
    setRenewLoading(true);
    try {
      await tenantAPI.renewPlan(renewTenant.id, {
        plan: renewForm.plan,
        add_days: parseInt(renewForm.add_days),
        custom_price: renewForm.custom_price ? parseFloat(renewForm.custom_price) : undefined
      });
      setRenewTenant(null);
      await loadTenants();
      alert('¡Plan renovado con éxito!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error renovando plan');
    } finally {
      setRenewLoading(false);
    }
  };

  if (loading) return <div className="p-6">Cargando talleres...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input className="input pl-10" placeholder="Buscar taller, dueño, email o plan..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 hidden md:block">{tenants.length} talleres · {tenants.filter((t:any)=>t.is_expired).length} vencidos</span>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Nuevo taller
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 md:px-6 pb-6">
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ink-50 border-b border-ink-200">
                <tr>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3">Taller</th>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3">Plan / Licencia</th>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3">Vencimiento</th>
                  <th className="text-center text-xs font-bold text-ink-500 uppercase px-4 py-3">Estado</th>
                  <th className="text-right text-xs font-bold text-ink-500 uppercase px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((t: any) => {
                  const planInfo = getPlanInfo(t.plan);
                  const expiry = getExpiryInfo(t.plan_expires_at);
                  return (
                    <tr key={t.id} className={`hover:bg-ink-50 ${t.is_expired ? 'bg-red-50/50' : t.is_expiring ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-ink-800 flex items-center gap-2"><Building2 className="w-4 h-4 text-ink-400" />{t.name_taller}</p>
                        <p className="text-xs text-ink-500">{t.email} · {t.name_dueno}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${planInfo.bg} ${planInfo.color}`}>
                          {planInfo.icon} {planInfo.label}
                        </span>
                        <p className="text-[11px] text-gray-500 mt-1">{t.max_users === 9999 ? 'Usuarios ilimitados' : `${t.max_users} usuarios` } · ${t.plan_price ? `$${t.plan_price}` : ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium flex items-center gap-1"><Calendar className="w-3 h-3" /> {t.plan_expires_at ? formatDate(t.plan_expires_at) : 'Sin fecha'}</p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold mt-1 inline-block ${
                          expiry.color === 'red' ? 'bg-red-100 text-red-700 border border-red-200' :
                          expiry.color === 'amber' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          expiry.color === 'green' ? 'bg-green-100 text-green-700 border border-green-200' :
                          'bg-gray-100 text-gray-600'
                        }`}>{expiry.text}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`badge ${t.status === 'active'? 'bg-success-100 text-success-700' : t.status === 'expired' ? 'bg-red-100 text-red-700' : 'bg-error-100 text-error-700'}`}>
                          {t.status === 'active' ? 'Activo' : t.status === 'expired' ? 'Vencido' : 'Suspendido'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setRenewTenant(t); setRenewForm({ plan: t.plan, add_days: '30', custom_price: String(t.plan_price || '') }); }} title="Renovar / Cambiar plan" className="p-2 rounded-lg hover:bg-blue-50 bg-blue-50 border border-blue-200">
                            <RefreshCw className="w-4 h-4 text-blue-600" />
                          </button>
                          <button onClick={() => openUsers(t)} title="Ver usuarios / cambiar contraseña" className="p-2 rounded-lg hover:bg-ink-100">
                            <Users className="w-4 h-4 text-ink-600" />
                          </button>
                          <button onClick={() => setConfirmSuspend(t)} title={t.status === 'active'? 'Suspender' : 'Reactivar'} className="p-2 rounded-lg hover:bg-ink-100">
                            {t.status === 'active'? <Power className="w-4 h-4 text-amber-600" /> : <RefreshCw className="w-4 h-4 text-success-600" />}
                          </button>
                          <button onClick={() => { setConfirmDelete(t); setDeleteInput(''); }} title="Eliminar definitivamente" className="p-2 rounded-lg hover:bg-error-50">
                            <Trash2 className="w-4 h-4 text-error-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
              const tenant = res.data.tenant;
              setShowCreate(false);
              setCreatedTenant({ name: data.name_dueno, email: creds.email, password: creds.password, plan: tenant.plan, expires: tenant.plan_expires_at });
              await loadTenants();
            } catch (err: any) {
              alert(err.response?.data?.error || err.message);
            }
          }}
        />
      )}

      {renewTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2"><Zap className="w-5 h-5 text-blue-600" /> Renovar / Cambiar plan</h3>
            <p className="text-sm text-gray-500 mb-4">{renewTenant.name_taller}</p>
            
            <div className="space-y-4">
              <div>
                <label className="label font-bold">Nuevo plan</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PLAN_CONFIG).filter(([k])=>!['starter','enterprise'].includes(k)).map(([key, p]: any) => (
                    <button key={key} onClick={()=>setRenewForm({...renewForm, plan: key, custom_price: String(p.price)})} className={`p-3 rounded-xl border-2 text-left transition ${renewForm.plan === key ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <p className="text-sm font-bold">{p.icon} {p.label}</p>
                      <p className="text-xs text-gray-500">{p.max_users === 9999 ? 'Ilimitados' : `${p.max_users} usuarios`} · {p.days} días</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Días a agregar</label>
                  <select className="input w-full" value={renewForm.add_days} onChange={e=>setRenewForm({...renewForm, add_days: e.target.value})}>
                    <option value="7">7 días (prueba)</option>
                    <option value="30">30 días (1 mes)</option>
                    <option value="60">60 días (2 meses)</option>
                    <option value="90">90 días (3 meses)</option>
                    <option value="180">180 días (6 meses)</option>
                    <option value="365">365 días (1 año)</option>
                  </select>
                  <p className="text-[11px] text-gray-500 mt-1">Si no ha vencido, se suma. Si venció, cuenta desde hoy.</p>
                </div>
                <div>
                  <label className="label">Precio personalizado</label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className="input pl-8 w-full" type="number" value={renewForm.custom_price} onChange={e=>setRenewForm({...renewForm, custom_price: e.target.value})} placeholder="299" />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700 font-semibold">Resumen</p>
                <p className="text-sm">Plan {getPlanInfo(renewForm.plan).label} · {renewForm.add_days} días</p>
                <p className="text-xs text-gray-600">Vence actualmente: {renewTenant.plan_expires_at ? formatDate(renewTenant.plan_expires_at) : 'Sin fecha'} → Nuevo vencimiento se calculará automáticamente</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={()=>setRenewTenant(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleRenew} disabled={renewLoading} className="btn-primary flex-1">{renewLoading ? 'Renovando...' : 'Renovar plan'}</button>
            </div>
          </div>
        </div>
      )}

      {createdTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-center mb-2">Taller creado con éxito</h3>
            <div className="flex justify-center mb-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getPlanInfo(createdTenant.plan).bg} ${getPlanInfo(createdTenant.plan).color}`}>{getPlanInfo(createdTenant.plan).icon} {getPlanInfo(createdTenant.plan).label}</span>
            </div>
            <div className="bg-ink-50 rounded-lg p-3 mb-3">
              <p className="text-xs text-ink-400">Correo</p>
              <p className="text-sm font-medium">{createdTenant.email}</p>
              <p className="text-xs text-ink-400 mt-2">Vence</p>
              <p className="text-sm font-medium">{createdTenant.expires ? formatDate(createdTenant.expires) : 'Sin fecha'}</p>
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
            <h3 className="text-lg font-bold mb-5">{confirmSuspend.status === 'active'? '¿Suspender?' : '¿Reactivar?'} {confirmSuspend.name_taller}</h3>
            <div className="flex gap-3">
              <button onClick={() => setConfirmSuspend(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => toggleStatus(confirmSuspend)} className="btn-primary flex-1">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-error-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-error-600" />
            </div>
            <h3 className="text-lg font-bold text-center mb-2">Eliminar taller definitivamente</h3>
            <p className="text-sm text-ink-500 text-center mb-4">
              Se borrará <b>{confirmDelete.name_taller}</b>, sus usuarios, órdenes, productos y ventas. Esta acción no se puede deshacer.
            </p>
            <div className="bg-ink-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-ink-500 mb-1">Escribe <b>{confirmDelete.name_taller}</b> para confirmar:</p>
              <input className="input w-full" placeholder={confirmDelete.name_taller} value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)} autoFocus />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting || deleteInput !== confirmDelete.name_taller} className="bg-error-600 hover:bg-error-700 text-white rounded-lg px-4 py-2 font-semibold flex-1 disabled:opacity-50">
                {deleting? 'Eliminando...' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTenantForUsers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2"><Users className="w-5 h-5" /> Usuarios de {selectedTenantForUsers.name_taller}</h3>
                <p className="text-xs text-ink-500">{selectedTenantForUsers.email} · Plan {getPlanInfo(selectedTenantForUsers.plan).label} · Máx {selectedTenantForUsers.max_users === 9999 ? '∞' : selectedTenantForUsers.max_users} usuarios</p>
              </div>
              <button onClick={() => setSelectedTenantForUsers(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {loadingUsers? (
                <p className="text-sm text-ink-500 text-center py-8">Cargando usuarios...</p>
              ) : tenantUsers.length === 0? (
                <p className="text-sm text-ink-400 text-center py-8">Sin usuarios</p>
              ) : (
                <div className="space-y-2">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-700">{tenantUsers.length} / {selectedTenantForUsers.max_users === 9999 ? '∞' : selectedTenantForUsers.max_users} usuarios usados</span>
                    <div className="w-24 h-2 bg-blue-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${Math.min(100, (tenantUsers.length / (selectedTenantForUsers.max_users === 9999 ? tenantUsers.length : selectedTenantForUsers.max_users)) * 100)}%` }} />
                    </div>
                  </div>
                  {tenantUsers.map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-semibold">{u.name} <span className="text-xs bg-ink-100 px-2 py-0.5 rounded ml-2">{u.role}</span></p>
                        <p className="text-xs text-ink-500">{u.email} · {u.active? 'Activo' : 'Inactivo'}</p>
                      </div>
                      <button onClick={() => setResetUser(u)} className="btn-secondary text-xs flex items-center gap-1">
                        <KeyRound className="w-4 h-4" /> Cambiar contraseña
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end">
              <button onClick={() => setSelectedTenantForUsers(null)} className="btn-secondary">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {resetUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-1 flex items-center gap-2"><KeyRound className="w-5 h-5" /> Cambiar contraseña</h3>
            <p className="text-sm text-ink-500 mb-4">Usuario: <b>{resetUser.email}</b></p>
            <div className="space-y-3">
              <div>
                <label className="label">Nueva contraseña (deja vacío para generar aleatoria)</label>
                <input type="text" className="input w-full" placeholder="Ej: FixPro2026! o vacío para auto-generar" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <p className="text-xs text-ink-400 mt-1">Mínimo 6 caracteres si la escribes manual</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setResetUser(null); setNewPassword(''); }} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleResetPassword} className="btn-primary flex-1"><Check className="w-4 h-4" /> Guardar nueva</button>
            </div>
          </div>
        </div>
      )}

      {resetResult && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-success-600" />
            </div>
            <h3 className="font-bold text-lg mb-2">Contraseña actualizada</h3>
            <div className="bg-ink-50 rounded-lg p-3 mb-3 text-left">
              <p className="text-xs text-ink-400">Email</p>
              <p className="text-sm font-medium">{resetResult.email}</p>
            </div>
            <div className="bg-primary-50 border-2 border-primary-200 rounded-lg p-3 mb-5">
              <p className="text-xs text-primary-600 font-semibold">Nueva contraseña (copiala ahora)</p>
              <div className="flex items-center justify-between gap-2">
                <code className="text-lg font-bold font-mono break-all">{resetResult.password}</code>
                <button onClick={() => navigator.clipboard.writeText(resetResult.password)} className="p-2 bg-white rounded-lg"><Copy className="w-4 h-4" /></button>
              </div>
            </div>
            <button onClick={() => setResetResult(null)} className="btn-primary w-full">Entendido</button>
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
  const [form, setForm] = useState({ name_taller: '', name_dueno: '', email: '', phone: '', plan: 'basic', custom_days: '30' });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-1">Crear nuevo taller</h2>
        <p className="text-xs text-gray-500 mb-5">Selecciona la licencia que compró el cliente</p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input className="input w-full" placeholder="Nombre del taller" value={form.name_taller} onChange={(e) => setForm({...form, name_taller: e.target.value })} />
            <input className="input w-full" placeholder="Nombre del dueño" value={form.name_dueno} onChange={(e) => setForm({...form, name_dueno: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="input w-full" placeholder="Email (debe ser nuevo)" value={form.email} onChange={(e) => setForm({...form, email: e.target.value })} />
            <input className="input w-full" placeholder="Celular" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value })} />
          </div>

          <div>
            <label className="label font-bold">Licencia / Plan</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PLAN_CONFIG).filter(([k])=>!['starter','enterprise'].includes(k)).map(([key, p]: any) => (
                <button key={key} type="button" onClick={()=>setForm({...form, plan: key, custom_days: String(p.days)})} className={`p-3 rounded-xl border-2 text-left transition ${form.plan === key ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                  <p className="text-sm font-bold flex items-center gap-1">{p.icon} {p.label}</p>
                  <p className="text-xs text-gray-600 mt-1">{p.max_users === 9999 ? 'Usuarios ilimitados' : `${p.max_users} usuarios`}</p>
                  <p className="text-[11px] text-gray-500">${p.price}/mes · {p.days} días</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Días de vigencia</label>
            <select className="input w-full" value={form.custom_days} onChange={e=>setForm({...form, custom_days: e.target.value})}>
              <option value="7">7 días (prueba)</option>
              <option value="15">15 días</option>
              <option value="30">30 días (1 mes) - recomendado</option>
              <option value="60">60 días (2 meses)</option>
              <option value="90">90 días (3 meses)</option>
              <option value="365">365 días (1 año)</option>
            </select>
            <p className="text-[11px] text-gray-500 mt-1">Se calcula desde hoy. Ej: hoy + 30 días = {new Date(Date.now() + parseInt(form.custom_days)*24*60*60*1000).toLocaleDateString('es-MX')}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => onCreate(form)} className="btn-primary flex-1"><Crown className="w-4 h-4" /> Crear con plan {PLAN_CONFIG[form.plan].label}</button>
        </div>
      </div>
    </div>
  );
}
