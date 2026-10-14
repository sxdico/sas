
import { AlertTriangle, Crown, Clock, X } from 'lucide-react';
import { useState } from 'react';

export function LicenseExpiredBanner({ license }: { license: any }) {
  const [dismissed, setDismissed] = useState(false);
  if (!license || dismissed) return null;
  
  if (license.expired) {
    return (
      <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between gap-3 sticky top-0 z-[100]">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 animate-pulse flex-shrink-0" />
          <div>
            <p className="font-bold text-sm">🔒 Licencia vencida hace {license.days_overdue} día{license.days_overdue>1?'s':''} - Modo solo lectura</p>
            <p className="text-xs opacity-90">Puedes ver tus órdenes, IMEI y buscar, pero no puedes crear, mover, cobrar ni editar hasta renovar.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={`https://wa.me/5210000000000?text=Hola, mi licencia FixPro venció hace ${license.days_overdue} días, quiero renovar`} target="_blank" className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold text-xs whitespace-nowrap hover:bg-red-50 flex items-center gap-1">
            <Crown className="w-4 h-4" /> Renovar
          </a>
          <button onClick={()=>setDismissed(true)} className="p-1 hover:bg-red-700 rounded"><X className="w-4 h-4"/></button>
        </div>
      </div>
    );
  }
  
  if (license.expiring) {
    return (
      <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between gap-2 sticky top-0 z-[90]">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <p className="text-xs font-bold">{license.message} - Vence el {new Date(license.expired_at).toLocaleDateString('es-MX')}</p>
        </div>
        <button onClick={()=>setDismissed(true)} className="p-1 hover:bg-amber-600 rounded"><X className="w-4 h-4"/></button>
      </div>
    );
  }
  
  return null;
}
