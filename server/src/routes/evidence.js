import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { sequelize } from '../models.js';
import { authMiddleware, authorize, requireTenantId } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_ROOT = path.join(__dirname, '..', '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Solo imágenes'), false) });

async function listar(tenantId, ordenId) {
  const [rows] = await sequelize.query(
    `SELECT id, orden_id, tipo, url, thumbnail_url, nota, created_at FROM orden_evidencias WHERE tenant_id=:tenantId AND orden_id=:ordenId ORDER BY created_at ASC`,
    { replacements: { tenantId, ordenId } }
  );
  const g = { ingreso: [], durante: [], salida: [] };
  for (const r of rows) if (g[r.tipo]) g[r.tipo].push(r);
  return g;
}

router.get('/', authorize(['owner','technician','cashier']), async (req,res)=>{
  const tenantId=requireTenantId(req,res); if(!tenantId) return;
  try{
    const ordenId=req.query.orden_id||req.query.ordenId;
    if(!ordenId) return res.status(400).json({error:'orden_id requerido'});
    res.json(await listar(tenantId, ordenId));
  }catch(e){ res.status(500).json({error:e.message}); }
});

router.get('/:ordenId', authorize(['owner','technician','cashier']), async (req,res)=>{
  const tenantId=requireTenantId(req,res); if(!tenantId) return;
  try{
    if(req.params.ordenId==='upload') return res.status(400).json({error:'Use POST'});
    res.json(await listar(tenantId, req.params.ordenId));
  }catch(e){ res.status(500).json({error:e.message}); }
});

async function subir(req,res){
  const tenantId=requireTenantId(req,res); if(!tenantId) return;
  if(!req.file) return res.status(400).json({error:'No archivo'});
  const finalOrdenId=req.body.orden_id||req.body.ordenId;
  if(!finalOrdenId) return res.status(400).json({error:'orden_id requerido'});
  const tipoFinal=['ingreso','durante','salida'].includes(req.body.tipo)?req.body.tipo:'ingreso';

  const [ordenRows]=await sequelize.query(`SELECT id FROM repair_orders WHERE id=:ordenId AND tenant_id=:tenantId LIMIT 1`,{replacements:{ordenId:finalOrdenId,tenantId}});
  if(ordenRows.length===0) return res.status(404).json({error:'Orden no encontrada'});

  const ordenFolder=path.join(UPLOAD_ROOT,`orden_${finalOrdenId}`,tipoFinal);
  if(!fs.existsSync(ordenFolder)) fs.mkdirSync(ordenFolder,{recursive:true});

  const fileName=`fix_${uuidv4()}.webp`;
  const thumbName=`thumb_${fileName}`;
  const filePath = path.join(ordenFolder,fileName);
  const thumbPath = path.join(ordenFolder,thumbName);

  // FIX ROTACIÓN: .rotate() lee EXIF y endereza automáticamente foto vertical del cel
  await sharp(req.file.buffer).rotate().resize(1600,1600,{fit:'inside',withoutEnlargement:true}).webp({quality:80}).toFile(filePath);
  await sharp(req.file.buffer).rotate().resize(400,400,{fit:'inside',withoutEnlargement:true}).webp({quality:70}).toFile(thumbPath);

  const url=`uploads/orden_${finalOrdenId}/${tipoFinal}/${fileName}`;
  const thumbnail_url=`uploads/orden_${finalOrdenId}/${tipoFinal}/${thumbName}`;
  const id=uuidv4();

  await sequelize.query(
    `INSERT INTO orden_evidencias (id, orden_id, tipo, url, thumbnail_url, nota, tenant_id) VALUES (:id,:orden_id,:tipo,:url,:thumbnail_url,:nota,:tenant_id)`,
    { replacements: { id, orden_id: finalOrdenId, tipo: tipoFinal, url, thumbnail_url, nota: req.body.nota||null, tenant_id: tenantId } }
  );

  res.status(201).json({id, orden_id:finalOrdenId, tipo:tipoFinal, url, thumbnail_url, nota:req.body.nota});
}

router.post('/', authorize(['owner','technician','cashier']), upload.single('foto'), async (req,res)=>{ try{await subir(req,res);}catch(e){console.error(e);res.status(500).json({error:e.message});} });
router.post('/upload', authorize(['owner','technician','cashier']), upload.single('foto'), async (req,res)=>{ try{await subir(req,res);}catch(e){console.error(e);res.status(500).json({error:e.message});} });

router.delete('/:id', authorize(['owner','technician']), async (req,res)=>{
  const tenantId=requireTenantId(req,res); if(!tenantId) return;
  try{
    const [rows]=await sequelize.query(`SELECT url, thumbnail_url FROM orden_evidencias WHERE id=:id AND tenant_id=:tenantId LIMIT 1`,{replacements:{id:req.params.id,tenantId}});
    if(rows.length===0) return res.status(404).json({error:'No encontrada'});
    try{ const p1=path.join(__dirname,'..','..','..',rows[0].url); const p2=path.join(__dirname,'..','..','..',rows[0].thumbnail_url); if(fs.existsSync(p1)) fs.unlinkSync(p1); if(fs.existsSync(p2)) fs.unlinkSync(p2);}catch{}
    await sequelize.query(`DELETE FROM orden_evidencias WHERE id=:id AND tenant_id=:tenantId`,{replacements:{id:req.params.id,tenantId}});
    res.json({message:'Eliminada'});
  }catch(e){ res.status(500).json({error:e.message}); }
});

export default router;