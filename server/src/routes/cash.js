import { Router } from 'express';
import { DataTypes, UUIDV4 } from 'sequelize';
import { CashSession, Sale, sequelize } from '../models.js';
import { authMiddleware } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Carpetas
const receiptDir = 'uploads/receipts';
if (!fs.existsSync(receiptDir)) fs.mkdirSync(receiptDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, receiptDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `receipt-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// MODELO EXPENSE (salidas) - ya lo tenias
export const Expense = sequelize.define('Expense', {
  id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.STRING(36), allowNull: false },
  cash_session_id: { type: DataTypes.STRING(36), allowNull: true },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  reason: { type: DataTypes.STRING(255), allowNull: false },
  category: { type: DataTypes.STRING(50), defaultValue: 'gasto_general' },
  user_id: { type: DataTypes.STRING(36) },
  user_name: { type: DataTypes.STRING(150) },
  receipt_url: { type: DataTypes.STRING(500), allowNull: true },
}, { tableName: 'expenses', createdAt: 'created_at', updatedAt: 'updated_at' });

// NUEVO MODELO INCOME (entradas)
export const Income = sequelize.define('Income', {
  id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.STRING(36), allowNull: false },
  cash_session_id: { type: DataTypes.STRING(36), allowNull: true },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  reason: { type: DataTypes.STRING(255), allowNull: false },
  category: { type: DataTypes.STRING(50), defaultValue: 'otro' },
  user_id: { type: DataTypes.STRING(36) },
  user_name: { type: DataTypes.STRING(150) },
  receipt_url: { type: DataTypes.STRING(500), allowNull: true },
}, { tableName: 'incomes', createdAt: 'created_at', updatedAt: 'updated_at' });

router.use(authMiddleware);

// Auto-crear tablas
Expense.sync({ alter: true }).catch(() => {});
Income.sync({ alter: true }).catch(() => {});

router.get('/current', async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const session = await CashSession.findOne({ where: { tenant_id, status: 'open' }, order: [['opened_at', 'DESC']] });
    if (!session) return res.json({ session: null, summary: null });
    const sales = await Sale.findAll({ where: { cash_session_id: session.id } });
    const expenses = await Expense.findAll({ where: { cash_session_id: session.id } });
    const incomes = await Income.findAll({ where: { cash_session_id: session.id } });
    const summary = {
      count: sales.length,
      total: sales.reduce((s, x) => s + Number(x.total), 0),
      efectivo: sales.filter(x => x.payment_method === 'efectivo').reduce((s, x) => s + Number(x.total), 0),
      tarjeta: sales.filter(x => x.payment_method === 'tarjeta').reduce((s, x) => s + Number(x.total), 0),
      transferencia: sales.filter(x => x.payment_method === 'transferencia').reduce((s, x) => s + Number(x.total), 0),
      credito: sales.filter(x => x.payment_method === 'credito').reduce((s, x) => s + Number(x.total), 0),
      total_salidas: expenses.reduce((s, x) => s + Number(x.amount), 0),
      salidas_count: expenses.length,
      total_entradas: incomes.reduce((s, x) => s + Number(x.amount), 0),
      entradas_count: incomes.length,
    };
    res.json({ session, summary, expenses, incomes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener caja actual' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const sessions = await CashSession.findAll({ where: { tenant_id }, order: [['opened_at', 'DESC']], limit: 100 });
    for (const s of sessions) {
      const exps = await Expense.findAll({ where: { cash_session_id: s.id } });
      const incs = await Income.findAll({ where: { cash_session_id: s.id } });
      s.dataValues.total_salidas = exps.reduce((a, b) => a + Number(b.amount), 0);
      s.dataValues.total_entradas = incs.reduce((a, b) => a + Number(b.amount), 0);
    }
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: 'Error historial' });
  }
});

// ===== SALIDAS =====
router.get('/expenses', async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const expenses = await Expense.findAll({ where: { tenant_id }, order: [['created_at', 'DESC']], limit: 200 });
    res.json({ expenses });
  } catch (err) {
    res.status(500).json({ error: 'Error salidas' });
  }
});

router.post('/expenses', upload.single('receipt'), async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const user = req.user;
    const { amount, reason, category } = req.body;
    if (!amount || !reason) return res.status(400).json({ error: 'Monto y motivo requeridos' });
    const current = await CashSession.findOne({ where: { tenant_id, status: 'open' } });
    if (!current) return res.status(400).json({ error: 'No hay caja abierta' });

    const sales = await Sale.findAll({ where: { cash_session_id: current.id } });
    const expenses = await Expense.findAll({ where: { cash_session_id: current.id } });
    const incomes = await Income.findAll({ where: { cash_session_id: current.id } });
    const totalEfectivo = sales.filter(x => x.payment_method === 'efectivo').reduce((s, x) => s + Number(x.total), 0);
    const totalSalidas = expenses.reduce((s, x) => s + Number(x.amount), 0);
    const totalEntradas = incomes.reduce((s, x) => s + Number(x.amount), 0);
    const disponible = Number(current.opening_amount) + totalEfectivo + totalEntradas - totalSalidas;
    if (Number(amount) > disponible) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: `Efectivo insuficiente. Disponible: $${disponible.toFixed(2)}` });
    }

    const exp = await Expense.create({
      tenant_id,
      cash_session_id: current.id,
      amount,
      reason,
      category: category || 'gasto_general',
      user_id: user.id,
      user_name: user.name,
      receipt_url: req.file ? `/${req.file.path.replace(/\\/g, '/')}` : null,
    });
    res.json({ expense: exp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear salida' });
  }
});

router.delete('/expenses/:id', async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const exp = await Expense.findOne({ where: { id: req.params.id, tenant_id } });
    if (!exp) return res.status(404).json({ error: 'No encontrado' });
    if (exp.dataValues.receipt_url) {
      const fp = exp.dataValues.receipt_url.replace(/^\//, '');
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await exp.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// ===== ENTRADAS =====
router.get('/incomes', async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const incomes = await Income.findAll({ where: { tenant_id }, order: [['created_at', 'DESC']], limit: 200 });
    res.json({ incomes });
  } catch (err) {
    res.status(500).json({ error: 'Error entradas' });
  }
});

router.post('/incomes', upload.single('receipt'), async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const user = req.user;
    const { amount, reason, category } = req.body;
    if (!amount || !reason) return res.status(400).json({ error: 'Monto y motivo requeridos' });
    const current = await CashSession.findOne({ where: { tenant_id, status: 'open' } });
    if (!current) return res.status(400).json({ error: 'No hay caja abierta' });

    const inc = await Income.create({
      tenant_id,
      cash_session_id: current.id,
      amount,
      reason,
      category: category || 'otro',
      user_id: user.id,
      user_name: user.name,
      receipt_url: req.file ? `/${req.file.path.replace(/\\/g, '/')}` : null,
    });
    res.json({ income: inc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear entrada' });
  }
});

router.delete('/incomes/:id', async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const inc = await Income.findOne({ where: { id: req.params.id, tenant_id } });
    if (!inc) return res.status(404).json({ error: 'No encontrado' });
    if (inc.dataValues.receipt_url) {
      const fp = inc.dataValues.receipt_url.replace(/^\//, '');
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await inc.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

router.post('/open', async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const user = req.user;
    const existing = await CashSession.findOne({ where: { tenant_id, status: 'open' } });
    if (existing) return res.status(400).json({ error: 'Ya hay una caja abierta' });
    const count = await CashSession.count({ where: { tenant_id } });
    const folio = `CAJA-${String(count + 1).padStart(4, '0')}`;
    const session = await CashSession.create({
      tenant_id,
      folio,
      opening_amount: req.body.opening_amount || 0,
      user_open_id: user.id,
      user_open_name: user.name,
      status: 'open',
      opened_at: new Date(),
    });
    res.json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al abrir caja' });
  }
});

router.post('/close', async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const user = req.user;
    const session = await CashSession.findOne({ where: { tenant_id, status: 'open' } });
    if (!session) return res.status(400).json({ error: 'No hay caja abierta' });
    const sales = await Sale.findAll({ where: { cash_session_id: session.id } });
    const expenses = await Expense.findAll({ where: { cash_session_id: session.id } });
    const incomes = await Income.findAll({ where: { cash_session_id: session.id } });
    const totalSales = sales.reduce((s, x) => s + Number(x.total), 0);
    const totalEfectivo = sales.filter(x => x.payment_method === 'efectivo').reduce((s, x) => s + Number(x.total), 0);
    const totalTarjeta = sales.filter(x => x.payment_method === 'tarjeta').reduce((s, x) => s + Number(x.total), 0);
    const totalTrans = sales.filter(x => x.payment_method === 'transferencia').reduce((s, x) => s + Number(x.total), 0);
    const totalCred = sales.filter(x => x.payment_method === 'credito').reduce((s, x) => s + Number(x.total), 0);
    const totalSalidas = expenses.reduce((s, x) => s + Number(x.amount), 0);
    const totalEntradas = incomes.reduce((s, x) => s + Number(x.amount), 0);
    const expected = Number(session.opening_amount) + totalEfectivo + totalEntradas - totalSalidas;
    const closing = req.body.closing_amount != null ? Number(req.body.closing_amount) : expected;
    const diff = closing - expected;
    await session.update({
      closing_amount: closing,
      expected_amount: expected,
      difference: diff,
      total_sales: totalSales,
      total_efectivo: totalEfectivo,
      total_tarjeta: totalTarjeta,
      total_transferencia: totalTrans,
      total_credito: totalCred,
      total_salidas: totalSalidas,
      total_entradas: totalEntradas,
      sales_count: sales.length,
      status: 'closed',
      user_close_id: user.id,
      user_close_name: user.name,
      closed_at: new Date(),
      notes: req.body.notes || null,
    });
    res.json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cerrar caja' });
  }
});

export default router;
