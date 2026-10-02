import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { userAPI } from '@/api/client'; // tu api.ts
import { ROLE_LABELS, ROLE_COLORS } from '@/utils/permissions';
import type { User, Role } from '@/types';
import { Plus, X, Check, Users as UsersIcon, Shield, Wrench, ArrowRight, Mail, Phone, Copy } from 'lucide-react';

const ASSIGNABLE_ROLES: { role: Role; label: string; desc: string; icon: typeof Shield }[] = [
  { role: 'secretary', label: 'Secretaria', desc: 'POS y entregas', icon: ArrowRight },
  { role: 'cashier', label: 'Cajera', desc: 'POS y entregas', icon: ArrowRight },
  { role: 'technician', label: 'Técnico', desc: 'Reparaciones e inventario', icon: Wrench },
];

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await userAPI.list();
      setUsers(res.data.users);
    } catch (e) {
      console.error('Error cargando usuarios', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const toggleActive = async (id: string) => {
    try {
      await userAPI.toggleActive(id);
      await loadUsers();
    } catch (e: any) {
      alert(e.response?.data?.error || e.message);
    }
  };

  if (loading) return <div className="p-6">Cargando usuarios...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 py-3 bg-white border-b border-ink-200 flex items-center justify-between">
        <p className="text-sm text-ink-500">{users.length} usuario(s) en tu taller</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Nuevo usuario
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
          {users.map((u) => (
            <div key={u.id} className={`card p-4 ${!u.active? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold ${ROLE_COLORS[u.role]}`}>
                  {u.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink-800 truncate">{u.name}</p>
                  <span className={`badge ${ROLE_COLORS[u.role]} mt-0.5`}>{ROLE_LABELS[u.role]}</span>
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                <p className="text-ink-500 flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {u.email}</p>
                {u.phone && <p className="text-ink-500 flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {u.phone}</p>}
              </div>
              <div className="mt-3 pt-3 border-t border-ink-100 flex items-center justify-between">
                <span className={`text-xs font-semibold ${u.active? 'text-success-600' : 'text-error-600'}`}>
                  {u.active? '● Activo' : '○ Inactivo'}
                </span>
                {u.role!== 'owner' && (
                  <button onClick={() => toggleActive(u.id)} className={`text-xs font-semibold ${u.active? 'text-error-500' : 'text-success-600'}`}>
                    {u.active? 'Desactivar' : 'Activar'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreate={async (data) => {
            try {
              const res = await userAPI.create(data);
              setShowCreate(false);
              setCreatedCreds({ email: res.data.user.email, password: res.data.password });
              await loadUsers();
            } catch (err: any) {
              alert(err.response?.data?.error || err.message);
            }
          }}
        />
      )}

      {createdCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md p-6">
            <div className="w-14 h-14 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-success-600" />
            </div>
            <h3 className="text-lg font-bold text-center mb-1">Usuario creado</h3>
            <p className="text-sm text-ink-500 text-center mb-5">Guarda la contraseña, solo se muestra una vez.</p>
            <div className="space-y-3 mb-5">
              <div className="bg-ink-50 rounded-lg p-3">
                <p className="text-xs text-ink-400">Email</p>
                <p className="text-sm font-medium">{createdCreds.email}</p>
              </div>
              <div className="bg-primary-50 rounded-lg p-3 border-2 border-primary-200">
                <p className="text-xs text-primary-600 font-semibold">Contraseña temporal</p>
                <div className="flex items-center justify-between">
                  <code className="text-lg font-bold font-mono">{createdCreds.password}</code>
                  <button onClick={() => navigator.clipboard.writeText(createdCreds.password)} className="p-2 bg-white rounded-lg"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
            <button onClick={() => setCreatedCreds(null)} className="btn-primary w-full">Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (data: { name: string; email: string; phone: string; role: Role }) => void;
}) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'secretary' as Role });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">Crear usuario</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div><label className="label">Nombre completo</label><input className="input w-full" value={form.name} onChange={(e) => setForm({...form, name: e.target.value })} autoFocus /></div>
          <div><label className="label">Email (debe ser nuevo)</label><input type="email" className="input w-full" value={form.email} onChange={(e) => setForm({...form, email: e.target.value })} /></div>
          <div><label className="label">Teléfono</label><input className="input w-full" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value })} /></div>
          <div>
            <label className="label">Rol</label>
            <div className="space-y-2">
              {ASSIGNABLE_ROLES.map(({ role, label, icon: Icon }) => (
                <button key={role} onClick={() => setForm({...form, role })} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 ${form.role === role? 'border-primary-500 bg-primary-50' : 'border-ink-200'}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${form.role === role? 'bg-primary-600 text-white' : 'bg-ink-100'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-semibold">{label}</p>
                  {form.role === role && <Check className="w-5 h-5 text-primary-600 ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => onCreate(form)} disabled={!form.name ||!form.email} className="btn-primary flex-1"><UsersIcon className="w-4 h-4" /> Crear</button>
        </div>
      </div>
    </div>
  );
}