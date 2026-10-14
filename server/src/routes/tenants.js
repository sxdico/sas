
import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Tenant, User, sequelize, Product, RepairOrder, Sale } from '../models.js';
import { authMiddleware, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.use(authorize(['super_admin']));

const PLAN_CONFIG = {
  trial: { label: 'Prueba 7 días', price: 0, max_users: 2, days: 7 },
  basic: { label: 'Básico $299', price: 299, max_users: 4, days: 30 },
  pro: { label: 'Pro $399', price: 399, max_users: 10, days: 30 },
  premium: { label: 'Premium $499', price: 499, max_users: 9999, days: 30 },
  starter: { label: 'Starter', price: 299, max_users: 4, days: 30 },
  enterprise: { label: 'Enterprise', price: 499, max_users: 9999, days: 30 },
};

const getPlanData = (plan) => {
  return PLAN_CONFIG[plan] || PLAN_CONFIG.basic;
};

router.get('/', async (_req, res) => {
  try {
    const tenants = await Tenant.findAll({ order: [['created_at', 'DESC']] });
    const enriched = tenants.map(t => {
      const json = t.toJSON();
      try {
        if (json.plan_expires_at) {
          const exp = new Date(json.plan_expires_at);
          const now = new Date();
          const diff = Math.ceil((exp - now) / (1000*60*60*24));
          json.days_left = diff;
          json.is_expired = diff < 0;
          json.is_expiring = diff >=0 && diff <= 5;
        } else {
          json.days_left = null;
          json.is_expired = false;
          json.is_expiring = false;
        }
      } catch { json.days_left = null; json.is_expired = false; }
      return json;
    });
    res.json({ tenants: enriched });
  } catch (err) {
    console.error('ERROR GET tenants:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { name_taller, name_dueno, email, phone, plan, custom_days } = req.body;
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
    const selectedPlan = plan || 'basic';
    const planData = getPlanData(selectedPlan);
    const days = custom_days ? parseInt(custom_days) : planData.days;
    
    const rawPassword = crypto.randomBytes(9).toString('base64').slice(0, 12);
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const tenantId = uuidv4();
    
    const startedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const tenant = await Tenant.create({
      id: tenantId, 
      name_taller, 
      name_dueno, 
      email, 
      phone,
      plan: selectedPlan, 
      max_users: planData.max_users,
      plan_price: planData.price,
      plan_started_at: startedAt,
      plan_expires_at: expiresAt,
      billing_cycle: 'monthly',
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
    res.status(201).json({
      tenant: { 
        id: tenant.id, 
        name_taller: tenant.name_taller, 
        status: tenant.status,
        plan: tenant.plan,
        max_users: tenant.max_users,
        plan_expires_at: tenant.plan_expires_at
      },
      credentials: { email, password: rawPassword },
    });
  } catch (err) {
    await t.rollback();
    console.error('>>> ERROR CREANDO TENANT:', err);
    res.status(500).json({ error: err.message });
  }
});

// RENOVAR / CAMBIAR PLAN - FIX SIN TRANSACCIÓN COMPLEJA
router.put('/:id/renew', async (req, res) => {
  try {
    console.log('Renew body:', req.body, 'id:', req.params.id);
    const { plan, add_days, custom_price } = req.body;
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Taller no encontrado' });
    }

    const selectedPlan = plan || tenant.plan || 'basic';
    const planData = getPlanData(selectedPlan);
    const daysToAdd = add_days ? parseInt(add_days) : (planData.days || 30);

    let baseDate = new Date();
    if (tenant.plan_expires_at) {
      const currentExp = new Date(tenant.plan_expires_at);
      if (!isNaN(currentExp.getTime()) && currentExp > new Date()) {
        baseDate = currentExp;
      }
    }
    baseDate.setDate(baseDate.getDate() + daysToAdd);

    tenant.plan = selectedPlan;
    tenant.max_users = planData.max_users;
    // custom_price puede venir vacío
    if (custom_price !== undefined && custom_price !== '' && !isNaN(parseFloat(custom_price))) {
      tenant.plan_price = parseFloat(custom_price);
    } else {
      tenant.plan_price = planData.price;
    }
    tenant.plan_expires_at = baseDate;
    if (!tenant.plan_started_at) tenant.plan_started_at = new Date();
    tenant.status = 'active';
    
    await tenant.save();
    
    // Reactivar usuarios - sin transacción para evitar deadlock
    try {
      await User.update({ active: true }, { where: { tenant_id: tenant.id } });
    } catch (e) {
      console.error('Error reactivando usuarios:', e.message);
    }

    console.log('Plan renovado:', tenant.id, selectedPlan, baseDate);
    res.json({ 
      tenant: {
        id: tenant.id,
        plan: tenant.plan,
        max_users: tenant.max_users,
        plan_price: tenant.plan_price,
        plan_expires_at: tenant.plan_expires_at,
        status: tenant.status
      },
      message: `Plan ${selectedPlan} renovado por ${daysToAdd} días`
    });
  } catch (err) {
    console.error('ERROR renew:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

router.put('/:id/suspend', async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Taller no encontrado' });
    tenant.status = 'suspended';
    await tenant.save();
    await User.update({ active: false }, { where: { tenant_id: tenant.id } });
    res.json({ tenant: { id: tenant.id, status: tenant.status } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/reactivate', async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Taller no encontrado' });
    if (tenant.plan_expires_at && new Date(tenant.plan_expires_at) < new Date()) {
      return res.status(400).json({ error: 'Licencia vencida. Usa Renovar plan.' });
    }
    tenant.status = 'active';
    await tenant.save();
    await User.update({ active: true }, { where: { tenant_id: tenant.id } });
    res.json({ tenant: { id: tenant.id, status: tenant.status } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/users', async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Taller no encontrado' });
    const users = await User.findAll({
      where: { tenant_id: tenant.id },
      attributes: ['id','name','email','phone','role','active','created_at'],
      order: [['created_at','DESC']]
    });
    res.json({ users, tenant: { id: tenant.id, name_taller: tenant.name_taller, max_users: tenant.max_users, plan: tenant.plan } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:userId/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    const user = await User.findByPk(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const rawPassword = newPassword && newPassword.length >= 6 ? newPassword : crypto.randomBytes(9).toString('base64').slice(0, 12);
    const hash = await bcrypt.hash(rawPassword, 10);
    user.password_hash = hash;
    await user.save();
    res.json({ user: { id: user.id, email: user.email, name: user.name }, credentials: { email: user.email, password: rawPassword } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const tenant = await Tenant.findByPk(req.params.id, { transaction: t });
    if (!tenant) { await t.rollback(); return res.status(404).json({ error: 'Taller no encontrado' }); }
    try { await Sale.destroy({ where: { tenant_id: tenant.id }, transaction: t }); } catch {}
    try { await RepairOrder.destroy({ where: { tenant_id: tenant.id }, transaction: t }); } catch {}
    try { await Product.destroy({ where: { tenant_id: tenant.id }, transaction: t }); } catch {}
    await User.destroy({ where: { tenant_id: tenant.id }, transaction: t });
    await Tenant.destroy({ where: { id: tenant.id }, transaction: t });
    await t.commit();
    res.json({ message: `Taller ${tenant.name_taller} eliminado` });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
});

export default router;
