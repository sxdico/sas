import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/utils/permissions';
import { PRIORITY_CONFIG, LOCK_TYPES, LOCK_TYPES_WITH_CODE } from '@/constants/RepairOrders';
import type { Priority } from '@/constants/RepairOrders';
import { X, DollarSign, Calendar, Lock, Shield, Ban, KeyRound, Eye, EyeOff, Camera, Upload, Check, Hash, Smartphone, Star, Phone, ChevronDown } from 'lucide-react';
import { customerAPI } from '@/api/client';

interface Props { onClose: () => void; onCreate: (form: any, fotos: File[]) => void; }

export default function CreateOrderModal({ onClose, onCreate }: Props) {
  const getDefaultPromised = () => {
    const d = new Date(); d.setDate(d.getDate()+2); d.setHours(18,0,0,0);
    const pad = (n:number)=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', device_type: 'Smartphone',
    device_brand: '', device_model: '', problem_description: '',
    total: 0, advance_payment: 0,
    payment_method_anticipo: 'efectivo' as any,
    lock_type: 'Sin bloqueo', lock_code: '',
    warranty_value: 0, warranty_unit: 'Días' as any,
    promised_at: getDefaultPromised(),
    priority: 'normal' as Priority,
    imei: '', device_color: ''
  });
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [showClienteList, setShowClienteList] = useState(false);
  const [showTelefonoList, setShowTelefonoList] = useState(false);
  const [clientePos, setClientePos] = useState({ top: 0, left: 0, width: 0 });
  const [telefonoPos, setTelefonoPos] = useState({ top: 0, left: 0, width: 0 });
  const clienteRef = useRef<HTMLInputElement>(null);
  const telefonoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    customerAPI.list({}).then(res => setAllCustomers(res.data.customers || [])).catch(()=>{});
    const pre = localStorage.getItem('prefillCliente');
    if (pre) {
      try {
        const c = JSON.parse(pre);
        setForm(prev => ({ ...prev, customer_name: c.customer_name || '', customer_phone: c.customer_phone || '' }));
      } catch {}
      localStorage.removeItem('prefillCliente');
    }
  }, []);

  const filteredByName = useMemo(() => {
    const q = form.customer_name.trim().toLowerCase();
    if (!q) return allCustomers.slice(0, 5);
    return allCustomers.filter(c => (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)).slice(0, 5);
  }, [form.customer_name, allCustomers]);

  const filteredByPhone = useMemo(() => {
    const q = form.customer_phone.trim().toLowerCase();
    if (!q) return allCustomers.slice(0, 5);
    return allCustomers.filter(c => (c.phone || '').includes(q) || (c.name || '').toLowerCase().includes(q)).slice(0, 5);
  }, [form.customer_phone, allCustomers]);

  const selectCustomer = (c: any) => {
    setForm(prev => ({ ...prev, customer_name: c.name, customer_phone: c.phone }));
    setShowClienteList(false);
    setShowTelefonoList(false);
  };

  const updateClientePos = () => {
    if (!clienteRef.current) return;
    const r = clienteRef.current.getBoundingClientRect();
    setClientePos({ top: r.bottom + 6, left: r.left, width: r.width });
  };
  const updateTelefonoPos = () => {
    if (!telefonoRef.current) return;
    const r = telefonoRef.current.getBoundingClientRect();
    setTelefonoPos({ top: r.bottom + 6, left: r.left, width: r.width });
  };

  const onNameChange = (val: string) => {
    setForm(prev => ({ ...prev, customer_name: val }));
    updateClientePos();
    setShowClienteList(true);
    const found = allCustomers.find(c => c.name === val);
    if (found) setForm(prev => ({ ...prev, customer_phone: found.phone }));
  };
  const onPhoneChange = (val: string) => {
    setForm(prev => ({ ...prev, customer_phone: val }));
    updateTelefonoPos();
    setShowTelefonoList(true);
    const found = allCustomers.find(c => (c.phone || '') === val);
    if (found) setForm(prev => ({ ...prev, customer_name: found.name }));
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const [showCode, setShowCode] = useState(false);
  const [fotosIngreso, setFotosIngreso] = useState<File[]>([]);
  const [previewFotos, setPreviewFotos] = useState<string[]>([]);
  const [warrantyText, setWarrantyText] = useState('0');
  const saldo = (form.total || 0) - (form.advance_payment || 0);
  const isNoWarranty = form.warranty_value === 0 || warrantyText === '' || warrantyText === '0';
  const needsCode = LOCK_TYPES_WITH_CODE.includes(form.lock_type);
  const handleLockTypeChange = (newType: string) => { setForm(prev => ({ ...prev, lock_type: newType, lock_code: LOCK_TYPES_WITH_CODE.includes(newType) ? prev.lock_code : '' })); };

  return (
    <>
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 512, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 24, borderBottom: '1px solid #e2e8f0', flexShrink: 0, background: 'white' }}><h2 style={{ fontSize: 20, fontWeight: 700 }}>Nueva Orden</h2><button onClick={onClose} style={{ padding: 8, borderRadius: 8 }}><X style={{ width: 20, height: 20 }} /></button></div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cliente *</label>
              <div className="relative">
                <input ref={clienteRef} className="input pr-8" placeholder="Escribe nombre..." value={form.customer_name} onChange={(e) => onNameChange(e.target.value)} onFocus={() => { updateClientePos(); setShowClienteList(true); }} onBlur={() => setTimeout(() => setShowClienteList(false), 150)} autoComplete="off" />
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="label">Teléfono</label>
              <div className="relative">
                <input ref={telefonoRef} className="input pr-8" placeholder="Teléfono..." value={form.customer_phone} onChange={(e) => onPhoneChange(e.target.value)} onFocus={() => { updateTelefonoPos(); setShowTelefonoList(true); }} onBlur={() => setTimeout(() => setShowTelefonoList(false), 150)} autoComplete="off" />
                <Phone className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3"><div><label className="label">Tipo</label><select className="input" value={form.device_type} onChange={(e) => setForm({...form, device_type: e.target.value })}><option>Smartphone</option><option>Tablet</option><option>Laptop</option><option>Consola</option><option>Otro</option></select></div><div><label className="label">Marca *</label><input className="input" value={form.device_brand} onChange={(e) => setForm({...form, device_brand: e.target.value })} /></div><div><label className="label">Modelo</label><input className="input" value={form.device_model} onChange={(e) => setForm({...form, device_model: e.target.value })} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label flex items-center gap-1"><Hash className="w-3.5 h-3.5" /> IMEI / Serie</label><input className="input font-mono" placeholder="355123456789012" value={form.imei} onChange={(e) => setForm({...form, imei: e.target.value })} /></div><div><label className="label flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> Color / Capacidad</label><input className="input" placeholder="Ej: 128GB Azul" value={form.device_color} onChange={(e) => setForm({...form, device_color: e.target.value })} /></div></div>
          <div><label className="label">Problema reportado</label><textarea className="input" style={{ minHeight: 70 }} value={form.problem_description} onChange={(e) => setForm({...form, problem_description: e.target.value })} /></div>
          <div className="bg-ink-50 rounded-xl p-4 space-y-3 border-2 border-dashed border-primary-200"><h4 className="font-bold text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary-600"/> Costos + Anticipo a Caja</h4><div className="grid grid-cols-2 gap-3"><div><label className="label font-bold text-primary-700">Costo total $ *</label><input type="number" min="0" className="input font-bold text-lg border-primary-300" value={form.total} onChange={(e) => setForm({...form, total: parseFloat(e.target.value) || 0 })} /></div><div><label className="label font-bold text-green-700">Anticipo $</label><input type="number" min="0" className="input font-bold border-green-300" value={form.advance_payment} onChange={(e) => setForm({...form, advance_payment: parseFloat(e.target.value) || 0 })} /></div></div><div className={`rounded-lg p-3 text-center font-bold text-base ${saldo <= 0 && form.total > 0? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-orange-100 text-orange-700 border-2 border-orange-200'}`}>{saldo <= 0 && form.total > 0? `¡Pagado completo! ✅` : `Resta por pagar: ${formatCurrency(saldo)}`}</div></div>
          <div className="bg-purple-50 rounded-xl p-4 space-y-2 border-2 border-dashed border-purple-200"><label className="label flex items-center gap-1 font-bold text-purple-800"><Calendar className="w-3.5 h-3.5" /> Fecha y hora prometida *</label><input type="datetime-local" className="input border-purple-300 font-semibold" value={form.promised_at} onChange={(e) => setForm({...form, promised_at: e.target.value})} /></div>
          <div className="space-y-2"><label className="label font-bold flex items-center gap-1">🔥 Prioridad / Etiqueta</label><div className="grid grid-cols-5 gap-2">{(Object.keys(PRIORITY_CONFIG) as Priority[]).map(p => { const cfg = PRIORITY_CONFIG[p]; const active = form.priority === p; return <button key={p} type="button" onClick={() => setForm({...form, priority: p})} className={`px-2 py-2.5 rounded-xl text-xs font-bold border-2 transition-all flex flex-col items-center gap-1 ${active ? cfg.color + ' ring-2 ring-offset-1 ' + (p==='urgente'?'ring-red-300': p==='garantia'?'ring-purple-300':'ring-blue-200') + ' scale-105' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}><span className="text-base">{cfg.emoji}</span><span>{cfg.label}</span></button>})}</div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Tipo de bloqueo</label><select className="input" value={form.lock_type} onChange={(e) => handleLockTypeChange(e.target.value)}>{LOCK_TYPES.map(t => <option key={t}>{t}</option>)}</select></div><div className="grid grid-cols-2 gap-2"><div><label className="label flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Garantía</label><div className="relative"><input type="text" inputMode="numeric" placeholder="0" className={`input pr-8 ${isNoWarranty ? 'bg-gray-100 border-gray-300 text-gray-600 font-bold' : ''}`} value={warrantyText} onChange={(e) => { const raw = e.target.value.replace(/[^0-9]/g, ''); if (raw === '') { setWarrantyText(''); setForm(prev => ({ ...prev, warranty_value: 0 })); return; } let num = parseInt(raw); if (isNaN(num)) num = 0; if (num > 365) num = 365; setWarrantyText(String(num)); setForm(prev => ({ ...prev, warranty_value: num })); }} onFocus={(e) => e.target.select()} onBlur={() => { if (warrantyText === '') { setWarrantyText('0'); setForm(prev => ({ ...prev, warranty_value: 0 })); } }} />{isNoWarranty && <Ban className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />}</div></div><div><label className="label">Unidad</label><select className="input" value={form.warranty_unit} onChange={(e) => setForm({...form, warranty_unit: e.target.value as 'Días' | 'Meses' })} disabled={isNoWarranty}><option>Días</option><option>Meses</option></select></div></div></div>
          {isNoWarranty && <div className="bg-gray-100 border-2 border-gray-300 rounded-xl p-3 flex items-center gap-2"><Ban className="w-5 h-5 text-gray-600" /><div><p className="text-sm font-bold text-gray-700">Servicio sin garantía</p><p className="text-xs text-gray-500">El cliente acepta que este servicio no tendrá garantía.</p></div></div>}
          {needsCode && <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-2"><label className="label flex items-center gap-1 font-bold text-amber-800"><KeyRound className="w-4 h-4" /> {form.lock_type === 'PIN' ? 'Código PIN' : 'Contraseña'} *</label><div className="relative"><input type={showCode ? "text" : "password"} className="input pr-10 font-mono font-bold border-amber-300 bg-white" placeholder={form.lock_type === 'PIN' ? 'Ej: 1234' : 'Ej: MiClave123'} value={form.lock_code} onChange={(e) => setForm({...form, lock_code: e.target.value })} /><button type="button" onClick={() => setShowCode(!showCode)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-amber-100">{showCode ? <EyeOff className="w-4 h-4 text-amber-700"/> : <Eye className="w-4 h-4 text-amber-700"/>}</button></div></div>}
          <div className="border-2 border-dashed border-blue-300 rounded-xl p-4 bg-blue-50/50 space-y-3"><h4 className="font-bold text-sm flex items-center gap-2 text-blue-700"><Camera className="w-4 h-4"/> Evidencia de Ingreso</h4><label className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg cursor-pointer font-semibold text-sm hover:bg-blue-700 w-full"><Upload className="w-4 h-4"/> {fotosIngreso.length>0 ? `${fotosIngreso.length} fotos` : 'Tomar / Seleccionar fotos'}<input type="file" multiple accept="image/*" capture="environment" hidden onChange={(e) => { const files = Array.from(e.target.files || []); setFotosIngreso(prev => [...prev, ...files]); files.forEach(file => { const reader = new FileReader(); reader.onload = (ev) => setPreviewFotos(prev => [...prev, ev.target?.result as string]); reader.readAsDataURL(file); }); }} /></label>{previewFotos.length>0 && <div className="grid grid-cols-3 gap-2">{previewFotos.map((src, i) => (<div key={i} className="relative"><img src={src} className="w-full h-20 object-cover rounded-lg border" /><button type="button" onClick={() => { setFotosIngreso(prev => prev.filter((_, idx) => idx !== i)); setPreviewFotos(prev => prev.filter((_, idx) => idx !== i)); }} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"><X size={10}/></button></div>))}</div>}</div>
        </div>
        <div style={{ padding: 24, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 12, background: 'white', flexShrink: 0 }}><button onClick={onClose} className="btn-secondary flex-1">Cancelar</button><button onClick={() => onCreate(form, fotosIngreso)} disabled={!form.customer_name ||!form.device_brand || (needsCode && !form.lock_code)} className="btn-primary flex-1 disabled:opacity-50"><Check className="w-4 h-4" /> {fotosIngreso.length>0 ? `Crear con ${fotosIngreso.length} fotos` : form.advance_payment>0? `Crear y cobrar ${formatCurrency(form.advance_payment)} en Caja` : 'Crear orden'}</button></div>
      </div>
    </div>

    {showClienteList && filteredByName.length > 0 && createPortal(
      <div style={{ position: 'fixed', top: clientePos.top, left: clientePos.left, width: clientePos.width, zIndex: 120, background: 'white', border: '1px solid #f1f5f9', borderRadius: 16, boxShadow: '0 12px 32px rgba(0,0,0,0.16)', overflow: 'hidden' }}>
        <p style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#94a3b8', background: '#f8fafc' }}>Clientes frecuentes</p>
        {filteredByName.map(c => (
          <button key={c.id} type="button" onMouseDown={(e) => { e.preventDefault(); selectCustomer(c); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', textAlign: 'left', borderTop: '1px solid #f8fafc' }}>
            <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{getInitials(c.name || '?')}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                {c.is_frequent && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: '#fefce8', color: '#a16207', border: '1px solid #fef08a', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999, flexShrink: 0 }}><Star style={{ width: 12, height: 12 }} /> Frecuente</span>}
              </span>
              <span style={{ display: 'block', fontSize: 12, color: '#64748b' }}>{c.phone} • {c.visits || 0} visitas</span>
            </span>
          </button>
        ))}
      </div>,
      document.body
    )}

    {showTelefonoList && filteredByPhone.length > 0 && createPortal(
      <div style={{ position: 'fixed', top: telefonoPos.top, left: telefonoPos.left, width: telefonoPos.width, zIndex: 120, background: 'white', border: '1px solid #f1f5f9', borderRadius: 16, boxShadow: '0 12px 32px rgba(0,0,0,0.16)', overflow: 'hidden' }}>
        <p style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#94a3b8', background: '#f8fafc' }}>Coincidencias</p>
        {filteredByPhone.map(c => (
          <button key={c.id} type="button" onMouseDown={(e) => { e.preventDefault(); selectCustomer(c); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', textAlign: 'left', borderTop: '1px solid #f8fafc' }}>
            <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#d1fae5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{getInitials(c.name || '?')}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{c.phone}</span>
              <span style={{ display: 'block', fontSize: 12, color: '#64748b' }}>{c.name}</span>
            </span>
          </button>
        ))}
      </div>,
      document.body
    )}
    </>
  );
}