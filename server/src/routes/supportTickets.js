import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { SupportTicket, SupportTicketComment, Notification, Tenant } from '../models.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'tickets');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `ticket-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// LISTAR - Dueño ve solo los de su taller, super_admin ve todos
router.get('/', authMiddleware, async (req, res) => {
  try {
    const where = req.user.role === 'super_admin' ? {} : { tenant_id: req.user.tenant_id };
    const tickets = await SupportTicket.findAll({
      where,
      order: [['created_at', 'DESC']],
      include: req.user.role === 'super_admin' ? [{ model: Tenant, attributes: ['name_taller', 'plan', 'plan_price'] }] : [],
    });
    // Mapeamos para que el frontend lo lea fácil
    const mapped = tickets.map((t) => {
      const j = t.toJSON();
      return {
        ...j,
        tenant_name: j.Tenant?.name_taller || j.tenant_name || 'Sin taller',
        tenant_plan: j.Tenant?.plan || null,
        tenant_plan_price: j.Tenant?.plan_price || null,
      };
    });
    res.json({ tickets: mapped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CREAR - con captura opcional
router.post('/', authMiddleware, upload.single('captura'), async (req, res) => {
  try {
    const { subject, type, priority, description, include_system_info, system_info } = req.body;
    if (!subject || !description) return res.status(400).json({ error: 'Faltan Asunto y Descripción' });

    const count = await SupportTicket.count({ where: req.user.role === 'super_admin' ? {} : { tenant_id: req.user.tenant_id } });
    const folio = `TK-${String(count + 1).padStart(4, '0')}`;

    const ticket = await SupportTicket.create({
      tenant_id: req.user.tenant_id || null,
      user_id: req.user.id,
      user_name: req.user.name,
      folio,
      subject,
      type: type || 'bug',
      priority: priority || 'media',
      description,
      status: 'abierto',
      attachment_url: req.file ? `/uploads/tickets/${req.file.filename}` : null,
      include_system_info: include_system_info === 'true' || include_system_info === true,
      system_info: system_info ? JSON.parse(system_info) : null,
    });
    res.status(201).json({ ticket });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CAMBIAR ESTADO
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const ticket = await SupportTicket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (req.user.role !== 'super_admin' && ticket.tenant_id !== req.user.tenant_id) return res.status(403).json({ error: 'Sin permiso' });
    ticket.status = req.body.status;
    await ticket.save();
    res.json({ ticket });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const ticket = await SupportTicket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    await ticket.destroy();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// COMENTARIOS - listar
router.get('/:id/comments', authMiddleware, async (req, res) => {
  try {
    const ticket = await SupportTicket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (req.user.role !== 'super_admin' && ticket.tenant_id !== req.user.tenant_id) return res.status(403).json({ error: 'Sin permiso' });
    const comments = await SupportTicketComment.findAll({ where: { ticket_id: req.params.id }, order: [['created_at', 'ASC']] });
    res.json({ comments });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// COMENTARIOS - responder (dueño o soporte)
router.post('/:id/comments', authMiddleware, upload.single('captura'), async (req, res) => {
  try {
    const ticket = await SupportTicket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (req.user.role !== 'super_admin' && ticket.tenant_id !== req.user.tenant_id) return res.status(403).json({ error: 'Sin permiso' });
    const { message } = req.body;
    if (!message?.trim() && !req.file) return res.status(400).json({ error: 'Escribe una respuesta' });
    const isSupport = req.user.role === 'super_admin';
    const comment = await SupportTicketComment.create({
      ticket_id: ticket.id,
      user_id: req.user.id,
      user_name: req.user.name,
      role: req.user.role,
      is_support: isSupport,
      message: message?.trim() || '📎 Captura adjunta',
      attachment_url: req.file ? `/uploads/tickets/${req.file.filename}` : null,
    });
        // Si soporte responde, pasa a En revisión. Si dueño responde y estaba resuelto, se reabre.
    if (isSupport && ticket.status === 'abierto') { ticket.status = 'en_revision'; await ticket.save(); }
    if (!isSupport && ticket.status === 'resuelto') { ticket.status = 'abierto'; await ticket.save(); }

    // 🔔 NOTIFICACIÓN - Solo cuando responde Super Admin, le llega al taller en la campanita
    // Reutiliza el mismo sistema de Broadcasts: tabla notifications + for_roles
    if (isSupport && ticket.tenant_id) {
      try {
        const preview = (message?.trim() || 'Te respondió').slice(0, 80);
        await Notification.create({
          tenant_id: ticket.tenant_id,
          title: `Soporte respondió tu ticket #${ticket.folio} ${ticket.subject}`,
          message: preview,
          type: 'info',
          read: false,
          for_roles: 'owner,secretary,cashier,technician',
        });
      } catch (notifErr) {
        console.error('Error creando notificación de ticket:', notifErr.message);
        // No tumbamos la respuesta si falla la notificación
      }
    }

    res.status(201).json({ comment });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;