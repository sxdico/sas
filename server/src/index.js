import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
  });
});

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✓ Conexión a MySQL establecida');

    // Usamos alter: true solo la primera vez para agregar cash_session_id si falta
    await sequelize.sync({ alter: false });
    console.log('✓ Modelos sincronizados');

    app.listen(PORT, () => {
      console.log(`\n🚀 FixPro API corriendo en http://localhost:${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('✗ Error al iniciar:', err.message);
    console.error('\n  Asegúrate de:');
    console.error('  1. Tener MySQL corriendo');
    console.error('  2. Crear la DB: mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS fixpro"');
    console.error('  3. Configurar server/.env correctamente');
    process.exit(1);
  }
}

start();