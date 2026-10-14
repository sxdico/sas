import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Tenant } from '../models.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }
  const user = await User.findOne({ where: { email: email.toLowerCase() }, include: [{ model: Tenant }] });
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  // ===== LICENCIA =====
  let licenseInfo = null;
  
  if (user.role !== 'super_admin' && user.Tenant) {
    const tenant = user.Tenant;
    
    // Suspendido manual -> bloqueo total
    if (tenant.status === 'suspended') {
      return res.status(403).json({ error: 'Licencia suspendida. Contacta al administrador.', code: 'SUSPENDED' });
    }

    if (tenant.plan_expires_at) {
      const exp = new Date(tenant.plan_expires_at);
      const now = new Date();
      
      if (exp < now) {
        const diffDays = Math.ceil((now.getTime() - exp.getTime()) / (1000*60*60*24));
        if (tenant.status !== 'expired') {
          try { tenant.status = 'expired'; await tenant.save(); } catch {}
        }
        licenseInfo = {
          expired: true,
          expired_at: tenant.plan_expires_at,
          days_overdue: diffDays,
          message: `Licencia vencida hace ${diffDays} día${diffDays>1?'s':''}. Solo lectura. Contacta a soporte para renovar.`,
          plan: tenant.plan,
          max_users: tenant.max_users,
          plan_price: tenant.plan_price
        };
      } else {
        const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000*60*60*24));
        if (diff <= 5) {
          licenseInfo = {
            expired: false,
            expiring: true,
            expired_at: tenant.plan_expires_at,
            days_left: diff,
            message: `Tu licencia vence en ${diff} día${diff>1?'s':''}. Renueva pronto.`,
            plan: tenant.plan
          };
        }
      }
    }
  }

  const token = jwt.sign(
    { id: user.id, tenant_id: user.tenant_id, role: user.role },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      tenant_id: user.tenant_id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    license: licenseInfo
  });
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    let licenseInfo = null;
    if (req.user.role !== 'super_admin' && req.user.tenant_id) {
      const tenant = await Tenant.findByPk(req.user.tenant_id);
      if (tenant && tenant.plan_expires_at) {
        const exp = new Date(tenant.plan_expires_at);
        const now = new Date();
        if (exp < now) {
          const diffDays = Math.ceil((now.getTime() - exp.getTime()) / (1000*60*60*24));
          licenseInfo = { expired: true, days_overdue: diffDays, expired_at: tenant.plan_expires_at, message: `Licencia vencida hace ${diffDays} días` };
        } else {
          const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000*60*60*24));
          if (diff <=5) licenseInfo = { expired: false, expiring: true, days_left: diff, expired_at: tenant.plan_expires_at };
        }
      }
    }
    res.json({ user: req.user, license: licenseInfo });
  } catch {
    res.json({ user: req.user });
  }
});

export default router;
