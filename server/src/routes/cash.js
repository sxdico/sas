import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CashSession, Sale, SaleItem } from '../models.js';
import { sequelize } from '../models.js';
import { authMiddleware, authorize, requireTenantId } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET Sesion actual abierta
router.get('/current', authorize(['owner','technician','cashier']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const session = await CashSession.findOne({
    where: { tenant_id: tenantId, status: 'open' },
    order: [['opened_at','DESC']]
  });
  if (!session) return res.json({ session: null });

  // Calcular ventas de esta sesion
  const sales = await Sale.findAll({ where: { tenant_id: tenantId, cash_session_id: session.id } });
  const summary = {
    total: sales.reduce((s, sale) => s + parseFloat(sale.total), 0),
    count: sales.length,
    efectivo: sales.filter(s => s.payment_method === 'efectivo').reduce((s, sale) => s + parseFloat(sale.total), 0),
    tarjeta: sales.filter(s => s.payment_method === 'tarjeta').reduce((s, sale) => s + parseFloat(sale.total), 0),
    transferencia: sales.filter(s => s.payment_method === 'transferencia').reduce((s, sale) => s + parseFloat(sale.total), 0),
    credito: sales.filter(s => s.payment_method === 'credito').reduce((s, sale) => s + parseFloat(sale.total), 0),
  };
  res.json({ session, sales, summary });
});

// POST Abrir caja
router.post('/open', authorize(['owner','technician','cashier']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const { opening_amount } = req.body;

  // Verificar que no haya caja abierta
  const existing = await CashSession.findOne({ where: { tenant_id: tenantId, status: 'open' } });
  if (existing) return res.status(400).json({ error: 'Ya hay una caja abierta. Cierra la actual antes de abrir otra.' });

  const count = await CashSession.count({ where: { tenant_id: tenantId } });
  const folio = `CAJA-${String(count + 1).padStart(3, '0')}`;

  const session = await CashSession.create({
    id: uuidv4(),
    tenant_id: tenantId,
    folio,
    opening_amount: opening_amount || 0,
    status: 'open',
    user_open_id: req.user.id,
    user_open_name: req.user.name,
    opened_at: new Date(),
  });

  res.status(201).json({ session });
});

// POST Cerrar caja
router.post('/close', authorize(['owner','technician','cashier']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const { closing_amount, notes } = req.body;

  const session = await CashSession.findOne({ where: { tenant_id: tenantId, status: 'open' } });
  if (!session) return res.status(404).json({ error: 'No hay caja abierta' });

  const t = await sequelize.transaction();
  try {
    const sales = await Sale.findAll({ where: { tenant_id: tenantId, cash_session_id: session.id }, transaction: t });

    const totalSales = sales.reduce((s, sale) => s + parseFloat(sale.total), 0);
    const totalEfectivo = sales.filter(s => s.payment_method === 'efectivo').reduce((s, sale) => s + parseFloat(sale.total), 0);
    const totalTarjeta = sales.filter(s => s.payment_method === 'tarjeta').reduce((s, sale) => s + parseFloat(sale.total), 0);
    const totalTransferencia = sales.filter(s => s.payment_method === 'transferencia').reduce((s, sale) => s + parseFloat(sale.total), 0);
    const totalCredito = sales.filter(s => s.payment_method === 'credito').reduce((s, sale) => s + parseFloat(sale.total), 0);

    const opening = parseFloat(session.opening_amount);
    const expected = opening + totalEfectivo;
    const closing = parseFloat(closing_amount || 0);
    const difference = closing - expected;

    session.closing_amount = closing;
    session.expected_amount = expected;
    session.difference = difference;
    session.total_sales = totalSales;
    session.total_efectivo = totalEfectivo;
    session.total_tarjeta = totalTarjeta;
    session.total_transferencia = totalTransferencia;
    session.total_credito = totalCredito;
    session.sales_count = sales.length;
    session.status = 'closed';
    session.user_close_id = req.user.id;
    session.user_close_name = req.user.name;
    session.closed_at = new Date();
    session.notes = notes || null;

    await session.save({ transaction: t });
    await t.commit();

    res.json({ session, summary: { totalSales, totalEfectivo, totalTarjeta, totalTransferencia, totalCredito, opening, expected, closing, difference, count: sales.length } });
  } catch (err) {
    await t.rollback();
    console.error('ERROR CERRANDO CAJA:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Historial de cajas
router.get('/history', authorize(['owner','technician','cashier']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const sessions = await CashSession.findAll({
    where: { tenant_id: tenantId },
    order: [['opened_at','DESC']],
    limit: 50
  });
  res.json({ sessions });
});

// GET Detalle de una caja con sus ventas
router.get('/:id', authorize(['owner','technician','cashier']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const session = await CashSession.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!session) return res.status(404).json({ error: 'Caja no encontrada' });
  const sales = await Sale.findAll({ where: { tenant_id: tenantId, cash_session_id: session.id }, order: [['created_at','DESC']] });
  res.json({ session, sales });
});

export default router;
