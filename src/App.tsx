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
import Clientes from '@/pages/Clientes';
import SupportTickets from '@/pages/SupportTickets';
import AdminTickets from '@/pages/AdminTickets';
import { Bell, X } from 'lucide-react';

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

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora mismo';
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    const days = Math.floor(hours / 24);
    return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
  };

  const handleNotificationClick = (n: AppNotification) => {
    const match = n.title.match(/#(TK-\d+)/);
    if (match) {
      localStorage.setItem('fixpro_open_ticket', match[1]);
      setShowNotifications(false);
      markNotificationRead(n.id);
      setCurrentPage('reports');
      return;
    }
    markNotificationRead(n.id);
  };

  if (!user) return <Login />;

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'entradas': return <CajaEntradas />;
      case 'salidas': return <CajaSalidas />;
      case 'pos':
      case 'caja':
        return <POS onSaleComplete={handleSaleComplete} onNavigate={handleNavigate} />;
      case 'clients': return <Clientes onNavigate={handleNavigate} />;
      case 'orders': return <Orders onStatusChange={handleOrderStatusChange} onNavigate={handleNavigate} />;
      case 'deliveries': return <Deliveries onDeliver={handleDeliver} />;
      case 'inventory': return <Inventory />;
      case 'tenants': return <Tenants />;
      case 'broadcasts': return <Broadcasts />;
      case 'finanzas': return <Finanzas />;
      case 'users': return <Users />;
      case 'cortedecaja': return <CorteDeCaja />;
      case 'repairs': return <Repairs onNavigate={handleNavigate} />;
      case 'reports': return <SupportTickets />;
      case 'admin-tickets': return <AdminTickets />;
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

      {/* CAMPANITA COMPACTA ESTILO CANVA */}
      {showNotifications && (
        <div className="fixed inset-0 z-50" onClick={() => setShowNotifications(false)}>
          <div
            className="absolute bg-white rounded-2xl shadow-2xl border border-ink-100 overflow-hidden flex flex-col"
            style={{ top: 68, right: 14, width: 380, maxWidth: 'calc(100vw - 28px)', maxHeight: 'calc(100vh - 90px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header compacto */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-ink-100">
              <h2 className="text-lg font-extrabold text-ink-900 leading-none">Notificaciones</h2>
              {unreadCount > 0 ? (
                <button onClick={markAllRead} className="text-xs text-blue-600 font-semibold hover:underline shrink-0">
                  Marcar todas como leídas
                </button>
              ) : (
                <button onClick={() => setShowNotifications(false)} className="text-ink-400 hover:text-ink-600 p-1">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Lista compacta */}
            <div className="overflow-y-auto px-3 py-2 space-y-2">
              {userNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-ink-400">
                  <Bell className="w-8 h-8 mb-2 text-ink-300" />
                  <p className="font-medium text-xs">Sin notificaciones</p>
                </div>
              ) : (
                userNotifications.map((n) => {
                  const isTicket = n.title.includes('ticket #') || n.title.includes('TK-');
                  return (
                    <div
                      key={n.id}
                      className="rounded-xl px-3 py-2.5"
                      style={{ background: !n.read ? '#EFF6FF' : '#fff', border: !n.read ? '1px solid #DBEAFE' : '1px solid #F1F5F9' }}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className="rounded-full flex items-center justify-center shrink-0"
                          style={{ width: 36, height: 36, fontSize: 16, background: isTicket ? '#DBEAFE' : '#F1F5F9' }}
                        >
                          {isTicket ? '🎫' : '📢'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-ink-900 leading-snug">{n.title}</p>
                          <p className="text-xs text-ink-600 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                          <div className="flex items-center justify-between mt-2 gap-2">
                            <p className="text-xs text-ink-400">{timeAgo(n.created_at)}</p>
                            {isTicket ? (
                              <button onClick={() => handleNotificationClick(n)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-full shrink-0">
                                Ver ticket
                              </button>
                            ) : !n.read ? (
                              <button onClick={() => markNotificationRead(n.id)} className="text-xs text-blue-600 font-semibold hover:underline shrink-0">
                                Marcar como leída
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer compacto */}
            {userNotifications.length > 0 && (
              <div className="px-3 pb-3 pt-1">
                <button
                  onClick={() => { setShowNotifications(false); setCurrentPage('reports'); }}
                  className="w-full bg-ink-100 hover:bg-ink-200 text-blue-600 font-bold text-xs py-2.5 rounded-full"
                >
                  Ver todas las notificaciones
                </button>
              </div>
            )}
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