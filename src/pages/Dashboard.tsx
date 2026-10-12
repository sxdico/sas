import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { orderAPI, productAPI } from '@/api/client';
import { formatCurrency, formatDateTime, PAYMENT_METHOD_LABELS, ORDER_STATUS_CONFIG } from '@/utils/permissions';
import type { OrderStatus } from '@/types';
import {
  TrendingUp, DollarSign, ClipboardList,
  Package, Users, AlertTriangle, ShoppingCart,
  ArrowUpRight, CheckCircle2, BadgeCheck,
} from 'lucide-react';
import axios from 'axios';

// Intentamos usar saleAPI si existe, si no hacemos fetch directo
// tu backend ya tiene /api/sales
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, productsRes, salesRes] = await Promise.all([
        orderAPI.list().catch(() => ({ data: { orders: [] } })),
        productAPI.list().catch(() => ({ data: { products: [] } })),
        axios.get(`${API_URL}/api/sales`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }).catch(() => ({ data: { sales: [] } }))
      ]);

      // orders
      const ords = (ordersRes as any).data?.orders || (ordersRes as any).data || [];
      setOrders(ords);

      // products
      const prods = (productsRes as any).data?.products || (productsRes as any).data || [];
      setProducts(prods);

      // sales
      const sals = (salesRes as any).data?.sales || (salesRes as any).data || [];
      setSales(sals);

      // clientes sacados de las ordenes + ventas (para no depender de mock)
      const custMap = new Map();
      ords.forEach((o: any) => {
        if (!custMap.has(o.customer_name)) {
          custMap.set(o.customer_name, { id: o.customer_name, name: o.customer_name, total_purchases: 0, credit_balance: 0 });
        }
        const c = custMap.get(o.customer_name);
        c.total_purchases += parseFloat(o.total || 0);
      });
      setCustomers(Array.from(custMap.values()));

    } catch (e) {
      console.error('Error cargando dashboard real', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ===== CALCULOS REALES - incluye anticipos de ordenes =====
  const totalRevenue = useMemo(() => {
    const salesTotal = sales.reduce((s, sale) => s + parseFloat(sale.total || 0), 0);
    const ordersAnticipo = orders.reduce((s, o) => s + parseFloat((o as any).advance_payment || 0), 0);
    return salesTotal + ordersAnticipo;
  }, [sales, orders]);

  const todayRevenue = useMemo(() => {
    const today = new Date().toDateString();
    const salesToday = sales
      .filter((s) => new Date(s.created_at).toDateString() === today)
      .reduce((s, sale) => s + parseFloat(sale.total || 0), 0);
    const ordersToday = orders
      .filter((o) => new Date(o.created_at).toDateString() === today)
      .reduce((s, o) => s + parseFloat((o as any).advance_payment || 0), 0);
    return salesToday + ordersToday;
  }, [sales, orders]);

  const activeOrders = useMemo(() => orders.filter((o) => o.status !== 'entregado').length, [orders]);
  const readyOrders = useMemo(() => orders.filter((o) => o.status === 'listo').length, [orders]);
  const lowStockProducts = useMemo(() => products.filter((p) => p.stock <= p.min_stock), [products]);
  const lowStock = lowStockProducts.length;
  const totalInventory = useMemo(() => products.reduce((s, p) => s + parseFloat(p.stock || 0) * parseFloat(p.cost_price || 0), 0), [products]);

  const revenueByMethod = useMemo(() => {
    const methods: Record<string, number> = {};
    sales.forEach((s) => { 
      const method = s.payment_method || 'efectivo';
      methods[method] = (methods[method] || 0) + parseFloat(s.total || 0); 
    });
    orders.forEach((o: any) => {
      const adv = parseFloat(o.advance_payment || 0);
      if (adv > 0) {
        const method = o.payment_method_anticipo || 'efectivo';
        methods[method] = (methods[method] || 0) + adv;
      }
    });
    return methods;
  }, [sales, orders]);

  const recentSales = useMemo(() => {
    const sortedSales = [...sales].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
    if (sortedSales.length > 0) return sortedSales;
    return [...orders]
      .filter((o: any) => parseFloat(o.advance_payment || 0) > 0)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((o: any) => ({
        id: o.id,
        folio: o.folio,
        customer_name: o.customer_name,
        total: o.advance_payment,
        payment_method: o.payment_method_anticipo || 'efectivo',
        created_at: o.created_at
      }));
  }, [sales, orders]);
  const recentOrders = useMemo(() => [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5), [orders]);

  const maxMethodValue = Math.max(...Object.values(revenueByMethod), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mr-3" />
        Cargando datos reales...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ingresos hoy" value={formatCurrency(todayRevenue)} icon={DollarSign} color="primary" trend="+12%" />
        <StatCard label="Ingresos totales" value={formatCurrency(totalRevenue)} icon={TrendingUp} color="success" trend="+8%" />
        <StatCard label="Órdenes activas" value={String(activeOrders)} icon={ClipboardList} color="accent" trend={`${readyOrders} listas`} />
        <StatCard label="Valor inventario" value={formatCurrency(totalInventory)} icon={Package} color="warning" trend={`${products.length} productos`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue by payment method */}
        <div className="card p-5 lg:col-span-1">
          <h3 className="font-bold text-ink-800 mb-4">Ingresos por método de pago</h3>
          <div className="space-y-3">
            {Object.entries(revenueByMethod).map(([method, amount]) => (
              <div key={method}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-ink-600 font-medium">{(PAYMENT_METHOD_LABELS as any)[method] || method}</span>
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

        {/* Recent sales - DATOS REALES */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-ink-800">Ventas recientes</h3>
            <ShoppingCart className="w-5 h-5 text-ink-400" />
          </div>
          <div className="space-y-2">
            {recentSales.length === 0 && <p className="text-sm text-ink-400 text-center py-6">Sin ventas registradas</p>}
            {recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between py-2 border-b border-ink-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary-700">{sale.folio}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-800">{sale.customer_name ?? 'Venta mostrador'}</p>
                    <p className="text-xs text-ink-500">{formatDateTime(sale.created_at)} · {(PAYMENT_METHOD_LABELS as any)[sale.payment_method] || sale.payment_method}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-success-600">{formatCurrency(sale.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent orders - DATOS REALES */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-ink-800">Órdenes recientes</h3>
            <ClipboardList className="w-5 h-5 text-ink-400" />
          </div>
          <div className="space-y-2">
            {recentOrders.length === 0 && <p className="text-sm text-ink-400 text-center py-6">Sin órdenes</p>}
            {recentOrders.map((order) => {
              const total = parseFloat((order as any).total || 0);
              const adv = parseFloat((order as any).advance_payment || 0);
              const pagado = total > 0 && adv >= total;
              const parcial = adv > 0 && adv < total;
              return (
                <div key={order.id} className="flex items-center justify-between py-2 border-b border-ink-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${pagado ? 'bg-green-100' : 'bg-ink-100'}`}>
                      {pagado ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <ClipboardList className="w-4 h-4 text-ink-500" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-ink-800">{order.customer_name}</p>
                        {pagado && (
                          <span className="inline-flex items-center gap-0.5 bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-green-200">
                            <BadgeCheck className="w-3 h-3" /> Pagado
                          </span>
                        )}
                        {parcial && (
                          <span className="inline-flex items-center bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-amber-200">
                            Anticipo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-500">{order.device_brand} {order.device_model} · {order.folio}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${(ORDER_STATUS_CONFIG as any)[order.status]?.color || 'bg-gray-100'}`}>{(ORDER_STATUS_CONFIG as any)[order.status]?.label || order.status}</span>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      {order.total > 0 && <p className="text-xs text-ink-500">{formatCurrency(total)}</p>}
                      {pagado && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                    </div>
                    {parcial && (
                      <p className="text-[10px] text-amber-600 font-medium">Debe {formatCurrency(total - adv)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alerts & customers - DATOS REALES */}
        <div className="space-y-4">
          {lowStock > 0 && (
            <div className="card p-5 border-warning-200 bg-warning-50/50">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-warning-600" />
                <h3 className="font-bold text-ink-800">Alertas de stock</h3>
              </div>
              <div className="space-y-2">
                {lowStockProducts.map((p) => (
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
              {customers.length === 0 && <p className="text-sm text-ink-400">Sin clientes aún</p>}
              {customers.map((c) => (
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