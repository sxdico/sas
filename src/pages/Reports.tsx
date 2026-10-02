import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { sales, repairOrders, products } from '@/data/mock';
import { formatCurrency, PAYMENT_METHOD_LABELS, ORDER_STATUS_CONFIG } from '@/utils/permissions';
import { TrendingUp, DollarSign, ShoppingCart, ClipboardList, Package, ArrowUpRight } from 'lucide-react';

export default function Reports() {
  const { user } = useAuth();
  const tenantId = user?.tenant_id;

  const tenantSales = useMemo(() => sales.filter((s) => s.tenant_id === tenantId), [tenantId]);
  const tenantOrders = useMemo(() => repairOrders.filter((o) => o.tenant_id === tenantId), [tenantId]);
  const tenantProducts = useMemo(() => products.filter((p) => p.tenant_id === tenantId), [tenantId]);

  const totalSales = tenantSales.reduce((s, sale) => s + sale.total, 0);
  const totalCost = tenantSales.reduce((s, sale) => s + sale.items.reduce((cs, item) => {
    const product = tenantProducts.find((p) => p.id === item.product_id);
    return cs + (product?.cost_price ?? 0) * item.quantity;
  }, 0), 0);
  const profit = totalSales - totalCost;
  const profitMargin = totalSales > 0 ? (profit / totalSales) * 100 : 0;

  const ordersRevenue = tenantOrders.filter((o) => o.status === 'entregado').reduce((s, o) => s + o.total, 0);
  const avgTicket = tenantSales.length > 0 ? totalSales / tenantSales.length : 0;

  const topProducts = useMemo(() => {
    const counts: Record<string, { name: string; qty: number; revenue: number }> = {};
    tenantSales.forEach((s) => s.items.forEach((i) => {
      if (!counts[i.product_id]) counts[i.product_id] = { name: i.name, qty: 0, revenue: 0 };
      counts[i.product_id].qty += i.quantity;
      counts[i.product_id].revenue += i.price * i.quantity - i.discount;
    }));
    return Object.values(counts).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [tenantSales]);

  const ordersByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    tenantOrders.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return counts;
  }, [tenantOrders]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard label="Ingresos por ventas" value={formatCurrency(totalSales)} icon={DollarSign} color="bg-primary-100 text-primary-600" />
        <ReportCard label="Utilidad estimada" value={formatCurrency(profit)} sub={`${profitMargin.toFixed(1)}% margen`} icon={TrendingUp} color="bg-success-100 text-success-600" />
        <ReportCard label="Ticket promedio" value={formatCurrency(avgTicket)} icon={ShoppingCart} color="bg-accent-100 text-accent-600" />
        <ReportCard label="Ingresos reparaciones" value={formatCurrency(ordersRevenue)} icon={ClipboardList} color="bg-warning-100 text-warning-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top products */}
        <div className="card p-5">
          <h3 className="font-bold text-ink-800 mb-4">Productos más vendidos</h3>
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-800 truncate">{p.name}</p>
                  <p className="text-xs text-ink-500">{p.qty} unidades</p>
                </div>
                <span className="text-sm font-bold text-success-600">{formatCurrency(p.revenue)}</span>
              </div>
            ))}
            {topProducts.length === 0 && <p className="text-sm text-ink-400 text-center py-6">Sin datos</p>}
          </div>
        </div>

        {/* Orders by status */}
        <div className="card p-5">
          <h3 className="font-bold text-ink-800 mb-4">Órdenes por estado</h3>
          <div className="space-y-3">
            {Object.entries(ordersByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={`badge ${ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG].color}`}>
                  {ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG].label}
                </span>
                <div className="flex items-center gap-3 flex-1 ml-4">
                  <div className="h-2 bg-ink-100 rounded-full overflow-hidden flex-1">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${(count / tenantOrders.length) * 100}%` }} />
                  </div>
                  <span className="text-sm font-bold text-ink-800 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sales detail */}
      <div className="card p-5">
        <h3 className="font-bold text-ink-800 mb-4">Historial de ventas</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-ink-200">
              <tr>
                <th className="text-left text-xs font-bold text-ink-500 uppercase px-3 py-2">Folio</th>
                <th className="text-left text-xs font-bold text-ink-500 uppercase px-3 py-2">Cliente</th>
                <th className="text-left text-xs font-bold text-ink-500 uppercase px-3 py-2 hidden md:table-cell">Cajero</th>
                <th className="text-left text-xs font-bold text-ink-500 uppercase px-3 py-2">Método</th>
                <th className="text-right text-xs font-bold text-ink-500 uppercase px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {tenantSales.map((s) => (
                <tr key={s.id} className="hover:bg-ink-50">
                  <td className="px-3 py-2.5 text-sm font-bold text-primary-600">{s.folio}</td>
                  <td className="px-3 py-2.5 text-sm text-ink-700">{s.customer_name ?? 'Mostrador'}</td>
                  <td className="px-3 py-2.5 text-sm text-ink-500 hidden md:table-cell">{s.user_name}</td>
                  <td className="px-3 py-2.5 text-sm text-ink-600">{PAYMENT_METHOD_LABELS[s.payment_method]}</td>
                  <td className="px-3 py-2.5 text-sm font-bold text-ink-800 text-right">{formatCurrency(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReportCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: typeof DollarSign; color: string;
}) {
  return (
    <div className="card p-4 md:p-5">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs text-ink-500 font-medium">{label}</p>
      <p className="text-xl md:text-2xl font-bold text-ink-900 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-success-600 mt-1 flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" /> {sub}</p>}
    </div>
  );
}
