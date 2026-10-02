import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Tenant, User } from '../models.js';
import { authMiddleware, authorize } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren super_admin
router.use(authMiddleware);
router.use(authorize(['super_admin']));

// GET /api/tenants — lista todos los talleres
router.get('/', async (_req, res) => {
  const tenants = await Tenant.findAll({ order: [['created_at', 'DESC']] });
  res.json({ tenants });
});

// POST /api/tenants — crear taller + owner con password aleatoria
router.post('/', async (req, res) => {
  const { name_taller, name_dueño, email, phone, plan } = req.body;
  if (!name_taller || !name_dueño || !email || !phone) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  // Genera password aleatoria de 12 caracteres
  const rawPassword = crypto.randomBytes(9).toString('base64').slice(0, 12);
  const passwordHash = await bcrypt.hash(rawPassword, 10);
  const tenantId = uuidv4();

  const tenant = await Tenant.create({
    id: tenantId,
    name_taller,
    name_dueño,
    email,
    phone,
    plan: plan || 'starter',
    status: 'active',
  });

  // Crea el usuario owner vinculado al tenant
  await User.create({
    id: uuidv4(),
    tenant_id: tenantId,
    name: name_dueño,
    email,
    phone,
    password_hash: passwordHash,
    role: 'owner',
    active: true,
  });

  // Retorna la contraseña UNA SOLA VEZ
  res.status(201).json({
    tenant: { id: tenant.id, name_taller: tenant.name_taller, status: tenant.status },
    credentials: {
      email,
      password: rawPassword, // Se muestra solo esta vez
      message: 'Guarda esta contraseña. No se volverá a mostrar.',
    },
  });
});

// PUT /api/tenants/:id/suspend — suspender licencia
router.put('/:id/suspend', async (req, res) => {
  const tenant = await Tenant.findByPk(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Taller no encontrado' });
  tenant.status = 'suspended';
  await tenant.save();
  // Desactivar todos los usuarios del tenant
  await User.update({ active: false }, { where: { tenant_id: tenant.id } });
  res.json({ tenant: { id: tenant.id, status: tenant.status } });
});

// PUT /api/tenants/:id/reactivate — reactivar licencia
router.put('/:id/reactivate', async (req, res) => {
  const tenant = await Tenant.findByPk(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Taller no encontrado' });
  tenant.status = 'active';
  await tenant.save();
  await User.update({ active: true }, { where: { tenant_id: tenant.id } });
  res.json({ tenant: { id: tenant.id, status: tenant.status } });
});

// DELETE /api/tenants/:id — eliminar taller (soft: suspender)
router.delete('/:id', async (req, res) => {
  const tenant = await Tenant.findByPk(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Taller no encontrado' });
  tenant.status = 'suspended';
  await tenant.save();
  await User.update({ active: false }, { where: { tenant_id: tenant.id } });
  res.json({ message: 'Taller suspendido' });
});

export default router;
