import { useState, useMemo, useCallback, useEffect } from 'react';
import { productAPI, saleAPI, orderAPI, cashAPI } from '@/api/client'
import { formatCurrency } from '@/utils/permissions';
import type { Product, Category, Customer, SaleItem, PaymentMethod } from '@/types';
import {
  Search, ShoppingCart, Plus, Minus, Trash2, X, User,
  CreditCard, Banknote, Smartphone, Check, AlertTriangle,
  Package, Lock, Unlock, DollarSign
} from 'lucide-react';

interface POSProps {
  onSaleComplete: (saleData: SaleItem[], total: number, method: PaymentMethod, customerName: string | null) => void;
}

interface PendingAnticipo {
  folio: string;
  orderId?: string;
  customer: string;
  device?: string;
  amount: string | number;
  method?: string;
  type?: 'anticipo' | 'liquidacion';
}

export default function POS({ onSaleComplete }: POSProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // CAJA
  const [cashSession, setCashSession] = useState<any>(null);
  const [cashSummary, setCashSummary] = useState<any>(null);
  const [showOpenCash, setShowOpenCash] = useState(false);
  const [showCloseCash, setShowCloseCash] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('500');
  const [closingAmount, setClosingAmount] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [cashReceived, setCashReceived] = useState('');
  const [saleCompleteMsg, setSaleCompleteMsg] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [pendingOrderInfo, setPendingOrderInfo] = useState<PendingAnticipo | null>(null);

  const loadCash = async () => {
    try {
      const res = await cashAPI.current();
      setCashSession(res.data.session);
      setCashSummary(res.data.summary || null);
      if (res.data.summary) {
        const expected = parseFloat(res.data.session.opening_amount) + parseFloat(res.data.summary.efectivo || 0);
        setClosingAmount(String(expected));
      }
    } catch (e) {
      console.error('Error caja', e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodsRes, catsRes] = await Promise.all([
        productAPI.list(),
        productAPI.categories(),
      ]);
      setProducts(prodsRes.data.products || prodsRes.data || []);
      setCategories(catsRes.data.categories || catsRes.data || []);
      await loadCash();
    } catch (e: any) {
      console.error('Error cargando POS', e.response?.data || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const visibleProducts = useMemo(() => products.filter((p: any) => p.sku!== 'ANTICIPO' &&!p.name.toLowerCase().includes('anticipo')), [products]);

  const filteredProducts = useMemo(() => {
    let list = visibleProducts;
    if (activeCategory!== 'all') list = list.filter((p) => p.category_id === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && String(p.barcode).includes(q))
      );
    }
    return list;
  }, [visibleProducts, activeCategory, search]);

  const favoriteProducts = useMemo(() => visibleProducts.filter((p: any) => p.favorite), [visibleProducts]);

  useEffect(() => {
    if (loading) return;
    const pendingRaw = localStorage.getItem('pendingAnticipo');
    if (!pendingRaw) return;
    try {
      const pending: PendingAnticipo = JSON.parse(pendingRaw);
      setPendingOrderInfo(pending);
      const anticipoProduct = products.find((p: any) => p.sku === 'ANTICIPO');
      const prodId = anticipoProduct?.id || `ANTICIPO-${pending.folio}`;
      const isLiquidacion = pending.type === 'liquidacion';
      const customItem: SaleItem = {
        product_id: prodId,
        name: `${isLiquidacion ? 'Liquidación' : 'Anticipo'} Orden ${pending.folio} - ${pending.customer}${pending.device? ` - ${pending.device}` : ''}`,
        price: parseFloat(String(pending.amount)),
        quantity: 1,
        discount: 0,
      };
      setCart([customItem]);
      setPaymentMethod((pending.method as PaymentMethod) || 'efectivo');
      setCashReceived(String(pending.amount));
      setShowCheckout(true);
      localStorage.removeItem('pendingAnticipo');
    } catch {}
  }, [products, loading]);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);
  const totalDiscount = useMemo(() => cart.reduce((s, i) => s + i.discount, 0), [cart]);
  const total = subtotal - totalDiscount;
  const change = paymentMethod === 'efectivo'? Math.max(0, (parseFloat(cashReceived) || 0) - total) : 0;
  const canCheckout = cart.length > 0 && (paymentMethod!== 'efectivo' || (parseFloat(cashReceived) || 0) >= total) && !!cashSession;

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((i) => i.product_id === product.id? {...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product_id: product.id, name: product.name, price: product.sale_price, quantity: 1, discount: 0 }];
    });
  }, []);

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => {
      const product = products.find((p) => p.id === id);
      return prev.map((i) => {
        if (i.product_id!== id) return i;
        const newQty = i.quantity + delta;
        if (newQty <= 0) return null as any;
        if (product && newQty > product.stock &&!String(id).startsWith('ANTICIPO')) return i;
        return {...i, quantity: newQty };
      }).filter(Boolean) as SaleItem[];
    });
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((i) => i.product_id!== id));
  const clearCart = () => { setCart([]); setSelectedCustomer(null); setPendingOrderInfo(null); };

  const handleOpenCash = async () => {
    try {
      await cashAPI.open(parseFloat(openingAmount) || 0);
      setShowOpenCash(false);
      await loadCash();
    } catch (e: any) { alert(e.response?.data?.error || 'Error abriendo caja'); }
  };

  const handleCloseCash = async () => {
    try {
      const res = await cashAPI.close({ closing_amount: parseFloat(closingAmount) || 0, notes: closeNotes });
      setShowCloseCash(false);
      setCashSession(null);
      setCashSummary(null);
      alert(`Caja cerrada. Diferencia: ${formatCurrency(res.data.summary.difference)}`);
    } catch (e: any) { alert(e.response?.data?.error || 'Error cerrando caja'); }
  };

  const completeSale = async () => {
    if (!cashSession) { alert('Debes abrir caja primero'); return; }
    setProcessing(true);
    setSaleError(null);
    try {
      const isAnticipoSale = cart.some(i => String(i.product_id).startsWith('ANTICIPO') || i.name.toLowerCase().includes('anticipo orden') || i.name.toLowerCase().includes('liquidación orden'));
      await saleAPI.create({
        items: cart.map((i) => ({
          product_id: isAnticipoSale? undefined : i.product_id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          discount: i.discount,
        })),
        payment_method: paymentMethod,
        cash_received: paymentMethod === 'efectivo'? parseFloat(cashReceived) || 0 : 0,
        customer_id: selectedCustomer?.id || undefined,
        discount: totalDiscount,
      });
      if (pendingOrderInfo?.orderId && pendingOrderInfo?.type === 'liquidacion') {
        try { await orderAPI.markPaid(pendingOrderInfo.orderId); } catch (e) { console.error(e); }
      }
      if (!isAnticipoSale) {
        setProducts((prev) => prev.map((p) => {
          const cartItem = cart.find((i) => i.product_id === p.id);
          if (cartItem) return {...p, stock: Math.max(0, p.stock - cartItem.quantity) };
          return p;
        }));
      }
      onSaleComplete(cart, total, paymentMethod, selectedCustomer?.name?? null);
      setShowCheckout(false);
      clearCart();
      setCashReceived('');
      setPaymentMethod('efectivo');
      setPendingOrderInfo(null);
      setSaleCompleteMsg(true);
      setTimeout(() => setSaleCompleteMsg(false), 2500);
      await loadData();
    } catch (err: any) {
      setSaleError(err.response?.data?.error || 'Error al procesar venta');
    } finally {
      setProcessing(false);
    }
  };

  const paymentMethods: { method: PaymentMethod; label: string; icon: any }[] = [
    { method: 'efectivo', label: 'Efectivo', icon: Banknote },
    { method: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
    { method: 'transferencia', label: 'Transferencia', icon: Smartphone },
    { method: 'credito', label: 'Crédito', icon: User },
  ];

  const isAnticipoInCart = cart.some(i => i.name.toLowerCase().includes('anticipo') || i.name.toLowerCase().includes('liquidación'));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mr-3" />
        Cargando...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* BARRA DE CAJA - DENTRO DE POS */}
      <div className={`px-4 py-2.5 flex items-center justify-between border-b-2 ${cashSession ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        {cashSession ? (
          <>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2 text-sm font-bold text-green-700"><Unlock className="w-4 h-4" /> {cashSession.folio} ABIERTA</span>
              <span className="text-xs bg-white px-2 py-1 rounded border">Inicial: {formatCurrency(cashSession.opening_amount)}</span>
              <span className="text-xs bg-white px-2 py-1 rounded border">Ventas: {formatCurrency(cashSummary?.total || 0)} ({cashSummary?.count || 0})</span>
              <span className="text-xs bg-green-600 text-white px-2 py-1 rounded font-bold">Efectivo: {formatCurrency(cashSummary?.efectivo || 0)}</span>
              <span className="text-xs hidden md:inline">Esperado: {formatCurrency(parseFloat(cashSession.opening_amount) + parseFloat(cashSummary?.efectivo || 0))}</span>
            </div>
            <button onClick={() => setShowCloseCash(true)} className="btn-primary bg-orange-600 hover:bg-orange-700 py-1.5 text-sm"><DollarSign className="w-4 h-4" /> Corte de caja</button>
          </>
        ) : (
          <>
            <span className="flex items-center gap-2 text-sm font-bold text-red-700"><Lock className="w-4 h-4" /> CAJA CERRADA - No puedes vender</span>
            <button onClick={() => setShowOpenCash(true)} className="btn-primary py-1.5 text-sm"><Unlock className="w-4 h-4" /> Abrir caja</button>
          </>
        )}
      </div>

      <div className="flex flex-1 h-0">
        <div className="flex flex-col w-full md:w-[70%] bg-ink-50 border-r border-ink-200">
          <div className="p-4 bg-white border-b border-ink-200 space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
              <input className="input pl-11 text-base" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button onClick={() => setActiveCategory('all')} className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${activeCategory === 'all'? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-600'}`}>Todos</button>
              {categories.map((cat) => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${activeCategory === cat.id? 'text-white' : 'bg-ink-100 text-ink-600'}`} style={activeCategory === cat.id? { backgroundColor: (cat as any).color } : {}}>{cat.name}</button>
              ))}
            </div>
          </div>
          {favoriteProducts.length > 0 && (
            <div className="px-4 py-2 bg-ink-100 border-b border-ink-200 flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-bold text-ink-500 shrink-0">RÁPIDAS:</span>
              {favoriteProducts.map((p) => (
                <button key={p.id} onClick={() => addToCart(p)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white border text-xs font-medium hover:border-primary-400">{p.name}</button>
              ))}
            </div>
          )}
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map((product) => {
                const outOfStock = product.stock <= 0;
                const lowStock = product.stock > 0 && product.stock <= product.min_stock;
                return (
                  <button key={product.id} onClick={() => addToCart(product)} disabled={outOfStock || !cashSession} className={`card p-3 text-left hover:shadow-md ${outOfStock || !cashSession? 'opacity-50' : ''}`}>
                    <div className="aspect-square rounded-lg bg-ink-100 flex items-center justify-center mb-2"><Package className="w-8 h-8 text-ink-300" /></div>
                    <p className="text-sm font-semibold line-clamp-2 mb-1">{product.name}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-primary-600">{formatCurrency(product.sale_price)}</span>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${outOfStock? 'bg-error-100 text-error-700' : lowStock? 'bg-warning-100 text-warning-700' : 'bg-ink-100'}`}>{outOfStock? 'Sin stock' : `${product.stock}pz`}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="hidden md:flex flex-col w-[30%] bg-white min-w-0">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-primary-600" /><span className="font-bold">Ticket</span></div>
            {cart.length > 0 && <button onClick={clearCart} className="text-error-500 p-1.5"><Trash2 className="w-4 h-4" /></button>}
          </div>
          <div className="flex-1 overflow-auto">
            {cart.length === 0? (
              <div className="flex flex-col items-center justify-center h-full text-ink-300 px-6">
                <ShoppingCart className="w-16 h-16 mb-3" /><p className="text-sm text-ink-400 text-center">{!cashSession ? 'Abre caja para vender' : 'Agrega productos'}</p>
              </div>
            ) : (
              <div className="divide-y">
                {cart.map((item) => (
                  <div key={item.product_id} className="px-4 py-3 bg-green-50/50">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium flex-1">{item.name}</p>
                      <button onClick={() => removeFromCart(item.product_id)}><X className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(item.product_id, -1)} className="w-7 h-7 rounded-md bg-ink-100 flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                        <button onClick={() => updateQty(item.product_id, 1)} className="w-7 h-7 rounded-md bg-ink-100 flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                      <span className="text-sm font-bold">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t p-4 space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-ink-500"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              {totalDiscount > 0 && <div className="flex justify-between text-sm text-success-600"><span>Descuentos</span><span>-{formatCurrency(totalDiscount)}</span></div>}
              <div className="flex justify-between items-baseline pt-1"><span className="text-sm font-semibold">Total</span><span className="text-3xl font-bold tabular-nums">{formatCurrency(total)}</span></div>
            </div>
            <button onClick={() => setShowCheckout(true)} disabled={cart.length === 0 || !cashSession} className="btn-primary w-full py-3 text-base"><CreditCard className="w-5 h-5" /> Cobrar {isAnticipoInCart ? (pendingOrderInfo?.type === 'liquidacion' ? 'Liquidación' : 'Anticipo') : ''}</button>
            {!cashSession && <p className="text-xs text-red-600 text-center">Abre caja para cobrar</p>}
          </div>
        </div>
      </div>

      {showOpenCash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Unlock className="w-5 h-5 text-green-600" /> Abrir caja</h2>
            <label className="label">Monto inicial en caja $</label>
            <input type="number" className="input text-2xl font-bold mb-4" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)} autoFocus />
            <div className="flex gap-3">
              <button onClick={() => setShowOpenCash(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleOpenCash} className="btn-primary flex-1 bg-green-600 hover:bg-green-700">Abrir caja</button>
            </div>
          </div>
        </div>
      )}

      {showCloseCash && cashSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-auto">
          <div className="card w-full max-w-lg p-6 my-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-orange-600" /> Corte de caja - {cashSession.folio}</h2>
            <div className="bg-ink-50 rounded-xl p-4 space-y-2 mb-4 text-sm">
              <div className="flex justify-between"><span>Monto inicial:</span><span className="font-bold">{formatCurrency(cashSession.opening_amount)}</span></div>
              <div className="flex justify-between"><span>Ventas totales:</span><span className="font-bold">{formatCurrency(cashSummary?.total || 0)} ({cashSummary?.count || 0} ventas)</span></div>
              <div className="flex justify-between text-green-700 font-bold"><span>Efectivo:</span><span>{formatCurrency(cashSummary?.efectivo || 0)}</span></div>
              <div className="flex justify-between"><span>Tarjeta:</span><span>{formatCurrency(cashSummary?.tarjeta || 0)}</span></div>
              <div className="flex justify-between"><span>Transferencia:</span><span>{formatCurrency(cashSummary?.transferencia || 0)}</span></div>
              <div className="border-t pt-2 mt-2 flex justify-between text-base font-bold"><span>Esperado en caja:</span><span>{formatCurrency(parseFloat(cashSession.opening_amount) + parseFloat(cashSummary?.efectivo || 0))}</span></div>
            </div>
            <label className="label font-bold">¿Cuánto hay realmente en caja? $</label>
            <input type="number" className="input text-2xl font-bold mb-2" value={closingAmount} onChange={e => setClosingAmount(e.target.value)} autoFocus />
            {closingAmount && (
              <div className={`rounded-lg p-3 mb-4 text-center font-bold ${parseFloat(closingAmount) - (parseFloat(cashSession.opening_amount) + parseFloat(cashSummary?.efectivo || 0)) === 0 ? 'bg-green-100 text-green-700' : parseFloat(closingAmount) - (parseFloat(cashSession.opening_amount) + parseFloat(cashSummary?.efectivo || 0)) > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                Diferencia: {formatCurrency(parseFloat(closingAmount) - (parseFloat(cashSession.opening_amount) + parseFloat(cashSummary?.efectivo || 0)))} {parseFloat(closingAmount) - (parseFloat(cashSession.opening_amount) + parseFloat(cashSummary?.efectivo || 0)) > 0 ? '(Sobra)' : parseFloat(closingAmount) - (parseFloat(cashSession.opening_amount) + parseFloat(cashSummary?.efectivo || 0)) < 0 ? '(Falta)' : '(Cuadrado ✅)'}
              </div>
            )}
            <label className="label">Notas (opcional)</label>
            <textarea className="input mb-4" value={closeNotes} onChange={e => setCloseNotes(e.target.value)} placeholder="Ej. Se pagó luz $200" />
            <div className="flex gap-3">
              <button onClick={() => setShowCloseCash(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleCloseCash} className="btn-primary flex-1 bg-orange-600 hover:bg-orange-700">Cerrar caja</button>
            </div>
          </div>
        </div>
      )}

      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() =>!processing && setShowCheckout(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h2 className="text-xl font-bold">Cobrar {isAnticipoInCart ? (pendingOrderInfo?.type === 'liquidacion' ? 'Liquidación' : 'Anticipo') : 'Venta'}</h2><button onClick={() => setShowCheckout(false)}><X className="w-5 h-5" /></button></div>
            <div className="bg-primary-50 rounded-xl p-4 mb-4 text-center"><p className="text-sm text-ink-500 mb-1">Total a cobrar</p><p className="text-4xl font-bold">{formatCurrency(total)}</p></div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {paymentMethods.map(({ method, label, icon: Icon }) => (
                <button key={method} onClick={() => setPaymentMethod(method)} className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 ${paymentMethod === method? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-ink-200 text-ink-500'}`}><Icon className="w-5 h-5" /><span className="text-xs font-semibold">{label}</span></button>
              ))}
            </div>
            {paymentMethod === 'efectivo' && (
              <div className="space-y-3 mb-4">
                <input type="number" className="input text-lg font-semibold" placeholder="0.00" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} autoFocus />
                {parseFloat(cashReceived) > 0 && <div className={`rounded-lg p-3 text-center ${change > 0? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-700'}`}>{change > 0? <p className="text-lg font-bold">Cambio: {formatCurrency(change)}</p> : <p className="text-sm font-semibold flex items-center justify-center gap-1"><AlertTriangle className="w-4 h-4" /> Efectivo insuficiente</p>}</div>}
              </div>
            )}
            {saleError && <div className="bg-error-50 text-error-700 rounded-lg p-3 mb-4 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{saleError}</div>}
            <button onClick={completeSale} disabled={!canCheckout || processing} className="btn-primary w-full py-3 text-base">{processing? 'Procesando...' : <><Check className="w-5 h-5" /> Confirmar {formatCurrency(total)}</>}</button>
          </div>
        </div>
      )}

      {saleCompleteMsg && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-success-600 text-white rounded-xl px-5 py-3 shadow-lg flex items-center gap-3"><Check className="w-6 h-6" /><div><p className="font-bold">¡Venta completada!</p><p className="text-sm text-success-100">Corte actualizado</p></div></div>
        </div>
      )}
    </div>
  );
}