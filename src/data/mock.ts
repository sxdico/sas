import type {
  User, Tenant, Category, Supplier, Product, RepairOrder,
  Sale, Customer, InventoryMovement, AppNotification,
} from '@/types';

export const tenants: Tenant[] = [
  {
    id: 't1', name_taller: 'Taller Electrónica Ramírez', name_dueno: 'Carlos Ramírez',
    email: 'carlos@talleramirez.com', phone: '5512345678', status: 'active',
    created_at: '2026-08-15', plan: 'pro', user_count: 4, order_count: 27,
  },
  {
    id: 't2', name_taller: 'FixCell Reparaciones', name_dueno: 'María González',
    email: 'maria@fixcell.com', phone: '5598765432', status: 'active',
    created_at: '2026-09-01', plan: 'starter', user_count: 2, order_count: 12,
  },
  {
    id: 't3', name_taller: 'TechRepair Pro', name_dueno: 'Juan Mendoza',
    email: 'juan@techrepair.com', phone: '5523456789', status: 'suspended',
    created_at: '2026-07-20', plan: 'enterprise', user_count: 8, order_count: 95,
  },
];

export const users: User[] = [
  { id: 'u0', tenant_id: null, name: 'Admin Global', email: 'admin@fixpro.com', role: 'super_admin', active: true },
  { id: 'u1', tenant_id: 't1', name: 'Carlos Ramírez', email: 'carlos@talleramirez.com', phone: '5512345678', role: 'owner', active: true },
  { id: 'u2', tenant_id: 't1', name: 'Ana Torres', email: 'ana@talleramirez.com', phone: '5511112222', role: 'secretary', active: true },
  { id: 'u3', tenant_id: 't1', name: 'Luis Pérez', email: 'luis@talleramirez.com', phone: '5533334444', role: 'technician', active: true },
  { id: 'u4', tenant_id: 't1', name: 'Sofía Díaz', email: 'sofia@talleramirez.com', phone: '5555556666', role: 'cashier', active: true },
];

export const categories: Category[] = [
  { id: 'c1', tenant_id: 't1', name: 'Pantallas', color: '#3b82f6', icon: 'Smartphone' },
  { id: 'c2', tenant_id: 't1', name: 'Baterías', color: '#22c55e', icon: 'BatteryCharging' },
  { id: 'c3', tenant_id: 't1', name: 'Cargadores', color: '#f59e0b', icon: 'Plug' },
  { id: 'c4', tenant_id: 't1', name: 'Fundas', color: '#06b6d4', icon: 'Shield' },
  { id: 'c5', tenant_id: 't1', name: 'Accesorios', color: '#8b5cf6', icon: 'Headphones' },
  { id: 'c6', tenant_id: 't1', name: 'Reparación', color: '#ef4444', icon: 'Wrench' },
];

export const suppliers: Supplier[] = [
  { id: 's1', tenant_id: 't1', name: 'TechParts MX', phone: '5511223344', email: 'ventas@techparts.mx' },
  { id: 's2', tenant_id: 't1', name: 'CellSupply', phone: '5599887766', email: 'info@cellsupply.mx' },
  { id: 's3', tenant_id: 't1', name: 'Importadora Gómez', phone: '5544332211', email: 'ventas@gomezimp.mx' },
];

