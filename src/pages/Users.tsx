import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { users as initialUsers } from '@/data/mock';
import { ROLE_LABELS, ROLE_COLORS } from '@/utils/permissions';
import type { User, Role } from '@/types';
import { Plus, X, Check, Users as UsersIcon, Shield, Wrench, ArrowRight, Mail, Phone } from 'lucide-react';

const ASSIGNABLE_ROLES: { role: Role; label: string; desc: string; icon: typeof Shield }[] = [
  { role: 'secretary', label: 'Secretaria', desc: 'POS y entregas pendientes', icon: ArrowRight },
  { role: 'cashier', label: 'Cajera', desc: 'POS y entregas pendientes', icon: ArrowRight },
  { role: 'technician', label: 'Técnico', desc: 'Reparaciones e inventario', icon: Wrench },
];

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>(initialUsers.filter((u) => u.tenant_id === user?.tenant_id));
  const [showCreate, setShowCreate] = useState(false);

  const toggleActive = (id: string) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, active: !u.active } : u));
  };

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
            <div key={u.id} className={`card p-4 ${!u.active ? 'opacity-60' : ''}`}>
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
                <span className={`text-xs font-semibold ${u.active ? 'text-success-600' : 'text-error-600'}`}>
                  {u.active ? '● Activo' : '○ Inactivo'}
                </span>
                {u.role !== 'owner' && (
                  <button
                    onClick={() => toggleActive(u.id)}
                    className={`text-xs font-semibold ${u.active ? 'text-error-500 hover:text-error-700' : 'text-success-600 hover:text-success-700'}`}
                  >
                    {u.active ? 'Desactivar' : 'Activar'}
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
          onCreate={(data) => {
            const newUser: User = {
              id: `u${Date.now()}`, tenant_id: user!.tenant_id!, active: true, ...data,
            };
            setUsers((prev) => [...prev, newUser]);
            setShowCreate(false);
          }}
        />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-md p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-ink-900">Crear usuario</h2>
            <p className="text-sm text-ink-500 mt-0.5">Asigna un rol específico</p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div><label className="label">Nombre completo</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
          <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Teléfono</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div>
            <label className="label">Rol a asignar</label>
            <div className="space-y-2">
              {ASSIGNABLE_ROLES.map(({ role, label, desc, icon: Icon }) => (
                <button
                  key={role}
                  onClick={() => setForm({ ...form, role })}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 transition-all ${
                    form.role === role ? 'border-primary-500 bg-primary-50' : 'border-ink-200 hover:border-ink-300'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${form.role === role ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-500'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-ink-800">{label}</p>
                    <p className="text-xs text-ink-500">{desc}</p>
                  </div>
                  {form.role === role && <Check className="w-5 h-5 text-primary-600" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => onCreate(form)} disabled={!form.name || !form.email} className="btn-primary flex-1">
            <UsersIcon className="w-4 h-4" /> Crear usuario
          </button>
        </div>
      </div>
    </div>
  );
}
