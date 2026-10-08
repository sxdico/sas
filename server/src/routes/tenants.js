import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Tenant, User, sequelize, Product, RepairOrder, Sale } from '../models.js';
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
    if (!name_taller || !name_dueno || !email || !phone) {
      await t.rollback();
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
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
      id: tenantId, name_taller, name_dueno, email, phone,
      plan: plan || 'starter', status: 'active',
    }, { transaction: t });
    await User.create({
      id: uuidv4(), tenant_id: tenantId, name: name_dueno, email, phone,
      password_hash: passwordHash, role: 'owner', active: true,
    }, { transaction: t });
    await t.commit();
    res.status(201).json({
      tenant: { id: tenant.id, name_taller: tenant.name_taller, status: tenant.status },
      credentials: { email, password: rawPassword, message: 'Guarda esta contraseña. No se volverá a mostrar.' },
    });
  } catch (err) {
    await t.rollback();
    console.error('>>> ERROR CREANDO TENANT:', err.message);
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

// LISTAR USUARIOS DE UN TALLER (para super_admin)
router.get('/:id/users', async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Taller no encontrado' });
    const users = await User.findAll({
      where: { tenant_id: tenant.id },
      attributes: ['id','name','email','phone','role','active','created_at'],
      order: [['created_at','DESC']]
    });
    res.json({ users, tenant: { id: tenant.id, name_taller: tenant.name_taller } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RESETEAR PASSWORD DE CUALQUIER USUARIO (super_admin)
router.put('/users/:userId/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body; // opcional, si no viene genera una
    const user = await User.findByPk(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    const rawPassword = newPassword && newPassword.length >= 6 
      ? newPassword 
      : crypto.randomBytes(9).toString('base64').slice(0, 12);
    
    const hash = await bcrypt.hash(rawPassword, 10);
    user.password_hash = hash;
    await user.save();

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      credentials: { email: user.email, password: rawPassword }
    });
  } catch (err) {
    console.error('ERROR reset-password:', err);
    res.status(500).json({ error: err.message });
  }
});

// ELIMINACION REAL DEL TALLER
router.delete('/:id', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const tenant = await Tenant.findByPk(req.params.id, { transaction: t });
    if (!tenant) {
      await t.rollback();
      return res.status(404).json({ error: 'Taller no encontrado' });
    }

    // Borra en orden por FKs (si tienes cascade, esto no hace daño)
    // Intenta borrar tablas hijas si existen
    try { await Sale.destroy({ where: { tenant_id: tenant.id }, transaction: t }); } catch {}
    try { await RepairOrder.destroy({ where: { tenant_id: tenant.id }, transaction: t }); } catch {}
    try { await Product.destroy({ where: { tenant_id: tenant.id }, transaction: t }); } catch {}
    await User.destroy({ where: { tenant_id: tenant.id }, transaction: t });
    await Tenant.destroy({ where: { id: tenant.id }, transaction: t });

    await t.commit();
    res.json({ message: `Taller ${tenant.name_taller} eliminado definitivamente` });
  } catch (err) {
    await t.rollback();
    console.error('ERROR DELETE tenant:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;