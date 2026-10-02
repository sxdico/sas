import jwt from 'jsonwebtoken';
import { User } from './models.js';

/**
 * Extrae y verifica el JWT del header Authorization.
 * Pega req.user con { id, tenant_id, role, name, email }.
 */
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
    });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuario inválido o inactivo' });
    }
    // Verifica que el tenant esté activo (excepto super_admin)
    if (user.role !== 'super_admin' && user.tenant_id) {
      const tenant = await user.getTenant?.();
      if (tenant && tenant.status === 'suspended') {
        return res.status(403).json({ error: 'Licencia suspendada' });
      }
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

/**
 * Middleware de autorización granular por roles.
 * @param {string[]} roles - Roles permitidos para la ruta.
 *
 * Ejemplo:
 *   router.put('/orders/:id/status', authorize(['owner','technician']), handler)
 *   router.post('/sales', authorize(['owner','secretary','cashier','technician']), handler)
 *   router.get('/deliveries-ready', authorize(['owner','secretary','cashier']), handler)
 *   router.use('/users', authorize(['owner']), userRouter)
 */
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

/**
 * Helper para obtener el tenant_id del usuario actual.
 * Lanza error 403 si no tiene tenant (no es super_admin intentando
 * acceder a datos de tenant).
 */
export function requireTenantId(req, res) {
  if (!req.user.tenant_id) {
    res.status(403).json({ error: 'Super Admin no tiene taller asignado' });
    return null;
  }
  return req.user.tenant_id;
}
