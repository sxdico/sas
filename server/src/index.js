import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize } from './models.js';

import authRoutes from './routes/auth.js';
import tenantRoutes from './routes/tenants.js';
import userRoutes from './routes/users.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import saleRoutes from './routes/sales.js';
import deliveryRoutes from './routes/deliveries.js';
import notificationRoutes from './routes/notifications.js';
import cashRoutes from './routes/cash.js';
import evidenciasRoutes from './routes/evidence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS FIX: permite localhost + producción playit.plus

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://ifixsoft.online',
  'https://www.ifixsoft.online',
];

const envOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((s) => s.trim())
  : [];

const allAllowed = [...new Set([...allowedOrigins, ...envOrigins])];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allAllowed.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json());

// Static para fotos - compatible Windows/Linux - DEBE IR ANTES DE AUTH
app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api/evidencias', evidenciasRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Error interno' });
});

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✓ Conexión a MySQL establecida');
    await sequelize.sync({ alter: false });
    console.log('✓ Modelos sincronizados');
    app.listen(PORT, () => {
      console.log(`\n🚀 FixPro API corriendo en http://localhost:${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
      console.log(`   Evidencias: http://localhost:${PORT}/api/evidencias`);
      console.log(`   Uploads: http://localhost:${PORT}/uploads`);
      console.log(`   CORS permitido: ${allAllowed.join(', ')}`);
    });
  } catch (err) {
    console.error('✗ Error al iniciar:', err.message);
    process.exit(1);
  }
}

start();