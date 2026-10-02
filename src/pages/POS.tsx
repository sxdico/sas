import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { productAPI, saleAPI } from '@/api/client';
import { products as mockProducts, categories as mockCategories, customers as mockCustomers } from '@/data/mock';
import { formatCurrency, PAYMENT_METHOD_LABELS } from '@/utils/permissions';
import type { Product, Category, Customer, SaleItem, PaymentMethod } from '@/types';
import {
  Search, ShoppingCart, Plus, Minus, Trash2, Percent, X, User,
  CreditCard, Banknote, Smartphone, Clock, Printer, Check, AlertTriangle,
  Tag, Package,
} from 'lucide-react';

interface POSProps {
  onSaleComplete: (saleData: SaleItem[], total: number, method: PaymentMethod, customerName: string | null) => void;
}

export default function POS({ onSaleComplete }: POSProps) {
  const { user } = useAuth();
  const tenantId = user?.tenant_id;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      // Demo mode fallback
      setProducts(mockProducts.filter((p) => p.tenant_id === tenantId));
      setCategories(mockCategories.filter((c) => c.tenant_id === tenantId));
      setCustomers(mockCustomers.filter((c) => c.tenant_id === tenantId));
      setLoading(false);
      return;
    }
    Promise.all([
      productAPI.list().then((r) => r.data.products).catch(() => mockProducts.filter((p) => p.tenant_id === tenantId)),
      productAPI.categories().then((r) => r.data.categories).catch(() => mockCategories.filter((c) => c.tenant_id === tenantId)),
    ]).then(([prods, cats]) => {
      setProducts(prods as Product[]);
      setCategories(cats as Category[]);
      setCustomers(mockCustomers.filter((c) => c.tenant_id === tenantId));
      setLoading(false);
    });
  }, [tenantId]);

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [heldSales, setHeldSales] = useState<{ items: SaleItem[]; customer: Customer | null }[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [cashReceived, setCashReceived] = useState('');
  const [lineDiscountEdit, setLineDiscountEdit] = useState<string | null>(null);
  const [saleCompleteMsg, setSaleCompleteMsg] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const tenantProducts = products;
  const tenantCategories = categories;
  const tenantCustomers = customers;

  const filteredProducts = useMemo(() => {
    let list = tenantProducts;
    if (activeCategory !== 'all') list = list.filter((p) => p.category_id === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q)
      );
    }
    return list;
  }, [tenantProducts, activeCategory, search]);

  const favoriteProducts = useMemo(() => tenantProducts.filter((p) => p.favorite), [tenantProducts]);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);
  const totalDiscount = useMemo(() => cart.reduce((s, i) => s + i.discount, 0), [cart]);
  const total = subtotal - totalDiscount;
  const change = paymentMethod === 'efectivo' ? Math.max(0, (parseFloat(cashReceived) || 0) - total) : 0;
  const canCheckout = cart.length > 0 && (paymentMethod !== 'efectivo' || (parseFloat(cashReceived) || 0) >= total);

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product_id: product.id, name: product.name, price: product.sale_price, quantity: 1, discount: 0 }];
    });
  }, []);

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => {
      const product = tenantProducts.find((p) => p.id === id);
      if (!product) return prev;
      return prev
        .map((i) => {
          if (i.product_id !== id) return i;
          const newQty = i.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > product.stock) return i;
          return { ...i, quantity: newQty };
        })
        .filter(Boolean) as SaleItem[];
    });
  };

  const updateDiscount = (id: string, discount: number) => {
    setCart((prev) => prev.map((i) =>
      i.product_id === id ? { ...i, discount: Math.max(0, Math.min(discount, i.price * i.quantity)) } : i
    ));
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((i) => i.product_id !== id));
  const clearCart = () => { setCart([]); setSelectedCustomer(null); };

  const holdSale = () => {
    if (cart.length === 0) return;
    setHeldSales((prev) => [...prev, { items: cart, customer: selectedCustomer }]);
    clearCart();
  };

  const resumeSale = (idx: number) => {
    const held = heldSales[idx];
    setCart(held.items);
    setSelectedCustomer(held.customer);
    setHeldSales((prev) => prev.filter((_, i) => i !== idx));
  };

  const completeSale = async () => {
    setProcessing(true);
    setSaleError(null);
    try {
      // Try real API first
      await saleAPI.create({
        items: cart.map((i) => ({
          product_id: i.product_id, name: i.name, price: i.price,
          quantity: i.quantity, discount: i.discount,
        })),
        payment_method: paymentMethod,
        cash_received: paymentMethod === 'efectivo' ? parseFloat(cashReceived) || 0 : 0,
        customer_id: selectedCustomer?.id || undefined,
        discount: totalDiscount,
      });

      // Update local stock
      setProducts((prev) => prev.map((p) => {
        const cartItem = cart.find((i) => i.product_id === p.id);
        if (cartItem) return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
        return p;
      }));

      onSaleComplete(cart, total, paymentMethod, selectedCustomer?.name ?? null);
      setShowCheckout(false);
      clearCart();
      setCashReceived('');
      setPaymentMethod('efectivo');
      setSaleCompleteMsg(true);
      setTimeout(() => setSaleCompleteMsg(false), 2500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Error al procesar venta';
      setSaleError(msg);
    } finally {
      setProcessing(false);
    }
  };

  const paymentMethods: { method: PaymentMethod; label: string; icon: typeof CreditCard }[] = [
    { method: 'efectivo', label: 'Efectivo', icon: Banknote },
    { method: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
    { method: 'transferencia', label: 'Transferencia', icon: Smartphone },
    { method: 'credito', label: 'Crédito', icon: User },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-ink-400 flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          Cargando productos...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* LEFT 70% - Products */}
      <div className="flex flex-col w-full md:w-[70%] bg-ink-50 border-r border-ink-200">
        <div className="p-4 bg-white border-b border-ink-200 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
            <input
              type="text"
              className="input pl-11 text-base"
              placeholder="Buscar por nombre, SKU o código de barras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                activeCategory === 'all' ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
            >
              Todos
            </button>
            {tenantCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                  activeCategory === cat.id ? 'text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                }`}
                style={activeCategory === cat.id ? { backgroundColor: cat.color } : {}}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {favoriteProducts.length > 0 && (
          <div className="px-4 py-2 bg-ink-100 border-b border-ink-200 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-bold text-ink-500 shrink-0">RÁPIDAS:</span>
            {favoriteProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white border border-ink-200 text-xs font-medium text-ink-700 hover:border-primary-400 hover:bg-primary-50 transition-all whitespace-nowrap"
              >
                {p.hotkey && <kbd className="px-1 py-0.5 bg-ink-800 text-white rounded text-[10px] font-mono">{p.hotkey}</kbd>}
                {p.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredProducts.map((product) => {
              const cat = tenantCategories.find((c) => c.id === product.category_id);
              const outOfStock = product.stock <= 0;
              const lowStock = product.stock > 0 && product.stock <= product.min_stock;
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={outOfStock}
                  className={`card p-3 text-left transition-all hover:shadow-md active:scale-[0.98] ${
                    outOfStock ? 'opacity-50 pointer-events-none' : 'hover:border-primary-300 cursor-pointer'
                  }`}
                >
                  <div className="aspect-square rounded-lg bg-ink-100 flex items-center justify-center mb-2 relative overflow-hidden">
                    {cat && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                        <Tag className="w-3 h-3" style={{ color: cat.color }} />
                      </div>
                    )}
                    <Package className="w-8 h-8 text-ink-300" />
                  </div>
                  <p className="text-sm font-semibold text-ink-800 line-clamp-2 leading-tight mb-1">{product.name}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-primary-600">{formatCurrency(product.sale_price)}</span>
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                      outOfStock ? 'bg-error-100 text-error-700' : lowStock ? 'bg-warning-100 text-warning-700' : 'bg-ink-100 text-ink-500'
                    }`}>
                      {outOfStock ? 'Sin stock' : `${product.stock}pz`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-ink-400">
              <Package className="w-12 h-12 mb-3" />
              <p className="font-medium">No se encontraron productos</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT 30% - Ticket */}
      <div className="hidden md:flex flex-col w-[30%] bg-white min-w-[340px]">
        <div className="px-4 py-3 border-b border-ink-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary-600" />
            <span className="font-bold text-ink-800">Ticket Actual</span>
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-error-500 hover:text-error-700 p-1.5 rounded-lg hover:bg-error-50">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-4 py-2 border-b border-ink-200">
          <button
            onClick={() => setShowCustomerPicker(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-ink-200 hover:border-primary-400 hover:bg-primary-50 transition-all text-sm"
          >
            <User className="w-4 h-4 text-ink-400" />
            <span className={selectedCustomer ? 'text-ink-800 font-medium' : 'text-ink-400'}>
              {selectedCustomer ? selectedCustomer.name : 'Seleccionar cliente (opcional)'}
            </span>
            {selectedCustomer && (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); }}
                className="ml-auto text-ink-400 hover:text-error-500"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-ink-300 px-6">
              <ShoppingCart className="w-16 h-16 mb-3" />
              <p className="text-sm font-medium text-ink-400 text-center">Agrega productos al ticket</p>
              <p className="text-xs text-ink-400 mt-1">Clic en un producto o usa las teclas rápidas</p>
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {cart.map((item) => (
                <div key={item.product_id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-ink-800 flex-1 leading-tight">{item.name}</p>
                    <button onClick={() => removeFromCart(item.product_id)} className="text-ink-300 hover:text-error-500 shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.product_id, -1)} className="w-7 h-7 rounded-md bg-ink-100 flex items-center justify-center hover:bg-ink-200 text-ink-600">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-ink-800">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product_id, 1)} className="w-7 h-7 rounded-md bg-ink-100 flex items-center justify-center hover:bg-ink-200 text-ink-600">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5">
                        {lineDiscountEdit === item.product_id ? (
                          <input
                            type="number"
                            className="w-16 text-xs rounded border border-ink-200 px-1 py-0.5 text-right"
                            autoFocus
                            placeholder="0"
                            onBlur={(e) => { updateDiscount(item.product_id, parseFloat(e.target.value) || 0); setLineDiscountEdit(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { updateDiscount(item.product_id, parseFloat((e.target as HTMLInputElement).value) || 0); setLineDiscountEdit(null); } }}
                          />
                        ) : (
                          <button
                            onClick={() => setLineDiscountEdit(item.product_id)}
                            className={`flex items-center gap-0.5 text-xs ${item.discount > 0 ? 'text-success-600 font-semibold' : 'text-ink-400 hover:text-ink-600'}`}
                          >
                            <Percent className="w-3 h-3" />
                            {item.discount > 0 ? `-${formatCurrency(item.discount)}` : 'Desc'}
                          </button>
                        )}
                        <span className="text-sm font-bold text-ink-900">{formatCurrency(item.price * item.quantity - item.discount)}</span>
                      </div>
                      {item.discount > 0 && (
                        <p className="text-[11px] text-ink-400">{formatCurrency(item.price * item.quantity)}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-ink-200 p-4 space-y-3">
          {heldSales.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-warning-700 bg-warning-50 rounded-lg px-3 py-2">
              <Clock className="w-4 h-4" />
              <span>{heldSales.length} venta(s) en espera</span>
              <button onClick={() => resumeSale(heldSales.length - 1)} className="ml-auto font-semibold hover:underline">Reanudar</button>
            </div>
          )}
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-ink-500">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm text-success-600">
                <span>Descuentos</span>
                <span>-{formatCurrency(totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-1">
              <span className="text-sm font-semibold text-ink-700">Total</span>
              <span className="text-3xl font-bold text-ink-900 tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button onClick={holdSale} disabled={cart.length === 0} className="btn-secondary text-xs py-2">
              <Clock className="w-4 h-4" /> Pausar
            </button>
            <button onClick={clearCart} disabled={cart.length === 0} className="btn-secondary text-xs py-2">
              <Trash2 className="w-4 h-4" /> Vaciar
            </button>
            <button onClick={() => setShowCustomerPicker(true)} className="btn-secondary text-xs py-2">
              <User className="w-4 h-4" /> Cliente
            </button>
          </div>
          <button
            onClick={() => setShowCheckout(true)}
            disabled={cart.length === 0}
            className="btn-primary w-full py-3 text-base"
          >
            <CreditCard className="w-5 h-5" />
            Cobrar <kbd className="ml-1 px-1.5 py-0.5 bg-primary-800/40 rounded text-xs font-mono">F10</kbd>
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={() => !processing && setShowCheckout(false)}>
          <div className="card w-full max-w-md p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-ink-900">Cobrar Venta</h2>
              <button onClick={() => setShowCheckout(false)} className="text-ink-400 hover:text-ink-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-ink-50 rounded-xl p-4 mb-4 text-center">
              <p className="text-sm text-ink-500 mb-1">Total a pagar</p>
              <p className="text-4xl font-bold text-ink-900">{formatCurrency(total)}</p>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {paymentMethods.map(({ method, label, icon: Icon }) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 transition-all ${
                    paymentMethod === method ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-ink-200 text-ink-500 hover:border-ink-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-semibold">{label}</span>
                </button>
              ))}
            </div>

            {paymentMethod === 'efectivo' && (
              <div className="space-y-3 mb-4">
                <div>
                  <label className="label">Efectivo recibido</label>
                  <input
                    type="number"
                    className="input text-lg font-semibold"
                    placeholder="0.00"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000].filter((v, i, arr) => arr.indexOf(v) === i).map((amt) => (
                    <button key={amt} onClick={() => setCashReceived(amt.toFixed(2))} className="px-3 py-1.5 rounded-lg bg-ink-100 text-sm font-semibold text-ink-700 hover:bg-ink-200">
                      {formatCurrency(amt)}
                    </button>
                  ))}
                </div>
                {parseFloat(cashReceived) > 0 && (
                  <div className={`rounded-lg p-3 text-center ${change > 0 ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-700'}`}>
                    {change > 0 ? (
                      <p className="text-lg font-bold">Cambio: {formatCurrency(change)}</p>
                    ) : (
                      <p className="text-sm font-semibold flex items-center justify-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> Efectivo insuficiente
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'credito' && !selectedCustomer && (
              <div className="bg-warning-50 text-warning-700 rounded-lg p-3 mb-4 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Selecciona un cliente para venta a crédito
              </div>
            )}

            {saleError && (
              <div className="bg-error-50 text-error-700 rounded-lg p-3 mb-4 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {saleError}
              </div>
            )}

            <button
              onClick={completeSale}
              disabled={!canCheckout || (paymentMethod === 'credito' && !selectedCustomer) || processing}
              className="btn-primary w-full py-3 text-base"
            >
              {processing ? (
                <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Procesando...</>
              ) : (
                <><Check className="w-5 h-5" /> Confirmar venta</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Customer picker modal */}
      {showCustomerPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={() => setShowCustomerPicker(false)}>
          <div className="card w-full max-w-md p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-ink-900">Seleccionar Cliente</h2>
              <button onClick={() => setShowCustomerPicker(false)} className="text-ink-400 hover:text-ink-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2 max-h-80 overflow-auto">
              {tenantCustomers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCustomer(c); setShowCustomerPicker(false); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-ink-200 hover:border-primary-400 hover:bg-primary-50 transition-all"
                >
                  <div className="text-left">
                    <p className="font-semibold text-ink-800 text-sm">{c.name}</p>
                    <p className="text-xs text-ink-500">{c.phone}</p>
                  </div>
                  {c.credit_balance > 0 && (
                    <span className="badge bg-error-100 text-error-700">Adeuda {formatCurrency(c.credit_balance)}</span>
                  )}
                </button>
              ))}
              {tenantCustomers.length === 0 && (
                <p className="text-sm text-ink-400 text-center py-6">No hay clientes registrados</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sale complete toast */}
      {saleCompleteMsg && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className="bg-success-600 text-white rounded-xl px-5 py-3 shadow-lg flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold">¡Venta completada!</p>
              <p className="text-sm text-success-100">Ticket generado correctamente</p>
            </div>
            <Printer className="w-5 h-5 text-success-100 ml-2" />
          </div>
        </div>
      )}
    </div>
  );
}
