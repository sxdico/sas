import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize } from './models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// desde src/ -> ../../uploads
const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

console.log('📁 Buscando en:', UPLOAD_ROOT);

if (!fs.existsSync(UPLOAD_ROOT)) {
  console.log('❌ No existe la carpeta uploads');
  process.exit(0);
}

const [dbFiles] = await sequelize.query(`SELECT url, thumbnail_url FROM orden_evidencias`);
const dbSet = new Set();
for (const r of dbFiles) {
  if (r.url) dbSet.add(r.url.replace(/\\/g, '/'));
  if (r.thumbnail_url) dbSet.add(r.thumbnail_url.replace(/\\/g, '/'));
}

console.log(`📸 En BD hay ${dbSet.size} referencias`);

let total = 0;
let borrados = 0;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(full);
      // borrar carpetas vacías
      try {
        if (fs.readdirSync(full).length === 0) {
          fs.rmdirSync(full);
          console.log(`📂 Carpeta vacía borrada: ${full}`);
        }
      } catch {}
    } else {
      total++;
      const rel = path.relative(path.join(__dirname, '..', '..'), full).replace(/\\/g, '/');
      // rel es tipo uploads/orden_xxx/ingreso/fix_xxx.webp
      if (!dbSet.has(rel)) {
        console.log(`🗑️ Borrando huérfano: ${rel}`);
        fs.unlinkSync(full);
        borrados++;
      }
    }
  }
}

walk(UPLOAD_ROOT);

console.log(`\n✅ Listo. Total en disco: ${total}, Borrados: ${borrados}, Válidos en BD: ${dbSet.size}`);
await sequelize.close();