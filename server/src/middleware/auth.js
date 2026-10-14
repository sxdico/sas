import jwt from 'jsonwebtoken';
import { User, Tenant } from '../models.js';

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'tenant_id', 'name', 'email', 'role', 'active'],
      include: [{ model: Tenant }]
    });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuario inválido o inactivo' });
    }

    // Info de licencia
    if (user.Tenant && user.Tenant.plan_expires_at && user.role !== 'super_admin') {
      const exp = new Date(user.Tenant.plan_expires_at);
      const now = new Date();
      if (exp < now) {
        req.licenseExpired = true;
        req.licenseInfo = { expired: true, days_overdue: Math.ceil((now - exp)/(1000*60*60*24)), expired_at: user.Tenant.plan_expires_at };
      }
    }

    // Bloqueo solo si está suspendido manualmente
    if (user.role !== 'super_admin' && user.Tenant && user.Tenant.status === 'suspended') {
      return res.status(403).json({ error: 'Licencia suspendida', code: 'SUSPENDED' });
    }

    req.user = {
      id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
      name: user.name,
      email: user.email,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function authorize(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }
    next();
  };
}

export function requireTenantId(req, res) {
  if (!req.user.tenant_id) {
    res.status(403).json({ error: 'Super Admin no tiene taller asignado' });
    return null;
  }
  return req.user.tenant_id;
}

// Bloquea escritura si licencia vencida, permite lectura
export function blockIfLicenseExpired(req, res, next) {
  if (req.user.role === 'super_admin') return next();
  if (!req.licenseExpired) return next();
  
  // Permite GET (ver órdenes)
  if (req.method === 'GET') {
    return next();
  }
  
  // Bloquea POST, PUT, DELETE
  return res.status(403).json({ 
    error: 'Licencia vencida. Solo lectura permitida. Contacta a soporte para renovar.',
    code: 'LICENSE_EXPIRED',
    licenseExpired: true
  });
}
