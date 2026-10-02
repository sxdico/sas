import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { sequelize, Tenant, User, Category, Product, Supplier, Customer, RepairOrder, Sale, SaleItem, InventoryMovement, Notification } from './models.js';

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✓ Conectado a MySQL');

    // ===== TENANT 1 =====
    const t1Id = uuidv4();
    await Tenant.create({
      id: t1Id,
      name_taller: 'Taller Electrónica Ramírez',
      name_dueno: 'Carlos Ramírez',
      email: 'carlos@talleramirez.com',
      phone: '5512345678',
      status: 'active',
      plan: 'pro',
    });

    // Owner
    const ownerHash = await bcrypt.hash('demo1234', 10);
    await User.create({
      id: uuidv4(), tenant_id: t1Id, name: 'Carlos Ramírez',
      email: 'carlos@talleramirez.com', phone: '5512345678',
      password_hash: ownerHash, role: 'owner', active: true,
    });

    // Secretary
    const secHash = await bcrypt.hash('demo1234', 10);
    await User.create({
      id: uuidv4(), tenant_id: t1Id, name: 'Ana Torres',
      email: 'ana@talleramirez.com', phone: '5511112222',
      password_hash: secHash, role: 'secretary', active: true,
    });

    // Technician
    const techHash = await bcrypt.hash('demo1234', 10);
    const tech = await User.create({
      id: uuidv4(), tenant_id: t1Id, name: 'Luis Pérez',
      email: 'luis@talleramirez.com', phone: '5533334444',
      password_hash: techHash, role: 'technician', active: true,
    });

    // Cashier
    const cashHash = await bcrypt.hash('demo1234', 10);
    await User.create({
      id: uuidv4(), tenant_id: t1Id, name: 'Sofía Díaz',
      email: 'sofia@talleramirez.com', phone: '5555556666',
      password_hash: cashHash, role: 'cashier', active: true,
    });

    // ===== CATEGORIES =====
    const catIds = {};
    const cats = [
      { name: 'Pantallas', color: '#3b82f6', icon: 'Smartphone' },
      { name: 'Baterías', color: '#22c55e', icon: 'BatteryCharging' },
      { name: 'Cargadores', color: '#f59e0b', icon: 'Plug' },
      { name: 'Fundas', color: '#06b6d4', icon: 'Shield' },
      { name: 'Accesorios', color: '#8b5cf6', icon: 'Headphones' },
      { name: 'Reparación', color: '#ef4444', icon: 'Wrench' },
    ];
    for (const c of cats) {
      const cat = await Category.create({
        id: uuidv4(), tenant_id: t1Id, ...c,
      });
      catIds[c.name] = cat.id;
    }

    // ===== SUPPLIERS =====
    await Supplier.bulkCreate([
      { id: uuidv4(), tenant_id: t1Id, name: 'TechParts MX', phone: '5511223344', email: 'ventas@techparts.mx' },
      { id: uuidv4(), tenant_id: t1Id, name: 'CellSupply', phone: '5599887766', email: 'info@cellsupply.mx' },
    ]);

    // ===== PRODUCTS =====
    const products = [
      { sku: 'PAN-IP13', barcode: '7501234567890', name: 'Pantalla iPhone 13 Pro', category: 'Pantallas', cost: 1800, sale: 2500, stock: 8, min: 3, fav: true, hk: 'F1' },
      { sku: 'BAT-S22', barcode: '7501234567891', name: 'Batería Samsung S22', category: 'Baterías', cost: 450, sale: 800, stock: 15, min: 5, fav: true, hk: 'F2' },
      { sku: 'CAR-USB-C', barcode: '7501234567892', name: 'Cargador USB-C 25W', category: 'Cargadores', cost: 120, sale: 250, stock: 30, min: 10, fav: true, hk: 'F3' },
      { sku: 'FUN-IP13-AZ', barcode: '7501234567893', name: 'Funda iPhone 13 Azul', category: 'Fundas', cost: 80, sale: 200, stock: 25, min: 5, fav: false, hk: null },
      { sku: 'AUD-BT', barcode: '7501234567894', name: 'Audífonos Bluetooth', category: 'Accesorios', cost: 300, sale: 600, stock: 12, min: 4, fav: true, hk: 'F4' },
      { sku: 'CRV-PREC', barcode: '7501234567895', name: 'Cristal Templado Premium', category: 'Accesorios', cost: 30, sale: 100, stock: 50, min: 15, fav: false, hk: null },
      { sku: 'PAN-S22', barcode: '7501234567896', name: 'Pantalla Samsung S22', category: 'Pantallas', cost: 1500, sale: 2200, stock: 5, min: 3, fav: false, hk: null },
      { sku: 'BAT-IP12', barcode: '7501234567897', name: 'Batería iPhone 12', category: 'Baterías', cost: 400, sale: 700, stock: 2, min: 5, fav: false, hk: null },
      { sku: 'REPAR-MOD', barcode: '7501234567900', name: 'Módulo de Carga', category: 'Reparación', cost: 100, sale: 350, stock: 20, min: 5, fav: false, hk: null },
      { sku: 'AUD-JACK', barcode: '7501234567901', name: 'Adaptador Jack 3.5mm', category: 'Accesorios', cost: 40, sale: 120, stock: 35, min: 10, fav: false, hk: null },
    ];

    const productMap = {};
    for (const p of products) {
      const prod = await Product.create({
        id: uuidv4(), tenant_id: t1Id, sku: p.sku, barcode: p.barcode,
        name: p.name, description: '', category_id: catIds[p.category],
        cost_price: p.cost, sale_price: p.sale, wholesale_price: Math.round(p.sale * 0.85),
        stock: p.stock, min_stock: p.min, favorite: p.fav, hotkey: p.hk,
      });
      productMap[p.sku] = prod;

      await InventoryMovement.create({
        id: uuidv4(), tenant_id: t1Id, product_id: prod.id,
        type: 'in', quantity: p.stock, reason: 'Stock inicial',
        user_id: tech.id, user_name: 'Luis Pérez',
      });
    }

    // ===== CUSTOMERS =====
    const cust1 = await Customer.create({
      id: uuidv4(), tenant_id: t1Id, name: 'Pedro Martínez',
      phone: '5512345600', email: 'pedro@mail.com',
      credit_balance: 0, total_purchases: 0,
    });
    const cust2 = await Customer.create({
      id: uuidv4(), tenant_id: t1Id, name: 'Laura Sánchez',
      phone: '5512345601', email: 'laura@mail.com',
      credit_balance: 0, total_purchases: 0,
    });

    // ===== REPAIR ORDERS =====
    await RepairOrder.create({
      id: uuidv4(), tenant_id: t1Id, folio: 'RP-001',
      customer_name: 'Pedro Martínez', customer_phone: '5512345600',
      device_type: 'Smartphone', device_brand: 'Apple', device_model: 'iPhone 13 Pro',
      problem_description: 'Pantalla rota tras caída',
      diagnostic: 'LCD dañado, necesita reemplazo completo',
      private_notes: 'Cliente apurado, prioridad alta.',
      status: 'en_reparacion', cost_parts: 1800, cost_labor: 500, total: 2300,
      technician_id: tech.id, technician_name: 'Luis Pérez',
    });
    await RepairOrder.create({
      id: uuidv4(), tenant_id: t1Id, folio: 'RP-002',
      customer_name: 'Laura Sánchez', customer_phone: '5512345601',
      device_type: 'Smartphone', device_brand: 'Samsung', device_model: 'Galaxy S22',
      problem_description: 'No carga',
      diagnostic: 'Puerto de carga oxidado',
      private_notes: 'Revisar también estado de batería.',
      status: 'esperando_refaccion', cost_parts: 100, cost_labor: 350, total: 450,
      technician_id: tech.id, technician_name: 'Luis Pérez',
    });
    const order3 = await RepairOrder.create({
      id: uuidv4(), tenant_id: t1Id, folio: 'RP-003',
      customer_name: 'Roberto Cruz', customer_phone: '5512345602',
      device_type: 'Tablet', device_brand: 'Apple', device_model: 'iPad Air',
      problem_description: 'Batería dura poco',
      diagnostic: 'Batería degradada',
      private_notes: '',
      status: 'listo', cost_parts: 0, cost_labor: 800, total: 800,
      technician_id: tech.id, technician_name: 'Luis Pérez',
      ready_at: new Date(),
    });
    await Notification.create({
      id: uuidv4(), tenant_id: t1Id,
      title: 'Orden lista para entrega',
      message: `La orden RP-003 de Roberto Cruz (iPad Air) está lista.`,
      type: 'success', read: false, for_roles: 'owner,secretary,cashier',
    });

    // ===== TENANT 2 (suspended) =====
    const t2Id = uuidv4();
    await Tenant.create({
      id: t2Id, name_taller: 'TechRepair Pro', name_dueno: 'Juan Mendoza',
      email: 'juan@techrepair.com', phone: '5523456789',
      status: 'suspended', plan: 'enterprise',
    });
    const t2Hash = await bcrypt.hash('demo1234', 10);
    await User.create({
      id: uuidv4(), tenant_id: t2Id, name: 'Juan Mendoza',
      email: 'juan@techrepair.com', password_hash: t2Hash,
      role: 'owner', active: true,
    });

    // ===== SUPER ADMIN =====
    const saHash = await bcrypt.hash('admin1234', 10);
    await User.create({
      id: uuidv4(), tenant_id: null, name: 'Admin Global',
      email: 'admin@fixpro.com', password_hash: saHash,
      role: 'super_admin', active: true,
    });

    console.log('\n✅ Seed completado!');
    console.log('\n=== Credenciales de acceso ===');
    console.log('Super Admin:  admin@fixpro.com / admin1234');
    console.log('Owner:        carlos@talleramirez.com / demo1234');
    console.log('Secretary:    ana@talleramirez.com / demo1234');
    console.log('Technician:   luis@talleramirez.com / demo1234');
    console.log('Cashier:      sofia@talleramirez.com / demo1234');
    console.log('\nEjecuta el servidor con: npm start');

    process.exit(0);
  } catch (err) {
    console.error('✗ Error en seed:', err.message);
    process.exit(1);
  }
}

seed();
