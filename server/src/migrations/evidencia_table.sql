
CREATE TABLE IF NOT EXISTS orden_evidencias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orden_id VARCHAR(36) NOT NULL,
  tipo ENUM('ingreso','durante','salida') NOT NULL,
  url VARCHAR(255) NOT NULL,
  thumbnail_url VARCHAR(255) NULL,
  nota VARCHAR(255) NULL,
  tenant_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_orden (orden_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
