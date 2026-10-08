import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Product, Category, InventoryMovement } from '../models.js';
import { authMiddleware, authorize, requireTenantId } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// 1. CATEGORIAS - SIEMPRE PRIMERO
router.get('/categories/all', authorize(['owner', 'technician', 'secretary', 'secretaria', 'cashier', 'cajera', 'receptionist', 'admin']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const categories = await Category.findAll({ where: { tenant_id: tenantId }, order: [['name', 'ASC']] });
  res.json({ categories });
});

// 1.1 MOVIMIENTOS GLOBALES - CRITICO ANTES DE /:id
router.get('/movements/all', authorize(['owner', 'technician', 'secretary', 'secretaria', 'cashier', 'cajera', 'receptionist', 'admin']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  try {
    const movements = await InventoryMovement.findAll({
      where: { tenant_id: tenantId },
      order: [['created_at', 'DESC']],
      limit: 500,
    });
    // Enriquecer nombre si falta
    const enriched = await Promise.all(movements.map(async (m) => {
      const json = m.toJSON();
      if (!json.product_name && json.product_id) {
        try {
          const prod = await Product.findByPk(json.product_id);
          if (prod) json.product_name = prod.name;
        } catch {}
      }
      return json;
    }));
    res.json({ movements: enriched });
  } catch (e) {
    console.error('Error movements/all', e);
    res.status(500).json({ error: 'Error obteniendo movimientos', detail: e.message });
  }
});

// 2. Productos
router.get('/', authorize(['owner', 'technician', 'secretary', 'secretaria', 'cashier', 'cajera', 'receptionist', 'admin']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const { search, category_id } = req.query;
  const where = { tenant_id: tenantId };
  if (category_id && category_id!== 'all') where.category_id = category_id;
  if (search) {
    const { Op } = await import('sequelize');
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { sku: { [Op.like]: `%${search}%` } },
      { barcode: { [Op.like]: `%${search}%` } },
    ];
  }
  const products = await Product.findAll({ where, order: [['name', 'ASC']] });
  res.json({ products });
});

router.get('/low-stock', authorize(['owner', 'technician', 'secretary', 'secretaria', 'cashier', 'admin']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const products = await Product.findAll({ where: { tenant_id: tenantId } });
  const lowStock = products.filter((p) => p.stock <= p.min_stock);
  res.json({ products: lowStock });
});

// Movimientos por producto (antes de /:id genérico)
router.get('/:id/movements', authorize(['owner', 'technician', 'secretary', 'secretaria', 'cashier', 'admin']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const movements = await InventoryMovement.findAll({
    where: { product_id: req.params.id, tenant_id: tenantId },
    order: [['created_at', 'DESC']],
  });
  res.json({ movements });
});

// ============ CATEGORIAS CRUD ============
router.post('/categories', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const { name, color, icon } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  const category = await Category.create({
    id: uuidv4(), tenant_id: tenantId,
    name: name.trim(), color: color || '#3b82f6', icon: icon || 'Package',
  });
  res.status(201).json({ category });
});

router.put('/categories/:id', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const category = await Category.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!category) return res.status(404).json({ error: 'Categoría no encontrada' });
  const { name, color, icon } = req.body;
  if (name !== undefined) category.name = name.trim();
  if (color !== undefined) category.color = color;
  if (icon !== undefined) category.icon = icon;
  await category.save();
  res.json({ category });
});

router.delete('/categories/:id', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const category = await Category.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!category) return res.status(404).json({ error: 'Categoría no encontrada' });
  const count = await Product.count({ where: { category_id: category.id, tenant_id: tenantId } });
  if (count > 0) return res.status(400).json({ error: `No puedes eliminar: tiene ${count} producto(s) asignados` });
  await category.destroy();
  res.json({ message: 'Categoría eliminada' });
});

// 4. Obtener un producto
router.get('/:id', authorize(['owner', 'technician', 'secretary', 'secretaria', 'cashier', 'admin']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  if (req.params.id === 'categories' || req.params.id === 'movements') return res.status(404).json({ error: 'Ruta no encontrada' });
  const product = await Product.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json({ product });
});

// POST producto
router.post('/', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  let { sku, barcode, name, description, category_id, cost_price, sale_price, wholesale_price, stock, min_stock } = req.body;
  if (!sku ||!name) return res.status(400).json({ error: 'SKU y nombre son requeridos' });
  if (!category_id || category_id === '') category_id = null;

  const product = await Product.create({
    id: uuidv4(), tenant_id: tenantId, sku, barcode, name, description,
    category_id, cost_price: cost_price || 0, sale_price: sale_price || 0,
    wholesale_price: wholesale_price || 0, stock: stock || 0,
    min_stock: min_stock || 5, favorite: false,
  });

  if (stock && stock > 0) {
    await InventoryMovement.create({
      id: uuidv4(), tenant_id: tenantId, product_id: product.id,
      product_name: product.name,
      type: 'in', quantity: stock, reason: 'Stock inicial',
      user_id: req.user.id, user_name: req.user.name,
    });
  }
  res.status(201).json({ product });
});

router.put('/:id', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const product = await Product.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  if (req.body.category_id === '') req.body.category_id = null;
  const fields = ['sku', 'barcode', 'name', 'description', 'category_id', 'cost_price', 'sale_price', 'wholesale_price', 'min_stock', 'favorite', 'hotkey'];
  fields.forEach((f) => { if (req.body[f]!== undefined) product[f] = req.body[f]; });
  await product.save();
  res.json({ product });
});

router.put('/:id/stock', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const { quantity, reason, type = 'adjustment' } = req.body;
  const product = await Product.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  const qty = parseInt(quantity);
  product.stock += qty;
  if (product.stock < 0) product.stock = 0;
  await product.save();

  await InventoryMovement.create({
    id: uuidv4(),
    tenant_id: tenantId,
    product_id: product.id,
    product_name: product.name,
    type: qty > 0 ? 'in' : 'out',
    quantity: Math.abs(qty),
    reason: reason || (qty > 0 ? 'Ajuste manual - entrada' : 'Ajuste manual - salida'),
    user_id: req.user.id,
    user_name: req.user.name,
  });

  res.json({ product });
});

router.delete('/:id', authorize(['owner']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const product = await Product.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  await product.destroy();
  res.json({ message: 'Producto eliminado' });
});

export default router;