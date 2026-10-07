import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RepairOrder, OrderPart, Product } from '../models.js';
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
  const {
    customer_name, customer_phone, device_type, device_brand,
    device_model, problem_description, advance_payment, lock_type,
    warranty_value, warranty_unit, total, cost_labor
  } = req.body;

  if (!customer_name || !device_brand) {
    return res.status(400).json({ error: 'Cliente y marca son requeridos' });
  }

  const t = await sequelize.transaction();
  try {
    const count = await RepairOrder.count({ where: { tenant_id: tenantId }, transaction: t });
    const folio = `RP-${String(count + 1).padStart(3, '0')}`;

    const order = await RepairOrder.create({
      id: uuidv4(), tenant_id: tenantId, folio,
      customer_name, customer_phone, device_type: device_type || 'Smartphone',
      device_brand, device_model, problem_description,
      status: 'por_revisar', technician_id: req.user.id,
      technician_name: req.user.name,
      cost_parts: 0,
      cost_labor: cost_labor || total || 0,
      total: total || 0,
      advance_payment: advance_payment || 0,
      lock_type: lock_type || 'Sin bloqueo',
      warranty_value: warranty_value || 10,
      warranty_unit: warranty_unit || 'Días',
    }, { transaction: t });

    await t.commit();
    // Regresamos solo la orden, la venta se hará en POS
    res.status(201).json({ order });

  } catch (err) {
    await t.rollback();
    console.error('ERROR CREANDO ORDEN:', err);
    res.status(500).json({ error: 'Error al crear orden', detail: err.message });
  }
});

router.put('/:id', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const order = await RepairOrder.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  const fields = ['customer_name','customer_phone','device_type','device_brand','device_model','problem_description','diagnostic','private_notes','cost_labor','total','advance_payment','lock_type','warranty_value','warranty_unit'];
  fields.forEach((f) => { if (req.body[f]!== undefined) order[f] = req.body[f]; });
  if (req.body.total === undefined) order.total = parseFloat(order.cost_parts) + parseFloat(order.cost_labor);
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
    if (req.body.status === 'listo' && !order.ready_at) order.ready_at = new Date();
    if (req.body.status === 'entregado' && !order.delivered_at) {
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