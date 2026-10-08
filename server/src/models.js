import { Sequelize, DataTypes, UUIDV4 } from 'sequelize';

const sequelize = new Sequelize(
  process.env.DB_NAME || 'fixpro',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mysql',
    logging: false,
  }
);

// ===== TENANTS =====
export const Tenant = sequelize.define('Tenant', {
  id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
  name_taller: { type: DataTypes.STRING(200), allowNull: false },
  name_dueno: { type: DataTypes.STRING(150), allowNull: false },
  email: { type: DataTypes.STRING(200), allowNull: false, unique: true },
  phone: { type: DataTypes.STRING(20), allowNull: false },
  status: { type: DataTypes.ENUM('active', 'suspended'), defaultValue: 'active' },
  plan: { type: DataTypes.ENUM('starter', 'pro', 'enterprise'), defaultValue: 'starter' },
}, { tableName: 'tenants', updatedAt: 'updated_at', createdAt: 'created_at' });

// ===== USERS =====
export const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  email: { type: DataTypes.STRING(200), allowNull: false, unique: true },
  phone: { type: DataTypes.STRING(20) },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  role: { type: DataTypes.ENUM('super_admin', 'owner', 'technician', 'secretary', 'cashier'), defaultValue: 'secretary' },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'users', updatedAt: 'updated_at', createdAt: 'created_at' });

// ===== CATEGORIES =====
export const Category = sequelize.define('Category', {
  id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING(100), allowNull: false },
  color: { type: DataTypes.STRING(7), defaultValue: '#3b82f6' },
  icon: { type: DataTypes.STRING(50), defaultValue: 'Package' },
}, { tableName: 'categories', createdAt: 'created_at', updatedAt: false });

// ===== SUPPLIERS =====
export const Supplier = sequelize.define('Supplier', {
  id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING(150), allowNull: false },
  phone: { type: DataTypes.STRING(20) },
  email: { type: DataTypes.STRING(200) },
}, { tableName: 'suppliers', createdAt: 'created_at', updatedAt: false });

// ===== PRODUCTS =====
export const Product = sequelize.define('Product', {
  id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  sku: { type: DataTypes.STRING(50), allowNull: false },
  barcode: { type: DataTypes.STRING(50) },
  name: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT },
  image: { type: DataTypes.STRING(500) },
  category_id: { type: DataTypes.UUID },
  cost_price: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  sale_price: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  wholesale_price: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  stock: { type: DataTypes.INTEGER, defaultValue: 0 },
  min_stock: { type: DataTypes.INTEGER, defaultValue: 5 },
  favorite: { type: DataTypes.BOOLEAN, defaultValue: false },
  hotkey: { type: DataTypes.STRING(5) },
}, { tableName: 'products', updatedAt: 'updated_at', createdAt: 'created_at' });

// ===== CUSTOMERS =====
export const Customer = sequelize.define('Customer', {
  id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING(150), allowNull: false },
  phone: { type: DataTypes.STRING(20) },
  email: { type: DataTypes.STRING(200) },
  credit_balance: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  total_purchases: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
}, { tableName: 'customers', createdAt: 'created_at', updatedAt: false });

// ===== INVENTORY MOVEMENTS =====
export const InventoryMovement = sequelize.define('InventoryMovement', {
  id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  product_id: { type: DataTypes.UUID, allowNull: false },
  type: { type: DataTypes.ENUM('in', 'out', 'sale', 'adjustment'), allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.STRING(255) },
  user_id: { type: DataTypes.UUID },
  user_name: { type: DataTypes.STRING(150) },
}, { tableName: 'inventory_movements', createdAt: 'created_at', updatedAt: false });

// ===== REPAIR ORDERS =====
export const RepairOrder = sequelize.define('RepairOrder', {
  id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  folio: { type: DataTypes.STRING(20), allowNull: false },
  customer_name: { type: DataTypes.STRING(150), allowNull: false },
  customer_phone: { type: DataTypes.STRING(20) },
  device_type: { type: DataTypes.STRING(50), defaultValue: 'Smartphone' },
  device_brand: { type: DataTypes.STRING(100) },
  device_model: { type: DataTypes.STRING(100) },
  problem_description: { type: DataTypes.TEXT },
  diagnostic: { type: DataTypes.TEXT },
  private_notes: { type: DataTypes.TEXT },
  status: {
    type: DataTypes.ENUM('por_revisar', 'en_reparacion', 'esperando_refaccion', 'listo', 'entregado'),
    defaultValue: 'por_revisar',
  },
  cost_parts: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  cost_labor: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  technician_id: { type: DataTypes.UUID },
  technician_name: { type: DataTypes.STRING(150) },
  ready_at: { type: DataTypes.DATE, allowNull: true },
  delivered_at: { type: DataTypes.DATE, allowNull: true },

  // ===== NUEVOS CAMPOS GARANTÍA Y BLOQUEO =====
  advance_payment: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  lock_type: { 
    type: DataTypes.ENUM('Sin bloqueo','Patrón','PIN','Contraseña','Cuenta Google','iCloud','MDM','Otro'),
    defaultValue: 'Sin bloqueo'
  },
  warranty_value: { type: DataTypes.INTEGER, defaultValue: 10 },
  warranty_unit: { 
    type: DataTypes.ENUM('Días','Meses'),
    defaultValue: 'Días'
  },
  warranty_ends_at: { type: DataTypes.DATE, allowNull: true },

}, { tableName: 'repair_orders', updatedAt: 'updated_at', createdAt: 'created_at' });

