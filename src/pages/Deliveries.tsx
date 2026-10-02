import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { deliveryAPI } from '../api/client'; // si tu api está en../api cambia a '../api'
import { formatCurrency, formatDateTime } from '@/utils/permissions';
import type { RepairOrder } from '@/types';
import { PackageCheck, MessageSquare, Check, Clock, User, Search } from 'lucide-react';

export default function Deliveries({ onDeliver }: { onDeliver?: (orderId: string) => void }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<RepairOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const loadReady = async () => {
    setLoading(true);
    try {
      const r = await deliveryAPI.ready();
      setOrders(r.data.orders as RepairOrder[]);
    } catch (e: any) {
      console.error('Error cargando entregas', e.response?.data || e.message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReady();
  }, []);

  const readyOrders = useMemo(() => {
    return orders
     .filter((o) => o.status === 'listo')
     .filter((o) =>!search || o.customer_name.toLowerCase().includes(search.toLowerCase()) || o.folio.toLowerCase().includes(search.toLowerCase()))
     .sort((a, b) => (b.ready_at?? '').localeCompare(a.ready_at?? ''));
  }, [orders, search]);

  const handleDeliver = async (id: string) => {
    try {
      await deliveryAPI.deliver(id);
      setOrders((prev) => prev.filter((o) => o.id!== id));
      onDeliver?.(id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'No se pudo entregar');
      await loadReady(); // recarga real de MySQL
    } finally {
      setConfirmId(null);
    }
  };

  const buildWhatsAppUrl = (order: RepairOrder) => {
    const phone = order.customer_phone.replace(/[^0-9]/g, '');
    const text = `Hola ${order.customer_name}, tu ${order.device_brand} ${order.device_model} ya está listo para recoger. Total a pagar: ${formatCurrency(order.total)}. Folio: ${order.folio}.`;
    return `https://wa.me/52${phone}?text=${encodeURIComponent(text)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-ink-400 flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          Cargando entregas...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 py-4 bg-white border-b border-ink-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-success-600" />
              Entregas Pendientes
            </h2>
            <p className="text-sm text-ink-500 mt-0.5">{readyOrders.length} equipo(s) listo(s) para entregar</p>
          </div>
          <button onClick={loadReady} className="btn-secondary text-sm">Recargar</button>
        </div>
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            className="input pl-10"
            placeholder="Buscar por folio o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {readyOrders.length === 0? (
          <div className="flex flex-col items-center justify-center py-20 text-ink-400">
            <PackageCheck className="w-16 h-16 mb-3 text-ink-300" />
            <p className="font-medium text-lg">No hay equipos listos para entregar</p>
            <p className="text-sm mt-1">Las órdenes marcadas como "Listo" aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-5xl">
            {readyOrders.map((order) => (
              <div key={order.id} className="card p-4 hover:shadow-md transition-shadow">
                <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-primary-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary-700">{order.folio.split('-')[1] || order.folio}</span>
                    </div>
                    <div className="md:hidden">
                      <p className="text-sm font-bold text-primary-600">{order.folio}</p>
                      <p className="text-xs text-ink-500">{order.customer_name}</p>
                    </div>
                    <p className="text-sm font-bold text-primary-600 hidden md:block">{order.folio}</p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-ink-800 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-ink-400" />
                      {order.customer_name}
                    </p>
                    <p className="text-xs text-ink-500 mt-0.5">{order.device_brand} {order.device_model}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-ink-400 flex items-center gap-1 md:justify-end">
                      <Clock className="w-3 h-3" /> Listo desde
                    </p>
                    <p className="text-sm font-medium text-ink-700">{order.ready_at? formatDateTime(order.ready_at) : '—'}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-ink-400">Total a cobrar</p>
                    <p className="text-lg font-bold text-success-600">{formatCurrency(order.total)}</p>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={buildWhatsAppUrl(order)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary px-3 py-2 text-sm"
                    >
                      <MessageSquare className="w-4 h-4 text-success-600" />
                      <span className="hidden md:inline">WhatsApp</span>
                    </a>
                    <button
                      onClick={() => setConfirmId(order.id)}
                      className="btn-primary px-3 py-2 text-sm"
                    >
                      <Check className="w-4 h-4" />
                      <span className="hidden md:inline">Entregar</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmId(null)}>
          <div className="card w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-success-600" />
            </div>
            <h3 className="text-lg font-bold text-ink-900 mb-1">¿Confirmar entrega?</h3>
            <p className="text-sm text-ink-500 mb-5">Marca esta orden como entregada y cierra el proceso.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => handleDeliver(confirmId)} className="btn-primary flex-1">Sí, entregar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}