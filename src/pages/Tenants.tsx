import { useState, useEffect, useMemo } from 'react';
import { tenantAPI } from '@/api/client';
import { formatDate } from '@/utils/permissions';
import type { Tenant, User } from '@/types';
import {
  Building2, Plus, Search, Power, RefreshCw, X, Check, Copy,
  Users, AlertTriangle, Trash2, KeyRound, Eye
} from 'lucide-react';

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createdTenant, setCreatedTenant] = useState<{ name: string; email: string; password: string } | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<Tenant | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Tenant | null>(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Users modal
  const [selectedTenantForUsers, setSelectedTenantForUsers] = useState<Tenant | null>(null);
  const [tenantUsers, setTenantUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null);

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

  const handleDelete = async () => {
    if (!confirmDelete) return;
    if (deleteInput.trim()!== confirmDelete.name_taller.trim()) {
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

  const openUsers = async (t: Tenant) => {
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
                      <p className="text-sm font-semibold text-ink-800 flex items-center gap-2"><Building2 className="w-4 h-4 text-ink-400" />{t.name_taller}</p>
                      <p className="text-xs text-ink-500">{t.email}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm font-medium text-ink-700">{t.name_dueno}</p>
                      <p className="text-xs text-ink-500">{t.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${t.status === 'active'? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
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
              <button onClick={handleDelete} disabled={deleting || deleteInput!== confirmDelete.name_taller} className="bg-error-600 hover:bg-error-700 text-white rounded-lg px-4 py-2 font-semibold flex-1 disabled:opacity-50">
                {deleting? 'Eliminando...' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTenantForUsers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-2xl max-h- flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2"><Users className="w-5 h-5" /> Usuarios de {selectedTenantForUsers.name_taller}</h3>
                <p className="text-xs text-ink-500">{selectedTenantForUsers.email}</p>
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
  const [form, setForm] = useState({ name_taller: '', name_dueno: '', email: '', phone: '', plan: 'starter' });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-5">Crear nuevo taller</h2>
        <div className="space-y-4">
          <input className="input w-full" placeholder="Nombre del taller" value={form.name_taller} onChange={(e) => setForm({...form, name_taller: e.target.value })} />
          <input className="input w-full" placeholder="Nombre del dueño" value={form.name_dueno} onChange={(e) => setForm({...form, name_dueno: e.target.value })} />
          <input className="input w-full" placeholder="Email (debe ser nuevo)" value={form.email} onChange={(e) => setForm({...form, email: e.target.value })} />
          <input className="input w-full" placeholder="Celular" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value })} />
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => onCreate(form)} className="btn-primary flex-1">Crear</button>
        </div>
      </div>
    </div>
  );
}