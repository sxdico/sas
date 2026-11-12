import { useState } from 'react';
import { X, Star } from 'lucide-react';

interface Props { onClose: () => void; onSave: (data: any) => Promise<void>; }

export default function NuevoClienteModal({ onClose, onSave }: Props) {
  const [form, setForm] = useState({ name:'', phone:'', email:'', notes:'', is_frequent:false, send_welcome:true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if(!form.name.trim()) return setError('El nombre es obligatorio');
    if(!form.phone.trim()) return setError('El teléfono es obligatorio');
    setSaving(true); setError('');
    try { await onSave(form); } catch(e:any){ setError(e.response?.data?.error || 'Error guardando cliente'); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      {/* MISMO TAMAÑO QUE NUEVA ORDEN: centrado, max-w-lg, no full-page */}
      <div
        className="bg-white rounded-xl w-full max-w-lg max-h- overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header - igual que Nueva Orden */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Nuevo Cliente</h2>
            <p className="text-sm text-slate-500">Registro en 20 segundos para agilizar su próxima visita.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Nombre completo *</label>
            <input
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              placeholder="Ej: Pablo Hernandez"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Teléfono / WhatsApp *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">💬</span>
              <input
                value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value.replace(/[^0-9]/g,'').slice(0,10)})}
                placeholder="868-123-4567"
                className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Correo (opcional)</label>
              <input
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                placeholder="ejemplo@correo.com"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Notas internas</label>
              <input
                value={form.notes}
                onChange={e => setForm({...form, notes: e.target.value})}
                placeholder="Ej: iPhone, paga en efectivo..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_frequent} onChange={e => setForm({...form, is_frequent: e.target.checked})} className="w-4 h-4 accent-amber-500" />
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="text-sm font-medium">Marcar como cliente frecuente</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.send_welcome} onChange={e => setForm({...form, send_welcome: e.target.checked})} className="w-4 h-4 accent-blue-600" />
            <span className="text-sm font-medium">Enviarle WhatsApp de bienvenida</span>
          </label>

          {error && <p className="text-red-600 text-sm bg-red-50 p-2 rounded-lg">{error}</p>}
        </div>

        {/* Footer - igual que Nueva Orden */}
        <div className="flex gap-3 px-6 pb-5 pt-1">
          <button onClick={onClose} className="flex-1 border border-slate-300 rounded-lg py-2.5 font-semibold text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg py-2.5 font-semibold disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar Cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}