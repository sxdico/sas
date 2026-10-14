import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User, Role } from '@/types';
import { authAPI } from '@/api/client';

interface LicenseInfo {
  expired?: boolean;
  expiring?: boolean;
  days_overdue?: number;
  days_left?: number;
  expired_at?: string;
  message?: string;
  plan?: string;
}

interface AuthContextType {
  user: User | null;
  license: LicenseInfo | null;
  isReadOnly: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; license?: LicenseInfo }>;
  loginAs: (role: Role) => void;
  logout: () => void;
  tenantName: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USERS: Record<Role, User> = {
  super_admin: { id: 'u0', tenant_id: null, name: 'Admin Global', email: 'admin@fixpro.com', role: 'super_admin', active: true },
  owner: { id: 'u1', tenant_id: 't1', name: 'Carlos Ramírez', email: 'carlos@talleramirez.com', phone: '5512345678', role: 'owner', active: true },
  technician: { id: 'u3', tenant_id: 't1', name: 'Luis Pérez', email: 'luis@talleramirez.com', phone: '5533334444', role: 'technician', active: true },
  secretary: { id: 'u2', tenant_id: 't1', name: 'Ana Torres', email: 'ana@talleramirez.com', phone: '5511112222', role: 'secretary', active: true },
  cashier: { id: 'u4', tenant_id: 't1', name: 'Sofía Díaz', email: 'sofia@talleramirez.com', phone: '5555556666', role: 'cashier', active: true },
};

const DEMO_TENANT_NAMES: Record<string, string> = {
  t1: 'Taller Electrónica Ramírez',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('fixpro_token');
    const storedUser = localStorage.getItem('fixpro_user');
    const storedLicense = localStorage.getItem('fixpro_license');
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        if (storedLicense) setLicense(JSON.parse(storedLicense));
      } catch {
        localStorage.removeItem('fixpro_token');
        localStorage.removeItem('fixpro_user');
        localStorage.removeItem('fixpro_license');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await authAPI.login(email, password);
      const { token, user: apiUser, license: lic } = res.data;
      const fullUser: User = {
        id: apiUser.id,
        tenant_id: apiUser.tenant_id,
        name: apiUser.name,
        email: apiUser.email,
        role: apiUser.role,
        active: true,
      };
      localStorage.setItem('fixpro_token', token);
      localStorage.setItem('fixpro_user', JSON.stringify(fullUser));
      if (lic) {
        localStorage.setItem('fixpro_license', JSON.stringify(lic));
        setLicense(lic);
      } else {
        localStorage.removeItem('fixpro_license');
        setLicense(null);
      }
      setUser(fullUser);
      return { success: true, license: lic };
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Credenciales inválidas';
      // Fallback demo
      const demoUser = Object.values(DEMO_USERS).find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );
      if (demoUser) {
        localStorage.setItem('fixpro_user', JSON.stringify(demoUser));
        setUser(demoUser);
        return { success: true };
      }
      return { success: false, error: msg };
    }
  }, []);

  const loginAs = useCallback((role: Role) => {
    const demoUser = DEMO_USERS[role];
    if (demoUser) {
      localStorage.setItem('fixpro_user', JSON.stringify(demoUser));
      localStorage.removeItem('fixpro_license');
      setUser(demoUser);
      setLicense(null);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('fixpro_token');
    localStorage.removeItem('fixpro_user');
    localStorage.removeItem('fixpro_license');
    setUser(null);
    setLicense(null);
  }, []);

  const tenantName = user?.tenant_id ? DEMO_TENANT_NAMES[user.tenant_id] ?? null : null;
  const isReadOnly = license?.expired === true;

  return (
    <AuthContext.Provider value={{ user, license, isReadOnly, loading, login, loginAs, logout, tenantName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
