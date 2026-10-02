import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { sales, repairOrders, products, customers } from '@/data/mock';
import { formatCurrency, formatDateTime, PAYMENT_METHOD_LABELS, ORDER_STATUS_CONFIG } from '@/utils/permissions';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, ClipboardList,
  Package, Users, AlertTriangle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const tenantId = user?.tenant_id;

  const tenantSales = useMemo(() => sales.filter((s) => s.tenant_id === tenantId), [tenantId]);
  const tenantOrders = useMemo(() => repairOrders.filter((o) => o.tenant_id === tenantId), [tenantId]);
  const tenantProducts = useMemo(() => products.filter((p) => p.tenant_id === tenantId), [tenantId]);
  const tenantCustomers = useMemo(() => customers.filter((c) => c.tenant_id === tenantId), [tenantId]);

  const totalRevenue = tenantSales.reduce((s, sale) => s + sale.total, 0);
  const todayRevenue = tenantSales
    .filter((s) => new Date(s.created_at).toDateString() === new Date().toDateString())
    .reduce((s, sale) => s + sale.total, 0);
  const activeOrders = tenantOrders.filter((o) => o.status !== 'entregado').length;
  const readyOrders = tenantOrders.filter((o) => o.status === 'listo').length;
  const lowStock = tenantProducts.filter((p) => p.stock <= p.min_stock).length;
  const totalInventory = tenantProducts.reduce((s, p) => s + p.stock * p.cost_price, 0);

  const revenueByMethod = useMemo(() => {
    const methods: Record<string, number> = {};
    tenantSales.forEach((s) => { methods[s.payment_method] = (methods[s.payment_method] || 0) + s.total; });
    return methods;
  }, [tenantSales]);

  const recentSales = [...tenantSales].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const recentOrders = [...tenantOrders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  const maxMethodValue = Math.max(...Object.values(revenueByMethod), 1);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ingresos hoy" value={formatCurrency(todayRevenue)} icon={DollarSign} color="primary" trend="+12%" />
        <StatCard label="Ingresos totales" value={formatCurrency(totalRevenue)} icon={TrendingUp} color="success" trend="+8%" />
        <StatCard label="Órdenes activas" value={String(activeOrders)} icon={ClipboardList} color="accent" trend={`${readyOrders} listas`} />
        <StatCard label="Valor inventario" value={formatCurrency(totalInventory)} icon={Package} color="warning" trend={`${tenantProducts.length} productos`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue by payment method */}
        <div className="card p-5 lg:col-span-1">
          <h3 className="font-bold text-ink-800 mb-4">Ingresos por método de pago</h3>
          <div className="space-y-3">
            {Object.entries(revenueByMethod).map(([method, amount]) => (
              <div key={method}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-ink-600 font-medium">{PAYMENT_METHOD_LABELS[method]}</span>
                  <span className="text-ink-800 font-semibold">{formatCurrency(amount)}</span>
                </div>
                <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${(amount / maxMethodValue) * 100}%` }} />
                </div>
              </div>
            ))}
            {Object.keys(revenueByMethod).length === 0 && (
              <p className="text-sm text-ink-400 text-center py-6">Sin ventas registradas</p>
            )}
          </div>
        </div>

        {/* Recent sales */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-ink-800">Ventas recientes</h3>
            <ShoppingCart className="w-5 h-5 text-ink-400" />
          </div>
          <div className="space-y-2">
            {recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between py-2 border-b border-ink-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary-700">{sale.folio}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-800">{sale.customer_name ?? 'Venta mostrador'}</p>
                    <p className="text-xs text-ink-500">{formatDateTime(sale.created_at)} · {PAYMENT_METHOD_LABELS[sale.payment_method]}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-success-600">{formatCurrency(sale.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-ink-800">Órdenes recientes</h3>
            <ClipboardList className="w-5 h-5 text-ink-400" />
          </div>
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between py-2 border-b border-ink-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-ink-100 flex items-center justify-center">
                    <ClipboardList className="w-4 h-4 text-ink-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-800">{order.customer_name}</p>
                    <p className="text-xs text-ink-500">{order.device_brand} {order.device_model} · {order.folio}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`badge ${ORDER_STATUS_CONFIG[order.status].color}`}>{ORDER_STATUS_CONFIG[order.status].label}</span>
                  {order.total > 0 && <p className="text-xs text-ink-500 mt-1">{formatCurrency(order.total)}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts & customers */}
        <div className="space-y-4">
          {lowStock > 0 && (
            <div className="card p-5 border-warning-200 bg-warning-50/50">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-warning-600" />
                <h3 className="font-bold text-ink-800">Alertas de stock</h3>
              </div>
              <div className="space-y-2">
                {tenantProducts.filter((p) => p.stock <= p.min_stock).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-ink-700 font-medium">{p.name}</span>
                    <span className={`badge ${p.stock === 0 ? 'bg-error-100 text-error-700' : 'bg-warning-100 text-warning-700'}`}>
                      {p.stock} / {p.min_stock}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-primary-600" />
              <h3 className="font-bold text-ink-800">Clientes registrados</h3>
            </div>
            <div className="space-y-2">
              {tenantCustomers.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700 font-medium">{c.name}</span>
                  <div className="text-right">
                    <span className="text-xs text-ink-500">{formatCurrency(c.total_purchases)}</span>
                    {c.credit_balance > 0 && <span className="ml-2 badge bg-error-100 text-error-700">Adeuda {formatCurrency(c.credit_balance)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, trend }: {
  label: string; value: string; icon: typeof DollarSign; color: string; trend?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary-100 text-primary-600',
    success: 'bg-success-100 text-success-600',
    accent: 'bg-accent-100 text-accent-600',
    warning: 'bg-warning-100 text-warning-600',
  };
  return (
    <div className="card p-4 md:p-5">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-xs text-ink-500 font-medium">{label}</p>
      <p className="text-xl md:text-2xl font-bold text-ink-900 mt-0.5">{value}</p>
      {trend && <p className="text-xs text-success-600 mt-1 flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" /> {trend}</p>}
    </div>
  );
}
