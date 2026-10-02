import { useState, useEffect, useMemo } from 'react';
import { saleAPI, orderAPI, productAPI } from '../api/client'
import { formatCurrency, PAYMENT_METHOD_LABELS, ORDER_STATUS_CONFIG } from '@/utils/permissions';
import { TrendingUp, DollarSign, ShoppingCart, ClipboardList, ArrowUpRight } from 'lucide-react';

export default function Reports() {
  const [sales, setSales] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const [salesRes, ordersRes, productsRes] = await Promise.all([
          saleAPI.list(),
          orderAPI.list(),
          productAPI.list(),
        ]);
        setSales(salesRes.data.sales || salesRes.data || []);
        setOrders(ordersRes.data.orders || ordersRes.data.repairOrders || ordersRes.data || []);
        setProducts(productsRes.data.products || productsRes.data || []);
      } catch (e) {
        console.error('Error cargando reportes', e);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const totalSales = useMemo(() => sales.reduce((s, sale) => s + Number(sale.total), 0), [sales]);

  const totalCost = useMemo(() => {
    return sales.reduce((s, sale: any) => {
      const items = sale.items || sale.SaleItems || [];
      return s + items.reduce((cs: number, item: any) => {
        const product = products.find((p) => p.id === item.product_id);
        return cs + (Number(product?.cost_price?? 0) * Number(item.quantity));
      }, 0);
    }, 0);
  }, [sales, products]);

  const profit = totalSales - totalCost;
  const profitMargin = totalSales > 0? (profit / totalSales) * 100 : 0;
  const ordersRevenue = useMemo(() => orders.filter((o) => o.status === 'entregado').reduce((s, o) => s + Number(o.total), 0), [orders]);
  const avgTicket = sales.length > 0? totalSales / sales.length : 0;

  const topProducts = useMemo(() => {
    const counts: Record<string, { name: string; qty: number; revenue: number }> = {};
    sales.forEach((s: any) => {
      const items = s.items || s.SaleItems || [];
      items.forEach((i: any) => {
        if (!counts[i.product_id]) counts[i.product_id] = { name: i.name, qty: 0, revenue: 0 };
        counts[i.product_id].qty += Number(i.quantity);
        counts[i.product_id].revenue += Number(i.price) * Number(i.quantity) - Number(i.discount || 0);
      });
    });
    return Object.values(counts).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [sales]);

  const ordersByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return counts;
  }, [orders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mr-3" />
        Cargando reportes reales de MySQL...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard label="Ingresos por ventas" value={formatCurrency(totalSales)} icon={DollarSign} color="bg-primary-100 text-primary-600" />
        <ReportCard label="Utilidad estimada" value={formatCurrency(profit)} sub={`${profitMargin.toFixed(1)}% margen`} icon={TrendingUp} color="bg-success-100 text-success-600" />
        <ReportCard label="Ticket promedio" value={formatCurrency(avgTicket)} icon={ShoppingCart} color="bg-accent-100 text-accent-600" />
        <ReportCard label="Ingresos reparaciones" value={formatCurrency(ordersRevenue)} icon={ClipboardList} color="bg-warning-100 text-warning-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-bold text-ink-800 mb-4">Productos más vendidos</h3>
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-ink-500">{p.qty} unidades</p>
                </div>
                <span className="text-sm font-bold text-success-600">{formatCurrency(p.revenue)}</span>
              </div>
            ))}
            {topProducts.length === 0 && <p className="text-sm text-ink-400 text-center py-6">Sin ventas aún</p>}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-ink-800 mb-4">Órdenes por estado</h3>
          <div className="space-y-3">
            {Object.entries(ordersByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={`badge ${ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG]?.color || 'bg-ink-100'}`}>
                  {ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG]?.label || status}
                </span>
                <div className="flex items-center gap-3 flex-1 ml-4">
                  <div className="h-2 bg-ink-100 rounded-full overflow-hidden flex-1">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${orders.length > 0? (count / orders.length) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-bold w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
            {Object.keys(ordersByStatus).length === 0 && <p className="text-sm text-ink-400 text-center py-6">Sin órdenes</p>}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-bold text-ink-800 mb-4">Historial de ventas</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-ink-200">
              <tr>
                <th className="text-left text-xs font-bold text-ink-500 uppercase px-3 py-2">Folio</th>
                <th className="text-left text-xs font-bold text-ink-500 uppercase px-3 py-2">Cliente</th>
                <th className="text-left text-xs font-bold text-ink-500 uppercase px-3 py-2">Método</th>
                <th className="text-right text-xs font-bold text-ink-500 uppercase px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {sales.map((s: any) => (
                <tr key={s.id} className="hover:bg-ink-50">
                  <td className="px-3 py-2.5 text-sm font-bold text-primary-600">{s.folio}</td>
                  <td className="px-3 py-2.5 text-sm">{s.customer_name?? 'Mostrador'}</td>
                  <td className="px-3 py-2.5 text-sm">{PAYMENT_METHOD_LABELS[s.payment_method as keyof typeof PAYMENT_METHOD_LABELS] || s.payment_method}</td>
                  <td className="px-3 py-2.5 text-sm font-bold text-right">{formatCurrency(Number(s.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReportCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: any; color: string }) {
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