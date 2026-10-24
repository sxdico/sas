import { useState, useEffect, useMemo } from 'react';
import { saleAPI, orderAPI, productAPI, cashAPI } from '../api/client'
import { formatCurrency, PAYMENT_METHOD_LABELS, formatDateTime } from '@/utils/permissions';
import { TrendingUp, DollarSign, ShoppingCart, ClipboardList, ArrowUpRight, Wallet, Lock, Unlock, History, Plus, Trash2, Banknote, Receipt } from 'lucide-react';

export default function Reports() {
  const [sales, setSales] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [cashHistory, setCashHistory] = useState<any[]>([]);
  const [currentCash, setCurrentCash] = useState<any>(null);
  const [currentSummary, setCurrentSummary] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'resumen' | 'caja' | 'ventas' | 'salidas'>('resumen');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ amount: '', reason: '', category: 'gasto_general' });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [salesRes, ordersRes, productsRes, cashHistRes, cashCurrRes, expRes] = await Promise.all([
        saleAPI.list(),
        orderAPI.list(),
        productAPI.list(),
        cashAPI.history().catch(() => ({ data: { sessions: [] } })),
        cashAPI.current().catch(() => ({ data: { session: null, summary: null } })),
        cashAPI.expenses?.().catch(() => ({ data: { expenses: [] } })) || { data: { expenses: [] } },
      ]);
      setSales(salesRes.data.sales || salesRes.data || []);
      setOrders(ordersRes.data.orders || ordersRes.data.repairOrders || ordersRes.data || []);
      setProducts(productsRes.data.products || productsRes.data || []);
      setCashHistory(cashHistRes.data.sessions || cashHistRes.data || []);
      setCurrentCash(cashCurrRes.data.session || null);
      setCurrentSummary(cashCurrRes.data.summary || null);
      setExpenses(expRes?.data?.expenses || expRes?.data || []);
    } catch (e) {
      console.error('Error cargando finanzas', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const totalSales = useMemo(() => sales.reduce((s, sale) => s + Number(sale.total), 0), [sales]);
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const totalCost = useMemo(() => {
    return sales.reduce((s, sale: any) => {
      const items = sale.items || sale.SaleItems || [];
      return s + items.reduce((cs: number, item: any) => {
        const product = products.find((p) => p.id === item.product_id);
        return cs + (Number(product?.cost_price?? 0) * Number(item.quantity));
      }, 0);
    }, 0);
  }, [sales, products]);

  const profit = totalSales - totalCost - totalExpenses;
  const profitMargin = totalSales > 0 ? (profit / totalSales) * 100 : 0;
  const ordersRevenue = useMemo(() => orders.filter((o) => o.status === 'entregado').reduce((s, o) => s + Number(o.total), 0), [orders]);
  const avgTicket = sales.length > 0 ? totalSales / sales.length : 0;

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

  const handleCreateExpense = async () => {
    if (!expenseForm.amount || !expenseForm.reason) return;
    try {
      await cashAPI.createExpense({ amount: Number(expenseForm.amount), reason: expenseForm.reason, category: expenseForm.category });
      setShowExpenseModal(false);
      setExpenseForm({ amount: '', reason: '', category: 'gasto_general' });
      loadAll();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error al registrar salida');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('¿Eliminar esta salida? Se re-calculará la caja.')) return;
    try {
      await cashAPI.deleteExpense(id);
      loadAll();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error al eliminar');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mr-3" />
        Cargando finanzas reales...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* TABS */}
      <div className="flex gap-2 bg-ink-100 p-1 rounded-xl w-fit flex-wrap">
        <button onClick={() => setActiveTab('resumen')} className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${activeTab === 'resumen' ? 'bg-white shadow' : 'text-ink-500'}`}><TrendingUp className="w-4 h-4" /> Resumen</button>
        <button onClick={() => setActiveTab('caja')} className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${activeTab === 'caja' ? 'bg-white shadow' : 'text-ink-500'}`}><Wallet className="w-4 h-4" /> Cortes de caja ({cashHistory.length})</button>
        <button onClick={() => setActiveTab('ventas')} className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${activeTab === 'ventas' ? 'bg-white shadow' : 'text-ink-500'}`}><ShoppingCart className="w-4 h-4" /> Ventas ({sales.length})</button>
        <button onClick={() => setActiveTab('salidas')} className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${activeTab === 'salidas' ? 'bg-white shadow' : 'text-ink-500'}`}><Banknote className="w-4 h-4" /> Salidas ({expenses.length})</button>
      </div>

      {/* CAJA ACTUAL */}
      {currentCash && (
        <div className="card p-4 border-2 border-green-200 bg-green-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center"><Unlock className="w-5 h-5 text-white" /></div>
              <div>
                <p className="font-bold text-green-800">{currentCash.folio} - ABIERTA desde {formatDateTime(currentCash.opened_at)}</p>
                <p className="text-sm text-green-600">Por {currentCash.user_open_name} | Inicial: {formatCurrency(currentCash.opening_amount)} | Ventas: {formatCurrency(currentSummary?.total || 0)} ({currentSummary?.count || 0}) | Salidas: {formatCurrency(currentSummary?.total_salidas || 0)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-green-600">Efectivo en caja ahora</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(parseFloat(currentCash.opening_amount) + parseFloat(currentSummary?.efectivo || 0) - parseFloat(currentSummary?.total_salidas || 0))}</p>
            </div>
          </div>
        </div>
      )}

      {!currentCash && (
        <div className="card p-4 border-2 border-red-200 bg-red-50 flex items-center gap-3">
          <Lock className="w-5 h-5 text-red-600" />
          <p className="text-sm font-semibold text-red-700">No hay caja abierta. Ve a POS para abrir caja y poder vender.</p>
        </div>
      )}

      {activeTab === 'resumen' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <ReportCard label="Ventas totales" value={formatCurrency(totalSales)} sub={`${sales.length} tickets`} icon={DollarSign} color="bg-green-100 text-green-600" />
            <ReportCard label="Ingresos por reparaciones" value={formatCurrency(ordersRevenue)} sub={`${orders.filter(o=>o.status==='entregado').length} entregadas`} icon={ClipboardList} color="bg-blue-100 text-blue-600" />
            <ReportCard label="Costo de productos" value={formatCurrency(totalCost)} sub={`${profitMargin.toFixed(1)}% margen`} icon={ShoppingCart} color="bg-orange-100 text-orange-600" />
            <ReportCard label="Salidas / Gastos" value={formatCurrency(totalExpenses)} sub={`${expenses.length} movimientos`} icon={Banknote} color="bg-red-100 text-red-600" />
            <ReportCard label="Ganancia neta" value={formatCurrency(profit)} sub={`Ticket prom: ${formatCurrency(avgTicket)}`} icon={TrendingUp} color="bg-ink-900 text-white" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="font-bold text-ink-800 mb-4">Top productos por ingresos</h3>
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div><p className="text-sm font-semibold">{p.name}</p><p className="text-xs text-ink-500">{p.qty} vendidos</p></div>
                    <p className="text-sm font-bold">{formatCurrency(p.revenue)}</p>
                  </div>
                ))}
                {topProducts.length===0 && <p className="text-sm text-ink-400">Sin datos aún</p>}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-bold text-ink-800 mb-4">Cuadre rápido de caja actual</h3>
              {currentCash ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Apertura</span><span className="font-bold">{formatCurrency(currentCash.opening_amount)}</span></div>
                  <div className="flex justify-between"><span>+ Ventas efectivo</span><span className="font-bold text-green-600">{formatCurrency(currentSummary?.efectivo || 0)}</span></div>
                  <div className="flex justify-between"><span>- Salidas</span><span className="font-bold text-red-600">- {formatCurrency(currentSummary?.total_salidas || 0)}</span></div>
                  <div className="border-t pt-2 flex justify-between font-bold text-base"><span>Efectivo esperado en caja</span><span>{formatCurrency(parseFloat(currentCash.opening_amount) + parseFloat(currentSummary?.efectivo || 0) - parseFloat(currentSummary?.total_salidas || 0))}</span></div>
                  <div className="text-xs text-ink-400 mt-2">Tarjeta: {formatCurrency(currentSummary?.tarjeta||0)} | Transferencia: {formatCurrency(currentSummary?.transferencia||0)}</div>
                </div>
              ) : <p className="text-sm text-ink-400">Abre caja para ver el cuadre</p>}
            </div>
          </div>
        </>
      )}

      {activeTab === 'caja' && (
        <div className="card overflow-hidden">
          <div className="p-5 border-b flex items-center gap-2"><History className="w-5 h-5" /><h3 className="font-bold">Historial de cortes de caja</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ink-50 border-b">
                <tr>
                  <th className="text-left text-xs font-bold uppercase px-4 py-3">Folio</th>
                  <th className="text-left text-xs font-bold uppercase px-4 py-3">Apertura</th>
                  <th className="text-left text-xs font-bold uppercase px-4 py-3">Cierre</th>
                  <th className="text-right text-xs font-bold uppercase px-4 py-3">Inicial</th>
                  <th className="text-right text-xs font-bold uppercase px-4 py-3">Ventas</th>
                  <th className="text-right text-xs font-bold uppercase px-4 py-3">Salidas</th>
                  <th className="text-right text-xs font-bold uppercase px-4 py-3">Efectivo</th>
                  <th className="text-right text-xs font-bold uppercase px-4 py-3">Esperado</th>
                  <th className="text-right text-xs font-bold uppercase px-4 py-3">Contado</th>
                  <th className="text-right text-xs font-bold uppercase px-4 py-3">Diferencia</th>
                  <th className="text-left text-xs font-bold uppercase px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cashHistory.map((c: any) => (
                  <tr key={c.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 text-sm font-bold text-primary-600">{c.folio}</td>
                    <td className="px-4 py-3 text-xs">{formatDateTime(c.opened_at)}<br/><span className="text-ink-400">{c.user_open_name}</span></td>
                    <td className="px-4 py-3 text-xs">{c.closed_at ? formatDateTime(c.closed_at) : '-'}<br/><span className="text-ink-400">{c.user_close_name || ''}</span></td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(c.opening_amount)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold">{formatCurrency(c.total_sales || 0)} ({c.sales_count})</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600 font-bold">{formatCurrency(c.total_salidas || 0)}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-700 font-bold">{formatCurrency(c.total_efectivo || 0)}</td>
                    <td className="px-4 py-3 text-sm text-right">{c.expected_amount ? formatCurrency(c.expected_amount) : '-'}</td>
                    <td className="px-4 py-3 text-sm text-right">{c.closing_amount ? formatCurrency(c.closing_amount) : '-'}</td>
                    <td className={`px-4 py-3 text-sm text-right font-bold ${parseFloat(c.difference) === 0 ? 'text-green-600' : parseFloat(c.difference) > 0 ? 'text-blue-600' : 'text-red-600'}`}>{c.difference ? formatCurrency(c.difference) : '-'}</td>
                    <td className="px-4 py-3"><span className={`badge ${c.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-ink-100'}`}>{c.status === 'open' ? 'Abierta' : 'Cerrada'}</span></td>
                  </tr>
                ))}
                {cashHistory.length === 0 && <tr><td colSpan={11} className="text-center py-10 text-ink-400">Sin cortes aún. Abre y cierra caja en POS.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'ventas' && (
        <div className="card p-5">
          <h3 className="font-bold text-ink-800 mb-4">Historial de ventas</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-3 py-2">Folio</th>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-3 py-2">Fecha</th>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-3 py-2">Cliente</th>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-3 py-2">Método</th>
                  <th className="text-right text-xs font-bold text-ink-500 uppercase px-3 py-2">Total</th>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-3 py-2">Caja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {sales.map((s: any) => (
                  <tr key={s.id} className="hover:bg-ink-50">
                    <td className="px-3 py-2.5 text-sm font-bold text-primary-600">{s.folio}</td>
                    <td className="px-3 py-2.5 text-xs">{formatDateTime(s.created_at)}</td>
                    <td className="px-3 py-2.5 text-sm">{s.customer_name ?? 'Mostrador'}</td>
                    <td className="px-3 py-2.5 text-sm">{PAYMENT_METHOD_LABELS[s.payment_method as keyof typeof PAYMENT_METHOD_LABELS] || s.payment_method}</td>
                    <td className="px-3 py-2.5 text-sm font-bold text-right">{formatCurrency(Number(s.total))}</td>
                    <td className="px-3 py-2.5 text-xs">{s.cash_session_id ? <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded border">En caja</span> : <span className="text-ink-400">Sin caja</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'salidas' && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-ink-800 flex items-center gap-2"><Receipt className="w-5 h-5"/> Salidas de caja (gastos, compras, retiros)</h3>
            <button onClick={() => setShowExpenseModal(true)} className="btn btn-primary flex items-center gap-2"><Plus className="w-4 h-4"/> Registrar salida</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-3 py-2">Fecha</th>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-3 py-2">Concepto</th>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-3 py-2">Categoría</th>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-3 py-2">Usuario</th>
                  <th className="text-right text-xs font-bold text-ink-500 uppercase px-3 py-2">Monto</th>
                  <th className="text-center text-xs font-bold text-ink-500 uppercase px-3 py-2">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {expenses.map((e: any) => (
                  <tr key={e.id} className="hover:bg-ink-50">
                    <td className="px-3 py-2.5 text-xs">{formatDateTime(e.created_at)}</td>
                    <td className="px-3 py-2.5 text-sm font-medium">{e.reason}</td>
                    <td className="px-3 py-2.5 text-xs"><span className="badge bg-ink-100">{e.category}</span></td>
                    <td className="px-3 py-2.5 text-xs">{e.user_name}</td>
                    <td className="px-3 py-2.5 text-sm font-bold text-right text-red-600">- {formatCurrency(e.amount)}</td>
                    <td className="px-3 py-2.5 text-center"><button onClick={() => handleDeleteExpense(e.id)} className="p-1 hover:bg-red-50 rounded text-red-500"><Trash2 className="w-4 h-4"/></button></td>
                  </tr>
                ))}
                {expenses.length===0 && <tr><td colSpan={6} className="text-center py-10 text-ink-400">Sin salidas registradas. Usa el botón para registrar una compra, pago a proveedor, etc.</td></tr>}
              </tbody>
              {expenses.length>0 && (
                <tfoot className="border-t bg-ink-50">
                  <tr><td colSpan={4} className="px-3 py-2 text-right font-bold text-sm">Total salidas:</td><td className="px-3 py-2 text-right font-bold text-red-600">{formatCurrency(totalExpenses)}</td><td></td></tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setShowExpenseModal(false)}></div>
          <div className="relative bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-bold text-lg mb-4">Registrar salida de caja</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Monto</label>
                <input type="number" value={expenseForm.amount} onChange={e=>setExpenseForm({...expenseForm, amount:e.target.value})} className="input w-full mt-1" placeholder="0.00" autoFocus />
              </div>
              <div>
                <label className="text-sm font-medium">Categoría</label>
                <select value={expenseForm.category} onChange={e=>setExpenseForm({...expenseForm, category:e.target.value})} className="input w-full mt-1">
                  <option value="gasto_general">Gasto general</option>
                  <option value="compra_refaccion">Compra refacción / producto</option>
                  <option value="pago_proveedor">Pago a proveedor</option>
                  <option value="retiro">Retiro de efectivo</option>
                  <option value="sueldo">Sueldo / Pago</option>
                  <option value="servicios">Servicios (luz, internet)</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Concepto / Motivo</label>
                <input type="text" value={expenseForm.reason} onChange={e=>setExpenseForm({...expenseForm, reason:e.target.value})} className="input w-full mt-1" placeholder="Ej: Compra de micas, pago luz..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={()=>setShowExpenseModal(false)} className="btn btn-ghost flex-1">Cancelar</button>
              <button onClick={handleCreateExpense} className="btn btn-primary flex-1 bg-red-600 hover:bg-red-700">Registrar salida</button>
            </div>
            <p className="text-xs text-ink-400 mt-3 text-center">Esta salida se descontará del efectivo de la caja abierta actual para el cuadre.</p>
          </div>
        </div>
      )}
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