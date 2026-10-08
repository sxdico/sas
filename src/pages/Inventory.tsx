import { useState, useMemo, useEffect } from 'react';
import { productAPI } from '../api/client'
import api from '../api/client'
import { formatCurrency, formatDateTime } from '@/utils/permissions';
import type { Product, Category, InventoryMovement } from '@/types';
import {
  Package, Plus, Search, AlertTriangle, X, Edit2, Trash2,
  RefreshCw, Tag, Palette,
} from 'lucide-react';

type Tab = 'products' | 'movements' | 'categories';

export default function Inventory() {
  const [tab, setTab] = useState<Tab>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodsRes, catsRes] = await Promise.all([
        productAPI.list(),
        productAPI.categories(),
      ]);
      setProducts(prodsRes.data.products || prodsRes.data || []);
      setCategories(catsRes.data.categories || catsRes.data || []);
      try {
        const movRes = await api.get('/products/movements/all').catch(() => api.get('/inventory/movements'));
        setMovements(movRes.data.movements || movRes.data || []);
      } catch {
        setMovements([]);
      }
    } catch (e: any) {
      console.error('Error inventario', e.response?.data || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const lowStockProducts = useMemo(() => products.filter((p) => p.stock <= p.min_stock), [products]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || String(p.barcode || '').includes(q));
  }, [products, search]);

  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: 'products', label: 'Productos', icon: Package, count: products.length },
    { key: 'movements', label: 'Movimientos', icon: RefreshCw, count: movements.length },
    { key: 'categories', label: 'Categorías', icon: Tag, count: categories.length },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mr-3" />
        Cargando inventario real...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 py-3 bg-white border-b border-ink-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {tabs.map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold ${tab === key? 'bg-primary-600 text-white' : 'text-ink-500 hover:bg-ink-100'}`}
              >
                <Icon className="w-4 h-4" /> {label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === key? 'bg-white/20' : 'bg-ink-200'}`}>{count}</span>
              </button>
            ))}
          </div>
          {tab === 'products' && (
            <button onClick={() => { setEditingProduct(null); setShowProductModal(true); }} className="btn-primary">
              <Plus className="w-4 h-4" /> Nuevo producto
            </button>
          )}
          {tab === 'categories' && (
            <button onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }} className="btn-primary">
              <Plus className="w-4 h-4" /> Nueva categoría
            </button>
          )}
        </div>

        {tab === 'products' && (
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input className="input pl-10" placeholder="Buscar por nombre, SKU o código..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {lowStockProducts.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-warning-700 bg-warning-50 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4" />
                {lowStockProducts.length} con stock bajo
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {tab === 'products' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-ink-50 border-b">
                  <tr>
                    <th className="text-left text-xs font-bold uppercase px-4 py-3">Producto</th>
                    <th className="text-left text-xs font-bold uppercase px-4 py-3">SKU</th>
                    <th className="text-left text-xs font-bold uppercase px-4 py-3 hidden md:table-cell">Categoría</th>
                    <th className="text-right text-xs font-bold uppercase px-4 py-3">Costo</th>
                    <th className="text-right text-xs font-bold uppercase px-4 py-3">Precio</th>
                    <th className="text-center text-xs font-bold uppercase px-4 py-3">Stock</th>
                    <th className="text-right text-xs font-bold uppercase px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredProducts.map((p) => {
                    const cat = categories.find((c) => c.id === p.category_id);
                    const lowStock = p.stock <= p.min_stock;
                    const outStock = p.stock <= 0;
                    return (
                      <tr key={p.id} className="hover:bg-ink-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-ink-100 flex items-center justify-center"><Package className="w-5 h-5 text-ink-400" /></div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{p.name}</p>
                              <p className="text-xs text-ink-500 truncate">{p.barcode}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">{p.sku}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {cat && <span className="badge" style={{ backgroundColor: (cat as any).color + '20', color: (cat as any).color }}>{cat.name}</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(p.cost_price)}</td>
                        <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(p.sale_price)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`badge ${outStock? 'bg-error-100 text-error-700' : lowStock? 'bg-warning-100 text-warning-700' : 'bg-success-100 text-success-700'}`}>
                            {p.stock} / {p.min_stock}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setEditingProduct(p); setShowProductModal(true); }} className="p-1.5 rounded-lg hover:bg-ink-100"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={async () => {
                              if (!confirm('¿Eliminar producto?')) return;
                              try { await productAPI.delete(p.id); setProducts(prev => prev.filter(x => x.id!== p.id)); }
                              catch (e: any) { alert(e.response?.data?.error || 'Error eliminando'); }
                            }} className="p-1.5 rounded-lg hover:bg-error-50 hover:text-error-600"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-ink-400">Sin productos en MySQL</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'movements' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-ink-50 border-b">
                  <tr>
                    <th className="text-left text-xs font-bold uppercase px-4 py-3">Fecha</th>
                    <th className="text-left text-xs font-bold uppercase px-4 py-3">Producto</th>
                    <th className="text-left text-xs font-bold uppercase px-4 py-3">Tipo</th>
                    <th className="text-center text-xs font-bold uppercase px-4 py-3">Cantidad</th>
                    <th className="text-left text-xs font-bold uppercase px-4 py-3">Razón</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movements.map((m: any) => (
                    <tr key={m.id} className="hover:bg-ink-50">
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                      <td className="px-4 py-3 text-sm font-medium">{m.product_name || m.product_id}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${m.type === 'in'? 'bg-success-100 text-success-700' : m.type === 'out'? 'bg-error-100 text-error-700' : 'bg-primary-100 text-primary-700'}`}>
                          {m.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold">{m.type === 'in'? '+' : '-'}{m.quantity}</td>
                      <td className="px-4 py-3 text-sm">{m.reason}</td>
                    </tr>
                  ))}
                  {movements.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-ink-400">Sin movimientos aún</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'categories' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat: any) => {
              const count = products.filter((p) => p.category_id === cat.id).length;
              return (
                <div key={cat.id} className="card p-4 group hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                        <Tag className="w-5 h-5" style={{ color: cat.color }} />
                      </div>
                      <div>
                        <p className="font-semibold">{cat.name}</p>
                        <p className="text-xs text-ink-500">{count} producto(s)</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => { setEditingCategory(cat); setShowCategoryModal(true); }} className="p-1.5 rounded hover:bg-ink-100"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={async () => {
                        if (count > 0) { alert('No puedes eliminar una categoría con productos'); return; }
                        if (!confirm(`¿Eliminar categoría "${cat.name}"?`)) return;
                        try { await api.delete(`/products/categories/${cat.id}`); setCategories(prev => prev.filter(x => x.id !== cat.id)); }
                        catch (e: any) { alert(e.response?.data?.error || 'Error eliminando categoría'); }
                      }} className="p-1.5 rounded hover:bg-error-50 hover:text-error-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
            {categories.length === 0 && (
              <div className="col-span-full card p-10 text-center">
                <Tag className="w-12 h-12 mx-auto mb-3 text-ink-300" />
                <p className="text-ink-500 mb-4">No hay categorías aún</p>
                <button onClick={() => setShowCategoryModal(true)} className="btn-primary mx-auto"><Plus className="w-4 h-4" /> Crear primera categoría</button>
              </div>
            )}
          </div>
        )}
      </div>

      {showProductModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          onClose={() => setShowProductModal(false)}
          onOpenCategoryModal={() => { setEditingCategory(null); setShowCategoryModal(true); }}
          onSave={async (data: any) => {
            try {
              if (editingProduct) {
                const { _adjustment, stock,...rest } = data;
                const res = await productAPI.update(editingProduct.id, rest);
                let updated = res.data.product;
                if (_adjustment && _adjustment!== 0) {
                  const stockRes = await api.put(`/products/${editingProduct.id}/stock`, {
                    quantity: _adjustment,
                    reason: _adjustment > 0? 'Ajuste manual - entrada' : 'Ajuste manual - salida',
                    type: _adjustment > 0? 'in' : 'out'
                  });
                  updated = stockRes.data.product;
                }
                setProducts(prev => prev.map(p => p.id === editingProduct.id? updated : p));
              } else {
                const res = await productAPI.create(data);
                setProducts(prev => [...prev, res.data.product]);
              }
              setShowProductModal(false);
              try {
                const movRes = await api.get('/products/movements/all').catch(() => api.get('/inventory/movements'));
                setMovements(movRes.data.movements || movRes.data || []);
              } catch {}
            } catch (e: any) {
              alert(e.response?.data?.error || 'Error guardando producto');
            }
          }}
        />
      )}

      {showCategoryModal && (
        <CategoryModal
          category={editingCategory}
          onClose={() => setShowCategoryModal(false)}
          onSave={async (data: any) => {
            try {
              if (editingCategory) {
                const res = await api.put(`/products/categories/${editingCategory.id}`, data);
                const updated = res.data.category || res.data;
                setCategories(prev => prev.map(c => c.id === editingCategory.id ? {...c, ...updated} : c));
              } else {
                const res = await api.post('/products/categories', data);
                const created = res.data.category || res.data;
                setCategories(prev => [...prev, created]);
              }
              setShowCategoryModal(false);
            } catch (e: any) {
              // Fallback si tu ruta es /categories
              try {
                if (editingCategory) {
                  const res2 = await api.put(`/categories/${editingCategory.id}`, data);
                  const updated = res2.data.category || res2.data;
                  setCategories(prev => prev.map(c => c.id === editingCategory.id ? {...c, ...updated} : c));
                } else {
                  const res2 = await api.post('/categories', data);
                  const created = res2.data.category || res2.data;
                  setCategories(prev => [...prev, created]);
                }
                setShowCategoryModal(false);
              } catch (e2: any) {
                alert(e2.response?.data?.error || e.response?.data?.error || 'Error guardando categoría. Revisa ruta en backend');
              }
            }
          }}
        />
      )}
    </div>
  );
}

function CategoryModal({ category, onClose, onSave }: any) {
  const [form, setForm] = useState({
    name: category?.name ?? '',
    color: category?.color ?? '#3B82F6',
  });

  const presetColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2"><Tag className="w-5 h-5" /> {category ? 'Editar categoría' : 'Nueva categoría'}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Nombre de categoría</label>
            <input className="input" placeholder="Ej: Pantallas, Baterías, Accesorios..." value={form.name} onChange={(e) => setForm({...form, name: e.target.value })} autoFocus />
          </div>
          <div>
            <label className="label flex items-center gap-2"><Palette className="w-4 h-4" /> Color</label>
            <div className="flex items-center gap-2 mb-3">
              <input type="color" className="w-12 h-10 rounded-lg border cursor-pointer" value={form.color} onChange={(e) => setForm({...form, color: e.target.value })} />
              <input className="input flex-1 font-mono" value={form.color} onChange={(e) => setForm({...form, color: e.target.value })} />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {presetColors.map(c => (
                <button key={c} onClick={() => setForm({...form, color: c})} className={`w-full h-9 rounded-lg border-2 transition ${form.color === c ? 'border-ink-900 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="bg-ink-50 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: form.color + '20' }}>
              <Tag className="w-5 h-5" style={{ color: form.color }} />
            </div>
            <div><p className="text-sm font-semibold">{form.name || 'Vista previa'}</p><p className="text-xs text-ink-500" style={{ color: form.color }}>{form.color}</p></div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => onSave(form)} disabled={!form.name.trim()} className="btn-primary flex-1 disabled:opacity-50">{category ? 'Actualizar' : 'Crear categoría'}</button>
        </div>
      </div>
    </div>
  );
}

function ProductModal({ product, categories, onClose, onSave, onOpenCategoryModal }: any) {
  const isEditing =!!product;
  const [form, setForm] = useState({
    sku: product?.sku?? '',
    barcode: product?.barcode?? '',
    name: product?.name?? '',
    description: product?.description?? '',
    category_id: product?.category_id?? categories[0]?.id?? '',
    cost_price: product?.cost_price?? 0,
    sale_price: product?.sale_price?? 0,
    wholesale_price: product?.wholesale_price?? 0,
    stock: product?.stock?? 0,
    min_stock: product?.min_stock?? 5,
  });
  const [adjustment, setAdjustment] = useState(0);
  const stockPreview = isEditing? (product.stock + adjustment) : form.stock;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">{product? 'Editar producto' : 'Nuevo producto'}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">SKU</label><input className="input" value={form.sku} onChange={(e) => setForm({...form, sku: e.target.value })} /></div>
            <div><label className="label">Código barras</label><input className="input" value={form.barcode} onChange={(e) => setForm({...form, barcode: e.target.value })} /></div>
          </div>
          <div><label className="label">Nombre</label><input className="input" value={form.name} onChange={(e) => setForm({...form, name: e.target.value })} /></div>
          <div><label className="label">Descripción</label><textarea className="input" value={form.description} onChange={(e) => setForm({...form, description: e.target.value })} /></div>
          <div>
            <div className="flex items-center justify-between mb-1"><label className="label mb-0">Categoría</label><button onClick={onOpenCategoryModal} className="text-xs text-primary-600 font-bold hover:underline">+ Nueva categoría</button></div>
            <select className="input" value={form.category_id} onChange={(e) => setForm({...form, category_id: e.target.value })}>
              <option value="">Sin categoría</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Costo</label><input type="number" className="input" value={form.cost_price} onChange={(e) => setForm({...form, cost_price: parseFloat(e.target.value) || 0 })} /></div>
            <div><label className="label">Precio venta</label><input type="number" className="input" value={form.sale_price} onChange={(e) => setForm({...form, sale_price: parseFloat(e.target.value) || 0 })} /></div>
            <div><label className="label">Mayoreo</label><input type="number" className="input" value={form.wholesale_price} onChange={(e) => setForm({...form, wholesale_price: parseFloat(e.target.value) || 0 })} /></div>
          </div>

          {isEditing? (
            <div className="bg-ink-50 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Stock actual</label>
                  <input className="input bg-ink-100 font-bold" value={product.stock} disabled />
                </div>
                <div>
                  <label className="label">Ajuste (+/-)</label>
                  <input type="number" className="input font-bold" placeholder="Ej: 5 o -2" value={adjustment} onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)} />
                </div>
              </div>
              {adjustment!== 0 && (
                <p className="text-sm font-semibold text-primary-600">Nuevo stock será: {stockPreview} pz {adjustment > 0? `(+${adjustment})` : `(${adjustment})`}</p>
              )}
              <div>
                <label className="label">Stock mínimo</label>
                <input type="number" className="input" value={form.min_stock} onChange={(e) => setForm({...form, min_stock: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Stock inicial</label><input type="number" className="input" value={form.stock} onChange={(e) => setForm({...form, stock: parseInt(e.target.value) || 0 })} /></div>
              <div><label className="label">Stock mínimo</label><input type="number" className="input" value={form.min_stock} onChange={(e) => setForm({...form, min_stock: parseInt(e.target.value) || 0 })} /></div>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => onSave({...form, _adjustment: adjustment})} disabled={!form.name ||!form.sku} className="btn-primary flex-1">Guardar en MySQL</button>
        </div>
      </div>
    </div>
  );
}