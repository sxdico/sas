import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RepairOrder, OrderPart, Product, Sale, SaleItem } from '../models.js';
import { sequelize } from '../models.js';
import { authMiddleware, authorize, requireTenantId } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const orders = await RepairOrder.findAll({
    where: { tenant_id: tenantId },
    include: [{ model: OrderPart, as: 'OrderParts' }],
    order: [['created_at', 'DESC']],
  });
  res.json({ orders });
});

router.post('/', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  try {
    const folio = `RP-${Date.now().toString().slice(-6)}`;
    const order = await RepairOrder.create({
      id: uuidv4(), tenant_id: tenantId, folio,
      customer_name: req.body.customer_name,
      customer_phone: req.body.customer_phone,
      device_type: req.body.device_type || 'Smartphone',
      device_brand: req.body.device_brand,
      device_model: req.body.device_model,
      problem_description: req.body.problem_description,
      status: 'por_revisar',
      technician_id: req.user.id,
      technician_name: req.user.name,
      cost_parts: 0,
      cost_labor: req.body.cost_labor || req.body.total || 0,
      total: req.body.total || 0,
      advance_payment: req.body.advance_payment || 0,
      lock_type: req.body.lock_type || 'Sin bloqueo',
      warranty_value: req.body.warranty_value || 10,
      warranty_unit: req.body.warranty_unit || 'Días',
    });
    res.status(201).json({ order });
  } catch (err) {
    console.error('ERROR CREANDO ORDEN:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const order = await RepairOrder.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  const fields = ['customer_name','customer_phone','device_type','device_brand','device_model','problem_description','diagnostic','private_notes','cost_labor','total','advance_payment','lock_type','warranty_value','warranty_unit'];
  fields.forEach((f) => { if (req.body[f]!== undefined) order[f] = req.body[f]; });
  await order.save();
  res.json({ order });
});

// LIQUIDAR RESTO - COBRA EL RESTO Y MARCA COMO PAGADO + CREA VENTA PARA CORTE
router.post('/:id/liquidate', authorize(['owner','technician','cashier']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const { payment_method } = req.body;
  const order = await RepairOrder.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

  const total = parseFloat(order.total || 0);
  const advance = parseFloat(order.advance_payment || 0);
  const resto = total - advance;

  if (resto <= 0) return res.status(400).json({ error: 'Esta orden ya está pagada' });

  const t = await sequelize.transaction();
  try {
    // Crear venta para el corte de caja
    const count = await Sale.count({ where: { tenant_id: tenantId }, transaction: t });
    const folio = `V-${String(count + 1).padStart(3, '0')}`;

    const sale = await Sale.create({
      id: uuidv4(),
      tenant_id: tenantId,
      folio,
      subtotal: resto,
      discount: 0,
      total: resto,
      payment_method: payment_method || 'efectivo',
      cash_received: resto,
      change: 0,
      customer_id: null,
      customer_name: order.customer_name,
      user_id: req.user.id,
      user_name: req.user.name,
      status: 'completed'
    }, { transaction: t });

    // Producto anticipo/liquidacion para no afectar stock real
    let anticipoProd = await Product.findOne({ where: { tenant_id: tenantId, sku: 'ANTICIPO' }, transaction: t });
    if (!anticipoProd) {
      anticipoProd = await Product.create({
        id: uuidv4(),
        tenant_id: tenantId,
        sku: 'ANTICIPO',
        name: 'Anticipo Orden Reparacion',
        sale_price: resto,
        cost_price: 0,
        stock: 999999,
        min_stock: 0,
      }, { transaction: t });
    }

    await SaleItem.create({
      id: uuidv4(),
      tenant_id: tenantId,
      sale_id: sale.id,
      product_id: anticipoProd.id,
      name: `Liquidación Orden ${order.folio} - ${order.customer_name}`,
      price: resto,
      quantity: 1,
      discount: 0,
    }, { transaction: t });

    // Actualizar orden como pagada
    order.advance_payment = total;
    await order.save({ transaction: t });

    await t.commit();
    res.json({ order, sale });
  } catch (err) {
    await t.rollback();
    console.error('ERROR LIQUIDANDO:', err);
    res.status(500).json({ error: err.message });
  }
});

// ENDPOINT PARA LIQUIDAR VIA POS (solo actualiza la orden después de cobrar en POS)
router.put('/:id/mark-paid', authorize(['owner','technician','cashier']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const order = await RepairOrder.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  order.advance_payment = order.total;
  await order.save();
  res.json({ order });
});

router.put('/:id/status', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const order = await RepairOrder.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  const t = await sequelize.transaction();
  try {
    order.status = req.body.status;
    if (req.body.status === 'listo' &&!order.ready_at) order.ready_at = new Date();
    if (req.body.status === 'entregado' &&!order.delivered_at) {
      order.delivered_at = new Date();
      if (order.warranty_value && order.warranty_unit) {
        const entrega = new Date(order.delivered_at);
        if (order.warranty_unit === 'Días') entrega.setDate(entrega.getDate() + parseInt(order.warranty_value));
        else entrega.setMonth(entrega.getMonth() + parseInt(order.warranty_value));
        order.warranty_ends_at = entrega;
      }
    }
    await order.save({ transaction: t });
    await t.commit();
    res.json({ order });
  } catch (err) { await t.rollback(); res.status(500).json({ error: err.message }); }
});

router.post('/:id/parts', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const { product_id, quantity } = req.body;
  const order = await RepairOrder.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  const product = await Product.findOne({ where: { id: product_id, tenant_id: tenantId } });
  if (!product || product.stock < quantity) return res.status(400).json({ error: 'Stock insuficiente' });
  const t = await sequelize.transaction();
  try {
    product.stock -= quantity; await product.save({ transaction: t });
    const part = await OrderPart.create({ id: uuidv4(), tenant_id: tenantId, order_id: order.id, product_id, product_name: product.name, quantity, unit_cost: product.cost_price }, { transaction: t });
    order.cost_parts = parseFloat(order.cost_parts) + (product.cost_price * quantity);
    order.total = parseFloat(order.total || 0) + (product.cost_price * quantity);
    await order.save({ transaction: t });
    await t.commit();
    res.status(201).json({ part, order });
  } catch (err) { await t.rollback(); res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authorize(['owner']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const order = await RepairOrder.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  await order.destroy();
  res.json({ message: 'Orden eliminada' });
});

export default router;
