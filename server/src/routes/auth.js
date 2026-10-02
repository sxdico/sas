import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Tenant } from '../models.js';
import { authMiddleware, authorize } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }
  const user = await User.findOne({ where: { email: email.toLowerCase() }, include: [{ model: Tenant }] });
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  // Verifica tenant activo (excepto super_admin)
  if (user.role !== 'super_admin' && user.Tenant && user.Tenant.status === 'suspended') {
    return res.status(403).json({ error: 'Licencia suspendada. Contacta al administrador.' });
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
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
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

export default router;
