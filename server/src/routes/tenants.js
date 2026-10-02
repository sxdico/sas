import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Tenant, User, sequelize } from '../models.js';
import { authMiddleware, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.use(authorize(['super_admin']));

router.get('/', async (_req, res) => {
  try {
    const tenants = await Tenant.findAll({ order: [['created_at', 'DESC']] });
    res.json({ tenants });
  } catch (err) {
    console.error('ERROR GET tenants:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { name_taller, name_dueno, email, phone, plan } = req.body;
    console.log('>>> Creando taller:', req.body);

    if (!name_taller || !name_dueno || !email || !phone) {
      await t.rollback();
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Verifica duplicados en AMBAS tablas
    const existsTenant = await Tenant.findOne({ where: { email }, transaction: t });
    const existsUser = await User.findOne({ where: { email }, transaction: t });
    
    if (existsTenant || existsUser) {
      await t.rollback();
      return res.status(400).json({ error: `El email ${email} ya está en uso` });
    }

    const rawPassword = crypto.randomBytes(9).toString('base64').slice(0, 12);
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const tenantId = uuidv4();

    const tenant = await Tenant.create({
      id: tenantId,
      name_taller,
      name_dueno,
      email,
      phone,
      plan: plan || 'starter',
      status: 'active',
    }, { transaction: t });

    await User.create({
      id: uuidv4(),
      tenant_id: tenantId,
      name: name_dueno,
      email,
      phone,
      password_hash: passwordHash,
      role: 'owner',
      active: true,
    }, { transaction: t });

    await t.commit();
    console.log('>>> Tenant creado OK:', tenant.id);

    res.status(201).json({
      tenant: { id: tenant.id, name_taller: tenant.name_taller, status: tenant.status },
      credentials: {
        email,
        password: rawPassword,
        message: 'Guarda esta contraseña. No se volverá a mostrar.',
      },
    });
  } catch (err) {
    await t.rollback();
    console.error('>>> ERROR CREANDO TENANT:', err.message);
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/suspend', async (req, res) => {
  const tenant = await Tenant.findByPk(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Taller no encontrado' });
  tenant.status = 'suspended';
  await tenant.save();
  await User.update({ active: false }, { where: { tenant_id: tenant.id } });
  res.json({ tenant: { id: tenant.id, status: tenant.status } });
});

router.put('/:id/reactivate', async (req, res) => {
  const tenant = await Tenant.findByPk(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Taller no encontrado' });
  tenant.status = 'active';
  await tenant.save();
  await User.update({ active: true }, { where: { tenant_id: tenant.id } });
  res.json({ tenant: { id: tenant.id, status: tenant.status } });
});

router.delete('/:id', async (req, res) => {
  const tenant = await Tenant.findByPk(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Taller no encontrado' });
  tenant.status = 'suspended';
  await tenant.save();
  await User.update({ active: false }, { where: { tenant_id: tenant.id } });
  res.json({ message: 'Taller suspendido' });
});

export default router;