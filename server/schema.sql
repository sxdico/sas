-- ============================================================
-- FixPro — Schema MySQL 8 (Multi-Tenant SaaS) - FIXED FOR CLEVER CLOUD
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ===== TENANTS (Talleres) =====
CREATE TABLE IF NOT EXISTS tenants (
  id            VARCHAR(36) PRIMARY KEY,
  name_taller   VARCHAR(200) NOT NULL,
  name_dueno    VARCHAR(150) NOT NULL,
  email         VARCHAR(200) NOT NULL UNIQUE,
  phone         VARCHAR(20)  NOT NULL,
  status        ENUM('active','suspended') DEFAULT 'active',
  plan          ENUM('starter','pro','enterprise') DEFAULT 'starter',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ===== USERS =====
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36) PRIMARY KEY,
  tenant_id     VARCHAR(36) NULL,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(200) NOT NULL UNIQUE,
  phone         VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('super_admin','owner','technician','secretary','cashier') NOT NULL DEFAULT 'secretary',
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_users_tenant (tenant_id)
) ENGINE=InnoDB;

-- ===== CATEGORIES =====
CREATE TABLE IF NOT EXISTS categories (
  id            VARCHAR(36) PRIMARY KEY,
  tenant_id     VARCHAR(36) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  color         VARCHAR(7) DEFAULT '#3b82f6',
  icon          VARCHAR(50) DEFAULT 'Package',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_cat_tenant (tenant_id)
) ENGINE=InnoDB;

-- ===== SUPPLIERS =====
CREATE TABLE IF NOT EXISTS suppliers (
  id            VARCHAR(36) PRIMARY KEY,
  tenant_id     VARCHAR(36) NOT NULL,
  name          VARCHAR(150) NOT NULL,
  phone         VARCHAR(20),
  email         VARCHAR(200),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_sup_tenant (tenant_id)
) ENGINE=InnoDB;

-- ===== PRODUCTS =====
CREATE TABLE IF NOT EXISTS products (
  id              VARCHAR(36) PRIMARY KEY,
  tenant_id       VARCHAR(36) NOT NULL,
  sku             VARCHAR(50) NOT NULL,
  barcode         VARCHAR(50),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  image           VARCHAR(500),
  category_id     VARCHAR(36),
  cost_price      DECIMAL(10,2) DEFAULT 0,
  sale_price      DECIMAL(10,2) DEFAULT 0,
  wholesale_price DECIMAL(10,2) DEFAULT 0,
  stock           INT DEFAULT 0,
  min_stock       INT DEFAULT 5,
  favorite        BOOLEAN DEFAULT FALSE,
  hotkey          VARCHAR(5),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_prod_tenant (tenant_id),
  INDEX idx_prod_sku (sku),
  INDEX idx_prod_barcode (barcode),
  UNIQUE idx_unique_sku_tenant (tenant_id, sku)
) ENGINE=InnoDB;

-- ===== CUSTOMERS =====
CREATE TABLE IF NOT EXISTS customers (
  id              VARCHAR(36) PRIMARY KEY,
  tenant_id       VARCHAR(36) NOT NULL,
  name            VARCHAR(150) NOT NULL,
  phone           VARCHAR(20),
  email           VARCHAR(200),
  credit_balance  DECIMAL(10,2) DEFAULT 0,
  total_purchases DECIMAL(10,2) DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_cust_tenant (tenant_id)
) ENGINE=InnoDB;

-- ===== INVENTORY MOVEMENTS =====
CREATE TABLE IF NOT EXISTS inventory_movements (
  id            VARCHAR(36) PRIMARY KEY,
  tenant_id     VARCHAR(36) NOT NULL,
  product_id    VARCHAR(36) NOT NULL,
  type          ENUM('in','out','sale','adjustment') NOT NULL,
  quantity      INT NOT NULL,
  reason        VARCHAR(255),
  user_id       VARCHAR(36),
  user_name     VARCHAR(150),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_mov_tenant (tenant_id),
  INDEX idx_mov_product (product_id)
) ENGINE=InnoDB;

