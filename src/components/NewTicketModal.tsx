import { useState, useRef } from 'react';
import { X, Bug, Upload, Flame, Check } from 'lucide-react';
import { supportAPI } from '@/api/client';

type Priority = 'alta' | 'media' | 'baja';

export default function NewTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [subject, setSubject] = useState('');
  const [type, setType] = useState('bug');
  const [priority, setPriority] = useState<Priority>('alta');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [includeSystem, setIncludeSystem] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | undefined) => {
    if (!f) return;
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(f.type)) { alert('Solo PNG o JPG'); return; }
    if (f.size > 10 * 1024 * 1024) { alert('Máximo 10MB'); return; }
    setFile(f);
    const r = new FileReader();
    r.onload = (e) => setPreview(e.target?.result as string);
    r.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) { alert('Faltan Asunto y Descripción'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('subject', subject.trim());
      fd.append('type', type);
      fd.append('priority', priority);
      fd.append('description', description.trim());
      fd.append('include_system_info', String(includeSystem));
      if (includeSystem) {
        fd.append('system_info', JSON.stringify({
          userAgent: navigator.userAgent,
          url: window.location.href,
          screen: `${window.screen.width}x${window.screen.height}`,
          language: navigator.language,
          timestamp: new Date().toISOString(),
        }));
      }
      if (file) fd.append('captura', file);
      await supportAPI.create(fd);
      onCreated();
      onClose();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error creando ticket');
    } finally { setSaving(false); }
  };

  const priorityBtn = (p: Priority, label: string) => {
    const active = priority === p;
    const style = p === 'alta' ? 'bg-red-500 text-white border-red-500' : p === 'media' ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-emerald-100 text-emerald-700 border-emerald-300';
    return (
      <button type="button" onClick={() => setPriority(p)} className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-bold border-2 flex items-center justify-center gap-1 ${active ? style + ' ring-2 ring-offset-1 ring-orange-200' : 'bg-white border-gray-200 text-gray-500'}`}>
        {p !== 'baja' ? <Flame className="w-4 h-4" /> : <span className="text-base">⊟</span>} {label}
      </button>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white', borderRadius: 20, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 24, borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          <h2 className="text-xl md:text-2xl font-extrabold flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-xl">🐞</span> Nuevo Ticket - Reportar problema</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label className="label font-bold">Asunto*</label>
            <input className="input" placeholder="Ej: Error al cerrar caja no calcula diferencia" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label font-bold">Tipo de problema*</label>
              <select className="input" value={type} onChange={e => setType(e.target.value)}>
                <option value="bug">Bug/Error</option>
                <option value="duda">Duda/Consulta</option>
                <option value="mejora">Mejora/Sugerencia</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="label font-bold">Prioridad*</label>
              <div className="flex gap-2">
                {priorityBtn('alta', 'Alta')}
                {priorityBtn('media', 'Media')}
                {priorityBtn('baja', 'Baja')}
              </div>
            </div>
          </div>

          <div>
            <label className="label font-bold">Descripción detallada*</label>
            <textarea className="input" style={{ minHeight: 110 }} placeholder="Describe paso a paso qué hiciste, qué esperabas y qué pasó... Incluye captura..." value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div>
            <label className="label font-bold">Adjuntar captura / evidencia</label>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
            >
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" hidden onChange={e => handleFile(e.target.files?.[0])} />
              <Upload className="w-6 h-6 mx-auto text-blue-500" />
              <p className="font-semibold text-sm mt-2">{file ? file.name : 'Subir captura PNG, JPG'}</p>
              <p className="text-xs text-gray-500">o arrastra y suelta aquí · Máx. 10MB</p>
              {preview && <img src={preview} className="mx-auto mt-3 max-h-40 rounded-lg border" />}
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={includeSystem} onChange={e => setIncludeSystem(e.target.checked)} className="mt-0.5 w-4 h-4 accent-blue-600" />
            <span>Incluir información del sistema (navegador, caja abierta) — esto me ayuda a debuggear más rápido</span>
          </label>
        </div>

        <div style={{ padding: 24, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 12, background: 'white', flexShrink: 0 }}>
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
            <Check className="w-4 h-4" /> {saving ? 'Creando...' : 'Crear Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}