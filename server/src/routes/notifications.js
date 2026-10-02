import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Notification } from '../models.js';
import { authMiddleware, requireTenantId } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET /api/notifications — del tenant actual, filtradas por rol
router.get('/', async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const all = await Notification.findAll({
    where: { tenant_id: tenantId },
    order: [['created_at', 'DESC']],
    limit: 50,
  });
  // Filtrar por roles del usuario
  const userRole = req.user.role;
  const filtered = all.filter((n) => {
    const roles = n.for_roles.split(',').map((r) => r.trim());
    return roles.includes(userRole);
  });
  res.json({ notifications: filtered });
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const notif = await Notification.findOne({
    where: { id: req.params.id, tenant_id: tenantId },
  });
  if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });
  notif.read = true;
  await notif.save();
  res.json({ notification: notif });
});

export default router;
