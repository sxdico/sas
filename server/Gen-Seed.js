import bcrypt from 'bcryptjs';
import fs from 'fs';
import { randomUUID } from 'crypto';

const adminHash = await bcrypt.hash('admin123', 10);
const ownerHash = await bcrypt.hash('123456', 10);

const tenantId = randomUUID();
const superAdminId = randomUUID();
const ownerId = randomUUID();

const sql = `
-- Seed FixPro
INSERT INTO tenants (id, name_taller, name_dueno, email, phone, status, plan) VALUES
('${tenantId}', 'Taller FixPro Demo', 'Enrique Castillo', 'demo@fixpro.com', '8681234567', 'active', 'pro');

INSERT INTO users (id, tenant_id, name, email, password_hash, role, active) VALUES
('${superAdminId}', NULL, 'Super Admin', 'admin@fixpro.com', '${adminHash}', 'super_admin', TRUE),
('${ownerId}', '${tenantId}', 'Owner Demo', 'owner@fixpro.com', '${ownerHash}', 'owner', TRUE);

INSERT INTO categories (id, tenant_id, name, color) VALUES
('${randomUUID()}', '${tenantId}', 'Refacciones', '#3b82f6'),
('${randomUUID()}', '${tenantId}', 'Accesorios', '#10b981');

SELECT 'Seed generado correctamente' as status;
`;

fs.writeFileSync('./seed_clever.sql', sql);
console.log('Archivo seed_clever.sql generado!');
console.log('Admin: admin@fixpro.com / admin123');
console.log('Owner: owner@fixpro.com / 123456');
