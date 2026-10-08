import { useState, useMemo, useCallback } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { can } from '@/utils/permissions';
import { notifications as initialNotifications } from '@/data/mock';
import type { AppNotification, SaleItem, PaymentMethod, OrderStatus } from '@/types';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import POS from '@/pages/POS';
import Orders from '@/pages/Orders';
import Deliveries from '@/pages/Deliveries';
import Inventory from '@/pages/Inventory';
import Tenants from '@/pages/Tenants';
import Dashboard from '@/pages/Dashboard';
import Reports from '@/pages/Reports';
import Users from '@/pages/Users';
import { Bell, X, Check, AlertTriangle, Info } from 'lucide-react';

function AppContent() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);
  const [showNotifications, setShowNotifications] = useState(false);

  const userNotifications = useMemo(() => {
    if (!user) return [];
    return notifications.filter((n) =>
      n.tenant_id === user.tenant_id &&
      n.for_roles.includes(user.role)
    );
  }, [notifications, user]);

  const unreadCount = userNotifications.filter((n) => !n.read).length;

  const handleNavigate = useCallback((page: string) => {
    if (!user) return;
    if (page === 'dashboard' && !can(user.role, 'reports')) {
      if (can(user.role, 'pos')) return setCurrentPage('pos');
      if (can(user.role, 'deliveries')) return setCurrentPage('deliveries');
      if (can(user.role, 'tenants')) return setCurrentPage('tenants');
    }
    setCurrentPage(page);
  }, [user]);

  const handleSaleComplete = useCallback((_items: SaleItem[], _total: number, _method: PaymentMethod, _customerName: string | null) => {
    // In production this would POST /api/sales and create inventory_movement 'out'
  }, []);

  const handleOrderStatusChange = useCallback((_orderId: string, newStatus: OrderStatus) => {
    if (newStatus === 'listo' && user) {
      setNotifications((prev) => [...prev, {
        id: `n${Date.now()}`, tenant_id: user.tenant_id!,
        title: 'Orden lista para entrega',
        message: 'Una orden ha sido marcada como lista.',
        type: 'success', read: false, created_at: new Date().toISOString(),
        for_roles: ['owner', 'secretary', 'cashier'],
      }]);
    }
  }, [user]);

  const handleDeliver = useCallback((_orderId: string) => {
    // In production this would PUT /api/orders/:id/status { status: 'entregado' }
  }, []);

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  if (!user) return <Login />;

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'pos': return <POS onSaleComplete={handleSaleComplete} />;
      case 'orders': return <Orders onStatusChange={handleOrderStatusChange} onNavigate={handleNavigate} />;
      case 'deliveries': return <Deliveries onDeliver={handleDeliver} />;
      case 'inventory': return <Inventory />;
      case 'tenants': return <Tenants />;
      case 'reports': return <Reports />;
      case 'users': return <Users />;
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

      {/* Notifications panel */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in" onClick={() => setShowNotifications(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-sm bg-white h-full shadow-xl overflow-auto animate-slide-right" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-ink-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="font-bold text-ink-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary-600" />
                Notificaciones
              </h2>
              <button onClick={() => setShowNotifications(false)} className="text-ink-400 hover:text-ink-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="divide-y divide-ink-100">
              {userNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-ink-400">
                  <Bell className="w-12 h-12 mb-3 text-ink-300" />
                  <p className="font-medium">Sin notificaciones</p>
                </div>
              ) : (
                userNotifications.map((n) => (
                  <div key={n.id} className={`px-5 py-4 ${!n.read ? 'bg-primary-50/50' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        n.type === 'success' ? 'bg-success-100 text-success-600' :
                        n.type === 'warning' ? 'bg-warning-100 text-warning-600' :
                        'bg-primary-100 text-primary-600'
                      }`}>
                        {n.type === 'success' ? <Check className="w-4 h-4" /> :
                         n.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
                         <Info className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink-800">{n.title}</p>
                        <p className="text-sm text-ink-600 mt-0.5">{n.message}</p>
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
