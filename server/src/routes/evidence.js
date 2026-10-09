import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { sequelize } from '../models.js';
import { authMiddleware, authorize, requireTenantId } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Config multer - guarda temporal
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), '..', 'uploads', 'tmp');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg','image/png','image/webp','image/jpg'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo jpg, png, webp'));
  }
});

// GET /api/evidencias?orden_id=xxx
router.get('/', authorize(['owner','technician','secretary','cashier']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  const { orden_id } = req.query;
  if (!orden_id) return res.status(400).json({ error: 'orden_id requerido' });

  try {
    const [rows] = await sequelize.query(
      "SELECT id, orden_id, tipo, url, thumbnail_url, nota, created_at FROM orden_evidencias WHERE orden_id = :orden_id AND tenant_id = :tenant_id ORDER BY created_at ASC",
      { replacements: { orden_id, tenant_id } }
    );
    const grouped = { ingreso: [], durante: [], salida: [] };
    rows.forEach(r => { if (grouped[r.tipo]) grouped[r.tipo].push(r); });
    res.json(grouped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/evidencias
router.post('/', authorize(['owner','technician']), upload.single('foto'), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;

  const { orden_id, tipo, nota } = req.body;
  if (!orden_id || !['ingreso','durante','salida'].includes(tipo)) {
    return res.status(400).json({ error: 'Datos invalidos' });
  }
  if (!req.file) return res.status(400).json({ error: 'No se recibio foto' });

  try {
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const filename = `fix_${uuidv4()}${ext}`;
    const thumbName = `thumb_${filename}`;

    // Carpeta final: uploads/orden_{id}/{tipo}/
    // BASE_PATH compatible Windows/Linux: usa path.join
    const baseUpload = path.join(process.cwd(), '..', 'uploads', `orden_${orden_id}`, tipo);
    if (!fs.existsSync(baseUpload)) fs.mkdirSync(baseUpload, { recursive: true });

    const finalPath = path.join(baseUpload, filename);
    const thumbPath = path.join(baseUpload, thumbName);

    // Mover y crear thumb con sharp
    await sharp(req.file.path).resize({ width: 1200 }).jpeg({ quality: 80 }).toFile(finalPath);
    await sharp(req.file.path).resize({ width: 400 }).jpeg({ quality: 75 }).toFile(thumbPath);

    // Borrar tmp
    fs.unlinkSync(req.file.path);

    // Ruta para BD siempre con / para web
    const url = `uploads/orden_${orden_id}/${tipo}/${filename}`;
    const thumbUrl = `uploads/orden_${orden_id}/${tipo}/${thumbName}`;
    const id = uuidv4();

    await sequelize.query(
      "INSERT INTO orden_evidencias (id, orden_id, tipo, url, thumbnail_url, nota, tenant_id) VALUES (:id, :orden_id, :tipo, :url, :thumb, :nota, :tenant_id)",
      { replacements: { id, orden_id, tipo, url, thumb: thumbUrl, nota: nota || null, tenant_id: tenantId } }
    );

    res.json({ ok: true, id, url, thumbnail_url: thumbUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/evidencias/:id
router.delete('/:id', authorize(['owner','technician']), async (req, res) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;
  try {
    const [rows] = await sequelize.query(
      "SELECT url, thumbnail_url FROM orden_evidencias WHERE id = :id AND tenant_id = :tenant_id",
      { replacements: { id: req.params.id, tenant_id: tenantId } }
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });

    const base = path.join(process.cwd(), '..');
    [rows[0].url, rows[0].thumbnail_url].forEach(p => {
      const fp = path.join(base, p);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });

    await sequelize.query("DELETE FROM orden_evidencias WHERE id = :id", { replacements: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
