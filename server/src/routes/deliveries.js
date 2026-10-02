import { Router } from 'express';
import { RepairOrder } from '../models.js';
import { authMiddleware, authorize, requireTenantId } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET /api/deliveries/ready — solo órdenes con status='listo'
// Visible para owner, secretary, cashier
router.get('/ready', authorize(['owner', 'secretary', 'cashier']), async (req, res) => {
  try {
    const tenantId = requireTenantId(req, res);
    if (!tenantId) return;

    const orders = await RepairOrder.findAll({
      where: { tenant_id: tenantId, status: 'listo' },
      attributes: [
        'id',
        'folio',
        'customer_name',
        'customer_phone',
        'device_brand',
        'device_model',
        'total',
        'ready_at',
        'status'
      ],
      order: [['ready_at', 'DESC']],
    });

    res.json({ orders });
  } catch (err) {
    console.error('ERROR GET /deliveries/ready:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/deliveries/:id/deliver — marcar como entregado
router.put('/:id/deliver', authorize(['owner', 'secretary', 'cashier']), async (req, res) => {
  try {
    const tenantId = requireTenantId(req, res);
    if (!tenantId) return;

    const order = await RepairOrder.findOne({
      where: { id: req.params.id, tenant_id: tenantId, status: 'listo' },
    });

    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada o no está lista' });
    }

    order.status = 'entregado';
    order.delivered_at = new Date();
    await order.save();

    res.json({ 
      order: { 
        id: order.id, 
        status: order.status, 
        delivered_at: order.delivered_at 
      } 
    });
  } catch (err) {
    console.error('ERROR PUT /deliveries/:id/deliver:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;