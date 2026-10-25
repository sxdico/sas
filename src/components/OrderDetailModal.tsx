import { useState, useEffect } from 'react';
import { evidenciaAPI } from '@/api/client'
import { ORDER_STATUS_CONFIG, formatCurrency, formatDateTime } from '@/utils/permissions';
import type { RepairOrder, OrderStatus } from '@/types';
import { getWarrantyInfo, getPagoInfo, getPromisedInfo } from '@/constants/repairOrders';
import {
  X, Phone, Wrench, Package, FileText, Check, DollarSign, Shield, Lock, Calendar, Trash2, Wallet, ChevronRight, Camera, Upload, KeyRound, Eye, EyeOff, Ban, Hash, Smartphone, Clock, Plus
} from 'lucide-react';

export default function OrderDetailModal({ order, onClose, products, onAddPart, onRemovePart, onDelete, onPagarResto, onStatusChange }: any) {
  const [activeTab, setActiveTab] = useState<'info' | 'diagnostic' | 'parts' | 'warranty' | 'evidencia'>('info');
  const [showPartPicker, setShowPartPicker] = useState(false);
  const [partQty, setPartQty] = useState(1);
  const [showLockCode, setShowLockCode] = useState(false);
  const warrantyInfo = getWarrantyInfo(order);
  const { total, anticipo, resto, pagado } = getPagoInfo(order);
  const saldo = resto;
  const isNoWarranty = (order as any).warranty_value === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden bg-white rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-center justify-between shrink-0 bg-white">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-primary-600">{order.folio}</span>
              <span className={`badge ${ORDER_STATUS_CONFIG[order.status as OrderStatus].color}`}>{ORDER_STATUS_CONFIG[order.status as OrderStatus].label}</span>
              {pagado && <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1"><Check className="w-3 h-3" />Pagado</span>}
              {isNoWarranty && <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-bold flex items-center gap-1"><Ban className="w-3 h-3" />Sin garantía</span>}
            </div>
            <p className="text-sm text-ink-500">{order.customer_name} · {order.device_brand} {order.device_model} {(order as any).imei ? `· ${(order as any).imei}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex gap-1 px-6 pt-2 border-b overflow-x-auto shrink-0 bg-white">
          {([
            { key: 'info', label: 'Info', icon: FileText }, 
            { key: 'diagnostic', label: 'Diagnóstico', icon: Wrench }, 
            { key: 'parts', label: 'Refacciones', icon: Package }, 
            { key: 'warranty', label: 'Garantía', icon: Shield },
            { key: 'evidencia', label: 'Evidencia', icon: Camera }
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === key? 'border-primary-600 text-primary-600' : 'border-transparent text-ink-500 hover:text-ink-700'}`}><Icon className="w-4 h-4" /> {label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-ink-400 uppercase font-semibold">Cliente</p><p className="text-sm font-medium">{order.customer_name}</p></div>
                <div><p className="text-xs text-ink-400 uppercase font-semibold">Teléfono</p><p className="text-sm font-medium flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {order.customer_phone || 'Sin teléfono'}</p></div>
                <div><p className="text-xs text-ink-400 uppercase font-semibold">Dispositivo</p><p className="text-sm font-medium">{order.device_type}</p></div>
                <div><p className="text-xs text-ink-400 uppercase font-semibold">Marca/Modelo</p><p className="text-sm font-medium">{order.device_brand} {order.device_model}</p></div>
                <div className="bg-gray-50 rounded-lg p-2 border"><p className="text-xs text-ink-400 uppercase font-semibold flex items-center gap-1"><Hash className="w-3 h-3"/> IMEI / Serie</p><p className="text-sm font-mono font-bold">{(order as any).imei || 'Sin IMEI'}</p></div>
                <div className="bg-gray-50 rounded-lg p-2 border"><p className="text-xs text-ink-400 uppercase font-semibold flex items-center gap-1"><Smartphone className="w-3 h-3"/> Color / Capacidad</p><p className="text-sm font-medium">{(order as any).device_color || 'No especificado'}</p></div>
                <div><p className="text-xs text-ink-400 uppercase font-semibold">Tipo de bloqueo</p><p className="text-sm font-medium flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> {order.lock_type || 'Sin bloqueo'}</p></div>
                <div><p className="text-xs text-ink-400 uppercase font-semibold">Garantía</p><p className={`text-sm font-medium ${isNoWarranty ? 'text-gray-500 font-bold' : ''}`}>{isNoWarranty ? 'Sin garantía (0 días)' : `${order.warranty_value} ${order.warranty_unit}`}</p></div>
              </div>
              {order.promised_at && (() => { const p = getPromisedInfo(order); if (!p) return null; return (
                <div className={`rounded-lg p-3 border-2 ${p.overdue ? 'bg-red-50 border-red-400' : 'bg-purple-50 border-purple-200'}`}>
                  <p className={`text-xs uppercase font-bold flex items-center gap-1 ${p.overdue ? 'text-red-700' : 'text-purple-700'}`}><Calendar className="w-3.5 h-3.5"/> Fecha prometida</p>
                  <p className={`text-sm font-bold mt-1 ${p.overdue ? 'text-red-800' : 'text-purple-800'}`}>{formatDateTime(order.promised_at)} · {p.text}</p>
                  {p.overdue && <p className="text-xs text-red-600 mt-1 font-bold">⚠ Esta orden está atrasada, priorizar!</p>}
                </div>
              ); })()}
              {order.lock_code && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                  <div><p className="text-xs text-amber-700 uppercase font-semibold flex items-center gap-1"><KeyRound className="w-3.5 h-3.5"/> Código / Contraseña</p><p className="text-sm font-mono font-bold mt-1">{showLockCode ? order.lock_code : '••••••••'}</p></div>
                  <button onClick={() => setShowLockCode(!showLockCode)} className="p-2 rounded-lg bg-white border hover:bg-amber-100">{showLockCode ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}</button>
                </div>
              )}
              <div><p className="text-xs text-ink-400 uppercase font-semibold mb-1">Problema reportado</p><p className="text-sm bg-ink-50 rounded-lg p-3">{order.problem_description || 'Sin descripción'}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-ink-50 rounded-lg p-3 text-center"><p className="text-xs text-ink-400">Refacciones</p><p className="text-lg font-bold">{formatCurrency(order.cost_parts || 0)}</p></div>
                <div className="bg-ink-50 rounded-lg p-3 text-center"><p className="text-xs text-ink-400">Mano obra</p><p className="text-lg font-bold">{formatCurrency(order.cost_labor || 0)}</p></div>
                <div className="bg-blue-50 rounded-lg p-3 text-center"><p className="text-xs text-blue-600">Anticipo</p><p className="text-lg font-bold text-blue-700">{formatCurrency(anticipo)}</p></div>
                <div className="bg-primary-50 rounded-lg p-3 text-center"><p className="text-xs text-primary-600">Total</p><p className="text-lg font-bold text-primary-700">{formatCurrency(total)}</p></div>
              </div>
              {pagado ? <div className="bg-green-600 text-white rounded-xl p-4 text-center font-bold flex items-center justify-center gap-2 text-lg"><Check className="w-6 h-6" /> Pagado completo ✅</div> : (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 space-y-3">
                  <div className="text-center"><p className="text-xs text-orange-600 font-semibold uppercase">Resta por pagar</p><p className="text-3xl font-bold text-orange-700">{formatCurrency(saldo)}</p></div>
                  <button onClick={() => onPagarResto(order)} className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"><Wallet className="w-5 h-5" /> Pagar {formatCurrency(saldo)} en caja</button>
                </div>
              )}
            </div>
          )}
          {activeTab === 'diagnostic' && <div className="space-y-4"><div><p className="text-xs text-ink-400 uppercase font-semibold mb-1">Diagnóstico técnico</p><p className="text-sm bg-ink-50 rounded-lg p-3 min-h-[60px]">{order.diagnostic || 'Sin diagnóstico aún'}</p></div><div><p className="text-xs text-ink-400 uppercase font-semibold mb-1">Notas privadas</p><p className="text-sm bg-amber-50 rounded-lg p-3 border border-amber-200 min-h-[60px]">{order.private_notes || 'Sin notas privadas'}</p></div></div>}
          {activeTab === 'parts' && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm flex items-center gap-2"><Package className="w-4 h-4" /> Refacciones usadas</h4>
              {(order.parts_used?.length > 0 || order.OrderParts?.length > 0) ? <div className="space-y-2">{(order.OrderParts || order.parts_used).map((part: any, i: number) => (<div key={part.id || i} className="flex items-center justify-between bg-ink-50 rounded-lg px-3 py-2.5 border"><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{part.product_name}</p><p className="text-xs text-ink-500">{part.quantity} × {formatCurrency(part.unit_cost)} = {formatCurrency(part.unit_cost * part.quantity)}</p></div><div className="flex items-center gap-2 ml-3"><span className="text-sm font-bold">{formatCurrency(part.unit_cost * part.quantity)}</span><button onClick={() => onRemovePart(order.id, part.id)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"><X className="w-4 h-4" /></button></div></div>))}</div> : <p className="text-sm text-ink-400 text-center py-8 bg-ink-50 rounded-lg">No se han usado refacciones</p>}
              <button onClick={() => setShowPartPicker(true)} className="btn-secondary w-full flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Agregar refacción</button>
            </div>
          )}
          {activeTab === 'warranty' && (
            <div className="space-y-4">
              <div className={`rounded-lg p-4 ${isNoWarranty ? 'bg-gray-100 border-2 border-gray-300' : 'bg-ink-50'}`}>
                <div className="flex items-center gap-2 mb-3">{isNoWarranty ? <Ban className="w-5 h-5 text-gray-500" /> : <Shield className="w-5 h-5 text-primary-600" />}<h3 className="font-bold">Garantía del servicio</h3></div>
                <div className="grid grid-cols-2 gap-4"><div><p className="text-xs text-ink-400 uppercase font-semibold">Período</p><p className={`text-lg font-bold ${isNoWarranty ? 'text-gray-600' : ''}`}>{isNoWarranty ? 'Sin garantía' : `${order.warranty_value} ${order.warranty_unit || 'Días'}`}</p></div>{order.delivered_at && !isNoWarranty && <div><p className="text-xs text-ink-400 uppercase font-semibold">Entregado</p><p className="text-sm font-medium">{formatDateTime(order.delivered_at)}</p></div>}<div><p className="text-xs text-ink-400 uppercase font-semibold">Bloqueo</p><p className="text-sm font-medium">{order.lock_type}</p></div></div>
              </div>
              {!isNoWarranty && order.warranty_ends_at ? <div className={`rounded-lg p-4 border-2 ${warrantyInfo?.expired? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}><div className="flex items-center gap-2 mb-2"><Calendar className={`w-5 h-5 ${warrantyInfo?.expired? 'text-red-600' : 'text-green-600'}`} /><p className="text-sm font-semibold">Vence el</p></div><p className={`text-2xl font-bold ${warrantyInfo?.expired? 'text-red-700' : 'text-green-700'}`}>{formatDateTime(order.warranty_ends_at)}</p><p className={`text-xs mt-1 ${warrantyInfo?.expired? 'text-red-600' : 'text-green-600'}`}>{warrantyInfo?.text}</p></div> : isNoWarranty ? <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center"><Ban className="w-10 h-10 text-gray-400 mx-auto mb-2" /><p className="font-bold text-gray-600">Servicio sin garantía</p></div> : <p className="text-sm text-ink-400 text-center py-6 bg-ink-50 rounded-lg">La garantía se activa cuando cambias el estado a "Entregado"</p>}
            </div>
          )}
          {activeTab === 'evidencia' && <EvidenciaTabContent ordenId={order.id} />}
        </div>

        <div className="border-t p-4 space-y-3 bg-white shrink-0">
          <div className="flex items-center gap-2 flex-wrap"><span className="text-sm text-ink-500 font-medium">Cambiar estado:</span>{(['por_revisar', 'en_reparacion', 'esperando_refaccion', 'listo', 'entregado'] as OrderStatus[]).map((s) => (<button key={s} onClick={() => onStatusChange(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${order.status === s? ORDER_STATUS_CONFIG[s].color : 'bg-ink-100 text-ink-500'}`}>{ORDER_STATUS_CONFIG[s].label}</button>))}</div>
          <div className="flex gap-2"><button onClick={() => onDelete(order.id)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 text-red-600 border border-red-200 font-semibold hover:bg-red-100"><Trash2 className="w-4 h-4" /> Eliminar</button><button onClick={onClose} className="flex-1 btn-secondary">Cerrar</button></div>
        </div>
      </div>
      {showPartPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPartPicker(false)}>
          <div className="card w-full max-w-md p-5 max-h-[80vh] flex flex-col bg-white rounded-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="font-bold">Agregar refacción</h3><button onClick={() => setShowPartPicker(false)}><X className="w-4 h-4" /></button></div>
            <div className="flex items-center gap-2 mb-3"><label className="text-sm">Cantidad:</label><input type="number" min="1" value={partQty} onChange={(e) => setPartQty(Math.max(1, parseInt(e.target.value) || 1))} className="input w-20" /></div>
            <div className="flex-1 overflow-auto space-y-2">{products.map((p: any) => (<button key={p.id} onClick={() => { onAddPart(p.id, partQty); setShowPartPicker(false); }} disabled={p.stock <= 0} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border hover:bg-primary-50 text-left disabled:opacity-50"><div><p className="text-sm font-medium">{p.name}</p><p className="text-xs">Stock: {p.stock} · {formatCurrency(p.cost_price)}</p></div><ChevronRight className="w-4 h-4" /></button>))}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenciaTabContent({ ordenId }: { ordenId: string }) {
  const [tipoActivo, setTipoActivo] = useState<'ingreso'|'durante'|'salida'>('ingreso');
  const [datos, setDatos] = useState<any>({ ingreso: [], durante: [], salida: [] });
  const [nota, setNota] = useState(''); const [preview, setPreview] = useState<string | null>(null); const [uploading, setUploading] = useState(false);
  const cargar = async () => { try { const res = await evidenciaAPI.list(ordenId); setDatos(res.data); } catch (e) { console.error(e); } };
  useEffect(() => { cargar(); }, [ordenId]);
  const subir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setUploading(true);
    const fd = new FormData(); fd.append('foto', file); fd.append('orden_id', ordenId); fd.append('tipo', tipoActivo); fd.append('nota', nota);
    try { await evidenciaAPI.upload(fd); setNota(''); e.target.value = ''; await cargar(); } catch (err: any) { alert(err.response?.data?.error || 'Error'); } finally { setUploading(false); }
  };
  const borrar = async (id: string) => { if (!confirm('¿Borrar foto?')) return; await evidenciaAPI.delete(id); await cargar(); };
  const fotos = datos[tipoActivo] || [];
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3"><p className="text-xs text-blue-700 font-semibold flex items-center gap-1"><Camera className="w-4 h-4"/> Evidencia fotográfica</p><p className="text-xs text-blue-600 mt-1">Te protege de reclamos "ya venía rayado".</p></div>
      <div className="flex gap-2 flex-wrap">{(['ingreso','durante','salida'] as const).map(t => (<button key={t} onClick={() => setTipoActivo(t)} className={`px-3 py-1.5 rounded-full text-sm border font-semibold ${tipoActivo===t ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-600'}`}>{t==='ingreso' ? 'Ingreso' : t==='durante' ? 'Durante' : 'Salida'} ({datos[t]?.length || 0})</button>))}</div>
      <div className="flex gap-2 flex-wrap"><label className="bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer font-semibold text-sm hover:bg-blue-700">{uploading ? 'Subiendo...' : '📷 Tomar / Subir foto'}<input type="file" accept="image/*" capture="environment" hidden onChange={subir} disabled={uploading} /></label><input value={nota} onChange={e=>setNota(e.target.value)} placeholder="Nota: pantalla estrellada..." className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 text-sm" maxLength={100} /></div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{fotos.length===0 && <p className="col-span-full text-center text-gray-400 py-8 text-sm border-2 border-dashed rounded-xl">No hay fotos en {tipoActivo}</p>}{fotos.map((f: any) => (<div key={f.id} className="border rounded-xl overflow-hidden relative bg-gray-50"><img src={`/${f.thumbnail_url || f.url}`} className="w-full h-32 object-cover cursor-pointer" onClick={()=>setPreview(`/${f.url}`)} loading="lazy" /><button onClick={()=>borrar(f.id)} className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"><X size={12}/></button><div className="p-2 text-[11px] text-gray-600"><div>{new Date(f.created_at).toLocaleString()}</div>{f.nota && <div className="font-semibold text-gray-900 truncate">{f.nota}</div>}</div></div>))}</div>
      {preview && <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4" onClick={()=>setPreview(null)}><img src={preview} className="max-w-full max-h-full rounded-xl" /><button className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"><X/></button></div>}
    </div>
  );
}
