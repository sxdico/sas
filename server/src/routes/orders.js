import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RepairOrder, OrderPart, Product, Notification } from '../models.js';
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

router.get('/:id', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const order = await RepairOrder.findOne({
    where: { id: req.params.id, tenant_id: tenantId },
    include: [{ model: OrderPart, as: 'OrderParts' }],
  });
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  res.json({ order });
});

// POST - CREAR CON TOTAL MANUAL
router.post('/', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const {
    customer_name, customer_phone, device_type, device_brand,
    device_model, problem_description, advance_payment, lock_type,
    warranty_value, warranty_unit, total, cost_labor
  } = req.body;
  if (!customer_name ||!device_brand) {
    return res.status(400).json({ error: 'Cliente y marca son requeridos' });
  }
  const count = await RepairOrder.count({ where: { tenant_id: tenantId } });
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
  });
  res.status(201).json({ order });
});

// PUT - EDITAR
router.put('/:id', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const order = await RepairOrder.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  const fields = [
    'customer_name', 'customer_phone', 'device_type', 'device_brand',
    'device_model', 'problem_description', 'diagnostic', 'private_notes',
    'cost_labor', 'total', 'advance_payment', 'lock_type', 'warranty_value', 'warranty_unit'
  ];
  fields.forEach((f) => {
    if (req.body[f]!== undefined) order[f] = req.body[f];
  });
  // Si no mandan total manual, recalcular con refacciones + mano de obra
  if (req.body.total === undefined) {
    order.total = parseFloat(order.cost_parts) + parseFloat(order.cost_labor);
  }
  await order.save();
  res.json({ order });
});

router.put('/:id/status', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const { status } = req.body;
  const validStatuses = ['por_revisar', 'en_reparacion', 'esperando_refaccion', 'listo', 'entregado'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  const order = await RepairOrder.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  const t = await sequelize.transaction();
  try {
    order.status = status;
    if (status === 'listo' &&!order.ready_at) order.ready_at = new Date();
    if (status === 'entregado' &&!order.delivered_at) {
      order.delivered_at = new Date();
      if (order.warranty_value && order.warranty_unit) {
        const entrega = new Date(order.delivered_at);
        if (order.warranty_unit === 'Días') entrega.setDate(entrega.getDate() + parseInt(order.warranty_value));
        else if (order.warranty_unit === 'Meses') entrega.setMonth(entrega.getMonth() + parseInt(order.warranty_value));
        order.warranty_ends_at = entrega;
      }
    }
    await order.save({ transaction: t });
    if (status === 'listo') {
      await Notification.create({
        id: uuidv4(), tenant_id: tenantId,
        title: 'Orden lista para entrega',
        message: `La orden ${order.folio} de ${order.customer_name} (${order.device_brand} ${order.device_model}) está lista.`,
        type: 'success', read: false,
        for_roles: 'owner,secretary,cashier',
      }, { transaction: t });
    }
    await t.commit();
    res.json({ order });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: 'Error al cambiar estado', detail: err.message });
  }
});

router.post('/:id/parts', authorize(['owner', 'technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const { product_id, quantity } = req.body;
  if (!product_id ||!quantity || quantity < 1) {
    return res.status(400).json({ error: 'product_id y quantity son requeridos' });
  }
  const order = await RepairOrder.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  const product = await Product.findOne({ where: { id: product_id, tenant_id: tenantId } });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  if (product.stock < quantity) {
    return res.status(400).json({ error: `Stock insuficiente. Disponible: ${product.stock}` });
  }
  const t = await sequelize.transaction();
  try {
    product.stock -= quantity;
    await product.save({ transaction: t });
    const part = await OrderPart.create({
      id: uuidv4(), tenant_id: tenantId, order_id: order.id,
      product_id, product_name: product.name,
      quantity, unit_cost: product.cost_price,
    }, { transaction: t });
    order.cost_parts = parseFloat(order.cost_parts) + (product.cost_price * quantity);
    // Si el total era 0, lo actualizamos. Si ya tenía un total manual, le sumamos la refacción
    order.total = parseFloat(order.total || 0) + (product.cost_price * quantity);
    if (parseFloat(order.total) === 0) {
      order.total = parseFloat(order.cost_parts) + parseFloat(order.cost_labor);
    }
    await order.save({ transaction: t });
    await t.commit();
    res.status(201).json({ part, order });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: 'Error al agregar refacción', detail: err.message });
  }
});

router.delete('/:id', authorize(['owner']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const order = await RepairOrder.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  await order.destroy();
  res.json({ message: 'Orden eliminada' });
});

export default router