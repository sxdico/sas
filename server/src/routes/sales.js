import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Sale, SaleItem, Product, Customer, InventoryMovement } from '../models.js';
import { sequelize } from '../models.js';
import { authMiddleware, authorize, requireTenantId } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// POST /api/sales — crear venta (transacción: descuenta stock + crea movimientos)
router.post('/', authorize(['owner', 'secretary', 'cashier', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const { items, payment_method, cash_received, customer_id, discount } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'La venta debe tener al menos un producto' });
  }
  const validMethods = ['efectivo', 'tarjeta', 'transferencia', 'credito'];
  if (!validMethods.includes(payment_method)) {
    return res.status(400).json({ error: 'Método de pago inválido' });
  }

  // Venta a crédito requiere cliente
  if (payment_method === 'credito' && !customer_id) {
    return res.status(400).json({ error: 'La venta a crédito requiere un cliente' });
  }

  const t = await sequelize.transaction();
  try {
    // Generar folio
    const saleCount = await Sale.count({ where: { tenant_id: tenantId } });
    const folio = `V-${String(saleCount + 1).padStart(3, '0')}`;

    // Calcular subtotal y validar stock
    let subtotal = 0;
    const validatedItems = [];
    for (const item of items) {
      const product = await Product.findOne({
        where: { id: item.product_id, tenant_id: tenantId },
        transaction: t,
      });
      if (!product) {
        await t.rollback();
        return res.status(404).json({ error: `Producto no encontrado: ${item.name}` });
      }
      if (product.stock < item.quantity) {
        await t.rollback();
        return res.status(400).json({ error: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}` });
      }
      const lineTotal = product.sale_price * item.quantity - (item.discount || 0);
      subtotal += lineTotal;
      validatedItems.push({
        product, quantity: item.quantity, discount: item.discount || 0,
        lineTotal,
      });
    }

    const totalDiscount = discount || validatedItems.reduce((s, i) => s + i.discount, 0);
    const total = subtotal - totalDiscount;
    const change = payment_method === 'efectivo'
      ? Math.max(0, parseFloat(cash_received || 0) - total)
      : 0;

    // Crear la venta
    const sale = await Sale.create({
      id: uuidv4(), tenant_id: tenantId, folio,
      subtotal, discount: totalDiscount, total,
      payment_method, cash_received: cash_received || 0, change,
      customer_id: customer_id || null,
      customer_name: null,
      user_id: req.user.id, user_name: req.user.name,
      status: payment_method === 'credito' ? 'credit' : 'completed',
    }, { transaction: t });

    // Crear sale_items, descontar stock y crear movimientos
    for (const vi of validatedItems) {
      await SaleItem.create({
        id: uuidv4(), tenant_id: tenantId, sale_id: sale.id,
        product_id: vi.product.id, name: vi.product.name,
        price: vi.product.sale_price, quantity: vi.quantity,
        discount: vi.discount,
      }, { transaction: t });

      // Descontar stock
      vi.product.stock -= vi.quantity;
      await vi.product.save({ transaction: t });

      // Movimiento de inventario
      await InventoryMovement.create({
        id: uuidv4(), tenant_id: tenantId, product_id: vi.product.id,
        type: 'sale', quantity: vi.quantity,
        reason: `Venta ${folio}`,
        user_id: req.user.id, user_name: req.user.name,
      }, { transaction: t });
    }

    // Si es venta a crédito, actualizar balance del cliente
    if (payment_method === 'credito' && customer_id) {
      const customer = await Customer.findByPk(customer_id, { transaction: t });
      if (customer) {
        customer.credit_balance = parseFloat(customer.credit_balance) + total;
        customer.total_purchases = parseFloat(customer.total_purchases) + total;
        await customer.save({ transaction: t });
        sale.customer_name = customer.name;
        await sale.save({ transaction: t });
      }
    } else if (customer_id) {
      const customer = await Customer.findByPk(customer_id, { transaction: t });
      if (customer) {
        customer.total_purchases = parseFloat(customer.total_purchases) + total;
        await customer.save({ transaction: t });
        sale.customer_name = customer.name;
        await sale.save({ transaction: t });
      }
    }

    await t.commit();
    res.status(201).json({ sale });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: 'Error al procesar venta', detail: err.message });
  }
});

// GET /api/sales — historial
router.get('/', authorize(['owner', 'secretary', 'cashier']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const sales = await Sale.findAll({
    where: { tenant_id: tenantId },
    include: [{ model: SaleItem, as: 'SaleItems' }],
    order: [['created_at', 'DESC']],
  });
  res.json({ sales });
});

// GET /api/sales/:id
router.get('/:id', authorize(['owner', 'secretary', 'cashier']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const sale = await Sale.findOne({
    where: { id: req.params.id, tenant_id: tenantId },
    include: [{ model: SaleItem, as: 'SaleItems' }],
  });
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
  res.json({ sale });
});

export default router;