export const products: Product[] = [
  { id: 'p1', tenant_id: 't1', sku: 'PAN-IP13', barcode: '7501234567890', name: 'Pantalla iPhone 13 Pro', description: 'Pantalla OLED original', image: '', category_id: 'c1', cost_price: 1800, sale_price: 2500, wholesale_price: 2200, stock: 8, min_stock: 3, favorite: true, hotkey: 'F1' },
  { id: 'p2', tenant_id: 't1', sku: 'BAT-S22', barcode: '7501234567891', name: 'Batería Samsung S22', description: 'Batería 3700mAh', image: '', category_id: 'c2', cost_price: 450, sale_price: 800, wholesale_price: 650, stock: 15, min_stock: 5, favorite: true, hotkey: 'F2' },
  { id: 'p3', tenant_id: 't1', sku: 'CAR-USB-C', barcode: '7501234567892', name: 'Cargador USB-C 25W', description: 'Cargador rápido original', image: '', category_id: 'c3', cost_price: 120, sale_price: 250, wholesale_price: 200, stock: 30, min_stock: 10, favorite: true, hotkey: 'F3' },
  { id: 'p4', tenant_id: 't1', sku: 'FUN-IP13-AZ', barcode: '7501234567893', name: 'Funda iPhone 13 Azul', description: 'Funda silicona premium', image: '', category_id: 'c4', cost_price: 80, sale_price: 200, wholesale_price: 150, stock: 25, min_stock: 5, favorite: false },
  { id: 'p5', tenant_id: 't1', sku: 'AUD-BT', barcode: '7501234567894', name: 'Audífonos Bluetooth', description: 'Audífonos inalámbricos', image: '', category_id: 'c5', cost_price: 300, sale_price: 600, wholesale_price: 500, stock: 12, min_stock: 4, favorite: true, hotkey: 'F4' },
  { id: 'p6', tenant_id: 't1', sku: 'CRV-PREC', barcode: '7501234567895', name: 'Cristal Templado Premium', description: 'Protector cristal 9H', image: '', category_id: 'c5', cost_price: 30, sale_price: 100, wholesale_price: 70, stock: 50, min_stock: 15, favorite: false },
  { id: 'p7', tenant_id: 't1', sku: 'PAN-S22', barcode: '7501234567896', name: 'Pantalla Samsung S22', description: 'Pantalla AMOLED', image: '', category_id: 'c1', cost_price: 1500, sale_price: 2200, wholesale_price: 1900, stock: 5, min_stock: 3, favorite: false },
  { id: 'p8', tenant_id: 't1', sku: 'BAT-IP12', barcode: '7501234567897', name: 'Batería iPhone 12', description: 'Batería 2815mAh', image: '', category_id: 'c2', cost_price: 400, sale_price: 700, wholesale_price: 550, stock: 2, min_stock: 5, favorite: false },
  { id: 'p9', tenant_id: 't1', sku: 'CAR-AUTO', barcode: '7501234567898', name: 'Cargador Auto USB-C', description: 'Cargador vehicular 2 puertos', image: '', category_id: 'c3', cost_price: 90, sale_price: 200, wholesale_price: 160, stock: 18, min_stock: 6, favorite: false },
  { id: 'p10', tenant_id: 't1', sku: 'FUN-S22-NEG', barcode: '7501234567899', name: 'Funda Samsung S22 Negra', description: 'Funda transparente', image: '', category_id: 'c4', cost_price: 70, sale_price: 180, wholesale_price: 130, stock: 0, min_stock: 5, favorite: false },
  { id: 'p11', tenant_id: 't1', sku: 'REPAR-MOD', barcode: '7501234567900', name: 'Módulo de Carga', description: 'Reparación de puerto de carga', image: '', category_id: 'c6', cost_price: 100, sale_price: 350, wholesale_price: 280, stock: 20, min_stock: 5, favorite: false },
  { id: 'p12', tenant_id: 't1', sku: 'AUD-JACK', barcode: '7501234567901', name: 'Adaptador Jack 3.5mm', description: 'Adaptador USB-C a Jack', image: '', category_id: 'c5', cost_price: 40, sale_price: 120, wholesale_price: 90, stock: 35, min_stock: 10, favorite: false },
];