-- ===== REPAIR ORDERS =====
CREATE TABLE IF NOT EXISTS repair_orders (
  id                 VARCHAR(36) PRIMARY KEY,
  tenant_id          VARCHAR(36) NOT NULL,
  folio              VARCHAR(20) NOT NULL,
  customer_name      VARCHAR(150) NOT NULL,
  customer_phone     VARCHAR(20),
  device_type        VARCHAR(50) DEFAULT 'Smartphone',
  device_brand       VARCHAR(100),
  device_model       VARCHAR(100),
  problem_description TEXT,
  diagnostic         TEXT,
  private_notes      TEXT,
  status             ENUM('por_revisar','en_reparacion','esperando_refaccion','listo','entregado') DEFAULT 'por_revisar',
  cost_parts         DECIMAL(10,2) DEFAULT 0,
  cost_labor         DECIMAL(10,2) DEFAULT 0,
  total              DECIMAL(10,2) DEFAULT 0,
  technician_id      VARCHAR(36),
  technician_name    VARCHAR(150),
  ready_at           TIMESTAMP NULL,
  delivered_at       TIMESTAMP NULL,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_ord_tenant (tenant_id),
  INDEX idx_ord_status (status),
  UNIQUE idx_unique_folio_tenant (tenant_id, folio)
) ENGINE=InnoDB;

-- ===== ORDER PARTS (Refacciones usadas) =====
CREATE TABLE IF NOT EXISTS order_parts (
  id            VARCHAR(36) PRIMARY KEY,
  tenant_id     VARCHAR(36) NOT NULL,
  order_id      VARCHAR(36) NOT NULL,
  product_id    VARCHAR(36) NOT NULL,
  product_name  VARCHAR(200) NOT NULL,
  quantity      INT NOT NULL,
  unit_cost     DECIMAL(10,2) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES repair_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_op_order (order_id)
) ENGINE=InnoDB;

-- ===== SALES =====
CREATE TABLE IF NOT EXISTS sales (
  id              VARCHAR(36) PRIMARY KEY,
  tenant_id       VARCHAR(36) NOT NULL,
  folio           VARCHAR(20) NOT NULL,
  subtotal        DECIMAL(10,2) DEFAULT 0,
  discount        DECIMAL(10,2) DEFAULT 0,
  total           DECIMAL(10,2) DEFAULT 0,
  payment_method  ENUM('efectivo','tarjeta','transferencia','credito') NOT NULL,
  cash_received   DECIMAL(10,2) DEFAULT 0,
  change          DECIMAL(10,2) DEFAULT 0,
  customer_id     VARCHAR(36) NULL,
  customer_name   VARCHAR(150) NULL,
  user_id         VARCHAR(36) NOT NULL,
  user_name       VARCHAR(150) NOT NULL,
  status          ENUM('completed','on_hold','credit') DEFAULT 'completed',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sale_tenant (tenant_id),
  UNIQUE idx_unique_sale_folio (tenant_id, folio)
) ENGINE=InnoDB;

-- ===== SALE ITEMS =====
CREATE TABLE IF NOT EXISTS sale_items (
  id            VARCHAR(36) PRIMARY KEY,
  tenant_id     VARCHAR(36) NOT NULL,
  sale_id       VARCHAR(36) NOT NULL,
  product_id    VARCHAR(36),
  name          VARCHAR(200) NOT NULL,
  price         DECIMAL(10,2) NOT NULL,
  quantity      INT NOT NULL,
  discount      DECIMAL(10,2) DEFAULT 0,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_si_sale (sale_id)
) ENGINE=InnoDB;

-- ===== NOTIFICATIONS =====
CREATE TABLE IF NOT EXISTS notifications (
  id            VARCHAR(36) PRIMARY KEY,
  tenant_id     VARCHAR(36) NOT NULL,
  title         VARCHAR(200) NOT NULL,
  message       TEXT NOT NULL,
  type          ENUM('info','success','warning') DEFAULT 'info',
  read          BOOLEAN DEFAULT FALSE,
  for_roles     VARCHAR(200) DEFAULT 'owner,secretary,cashier',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_notif_tenant (tenant_id)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;