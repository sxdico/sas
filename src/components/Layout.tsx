import { useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { can, ROLE_LABELS, ROLE_COLORS } from '@/utils/permissions';
import {
  Wrench, LayoutDashboard, ShoppingCart, ClipboardList, Package,
  Users, Building2, LogOut, Bell, Menu, TrendingUp
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  page: string;
  permission: 'pos' | 'orders' | 'ordersView' | 'deliveries' | 'inventory' | 'reports' | 'users' | 'tenants';
}

const ALL_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, page: 'dashboard', permission: 'reports' },
  { label: 'POS', icon: ShoppingCart, page: 'pos', permission: 'pos' },
  { label: 'Órdenes', icon: ClipboardList, page: 'orders', permission: 'ordersView' },
  { label: 'Entregas', icon: Package, page: 'deliveries', permission: 'deliveries' },
  { label: 'Inventario', icon: Package, page: 'inventory', permission: 'inventory' },
  { label: 'Finanzas', icon: TrendingUp, page: 'reports', permission: 'reports' },
  { label: 'Usuarios', icon: Users, page: 'users', permission: 'users' },
  { label: 'Talleres', icon: Building2, page: 'tenants', permission: 'tenants' },
];

interface LayoutProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  children: ReactNode;
  notificationCount?: number;
  onNotificationsClick?: () => void;
}

export default function Layout({ currentPage, onNavigate, children, notificationCount = 0, onNotificationsClick }: LayoutProps) {
  const { user, logout, tenantName } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  if (!user) return null;

  const navItems = ALL_NAV_ITEMS.filter((item) => can(user.role, item.permission));
  const currentLabel = navItems.find((n) => n.page === currentPage)?.label ?? 'iFixSoft';

  const sidebar = (
    <div className="flex flex-col h-full bg-ink-900 w-64 shrink-0">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-ink-800">
        <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center shrink-0">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-sm">FixPro</p>
          <p className="text-ink-400 text-xs truncate">{user.role === 'super_admin' ? 'Panel Global' : tenantName}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const active = currentPage === item.page;
          const Icon = item.icon;
          return (
            <button
              key={item.page}
              onClick={() => { onNavigate(item.page); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active ? 'bg-primary-600 text-white shadow-sm' : 'text-ink-300 hover:bg-ink-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-ink-800 p-3">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${ROLE_COLORS[user.role]}`}>
            {user.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-semibold truncate">{user.name}</p>
            <p className="text-ink-400 text-xs">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>
        <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink-400 hover:bg-error-900/40 hover:text-error-300 transition-colors">
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-ink-50">
      <div className="hidden md:flex">{sidebar}</div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 animate-slide-right">{sidebar}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-ink-200 flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-ink-100">
              <Menu className="w-5 h-5 text-ink-600" />
            </button>
            <h1 className="text-lg font-bold text-ink-900">{currentLabel}</h1>
          </div>
          <div className="flex items-center gap-2">
            {notificationCount > 0 && (
              <button onClick={onNotificationsClick} className="relative p-2 rounded-lg hover:bg-ink-100 transition-colors">
                <Bell className="w-5 h-5 text-ink-600" />
                <span className="absolute top-1 right-1 w-4 h-4 bg-error-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {notificationCount}
                </span>
              </button>
            )}
            <div className={`badge ${ROLE_COLORS[user.role]}`}>
              {ROLE_LABELS[user.role]}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}