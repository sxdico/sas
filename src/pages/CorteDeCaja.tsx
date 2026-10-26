import { useState, useMemo, useEffect } from 'react';
import { cashAPI, saleAPI } from '@/api/client';
import { formatCurrency, formatDateTime } from '@/utils/permissions';
import { DollarSign, ArrowUp, ArrowDown, Wallet, Banknote, Coins, Calendar, Lock } from 'lucide-react';

const DENOMINACIONES = {
  billetes: [
    { value: 1000, label: 'Billete $1,000' },
    { value: 500, label: 'Billete $500' },
    { value: 200, label: 'Billete $200' },
    { value: 100, label: 'Billete $100' },
    { value: 50, label: 'Billete $50' },
    { value: 20, label: 'Billete $20' },
  ],
  monedas: [
    { value: 10, label: 'Moneda $10' },
    { value: 5, label: 'Moneda $5' },
    { value: 2, label: 'Moneda $2' },
    { value: 1, label: 'Moneda $1' },
    { value: 0.5, label: 'Moneda $0.50' },
  ]
};

type ContadorState = Record<number, number>;

export default function CorteDeCaja() {
  const [cashSession, setCashSession] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');
  const [contador, setContador] = useState<ContadorState>({
    1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0,
    10: 0, 5: 0, 2: 0, 1: 0, 0.5: 0
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cashRes, salesRes] = await Promise.all([
        cashAPI.current(),
        saleAPI.list().catch(() => ({ data: { sales: [] } }))
      ]);
      setCashSession(cashRes.data.session);
      setSummary(cashRes.data.summary);
      setExpenses(cashRes.data.expenses || []);
      setIncomes(cashRes.data.incomes || []);
      const allSales = cashRes.data.session ? (salesRes.data.sales || salesRes.data || []).filter((s: any) => s.cash_session_id === cashRes.data.session.id) : [];
      setSales(allSales);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const expectedInCash = useMemo(() => {
    if (!cashSession || !summary) return 0;
    return parseFloat(cashSession.opening_amount) + parseFloat(summary.efectivo || 0) + parseFloat(summary.total_entradas || 0) - parseFloat(summary.total_salidas || 0);
  }, [cashSession, summary]);

  const totalContado = useMemo(() => {
    let total = 0;
    Object.entries(contador).forEach(([valor, cantidad]) => { total += parseFloat(valor) * cantidad; });
    return total;
  }, [contador]);

  const totalBilletes = useMemo(() => DENOMINACIONES.billetes.reduce((acc, d) => acc + (contador[d.value] || 0), 0), [contador]);
  const totalMonedas = useMemo(() => DENOMINACIONES.monedas.reduce((acc, d) => acc + (contador[d.value] || 0), 0), [contador]);
  const diferencia = totalContado - expectedInCash;

  const movimientosDelDia = useMemo(() => {
    const movs: any[] = [];
    if (cashSession) movs.push({ tipo: 'apertura', hora: cashSession.opened_at, concepto: `Apertura de caja • ${formatDateTime(cashSession.opened_at)}`, monto: cashSession.opening_amount, color: 'green' });
    sales.forEach((s: any) => movs.push({ tipo: 'venta', hora: s.created_at, concepto: `Venta ${s.folio} • ${new Date(s.created_at).toLocaleTimeString()}`, monto: s.total, color: 'blue' }));
    incomes.forEach((i: any) => movs.push({ tipo: 'entrada', hora: i.created_at, concepto: `${i.reason} • ${i.category}`, monto: i.amount, color: 'emerald' }));
    expenses.forEach((e: any) => movs.push({ tipo: 'salida', hora: e.created_at, concepto: `${e.reason} • ${e.category}`, monto: e.amount, color: 'red' }));
    return movs.sort((a, b) => new Date(a.hora).getTime() - new Date(b.hora).getTime());
  }, [cashSession, sales, incomes, expenses]);

  const handleCloseCash = async () => {
    try {
      const res = await cashAPI.close({ closing_amount: totalContado, notes: closeNotes });
      setShowCloseModal(false);
      alert(`Caja ${res.data.session.folio} cerrada. Diferencia: ${formatCurrency(res.data.session.difference)}`);
      loadAll();
    } catch (e: any) { alert(e.response?.data?.error || 'Error al cerrar caja'); }
  };

  const updateContador = (valor: number, cantidad: string) => {
    const num = parseInt(cantidad) || 0;
    setContador(prev => ({ ...prev, [valor]: Math.max(0, num) }));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mr-3" /> Cargando corte...</div>;

  if (!cashSession) {
    return (
      <div className="p-6">
        <div className="card p-10 text-center border-2 border-dashed">
          <Wallet className="w-12 h-12 mx-auto text-ink-300 mb-3" />
          <h3 className="font-bold text-lg">No hay caja abierta</h3>
          <p className="text-sm text-ink-500">Ve a Caja (POS) para abrir caja y ver el corte.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f8fafc] min-h-full">
      {/* TOP BAR UNIFICADO - MISMO QUE CAJA CON CANDADO */}
      <div className="p-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border flex-wrap justify-between bg-green-50 border-green-200">
          <div className="flex items-center gap-2 flex-wrap">
            <Lock className="w-3.5 h-3.5 text-ink-400" />
            <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">● {cashSession.folio} ABIERTA</span>
            <span className="text-xs bg-white px-2 py-1 rounded border">Inicial: {formatCurrency(cashSession.opening_amount)}</span>
            <span className="text-xs bg-white px-2 py-1 rounded border">Ventas: {formatCurrency(summary?.total || 0)} {summary?.count || 0}</span>
            <span className="text-xs bg-emerald-600 text-white px-2 py-1 rounded font-bold">Efectivo: {formatCurrency(summary?.efectivo || 0)}</span>
            {summary?.total_entradas > 0 && <span className="text-xs bg-emerald-600 text-white px-2 py-1 rounded">Entradas: +{formatCurrency(summary.total_entradas)}</span>}
            {summary?.total_salidas > 0 && <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">Salidas: -{formatCurrency(summary.total_salidas)}</span>}
            <span className="text-xs bg-white px-2 py-1 rounded border font-bold">Esperado: {formatCurrency(expectedInCash)}</span>
          </div>
          <span className="text-xs text-ink-500 ml-auto">Abierta hoy {new Date(cashSession.opened_at).toLocaleDateString()} {new Date(cashSession.opened_at).toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="p-4 md:p-6 pt-0">
        <h1 className="text-3xl font-extrabold tracking-tight mb-6">Corte de Caja</h1>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border p-4"><div className="flex items-center gap-2 text-xs text-ink-500"><Wallet className="w-4 h-4" /> Inicial</div><div className="text-xl font-bold">{formatCurrency(cashSession.opening_amount)}</div></div>
              <div className="bg-white rounded-2xl border p-4"><div className="flex items-center gap-2 text-xs text-ink-500"><ArrowUp className="w-4 h-4" /> Ventas</div><div className="text-xl font-bold">{formatCurrency(summary?.total || 0)}</div></div>
              <div className="bg-white rounded-2xl border p-4"><div className="flex items-center gap-2 text-xs text-ink-500"><ArrowUp className="w-4 h-4 text-emerald-600" /> Entradas</div><div className="text-xl font-bold text-emerald-600">+{formatCurrency(summary?.total_entradas || 0)}</div></div>
              <div className="bg-white rounded-2xl border p-4"><div className="flex items-center gap-2 text-xs text-ink-500"><ArrowDown className="w-4 h-4 text-red-600" /> Salidas</div><div className="text-xl font-bold text-red-600">-{formatCurrency(summary?.total_salidas || 0)}</div></div>
              <div className="bg-white rounded-2xl border p-4 col-span-2 md:col-span-2"><div className="flex items-center gap-2 text-xs text-ink-500"><Banknote className="w-4 h-4" /> Efectivo esperado</div><div className="text-xl font-bold">{formatCurrency(expectedInCash)}</div></div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="p-5 border-b"><h3 className="font-bold text-lg flex items-center gap-2"><Coins className="w-5 h-5" /> Cash Counter</h3><p className="text-xs text-ink-500">Cuenta tu efectivo para cuadrar la caja</p></div>
              <div className="p-5 space-y-6">
                <div><p className="text-xs font-bold tracking-widest text-ink-500 mb-3">BILLETES</p><div className="space-y-2">{DENOMINACIONES.billetes.map((b) => (
                  <div key={b.value} className="flex items-center justify-between gap-3 bg-ink-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 w-28"><div className="w-8 h-5 bg-gradient-to-r from-blue-100 to-green-100 rounded border text-[8px] flex items-center justify-center font-bold">${b.value}</div><span className="text-sm">{b.value} x</span></div>
                    <input type="number" min={0} value={contador[b.value] || 0} onChange={e => updateContador(b.value, e.target.value)} className="w-20 border rounded-lg px-2 py-1 text-center text-sm" />
                    <span className="text-sm w-20 text-right">= {formatCurrency(b.value * (contador[b.value] || 0))}</span>
                  </div>
                ))}</div></div>
                <div><p className="text-xs font-bold tracking-widest text-ink-500 mb-3">MONEDAS</p><div className="space-y-2">{DENOMINACIONES.monedas.map((m) => (
                  <div key={m.value} className="flex items-center justify-between gap-3 bg-ink-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 w-28"><div className="w-5 h-5 bg-yellow-100 rounded-full border flex items-center justify-center text-[9px]">{m.value}</div><span className="text-sm">{m.value} x</span></div>
                    <input type="number" min={0} value={contador[m.value] || 0} onChange={e => updateContador(m.value, e.target.value)} className="w-20 border rounded-lg px-2 py-1 text-center text-sm" />
                    <span className="text-sm w-20 text-right">= {formatCurrency(m.value * (contador[m.value] || 0))}</span>
                  </div>
                ))}</div></div>
              </div>
              <div className="border-t">
                <div className="bg-[#1e40af] text-white px-5 py-3 flex justify-between font-bold"><span>Total contado:</span><span>{formatCurrency(totalContado)}</span></div>
                <div className="px-5 py-2 flex justify-between text-sm bg-white"><span>Efectivo esperado:</span><span className="font-bold">{formatCurrency(expectedInCash)}</span></div>
                <div className="px-5 py-3 flex justify-between text-sm bg-gray-50 border-t items-center">
                  <span className="flex items-center gap-2">Diferencia: {diferencia === 0 ? <span className="text-green-600 flex items-center gap-1">● La caja cuadra correctamente</span> : diferencia > 0 ? <span className="text-blue-600">Sobra {formatCurrency(diferencia)}</span> : <span className="text-red-600">Falta {formatCurrency(Math.abs(diferencia))}</span>}</span>
                  <span className={`font-bold ${diferencia === 0 ? 'text-green-600' : diferencia > 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(diferencia)}</span>
                </div>
                <div className="px-5 py-2 text-xs text-ink-500">{totalBilletes} billetes + {totalMonedas} monedas</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button onClick={() => setShowCloseModal(true)} className="w-full bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-2xl py-6 font-bold text-xl flex flex-col items-center justify-center gap-1 shadow">
              <span className="flex items-center gap-2"><DollarSign className="w-6 h-6" /> Cerrar caja</span>
              <span className="text-xs font-normal opacity-80">Esto cerrará la caja y generará el corte final</span>
            </button>
            <div className="bg-white rounded-2xl border p-5">
              <div className="flex items-center justify-between mb-4"><h3 className="font-bold flex items-center gap-2"><Calendar className="w-5 h-5" /> Movimientos del día</h3><span className="text-xs bg-gray-100 border px-2 py-1 rounded-full">{new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
              {movimientosDelDia.length === 0 ? (
                <div className="text-center py-10"><div className="w-12 h-12 bg-gray-100 rounded-xl mx-auto flex items-center justify-center mb-2">📋</div><p className="font-semibold">Sin movimientos registrados</p><p className="text-xs text-ink-500 mt-1">Los ingresos, ventas, entradas y salidas aparecerán aquí durante el día</p></div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-auto">{movimientosDelDia.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-full px-3 py-2 text-sm"><span className={`w-2 h-2 rounded-full ${m.color === 'green' ? 'bg-green-500' : m.color === 'red' ? 'bg-red-500' : m.color === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500'}`}></span><span className="flex-1 truncate">{m.concepto}</span><span className={`font-bold text-xs ${m.tipo === 'salida' ? 'text-red-600' : 'text-green-700'}`}>{m.tipo === 'salida' ? '-' : '+'}{formatCurrency(m.monto)}</span></div>
                ))}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL CIERRE - CON CONTADOR DE DINERO */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg my-8 shadow-2xl overflow-hidden">
            <div className="p-5 max-h-[90vh] overflow-y-auto">
              <h2 className="font-bold text-lg flex items-center gap-2"><DollarSign className="w-5 h-5 text-orange-600" /> Corte de caja - {cashSession.folio}</h2>

              <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 mt-4 text-sm">
                <div className="flex justify-between"><span>Monto inicial:</span><span className="font-bold">{formatCurrency(cashSession.opening_amount)}</span></div>
                <div className="flex justify-between"><span>Ventas totales:</span><span className="font-bold">{formatCurrency(summary?.total || 0)} ({summary?.count || 0} ventas)</span></div>
                <div className="flex justify-between text-green-700 font-bold"><span>Efectivo:</span><span>{formatCurrency(summary?.efectivo || 0)}</span></div>
                <div className="flex justify-between"><span>Tarjeta:</span><span>{formatCurrency(summary?.tarjeta || 0)}</span></div>
                <div className="flex justify-between"><span>Transferencia:</span><span>{formatCurrency(summary?.transferencia || 0)}</span></div>
                <div className="flex justify-between text-emerald-600 font-bold"><span>+ Entradas:</span><span>+ {formatCurrency(summary?.total_entradas || 0)} ({summary?.entradas_count || 0})</span></div>
                <div className="flex justify-between text-red-600 font-bold"><span>- Salidas:</span><span>- {formatCurrency(summary?.total_salidas || 0)} ({summary?.salidas_count || 0})</span></div>
                <div className="border-t pt-2 mt-2 flex justify-between text-base font-bold"><span>Esperado en caja:</span><span>{formatCurrency(expectedInCash)}</span></div>
              </div>

              <div className="mt-5">
                <h3 className="font-bold text-sm flex items-center gap-2">🧮 Contador de efectivo — Registra lo contado</h3>
                <p className="text-[11px] text-ink-500">Ingresa la cantidad de billetes y monedas para calcular el total contado automáticamente</p>

                <div className="mt-3">
                  <p className="text-[10px] font-bold tracking-widest text-ink-500 mb-2">BILLETES</p>
                  <div className="space-y-1.5">
                    {DENOMINACIONES.billetes.map(b => (
                      <div key={b.value} className="flex items-center justify-between text-xs gap-2">
                        <span className="w-28">Billete ${b.value.toLocaleString()}</span>
                        <span className="text-ink-400">x</span>
                        <input type="number" min={0} value={contador[b.value] || 0} onChange={e => updateContador(b.value, e.target.value)} className="w-16 border rounded px-1 py-0.5 text-center" />
                        <span className={`w-16 text-right px-2 py-0.5 rounded ${b.value === 100 && contador[100] > 0 ? 'bg-green-100 text-green-700 font-bold' : ''}`}>= ${b.value * (contador[b.value] || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[10px] font-bold tracking-widest text-ink-500 mb-2">MONEDAS</p>
                  <div className="space-y-1.5">
                    {DENOMINACIONES.monedas.map(m => (
                      <div key={m.value} className="flex items-center justify-between text-xs gap-2">
                        <span className="w-28">Moneda ${m.value}</span>
                        <span className="text-ink-400">x</span>
                        <input type="number" min={0} value={contador[m.value] || 0} onChange={e => updateContador(m.value, e.target.value)} className="w-16 border rounded px-1 py-0.5 text-center" />
                        <span className="w-16 text-right">= ${m.value * (contador[m.value] || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-gray-100 rounded-xl p-3">
                    <p className="text-xs text-ink-500">Total contado</p>
                    <p className="font-bold text-lg">{formatCurrency(totalContado)}</p>
                    <p className="text-[11px] text-ink-500">({totalBilletes} billetes + {totalMonedas} monedas)</p>
                  </div>
                  <div className="space-y-2">
                    <div className={`rounded-xl p-2 text-center text-sm font-bold ${diferencia === 0 ? 'bg-green-100 text-green-700' : diferencia > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                      Diferencia: {formatCurrency(diferencia)} — {diferencia === 0 ? 'Cuadrado ✅' : diferencia > 0 ? 'Sobra' : 'Falta'}
                    </div>
                    <div>
                      <label className="text-[11px] font-bold">Notas (opcional)</label>
                      <input type="text" value={closeNotes} onChange={e => setCloseNotes(e.target.value)} placeholder="Ej. Se pagó luz $200" className="w-full border rounded px-2 py-1 text-xs" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowCloseModal(false)} className="flex-1 border rounded-xl py-2.5 font-bold text-sm">Cancelar</button>
                <button onClick={handleCloseCash} className="flex-1 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl py-2.5 font-bold text-sm">Cerrar caja</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
