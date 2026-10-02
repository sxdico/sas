export type Role = 'super_admin' | 'owner' | 'technician' | 'secretary' | 'cashier';

export interface User {
  id: string;
  tenant_id: string | null;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  active: boolean;
}

export interface Tenant {
  id: string;
  name_taller: string;
  name_dueño: string;
  email: string;
  phone: string;
  status: 'active' | 'suspended';
  created_at: string;
  plan: 'starter' | 'pro' | 'enterprise';
  user_count: number;
  order_count: number;
}

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  icon: string;
}

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  email: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  sku: string;
  barcode: string;
  name: string;
  description: string;
  image: string;
  category_id: string;
  cost_price: number;
  sale_price: number;
  wholesale_price: number;
  stock: number;
  min_stock: number;
  favorite: boolean;
  hotkey?: string;
}

export type OrderStatus = 'por_revisar' | 'en_reparacion' | 'esperando_refaccion' | 'listo' | 'entregado';

export interface RepairOrder {
  id: string;
  tenant_id: string;
  folio: string;
  customer_name: string;
  customer_phone: string;
  device_type: string;
  device_brand: string;
  device_model: string;
  problem_description: string;
  diagnostic: string;
  private_notes: string;
  status: OrderStatus;
  cost_parts: number;
  cost_labor: number;
  total: number;
  technician_id: string;
  technician_name: string;
  created_at: string;
  ready_at: string | null;
  delivered_at: string | null;
  parts_used: PartUsed[];
}

export interface PartUsed {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
}

export interface SaleItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  discount: number;
}

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'credito';

export interface Sale {
  id: string;
  tenant_id: string;
  folio: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  cash_received: number;
  change: number;
  customer_id: string | null;
  customer_name: string | null;
  user_id: string;
  user_name: string;
  created_at: string;
  status: 'completed' | 'on_hold' | 'credit';
}

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  email: string;
  credit_balance: number;
  total_purchases: number;
}

export interface InventoryMovement {
  id: string;
  tenant_id: string;
  product_id: string;
  product_name: string;
  type: 'in' | 'out' | 'sale' | 'adjustment';
  quantity: number;
  reason: string;
  user_name: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  tenant_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  read: boolean;
  created_at: string;
  for_roles: Role[];
}
