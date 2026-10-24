import { useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { can, ROLE_LABELS, ROLE_COLORS } from '@/utils/permissions';
import {
  Wrench, LayoutDashboard, ShoppingCart, ClipboardList, Package,
  Users, Building2, LogOut, Bell, Menu, TrendingUp, Megaphone,
  ChevronDown, DollarSign, ArrowDownLeft, ArrowUpRight, Scissors,
  HelpCircle, FileBarChart
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  page: string;
  permission: 'pos' | 'orders' | 'ordersView' | 'deliveries' | 'inventory' | 'reports' | 'users' | 'tenants';
  children?: NavItem[];
}

// NUEVA ESTRUCTURA ACORDEÓN
const ALL_NAV_ITEMS: NavItem[] = [
  { label: 'Tablero', icon: LayoutDashboard, page: 'dashboard', permission: 'reports' },
  {
    label: 'Ventas', icon: ShoppingCart, page: 'ventas-group', permission: 'pos',
    children: [
      { label: 'Caja', icon: DollarSign, page: 'pos', permission: 'pos' },
      { label: 'Entradas', icon: ArrowDownLeft, page: 'entradas', permission: 'pos' },
      { label: 'Salidas', icon: ArrowUpRight, page: 'salidas', permission: 'pos' },
      { label: 'Corte de Caja', icon: Scissors, page: 'corte-caja', permission: 'pos' },
    ]
  },
  {
    label: 'Taller', icon: Wrench, page: 'taller-group', permission: 'ordersView',
    children: [
      { label: 'Órdenes', icon: ClipboardList, page: 'orders', permission: 'ordersView' },
      { label: 'Clientes', icon: Users, page: 'clients', permission: 'ordersView' },
      { label: 'Entregas Pendientes', icon: Package, page: 'deliveries', permission: 'deliveries' },
    ]
  },
  { label: 'Artículos', icon: Package, page: 'inventory', permission: 'inventory' },
  { label: 'Finanzas', icon: TrendingUp, page: 'finanzas', permission: 'reports' },
  {
    label: 'Administración', icon: Building2, page: 'admin-group', permission: 'users',
    children: [
      { label: 'Equipo', icon: Users, page: 'users', permission: 'users' },
      { label: 'Talleres', icon: Building2, page: 'tenants', permission: 'tenants' },
    ]
  },
  {
    label: 'Ayuda y Soporte', icon: HelpCircle, page: 'ayuda-group', permission: 'reports',
    children: [
      { label: 'Reportes', icon: FileBarChart, page: 'tickets', permission: 'reports' },
      { label: 'Broadcasts', icon: Megaphone, page: 'broadcasts', permission: 'tenants' },
    ]
  },
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
  const [openGroups, setOpenGroups] = useState<string[]>(['taller-group', 'ventas-group']);
  if (!user) return null;

  const toggleGroup = (page: string) => {
    setOpenGroups(prev => prev.includes(page) ? prev.filter(p => p !== page) : [...prev, page]);
  };

  const navItems = ALL_NAV_ITEMS.filter((item) => {
    if (item.children) {
      const visibleChildren = item.children.filter(c => can(user.role, c.permission));
      return visibleChildren.length > 0;
    }
    return can(user.role, item.permission);
  });

  const allFlatItems = navItems.flatMap(n => n.children ? [n, ...n.children] : [n]);
  const currentLabel = allFlatItems.find((n) => n.page === currentPage)?.label ?? 'FixPro';

  const sidebar = (
    <div className="flex flex-col h-full bg-ink-900 w-64 shrink-0">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-ink-800">
        <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center shrink-0">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-sm">iFixSoft</p>
          <p className="text-ink-400 text-xs truncate">{user.role === 'super_admin' ? 'Panel Global' : tenantName}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const hasChildren = !!item.children?.length;
          const isOpen = openGroups.includes(item.page);
          const filteredChildren = hasChildren ? item.children!.filter(c => can(user.role, c.permission)) : [];
          const isChildActive = hasChildren && filteredChildren.some(c => c.page === currentPage);

          if (hasChildren) {
            return (
              <div key={item.page} className="space-y-1">
                <button
                  onClick={() => toggleGroup(item.page)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isChildActive ? 'bg-ink-800 text-white' : 'text-ink-300 hover:bg-ink-800 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="ml-3 pl-3 border-l border-ink-800 space-y-1">
                    {filteredChildren.map((child) => {
                      const active = currentPage === child.page;
                      const Icon = child.icon;
                      return (
                        <button
                          key={`${item.page}-${child.page}-${child.label}`}
                          onClick={() => { onNavigate(child.page); setSidebarOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            active ? 'bg-primary-600 text-white shadow-sm' : 'text-ink-400 hover:bg-ink-800 hover:text-white'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

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
          <div className="flex items-center gap-3">
            <button onClick={onNotificationsClick} className="relative p-2.5 rounded-xl hover:bg-ink-100 transition-colors border border-ink-100">
              <Bell className="w-5 h-5 text-ink-700" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w- h-5 bg-red-500 text-white text- font-bold rounded-full flex items-center justify-center px-1 border-2 border-white">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>
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