export const repairOrders: RepairOrder[] = [
  {
    id: 'o1', tenant_id: 't1', folio: 'RP-001', customer_name: 'Pedro Martínez', customer_phone: '5512345600',
    device_type: 'Smartphone', device_brand: 'Apple', device_model: 'iPhone 13 Pro',
    problem_description: 'Pantalla rota tras caída', diagnostic: 'LCD dañado, necesita reemplazo completo',
    private_notes: 'Cliente apurado, prioridad alta. Posible daño en flex de touch.',
    status: 'en_reparacion', cost_parts: 1800, cost_labor: 500, total: 2300,
    technician_id: 'u3', technician_name: 'Luis Pérez', created_at: '2026-10-01T09:30:00', ready_at: null, delivered_at: null,
    parts_used: [{ product_id: 'p1', product_name: 'Pantalla iPhone 13 Pro', quantity: 1, unit_cost: 1800 }],
  },
  {
    id: 'o2', tenant_id: 't1', folio: 'RP-002', customer_name: 'Laura Sánchez', customer_phone: '5512345601',
    device_type: 'Smartphone', device_brand: 'Samsung', device_model: 'Galaxy S22',
    problem_description: 'No carga', diagnostic: 'Puerto de carga oxidado',
    private_notes: 'Revisar también estado de batería.',
    status: 'esperando_refaccion', cost_parts: 100, cost_labor: 350, total: 450,
    technician_id: 'u3', technician_name: 'Luis Pérez', created_at: '2026-10-01T11:00:00', ready_at: null, delivered_at: null,
    parts_used: [{ product_id: 'p11', product_name: 'Módulo de Carga', quantity: 1, unit_cost: 100 }],
  },
  {
    id: 'o3', tenant_id: 't1', folio: 'RP-003', customer_name: 'Roberto Cruz', customer_phone: '5512345602',
    device_type: 'Tablet', device_brand: 'Apple', device_model: 'iPad Air',
    problem_description: 'Batería dura poco', diagnostic: 'Batería degradada, ciclo >500',
    private_notes: '',
    status: 'listo', cost_parts: 0, cost_labor: 800, total: 800,
    technician_id: 'u3', technician_name: 'Luis Pérez', created_at: '2026-09-30T14:00:00', ready_at: '2026-10-02T10:00:00', delivered_at: null,
    parts_used: [],
  },
  {
    id: 'o4', tenant_id: 't1', folio: 'RP-004', customer_name: 'María Fernández', customer_phone: '5512345603',
    device_type: 'Smartphone', device_brand: 'Xiaomi', device_model: 'Redmi Note 11',
    problem_description: 'Pantalla con líneas', diagnostic: 'Pendiente de revisión',
    private_notes: '',
    status: 'por_revisar', cost_parts: 0, cost_labor: 0, total: 0,
    technician_id: 'u3', technician_name: 'Luis Pérez', created_at: '2026-10-02T08:00:00', ready_at: null, delivered_at: null,
    parts_used: [],
  },
  {
    id: 'o5', tenant_id: 't1', folio: 'RP-005', customer_name: 'Jorge Ruiz', customer_phone: '5512345604',
    device_type: 'Smartphone', device_brand: 'Apple', device_model: 'iPhone 12',
    problem_description: 'No enciende', diagnostic: 'Batería agotada, posible problema placa',
    private_notes: 'Si al cambiar batería no enciende, revisar IC de carga.',
    status: 'listo', cost_parts: 400, cost_labor: 300, total: 700,
    technician_id: 'u3', technician_name: 'Luis Pérez', created_at: '2026-09-29T10:00:00', ready_at: '2026-10-01T16:00:00', delivered_at: null,
    parts_used: [{ product_id: 'p8', product_name: 'Batería iPhone 12', quantity: 1, unit_cost: 400 }],
  },
  {
    id: 'o6', tenant_id: 't1', folio: 'RP-006', customer_name: 'Carmen Vega', customer_phone: '5512345605',
    device_type: 'Smartphone', device_brand: 'Motorola', device_model: 'Moto G Power',
    problem_description: 'Cristal roto', diagnostic: 'Solo cristal, LCD funciona',
    private_notes: '',
    status: 'entregado', cost_parts: 30, cost_labor: 250, total: 280,
    technician_id: 'u3', technician_name: 'Luis Pérez', created_at: '2026-09-25T09:00:00', ready_at: '2026-09-26T10:00:00', delivered_at: '2026-09-27T12:00:00',
    parts_used: [{ product_id: 'p6', product_name: 'Cristal Templado Premium', quantity: 1, unit_cost: 30 }],
  },
];

