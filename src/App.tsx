import { useState, useEffect, useMemo, useCallback } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { can } from '@/utils/permissions';
import { notificationAPI } from '@/api/client';
import type { AppNotification, SaleItem, PaymentMethod, OrderStatus } from '@/types';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import POS from '@/pages/POS';
import Orders from '@/pages/Orders';
import Deliveries from '@/pages/Deliveries';
import Inventory from '@/pages/Inventory';
import Tenants from '@/pages/Tenants';
import Broadcasts from '@/pages/Broadcasts';
import Dashboard from '@/pages/Dashboard';
import Finanzas from '@/pages/Finanzas';
import Users from '@/pages/Users';
import Repairs from '@/pages/Repairs';
import CajaSalidas from '@/pages/CajaSalidas';
import CajaEntradas from './pages/CajaEntradas';
import CorteDeCaja from './pages/CorteDeCaja';
import { Bell, X, Check, AlertTriangle, Info } from 'lucide-react';

function AppContent() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    if (user.role === 'super_admin') {
      setNotifications([]);
      return;
    }
    try {
      const res = await notificationAPI.list();
      const raw = res.data.notifications || res.data || [];
      const mapped: AppNotification[] = raw.map((n: AppNotification) => ({
        id: n.id,
        tenant_id: n.tenant_id,
        title: n.title,
        message: n.message,
        type: n.type,
        read: n.read,
        created_at: n.created_at,
        for_roles: n.for_roles,
      }));
      setNotifications(mapped);
    } catch (e) {
      console.error('Error cargando notificaciones reales', e);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const userNotifications = useMemo(() => {
    if (!user) return [];
    if (user.role === 'super_admin') return [];
    return notifications.filter((n) => {
      const rolesStr = typeof n.for_roles === 'string' ? n.for_roles : (n.for_roles as unknown as string[]).join(',');
      return rolesStr.split(',').map((r) => r.trim()).includes(user.role);
    });
  }, [notifications, user]);

  const unreadCount = userNotifications.filter((n) => !n.read).length;

const handleNavigate = useCallback((page: string) => {
  if (!user) return;
  // Normalizamos: si alguien manda 'caja' lo mandamos a 'pos' que es tu Caja real
  const normalizedPage = page === 'caja' ? 'pos' : page;
  if (normalizedPage === 'dashboard' && !can(user.role, 'reports')) {
    if (can(user.role, 'pos')) return setCurrentPage('pos');
    if (can(user.role, 'deliveries')) return setCurrentPage('deliveries');
    if (can(user.role, 'tenants')) return setCurrentPage('tenants');
  }
  setCurrentPage(normalizedPage);
}, [user]);

  const handleSaleComplete = useCallback((_items: SaleItem[], _total: number, _method: PaymentMethod, _customerName: string | null) => {}, []);

  const handleOrderStatusChange = useCallback(async (_orderId: string, _newStatus: OrderStatus) => {
    loadNotifications();
  }, [loadNotifications]);

  const handleDeliver = useCallback((_orderId: string) => {}, []);

  const markNotificationRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    try {
      await notificationAPI.markRead(id);
    } catch (e) {
      console.error('Error marcando leída', e);
    }
  };

  const markAllRead = async () => {
    const unread = userNotifications.filter(n => !n.read);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    for (const n of unread) {
      try { await notificationAPI.markRead(n.id); } catch {}
    }
  };

  if (!user) return <Login />;

const renderPage = () => {
  switch (currentPage) {
    case 'dashboard': return <Dashboard />;
    case 'entradas': return <CajaEntradas />;
    case 'salidas': return <CajaSalidas />;
    case 'pos':
    case 'caja':
      // AQUÍ ESTÁ EL FIX - LE PASAMOS onNavigate A POS
      return <POS onSaleComplete={handleSaleComplete} onNavigate={handleNavigate} />;
    case 'orders': return <Orders onStatusChange={handleOrderStatusChange} onNavigate={handleNavigate} />;
    case 'deliveries': return <Deliveries onDeliver={handleDeliver} />;
    case 'inventory': return <Inventory />;
    case 'tenants': return <Tenants />;
    case 'broadcasts': return <Broadcasts />;
    case 'finanzas': return <Finanzas />;
    case 'users': return <Users />;
    case 'cortedecaja': return <CorteDeCaja />;
    case 'repairs': return <Repairs onNavigate={handleNavigate} />;
    default: return <Dashboard />;
  }
};

  return (
    <>
      <Layout
        currentPage={currentPage}
        onNavigate={handleNavigate}
        notificationCount={unreadCount}
        onNotificationsClick={() => setShowNotifications(true)}
      >
        {renderPage()}
      </Layout>

      {showNotifications && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in" onClick={() => setShowNotifications(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-sm bg-white h-full shadow-xl overflow-auto animate-slide-right" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-ink-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="font-bold text-ink-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary-600" />
                Notificaciones {unreadCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>}
              </h2>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-primary-600 font-semibold hover:underline">
                    Marcar todo leído
                  </button>
                )}
                <button onClick={() => setShowNotifications(false)} className="text-ink-400 hover:text-ink-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="divide-y divide-ink-100">
              {userNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-ink-400">
                  <Bell className="w-12 h-12 mb-3 text-ink-300" />
                  <p className="font-medium">Sin notificaciones</p>
                  <p className="text-xs mt-1">Los anuncios del admin aparecerán aquí</p>
                </div>
              ) : (
                userNotifications.map((n) => (
                  <div key={n.id} className={`px-5 py-4 ${!n.read ? 'bg-blue-50/60' : ''} hover:bg-ink-50 transition-colors`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        n.type === 'success' ? 'bg-green-100 text-green-600' :
                        n.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                        n.type === 'error' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {n.type === 'success' ? <Check className="w-4 h-4" /> :
                         n.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
                         <Info className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink-800 leading-tight">{n.title}</p>
                        <p className="text-sm text-ink-600 mt-1 leading-snug">{n.message}</p>
                        <p className="text-[11px] text-ink-400 mt-2">{new Date(n.created_at).toLocaleString('es-MX')}</p>
                        {!n.read && (
                          <button
                            onClick={() => markNotificationRead(n.id)}
                            className="text-xs text-primary-600 font-semibold mt-2 hover:underline"
                          >
                            Marcar como leída
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
