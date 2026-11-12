import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Customer, RepairOrder } from '../models.js';
import { authMiddleware, authorize, requireTenantId } from '../middleware/auth.js';
import { Op } from 'sequelize';

const router = Router();
router.use(authMiddleware);

router.get('/', authorize(['owner','technician','secretary','cashier']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  try {
    const { search = '', filter = 'todos' } = req.query;
    const where = { tenant_id: tenantId };
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }
    if (filter === 'frecuentes') where.is_frequent = true;
    const customers = await Customer.findAll({ where, order: [['created_at','DESC']] });
    const enriched = await Promise.all(customers.map(async (c) => {
      const orders = await RepairOrder.findAll({ where: { tenant_id: tenantId, customer_phone: c.phone } });
      const visits = Math.max(c.visits_count || 0, orders.length);
      const totalSpent = orders.reduce((s,o)=> s + parseFloat(o.total||0), 0);
      const lastVisit = orders.length ? orders.sort((a,b)=> new Date(b.created_at)-new Date(a.created_at))[0].created_at : c.last_visit_at;
      const isNew = c.created_at && new Date(c.created_at).getMonth() === new Date().getMonth() && new Date(c.created_at).getFullYear() === new Date().getFullYear();
      return { ...c.toJSON(), visits, total_spent: totalSpent || parseFloat(c.total_spent||0), last_visit: lastVisit, is_new_this_month: isNew };
    }));
    let filtered = enriched;
    if (filter === 'nuevos') filtered = enriched.filter(x=> x.is_new_this_month);
    const stats = { total: enriched.length, frecuentes: enriched.filter(x=> x.is_frequent || x.visits >= 3).length, nuevos_mes: enriched.filter(x=> x.is_new_this_month).length };
    res.json({ customers: filtered, stats });
  } catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

router.get('/:id', authorize(['owner','technician','secretary','cashier']), async (req,res)=>{
  const tenantId = requireTenantId(req,res); if(!tenantId) return;
  const c = await Customer.findOne({ where:{ id:req.params.id, tenant_id: tenantId } });
  if(!c) return res.status(404).json({ error:'Cliente no encontrado' });
  const orders = await RepairOrder.findAll({ where:{ tenant_id: tenantId, customer_phone: c.phone }, order:[['created_at','DESC']] });
  res.json({ customer: c, orders });
});

router.post('/', authorize(['owner','secretary','cashier','technician']), async (req,res)=>{
  const tenantId = requireTenantId(req,res); if(!tenantId) return;
  try{
    const { name, phone, email, notes, is_frequent, send_welcome } = req.body;
    if(!name?.trim()) return res.status(400).json({ error:'El nombre es obligatorio' });
    if(!phone?.trim()) return res.status(400).json({ error:'El teléfono es obligatorio' });
    const cleanPhone = phone.replace(/\D/g,'');
    const existing = await Customer.findOne({ where:{ tenant_id: tenantId, phone: cleanPhone } });
    if(existing) return res.status(400).json({ error:'Ya existe un cliente con ese teléfono' });
    const customer = await Customer.create({
      id: uuidv4(), tenant_id: tenantId,
      name: name.trim(), phone: cleanPhone,
      email: email?.trim() || null,
      notes: notes?.trim() || null,
      is_frequent: !!is_frequent,
      send_welcome: !!send_welcome,
      visits_count: 0, total_spent: 0,
    });
    res.status(201).json({ customer });
  }catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

router.put('/:id', authorize(['owner','secretary']), async (req,res)=>{
  const tenantId = requireTenantId(req,res); if(!tenantId) return;
  const c = await Customer.findOne({ where:{ id:req.params.id, tenant_id: tenantId } });
  if(!c) return res.status(404).json({ error:'Cliente no encontrado' });
  ['name','phone','email','notes','is_frequent'].forEach(f=>{ if(req.body[f]!==undefined) c[f]=req.body[f]; });
  await c.save();
  res.json({ customer: c });
});

router.delete('/:id', authorize(['owner']), async (req,res)=>{
  const tenantId = requireTenantId(req,res); if(!tenantId) return;
  const c = await Customer.findOne({ where:{ id:req.params.id, tenant_id: tenantId } });
  if(!c) return res.status(404).json({ error:'Cliente no encontrado' });
  await c.destroy();
  res.json({ message:'Cliente eliminado' });
});

export default router;