// ===== ORDER PARTS =====
export const OrderPart = sequelize.define('OrderPart', {
  id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  order_id: { type: DataTypes.UUID, allowNull: false },
  product_id: { type: DataTypes.UUID, allowNull: false },
  product_name: { type: DataTypes.STRING(200), allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  unit_cost: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
}, { tableName: 'order_parts', createdAt: 'created_at', updatedAt: false });

// ===== SALES =====
export const Sale = sequelize.define('Sale', {
  id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  folio: { type: DataTypes.STRING(20), allowNull: false },
  subtotal: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  discount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  payment_method: { type: DataTypes.ENUM('efectivo', 'tarjeta', 'transferencia', 'credito'), allowNull: false },
  cash_received: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  change: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  customer_id: { type: DataTypes.UUID, allowNull: true },
  customer_name: { type: DataTypes.STRING(150), allowNull: true },
  user_id: { type: DataTypes.UUID, allowNull: false },
  user_name: { type: DataTypes.STRING(150), allowNull: false },
  status: { type: DataTypes.ENUM('completed', 'on_hold', 'credit'), defaultValue: 'completed' },
}, { tableName: 'sales', createdAt: 'created_at', updatedAt: false });

// ===== CASH SESSIONS MODEL =====
export const CashSession = sequelize.define('CashSession', {
  id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  folio: { type: DataTypes.STRING(20), allowNull: false },
  opening_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  closing_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  expected_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  difference: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  total_sales: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  total_efectivo: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  total_tarjeta: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  total_transferencia: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  total_credito: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  sales_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM('open', 'closed'), defaultValue: 'open' },
  user_open_id: { type: DataTypes.UUID },
  user_open_name: { type: DataTypes.STRING(150) },
  user_close_id: { type: DataTypes.UUID, allowNull: true },
  user_close_name: { type: DataTypes.STRING(150), allowNull: true },
  opened_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  closed_at: { type: DataTypes.DATE, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'cash_sessions', createdAt: 'created_at', updatedAt: 'updated_at' });

// ===== SALE ITEMS =====
export const SaleItem = sequelize.define('SaleItem', {
  id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
  cash_session_id: { type: DataTypes.UUID, allowNull: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  sale_id: { type: DataTypes.UUID, allowNull: false },
  product_id: { type: DataTypes.UUID },
  name: { type: DataTypes.STRING(200), allowNull: false },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  discount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
}, { tableName: 'sale_items', updatedAt: false, createdAt: false });

// ===== NOTIFICATIONS =====
export const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  title: { type: DataTypes.STRING(200), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  type: { type: DataTypes.ENUM('info', 'success', 'warning'), defaultValue: 'info' },
  read: { type: DataTypes.BOOLEAN, defaultValue: false },
  for_roles: { type: DataTypes.STRING(200), defaultValue: 'owner,secretary,cashier' },
}, { tableName: 'notifications', createdAt: 'created_at', updatedAt: false });

// ===== ASSOCIATIONS =====
Tenant.hasMany(User, { foreignKey: 'tenant_id' });
User.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Tenant.hasMany(Category, { foreignKey: 'tenant_id' });
Category.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Tenant.hasMany(Product, { foreignKey: 'tenant_id' });
Product.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Product.belongsTo(Category, { foreignKey: 'category_id' });

Tenant.hasMany(Customer, { foreignKey: 'tenant_id' });
Customer.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Tenant.hasMany(InventoryMovement, { foreignKey: 'tenant_id' });
InventoryMovement.belongsTo(Tenant, { foreignKey: 'tenant_id' });
InventoryMovement.belongsTo(Product, { foreignKey: 'product_id' });

Tenant.hasMany(RepairOrder, { foreignKey: 'tenant_id' });
RepairOrder.belongsTo(Tenant, { foreignKey: 'tenant_id' });
RepairOrder.belongsTo(User, { foreignKey: 'technician_id', as: 'technician' });
RepairOrder.hasMany(OrderPart, { foreignKey: 'order_id' });
OrderPart.belongsTo(RepairOrder, { foreignKey: 'order_id' });
OrderPart.belongsTo(Product, { foreignKey: 'product_id' });

Tenant.hasMany(Sale, { foreignKey: 'tenant_id' });
Sale.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Sale.belongsTo(Customer, { foreignKey: 'customer_id' });
Sale.hasMany(SaleItem, { foreignKey: 'sale_id' });
SaleItem.belongsTo(Sale, { foreignKey: 'sale_id' });
SaleItem.belongsTo(Product, { foreignKey: 'product_id' });

Tenant.hasMany(Notification, { foreignKey: 'tenant_id' });
Notification.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Tenant.hasMany(CashSession, { foreignKey: 'tenant_id' });
CashSession.belongsTo(Tenant, { foreignKey: 'tenant_id' });
CashSession.hasMany(Sale, { foreignKey: 'cash_session_id' });
Sale.belongsTo(CashSession, { foreignKey: 'cash_session_id' });

export { sequelize };
export default sequelize;