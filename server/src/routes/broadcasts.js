import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Tenant, Notification, Broadcast } from '../models.js';
import { authMiddleware, authorize } from '../middleware/auth.js';
import { Op } from 'sequelize';

const router = Router();

router.use(authMiddleware);
router.use(authorize(['super_admin']));

// GET /api/broadcasts - historial
router.get('/', async (req, res) => {
  const broadcasts = await Broadcast.findAll({
    order: [['created_at','DESC']],
    limit: 100,
  });
  res.json({ broadcasts });
});

// GET /api/broadcasts/preview
router.get('/preview', async (req, res) => {
  const { plans = 'all', status = 'active' } = req.query;
  const where = {};
  if (status !== 'all') where.status = status;
  if (plans !== 'all') {
    const planList = String(plans).split(',').map(s=>s.trim());
    where.plan = { [Op.in]: planList };
  }
  const count = await Tenant.count({ where });
  const tenants = await Tenant.findAll({ where, attributes: ['plan'], limit: 1000 });
  const byPlan = tenants.reduce((acc,t)=>{ acc[t.plan]=(acc[t.plan]||0)+1; return acc; }, {});
  res.json({ count, byPlan });
});

// POST /api/broadcasts
router.post('/', async (req, res) => {
  const { title, message, type = 'info', target_plans = 'all', target_roles = 'owner,secretary,cashier,technician', expires_at = null } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'Título y mensaje requeridos' });

  const where = { status: 'active' };
  if (target_plans !== 'all') {
    const planList = String(target_plans).split(',').map(s=>s.trim()).filter(Boolean);
    if (planList.length) where.plan = { [Op.in]: planList };
  }

  const tenants = await Tenant.findAll({ where });
  if (tenants.length === 0) return res.status(400).json({ error: 'No hay talleres que coincidan' });

  const broadcast = await Broadcast.create({
    id: uuidv4(),
    title,
    message,
    type,
    target_plans,
    target_roles,
    tenant_count: tenants.length,
    notification_count: tenants.length,
    expires_at: expires_at || null,
    created_by: req.user.id,
    created_by_name: req.user.name,
  });

  const notificationsToCreate = tenants.map(t => ({
    id: uuidv4(),
    tenant_id: t.id,
    title: `[📢 ${type.toUpperCase()}] ${title}`,
    message,
    type,
    read: false,
    for_roles: target_roles,
  }));

  for (let i=0;i<notificationsToCreate.length;i+=100){
    await Notification.bulkCreate(notificationsToCreate.slice(i,i+100));
  }

  res.json({ success: true, broadcast, sent_to: tenants.length });
});

// DELETE /api/broadcasts/:id - AHORA SÍ BORRA EN MYSQL DE LOS USUARIOS
router.delete('/:id', async (req,res)=>{
  const b = await Broadcast.findByPk(req.params.id);
  if(!b) return res.status(404).json({ error: 'No encontrado' });

  // Construye el título exacto como se guardó en notifications
  const notificationTitle = `[📢 ${b.type.toUpperCase()}] ${b.title}`;

  // Borra todas las notificaciones que creó este broadcast
  // Match por título exacto + mensaje para no borrar otras
  const deleted = await Notification.destroy({
    where: {
      title: notificationTitle,
      message: b.message
    }
  });

  // Fallback: si por algún motivo el título tiene emoji diferente, borra por mensaje + target_roles
  if (deleted === 0) {
    await Notification.destroy({
      where: {
        message: b.message,
        for_roles: b.target_roles
      }
    });
  }

  await b.destroy();

  res.json({ success: true, deleted_notifications: deleted });
});

export default router;
