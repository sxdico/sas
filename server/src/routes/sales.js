import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Sale, SaleItem, Product } from '../models.js';
import { sequelize } from '../models.js';
import { authMiddleware, authorize, requireTenantId } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.post('/', authorize(['owner','technician','cashier']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const { items, payment_method, cash_received, customer_id, discount } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Carrito vacío' });

  const t = await sequelize.transaction();
  try {
    const count = await Sale.count({ where: { tenant_id: tenantId }, transaction: t });
    const folio = `V-${String(count + 1).padStart(3, '0')}`;

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const totalDisc = discount || items.reduce((s, i) => s + (i.discount||0), 0);
    const total = subtotal - totalDisc;

    const sale = await Sale.create({
      id: uuidv4(),
      tenant_id: tenantId,
      folio,
      subtotal,
      discount: totalDisc,
      total,
      payment_method: payment_method || 'efectivo',
      cash_received: cash_received || total,
      change: Math.max(0, (cash_received||total) - total),
      customer_id: customer_id || null,
      user_id: req.user.id,
      user_name: req.user.name,
      status: 'completed'
    }, { transaction: t });

    for (const it of items) {
      const isAnticipo = !it.product_id || String(it.product_id).startsWith('ANTICIPO') || it.name.toLowerCase().includes('anticipo orden');

      let productIdToSave = it.product_id || null;

      // Si es producto normal, descuenta stock
      if (!isAnticipo && it.product_id) {
        const prod = await Product.findOne({ where: { id: it.product_id, tenant_id: tenantId }, transaction: t });
        if (!prod) throw new Error(`Producto ${it.name} no encontrado`);
        if (prod.stock < it.quantity) throw new Error(`Stock insuficiente para ${prod.name}`);
        prod.stock -= it.quantity;
        await prod.save({ transaction: t });
        productIdToSave = prod.id;
      } else {
        // Para anticipo, busca o usa el producto fantasma ANTICIPO sin descontar stock infinito
        let anticipoProd = await Product.findOne({ where: { tenant_id: tenantId, sku: 'ANTICIPO' }, transaction: t });
        if (!anticipoProd) {
          anticipoProd = await Product.create({
            id: uuidv4(),
            tenant_id: tenantId,
            sku: 'ANTICIPO',
            name: 'Anticipo Orden Reparacion',
            sale_price: it.price,
            cost_price: 0,
            stock: 999999,
            min_stock: 0,
          }, { transaction: t });
        }
        productIdToSave = anticipoProd.id;
      }

      await SaleItem.create({
        id: uuidv4(),
        tenant_id: tenantId,
        sale_id: sale.id,
        product_id: productIdToSave,
        name: it.name, // Aquí se guarda "Anticipo Orden RP-003 - test"
        price: it.price,
        quantity: it.quantity,
        discount: it.discount || 0,
      }, { transaction: t });
    }

    await t.commit();
    res.status(201).json({ sale });
  } catch (err) {
    await t.rollback();
    console.error('ERROR VENTA:', err);
    res.status(500).json({ error: 'Error al crear venta', detail: err.message });
  }
});

router.get('/', authorize(['owner','technician','cashier']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const sales = await Sale.findAll({
    where: { tenant_id: tenantId },
    order: [['created_at','DESC']],
    limit: 100
  });
  res.json({ sales });
});

export default router;