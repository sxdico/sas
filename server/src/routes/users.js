import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models.js';
import { authMiddleware, authorize, requireTenantId } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.use(authorize(['owner']));

router.get('/', async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const users = await User.findAll({
    where: { tenant_id: tenantId },
    attributes: ['id', 'name', 'email', 'phone', 'role', 'active', 'created_at'],
    order: [['created_at', 'DESC']],
  });
  res.json({ users });
});

router.post('/', async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const { name, email, phone, role, password } = req.body;
  const allowedRoles = ['secretary', 'cashier', 'technician'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Solo puedes asignar: secretary, cashier, technician' });
  }
  const existing = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existing) return res.status(409).json({ error: 'Email ya registrado' });
  const rawPassword = password || crypto.randomBytes(8).toString('base64').slice(0, 10);
  const hash = await bcrypt.hash(rawPassword, 10);
  const user = await User.create({
    id: uuidv4(), tenant_id: tenantId, name, email: email.toLowerCase(),
    phone, password_hash: hash, role, active: true,
  });
  res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    password: rawPassword,
  });
});

router.put('/:id/role', async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const { role } = req.body;
  const allowedRoles = ['secretary', 'cashier', 'technician'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Rol no asignable' });
  }
  const user = await User.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (user.role === 'owner') return res.status(400).json({ error: 'No puedes cambiar el rol del owner' });
  user.role = role;
  await user.save();
  res.json({ user: { id: user.id, role: user.role } });
});

router.put('/:id/toggle-active', async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const user = await User.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (user.role === 'owner') return res.status(400).json({ error: 'No puedes desactivar al owner' });
  user.active = !user.active;
  await user.save();
  res.json({ user: { id: user.id, active: user.active } });
});

export default router;
