import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Product, Category, Supplier, InventoryMovement } from '../models.js';
import { authMiddleware, authorize, requireTenantId } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET /api/products — listar productos del tenant
router.get('/', authorize(['owner', 'technician', 'secretary', 'cashier']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const { search, category_id } = req.query;
  const where = { tenant_id: tenantId };
  if (category_id && category_id !== 'all') where.category_id = category_id;
  if (search) {
    where[Symbol.for('or')] = [
      { name: { [Symbol.for('like')]: `%${search}%` } },
      { sku: { [Symbol.for('like')]: `%${search}%` } },
      { barcode: { [Symbol.for('like')]: `%${search}%` } },
    ];
  }
  const products = await Product.findAll({ where, order: [['name', 'ASC']] });
  res.json({ products });
});

// GET /api/products/low-stock — alertas de stock bajo
router.get('/low-stock', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const products = await Product.findAll({ where: { tenant_id: tenantId } });
  const lowStock = products.filter((p) => p.stock <= p.min_stock);
  res.json({ products: lowStock });
});

// GET /api/products/:id
router.get('/:id', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const product = await Product.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json({ product });
});

// POST /api/products
router.post('/', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const {
    sku, barcode, name, description, category_id,
    cost_price, sale_price, wholesale_price, stock, min_stock,
  } = req.body;
  if (!sku || !name) {
    return res.status(400).json({ error: 'SKU y nombre son requeridos' });
  }
  const product = await Product.create({
    id: uuidv4(), tenant_id: tenantId, sku, barcode, name, description,
    category_id, cost_price: cost_price || 0, sale_price: sale_price || 0,
    wholesale_price: wholesale_price || 0, stock: stock || 0,
    min_stock: min_stock || 5, favorite: false,
  });
  // Si hay stock inicial, registrar movimiento
  if (stock && stock > 0) {
    await InventoryMovement.create({
      id: uuidv4(), tenant_id: tenantId, product_id: product.id,
      type: 'in', quantity: stock, reason: 'Stock inicial',
      user_id: req.user.id, user_name: req.user.name,
    });
  }
  res.status(201).json({ product });
});

// PUT /api/products/:id
router.put('/:id', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const product = await Product.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  const fields = [
    'sku', 'barcode', 'name', 'description', 'category_id',
    'cost_price', 'sale_price', 'wholesale_price', 'min_stock', 'favorite', 'hotkey',
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) product[f] = req.body[f];
  });
  await product.save();
  res.json({ product });
});

// PUT /api/products/:id/stock — ajustar stock (crea movimiento)
router.put('/:id/stock', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const { quantity, reason, type = 'adjustment' } = req.body;
  const product = await Product.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  product.stock += parseInt(quantity);
  if (product.stock < 0) product.stock = 0;
  await product.save();
  await InventoryMovement.create({
    id: uuidv4(), tenant_id: tenantId, product_id: product.id,
    type, quantity: Math.abs(parseInt(quantity)), reason: reason || 'Ajuste manual',
    user_id: req.user.id, user_name: req.user.name,
  });
  res.json({ product });
});

// DELETE /api/products/:id — solo owner
router.delete('/:id', authorize(['owner']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const product = await Product.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  await product.destroy();
  res.json({ message: 'Producto eliminado' });
});

// GET /api/products/:id/movements — kardex
router.get('/:id/movements', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const movements = await InventoryMovement.findAll({
    where: { product_id: req.params.id, tenant_id: tenantId },
    order: [['created_at', 'DESC']],
  });
  res.json({ movements });
});

// ===== CATEGORIES =====
router.get('/categories/all', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const categories = await Category.findAll({ where: { tenant_id: tenantId } });
  res.json({ categories });
});

router.post('/categories', authorize(['owner']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const { name, color, icon } = req.body;
  const category = await Category.create({
    id: uuidv4(), tenant_id: tenantId,
    name, color: color || '#3b82f6', icon: icon || 'Package',
  });
  res.status(201).json({ category });
});

export default router;
