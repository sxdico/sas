<?php
// generar_evidencia.php - Ejecutar 1 vez: php generar_evidencia.php
// Compatible Windows 10 (tu laptop) y Ubuntu (tu HP ML310e)

echo "Generando estructura Evidencia para FixPro...\n";

$dirs = [
    'uploads',
    'server/src/migrations',
    'src/components/evidencia',
];

foreach ($dirs as $dir) {
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
        echo "[OK] Creado: $dir\n";
    } else {
        echo "[--] Ya existe: $dir\n";
    }
}

// .gitignore para no subir fotos a GitHub
file_put_contents('uploads/.gitignore', "*\n!.gitignore\n");
echo "[OK] .gitignore en uploads/\n";

// SQL para la tabla
$sql = "
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
";

file_put_contents('server/src/migrations/evidencia_table.sql', $sql);
echo "[OK] SQL creado: server/src/migrations/evidencia_table.sql\n";

echo "\nListo! Ahora importa ese SQL en HeidiSQL y sigue al Paso 2.\n";
?>