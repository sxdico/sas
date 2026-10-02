import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS } from '@/utils/permissions';
import type { Role } from '@/types';
import { Wrench, Eye, EyeOff, ArrowRight, Shield, UserCircle, Cog } from 'lucide-react';

const demoAccounts: { role: Role; email: string; desc: string; icon: typeof Shield }[] = [
  { role: 'super_admin', email: 'admin@fixpro.com', desc: 'Gestiona todos los talleres', icon: Shield },
  { role: 'owner', email: 'carlos@talleramirez.com', desc: 'Acceso total al taller', icon: UserCircle },
  { role: 'technician', email: 'luis@talleramirez.com', desc: 'Reparaciones e inventario', icon: Cog },
  { role: 'secretary', email: 'ana@talleramirez.com', desc: 'POS y entregas pendientes', icon: ArrowRight },
  { role: 'cashier', email: 'sofia@talleramirez.com', desc: 'POS y entregas pendientes', icon: ArrowRight },
];

export default function Login() {
  const { login, loginAs } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const ok = await login(email, password);
    setSubmitting(false);
    if (!ok) {
      setError('Credenciales inválidas. Usa una cuenta demo de abajo.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, #2563eb 0%, transparent 40%), radial-gradient(circle at 80% 70%, #06b6d4 0%, transparent 40%)' }} />
      <div className="relative w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 mb-4 shadow-lg shadow-primary-600/30">
            <Wrench className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">FixPro</h1>
          <p className="text-ink-400 mt-2">Gestión multi-taller de reparaciones y POS</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input
                type="email"
                className="input"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input pr-11"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600">
                  {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-error-600 bg-error-50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Iniciando...</>
              ) : (
                <>Iniciar sesión <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-ink-200">
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">Acceso rápido demo</p>
            <div className="space-y-2">
              {demoAccounts.map(({ role, email: em, desc, icon: Icon }) => (
                <button
                  key={role}
                  onClick={() => loginAs(role)}
                  className="w-full flex items-center gap-3 rounded-lg border border-ink-200 px-3 py-2.5 text-left transition-all hover:border-primary-400 hover:bg-primary-50 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-ink-100 flex items-center justify-center text-ink-500 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-800">{ROLE_LABELS[role]}</p>
                    <p className="text-xs text-ink-500 truncate">{desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-ink-300 group-hover:text-primary-600 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-center text-ink-500 text-xs mt-6">Demo: cualquier contraseña funciona</p>
      </div>
    </div>
  );
}