export const sales: Sale[] = [
  {
    id: 'v1', tenant_id: 't1', folio: 'V-001', items: [
      { product_id: 'p3', name: 'Cargador USB-C 25W', price: 250, quantity: 1, discount: 0 },
      { product_id: 'p6', name: 'Cristal Templado Premium', price: 100, quantity: 2, discount: 0 },
    ], subtotal: 450, discount: 0, total: 450, payment_method: 'efectivo', cash_received: 500, change: 50,
    customer_id: null, customer_name: null, user_id: 'u4', user_name: 'Sofía Díaz', created_at: '2026-10-02T09:15:00', status: 'completed',
  },
  {
    id: 'v2', tenant_id: 't1', folio: 'V-002', items: [
      { product_id: 'p5', name: 'Audífonos Bluetooth', price: 600, quantity: 1, discount: 50 },
    ], subtotal: 600, discount: 50, total: 550, payment_method: 'tarjeta', cash_received: 0, change: 0,
    customer_id: 'cu1', customer_name: 'Pedro Martínez', user_id: 'u2', user_name: 'Ana Torres', created_at: '2026-10-01T15:30:00', status: 'completed',
  },
  {
    id: 'v3', tenant_id: 't1', folio: 'V-003', items: [
      { product_id: 'p2', name: 'Batería Samsung S22', price: 800, quantity: 1, discount: 0 },
    ], subtotal: 800, discount: 0, total: 800, payment_method: 'credito', cash_received: 0, change: 0,
    customer_id: 'cu2', customer_name: 'Laura Sánchez', user_id: 'u4', user_name: 'Sofía Díaz', created_at: '2026-10-01T17:00:00', status: 'credit',
  },
];

export const customers: Customer[] = [
  { id: 'cu1', tenant_id: 't1', name: 'Pedro Martínez', phone: '5512345600', email: 'pedro@mail.com', credit_balance: 0, total_purchases: 2300 },
  { id: 'cu2', tenant_id: 't1', name: 'Laura Sánchez', phone: '5512345601', email: 'laura@mail.com', credit_balance: 800, total_purchases: 800 },
  { id: 'cu3', tenant_id: 't1', name: 'Roberto Cruz', phone: '5512345602', email: 'roberto@mail.com', credit_balance: 0, total_purchases: 800 },
];

export const inventoryMovements: InventoryMovement[] = [
  { id: 'm1', tenant_id: 't1', product_id: 'p1', product_name: 'Pantalla iPhone 13 Pro', type: 'in', quantity: 10, reason: 'Compra inicial', user_name: 'Carlos Ramírez', created_at: '2026-08-20T10:00:00' },
  { id: 'm2', tenant_id: 't1', product_id: 'p1', product_name: 'Pantalla iPhone 13 Pro', type: 'sale', quantity: 1, reason: 'Venta V-000', user_name: 'Sofía Díaz', created_at: '2026-09-28T12:00:00' },
  { id: 'm3', tenant_id: 't1', product_id: 'p1', product_name: 'Pantalla iPhone 13 Pro', type: 'out', quantity: 1, reason: 'Uso en reparación RP-001', user_name: 'Luis Pérez', created_at: '2026-10-01T10:00:00' },
  { id: 'm4', tenant_id: 't1', product_id: 'p2', product_name: 'Batería Samsung S22', type: 'in', quantity: 20, reason: 'Compra TechParts MX', user_name: 'Carlos Ramírez', created_at: '2026-08-20T10:00:00' },
  { id: 'm5', tenant_id: 't1', product_id: 'p2', product_name: 'Batería Samsung S22', type: 'sale', quantity: 1, reason: 'Venta V-003', user_name: 'Sofía Díaz', created_at: '2026-10-01T17:00:00' },
];

export const notifications: AppNotification[] = [
  { id: 'n1', tenant_id: 't1', title: 'Orden lista para entrega', message: 'La orden RP-003 de Roberto Cruz (iPad Air) está lista.', type: 'success', read: false, created_at: '2026-10-02T10:00:00', for_roles: ['owner', 'secretary', 'cashier'] },
  { id: 'n2', tenant_id: 't1', title: 'Orden lista para entrega', message: 'La orden RP-005 de Jorge Ruiz (iPhone 12) está lista.', type: 'success', read: false, created_at: '2026-10-01T16:00:00', for_roles: ['owner', 'secretary', 'cashier'] },
  { id: 'n3', tenant_id: 't1', title: 'Stock bajo', message: 'Batería iPhone 12 tiene solo 2 unidades (mín: 5).', type: 'warning', read: false, created_at: '2026-10-01T08:00:00', for_roles: ['owner', 'technician'] },
  { id: 'n4', tenant_id: 't1', title: 'Producto agotado', message: 'Funda Samsung S22 Negra está sin stock.', type: 'warning', read: true, created_at: '2026-09-30T18:00:00', for_roles: ['owner', 'technician'] },
];
