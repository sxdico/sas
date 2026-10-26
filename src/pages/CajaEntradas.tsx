import { useState, useMemo, useEffect } from 'react';
import { cashAPI } from '@/api/client';
import { formatCurrency, formatDateTime } from '@/utils/permissions';
import { DollarSign, Clock, FileText, Upload, Banknote, ArrowDownLeft, X, Trash2, Lock } from 'lucide-react';

type CategoriaEntrada = 'abono_orden' | 'inyeccion_capital' | 'reembolso' | 'venta_extra' | 'otro';

interface Entrada {
  id: string;
  created_at: string;
  reason: string;
  category: string;
  amount: number;
  user_name?: string;
  receipt_url?: string;
}

const MONTOS_RAPIDOS = [50, 100, 200, 500];

export default function CajaEntradas({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [currentCash, setCurrentCash] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [monto, setMonto] = useState(0);
  const [montoText, setMontoText] = useState('');
  const [categoria, setCategoria] = useState<CategoriaEntrada>('abono_orden');
  const [concepto, setConcepto] = useState('');
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [previewTicket, setPreviewTicket] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [currRes, incRes] = await Promise.all([
        cashAPI.current().catch(() => ({ data: { session: null, summary: null } })),
        (cashAPI as any).incomes?.().catch(() => ({ data: { incomes: [] } })) || Promise.resolve({ data: { incomes: [] } }),
      ]);
      setCurrentCash(currRes.data.session || null);
      setSummary(currRes.data.summary || null);
      const incs = incRes?.data?.incomes || incRes?.data || [];
      const hoy = new Date().toDateString();
      const filtradas = incs.filter((e: any) => new Date(e.created_at).toDateString() === hoy);
      setEntradas(filtradas.length ? filtradas : incs);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const totalEntradasHoy = useMemo(() => entradas.reduce((acc, s) => acc + Number(s.amount), 0), [entradas]);
  const efectivoActual = useMemo(() => {
    if (!currentCash) return 0;
    return parseFloat(currentCash.opening_amount || 0) + parseFloat(summary?.efectivo || 0) + parseFloat(summary?.total_entradas || 0) - parseFloat(summary?.total_salidas || 0);
  }, [currentCash, summary]);

  const handleMontoChange = (value: string) => {
    const clean = value.replace(/[^0-9.]/g, '');
    setMontoText(clean);
    setMonto(parseFloat(clean) || 0);
  };

  const handleRegistrar = async () => {
    if (!currentCash) { alert('No hay caja abierta. Ve a POS y abre caja primero.'); return; }
    if (monto <= 0 || concepto.trim().length < 3) return;
    setSaving(true);
    try {
      let payload: any;
      if (comprobante) {
        const fd = new FormData();
        fd.append('amount', String(monto));
        fd.append('reason', concepto.trim());
        fd.append('category', categoria);
        fd.append('receipt', comprobante);
        payload = fd;
      } else {
        payload = { amount: monto, reason: concepto.trim(), category: categoria };
      }
      await (cashAPI as any).createIncome(payload);
      setMonto(0); setMontoText(''); setConcepto(''); setComprobante(null); setPreviewTicket(null);
      await loadAll();
    } catch (e: any) { alert(e.response?.data?.error || 'Error al registrar entrada'); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta entrada? Se re-calculará la caja.')) return;
    try { await (cashAPI as any).deleteIncome(id); await loadAll(); } catch (e: any) { alert(e.response?.data?.error || 'Error al eliminar'); }
  };

  const handleTicket = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setComprobante(file);
    const reader = new FileReader();
    reader.onload = ev => setPreviewTicket(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  if (loading) return <div className="p-8 flex items-center justify-center"><div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mr-2" />Cargando caja...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* TOP BAR UNIFICADO - MISMO QUE CAJA */}
      <div className="p-3">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border flex-wrap justify-between ${currentCash ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          {currentCash ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Lock className="w-3.5 h-3.5 text-ink-400" />
                <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">● {currentCash.folio} ABIERTA</span>
                <span className="text-xs bg-white px-2 py-1 rounded border">Inicial: {formatCurrency(currentCash.opening_amount)}</span>
                <span className="text-xs bg-white px-2 py-1 rounded border">Ventas: {formatCurrency(summary?.total || 0)} {summary?.count || 0}</span>
                <span className="text-xs bg-emerald-600 text-white px-2 py-1 rounded font-bold">Efectivo: {formatCurrency(summary?.efectivo || 0)}</span>
                <span className="text-xs bg-emerald-600 text-white px-2 py-1 rounded font-bold">Entradas: +{formatCurrency(summary?.total_entradas || 0)}</span>
                <span className="text-xs bg-white px-2 py-1 rounded border font-bold">Esperado: {formatCurrency(efectivoActual)}</span>
              </div>
              <span className="text-xs text-ink-500 ml-auto hidden md:block">Abierta hoy {formatDateTime(currentCash.opened_at)}.</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-2 text-xs font-bold text-red-700"><Lock className="w-3.5 h-3.5" /> CAJA CERRADA</span>
              <button onClick={() => onNavigate?.('caja')} className="ml-auto bg-green-600 text-white px-3 py-1 rounded-full font-bold text-xs">Abrir caja en POS</button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 md:p-6 pt-0 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 max-w-[1400px] mx-auto w-full">
        <div className="bg-white rounded-2xl border shadow-sm h-fit">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center"><ArrowDownLeft className="w-4 h-4 text-green-600" /></div><h3 className="font-bold text-[15px]">Nueva entrada</h3></div>
            <span className="text-[11px] bg-gray-100 px-2.5 py-1 rounded-full text-gray-500 font-medium">{currentCash?.user_open_name || 'Dueño'}</span>
          </div>
          <div className="p-5 space-y-5">
            <div>
              <label className="text-[11px] font-bold tracking-wider text-ink-500 uppercase mb-2 block">Monto</label>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">$</span><input value={montoText} onChange={e=>handleMontoChange(e.target.value)} placeholder="0.00" disabled={!currentCash} className="w-full pl-9 pr-4 py-3.5 text-3xl font-bold bg-[#f8fafc] border-2 border-gray-200 rounded-xl focus:border-green-500 focus:bg-white outline-none disabled:opacity-50" /></div>
              <div className="grid grid-cols-4 gap-2 mt-3">{MONTOS_RAPIDOS.map(m => (<button key={m} onClick={()=>{ setMonto(m); setMontoText(String(m)); }} disabled={!currentCash} className={`py-2 rounded-lg border text-sm font-semibold disabled:opacity-50 ${monto===m ? 'bg-green-600 text-white border-green-600' : 'bg-white hover:bg-gray-50'}`}>${m}</button>))}</div>
            </div>
            <div>
              <label className="text-[11px] font-bold tracking-wider text-ink-500 uppercase mb-2 block">Concepto / Motivo</label>
              <textarea value={concepto} onChange={e=>setConcepto(e.target.value)} placeholder="Ej: Abono de orden RP-0012..." disabled={!currentCash} className="w-full min-h-[150px] p-3.5 text-sm bg-[#f8fafc] border-2 border-gray-200 rounded-xl focus:border-green-500 focus:bg-white outline-none resize-none disabled:opacity-50" maxLength={80} />
              <div className="flex justify-between mt-1.5"><span className="text-[11px] text-gray-400">Min. 3 caracteres</span><span className="text-[11px] text-gray-400">{concepto.length}/80</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[11px] font-bold tracking-wider text-ink-500 uppercase mb-2 block">Método</label><div className="flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-green-50 border-green-200"><div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center"><DollarSign className="w-4 h-4 text-green-600" /></div><span className="text-sm font-medium">Solo Efectivo</span></div></div>
              <div>
                <label className="text-[11px] font-bold tracking-wider text-ink-500 uppercase mb-2 block">Comprobante</label>
                <label className="flex items-center justify-center gap-1.5 border-2 border-dashed rounded-xl px-3 py-2.5 bg-white cursor-pointer hover:bg-gray-50 text-sm text-gray-500"><Upload className="w-4 h-4" /> {comprobante ? 'Cambiar' : 'Subir ticket'}<input type="file" accept="image/*" hidden onChange={handleTicket} disabled={!currentCash} /></label>
                {previewTicket && <div className="mt-2 relative"><img src={previewTicket} className="w-full h-20 object-cover rounded-lg border" /><button onClick={()=>{setComprobante(null); setPreviewTicket(null);}} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center"><X size={10} /></button></div>}
              </div>
            </div>
            <button onClick={handleRegistrar} disabled={!currentCash || monto<=0 || concepto.trim().length<3 || saving} className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${currentCash && monto>0 && concepto.trim().length>=3 ? 'bg-[#0f172a] text-white hover:bg-black' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}><Banknote className="w-4 h-4" /> {saving ? 'Registrando...' : `Registrar entrada - ${formatCurrency(monto)}`}</button>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border shadow-sm flex-1">
            <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><h3 className="font-bold text-[15px]">Entradas de hoy - Caja actual</h3><span className="flex items-center gap-1.5 bg-gray-100 border px-2.5 py-1 rounded-full text-xs"><Clock className="w-3.5 h-3.5" /> {new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div><div className="text-sm">Total entradas hoy: <span className="font-bold text-green-600 text-base">+{formatCurrency(totalEntradasHoy)}</span></div></div>
            <div className="divide-y">{entradas.length===0 && <div className="p-12 text-center text-gray-400 text-sm">Sin entradas hoy.</div>}{entradas.map(s => { const hora = new Date(s.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); return (<div key={s.id} className="p-4 flex items-start gap-4 hover:bg-gray-50/50 group"><div className="text-center min-w-[70px]"><p className="text-xs font-medium text-gray-600">{hora}</p><div className="mt-1.5 px-2 py-1 rounded-full text-[11px] font-medium border inline-flex bg-green-50 text-green-700 border-green-200">{s.category}</div></div><div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{s.reason}</p></div><div className="flex items-center gap-3"><span className="text-sm font-bold text-green-600">+{formatCurrency(s.amount)}</span><button onClick={()=>handleDelete(s.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded text-red-500"><Trash2 className="w-4 h-4" /></button></div></div>); })}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
