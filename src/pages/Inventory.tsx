import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { productAPI } from '@/api/client';
import {
  products as mockProducts, categories as mockCategories,
  suppliers as mockSuppliers, inventoryMovements as mockMovements,
} from '@/data/mock';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/permissions';
import type { Product, Category, InventoryMovement } from '@/types';
import {
  Package, Plus, Search, AlertTriangle, X, Edit2, Trash2, Upload,
  TrendingUp, TrendingDown, RefreshCw, FileText, Tag,
} from 'lucide-react';

type Tab = 'products' | 'movements' | 'categories' | 'suppliers';

export default function Inventory() {
  const { user } = useAuth();
  const tenantId = user?.tenant_id;
  const [tab, setTab] = useState<Tab>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showImport, setShowImport] = useState(false);

  const canEdit = user?.role === 'owner' || user?.role === 'technician';
  const canDelete = user?.role === 'owner';

  useEffect(() => {
    if (!tenantId) {
      setProducts(mockProducts.filter((p) => p.tenant_id === tenantId));
      setCategories(mockCategories.filter((c) => c.tenant_id === tenantId));
      setMovements(mockMovements.filter((m) => m.tenant_id === tenantId));
      setLoading(false);
      return;
    }
    Promise.all([
      productAPI.list().then((r) => r.data.products).catch(() => mockProducts.filter((p) => p.tenant_id === tenantId)),
      productAPI.categories().then((r) => r.data.categories).catch(() => mockCategories.filter((c) => c.tenant_id === tenantId)),
    ]).then(([prods, cats]) => {
      setProducts(prods as Product[]);
      setCategories(cats as Category[]);
      setMovements(mockMovements.filter((m) => m.tenant_id === tenantId));
      setLoading(false);
    });
  }, [tenantId]);

  const lowStockProducts = useMemo(() => products.filter((p) => p.stock <= p.min_stock), [products]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q));
  }, [products, search]);

  const tabs: { key: Tab; label: string; icon: typeof Package; count?: number }[] = [
    { key: 'products', label: 'Productos', icon: Package, count: products.length },
    { key: 'movements', label: 'Movimientos', icon: RefreshCw, count: movements.length },
    { key: 'categories', label: 'Categorías', icon: Tag, count: categories.length },
    { key: 'suppliers', label: 'Proveedores', icon: FileText, count: mockSuppliers.filter(s => s.tenant_id === tenantId).length },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-ink-400 flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          Cargando inventario...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-4 md:px-6 py-3 bg-white border-b border-ink-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {tabs.map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === key ? 'bg-primary-600 text-white' : 'text-ink-500 hover:bg-ink-100'
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
                {count !== undefined && <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === key ? 'bg-white/20' : 'bg-ink-200'}`}>{count}</span>}
              </button>
            ))}
          </div>
          {canEdit && tab === 'products' && (
            <div className="flex gap-2">
              <button onClick={() => setShowImport(true)} className="btn-secondary">
                <Upload className="w-4 h-4" /> Importar CSV
              </button>
              <button onClick={() => { setEditingProduct(null); setShowProductModal(true); }} className="btn-primary">
                <Plus className="w-4 h-4" /> Nuevo producto
              </button>
            </div>
          )}
        </div>

        {tab === 'products' && (
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input className="input pl-10" placeholder="Buscar por nombre, SKU o código de barras..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {lowStockProducts.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-warning-700 bg-warning-50 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4" />
                {lowStockProducts.length} producto(s) con stock bajo
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {tab === 'products' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-ink-50 border-b border-ink-200">
                  <tr>
                    <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3">Producto</th>
                    <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3">SKU</th>
                    <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3 hidden md:table-cell">Categoría</th>
                    <th className="text-right text-xs font-bold text-ink-500 uppercase px-4 py-3">Costo</th>
                    <th className="text-right text-xs font-bold text-ink-500 uppercase px-4 py-3">Precio</th>
                    <th className="text-center text-xs font-bold text-ink-500 uppercase px-4 py-3">Stock</th>
                    {canEdit && <th className="text-right text-xs font-bold text-ink-500 uppercase px-4 py-3">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {filteredProducts.map((p) => {
                    const cat = categories.find((c) => c.id === p.category_id);
                    const lowStock = p.stock <= p.min_stock;
                    const outStock = p.stock <= 0;
                    return (
                      <tr key={p.id} className="hover:bg-ink-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-ink-100 flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-ink-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-ink-800 truncate">{p.name}</p>
                              <p className="text-xs text-ink-500 truncate">{p.barcode}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-ink-600">{p.sku}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {cat && <span className="badge" style={{ backgroundColor: cat.color + '20', color: cat.color }}>{cat.name}</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-600 text-right tabular-nums">{formatCurrency(p.cost_price)}</td>
                        <td className="px-4 py-3 text-sm font-bold text-ink-800 text-right tabular-nums">{formatCurrency(p.sale_price)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`badge ${outStock ? 'bg-error-100 text-error-700' : lowStock ? 'bg-warning-100 text-warning-700' : 'bg-success-100 text-success-700'}`}>
                            {p.stock} / {p.min_stock}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => { setEditingProduct(p); setShowProductModal(true); }} className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-primary-600">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {canDelete && (
                                <button onClick={async () => {
                try { await productAPI.delete(p.id); } catch {}
                setProducts((prev) => prev.filter((x) => x.id !== p.id));
              }} className="p-1.5 rounded-lg text-ink-400 hover:bg-error-50 hover:text-error-600">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'movements' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-ink-50 border-b border-ink-200">
                  <tr>
                    <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3">Fecha</th>
                    <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3">Producto</th>
                    <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3">Tipo</th>
                    <th className="text-center text-xs font-bold text-ink-500 uppercase px-4 py-3">Cantidad</th>
                    <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3">Razón</th>
                    <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-ink-50">
                      <td className="px-4 py-3 text-sm text-ink-600 whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-ink-800">{m.product_name}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${
                          m.type === 'in' ? 'bg-success-100 text-success-700' :
                          m.type === 'out' ? 'bg-error-100 text-error-700' :
                          m.type === 'sale' ? 'bg-primary-100 text-primary-700' :
                          'bg-warning-100 text-warning-700'
                        }`}>
                          {m.type === 'in' && <TrendingUp className="w-3 h-3" />}
                          {m.type === 'out' && <TrendingDown className="w-3 h-3" />}
                          {m.type === 'sale' && <Package className="w-3 h-3" />}
                          {m.type === 'adjustment' && <RefreshCw className="w-3 h-3" />}
                          {m.type === 'in' ? 'Entrada' : m.type === 'out' ? 'Salida' : m.type === 'sale' ? 'Venta' : 'Ajuste'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-bold tabular-nums">{m.type === 'in' ? '+' : '-'}{m.quantity}</td>
                      <td className="px-4 py-3 text-sm text-ink-600">{m.reason}</td>
                      <td className="px-4 py-3 text-sm text-ink-600">{m.user_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'categories' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const count = products.filter((p) => p.category_id === cat.id).length;
              return (
                <div key={cat.id} className="card p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                      <Tag className="w-5 h-5" style={{ color: cat.color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-ink-800">{cat.name}</p>
                      <p className="text-xs text-ink-500">{count} producto(s)</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'suppliers' && (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-ink-50 border-b border-ink-200">
                <tr>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3">Proveedor</th>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3">Teléfono</th>
                  <th className="text-left text-xs font-bold text-ink-500 uppercase px-4 py-3">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {mockSuppliers.filter((s) => s.tenant_id === tenantId).map((s) => (
                  <tr key={s.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 text-sm font-semibold text-ink-800">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-ink-600">{s.phone}</td>
                    <td className="px-4 py-3 text-sm text-ink-600">{s.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product modal */}
      {showProductModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          onClose={() => setShowProductModal(false)}
          onSave={async (data) => {
            try {
              if (editingProduct) {
                const res = await productAPI.update(editingProduct.id, data);
                setProducts((prev) => prev.map((p) => p.id === editingProduct.id ? res.data.product : p));
              } else {
                const res = await productAPI.create(data);
                setProducts((prev) => [...prev, res.data.product]);
              }
            } catch {
              // Fallback: local update
              if (editingProduct) {
                setProducts((prev) => prev.map((p) => p.id === editingProduct.id ? { ...p, ...data } : p));
              } else {
                setProducts((prev) => [...prev, {
                  id: `p${Date.now()}`, tenant_id: tenantId!, image: '', favorite: false,
                  ...data,
                } as Product]);
              }
            }
            setShowProductModal(false);
          }}
        />
      )}

      {/* Import CSV modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={() => setShowImport(false)}>
          <div className="card w-full max-w-md p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-ink-900">Importar productos (CSV)</h2>
              <button onClick={() => setShowImport(false)} className="text-ink-400 hover:text-ink-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="border-2 border-dashed border-ink-200 rounded-xl p-8 text-center">
              <Upload className="w-12 h-12 text-ink-300 mx-auto mb-3" />
              <p className="text-sm text-ink-500 mb-2">Arrastra tu archivo CSV aquí</p>
              <p className="text-xs text-ink-400">Columnas: sku, barcode, name, category_id, cost_price, sale_price, stock, min_stock</p>
              <button className="btn-secondary mt-4">Seleccionar archivo</button>
            </div>
            <p className="text-xs text-ink-400 mt-3 text-center">Demo: la importación procesa tu CSV y crea productos en lote</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductModal({ product, categories, onClose, onSave }: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSave: (data: Partial<Product>) => void;
}) {
  const [form, setForm] = useState({
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    category_id: product?.category_id ?? categories[0]?.id ?? '',
    cost_price: product?.cost_price ?? 0,
    sale_price: product?.sale_price ?? 0,
    wholesale_price: product?.wholesale_price ?? 0,
    stock: product?.stock ?? 0,
    min_stock: product?.min_stock ?? 5,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 animate-slide-up max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-ink-900">{product ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">SKU</label><input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            <div><label className="label">Código de barras</label><input className="input" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
          </div>
          <div><label className="label">Nombre</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Descripción</label><textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div>
            <label className="label">Categoría</label>
            <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Costo</label><input type="number" className="input" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: parseFloat(e.target.value) || 0 })} /></div>
            <div><label className="label">Precio venta</label><input type="number" className="input" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: parseFloat(e.target.value) || 0 })} /></div>
            <div><label className="label">Precio mayoreo</label><input type="number" className="input" value={form.wholesale_price} onChange={(e) => setForm({ ...form, wholesale_price: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Stock actual</label><input type="number" className="input" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} /></div>
            <div><label className="label">Stock mínimo</label><input type="number" className="input" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: parseInt(e.target.value) || 0 })} /></div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => onSave(form)} disabled={!form.name || !form.sku} className="btn-primary flex-1">Guardar</button>
        </div>
      </div>
    </div>
  );
}
