
-- Seed FixPro
INSERT INTO tenants (id, name_taller, name_dueno, email, phone, status, plan) VALUES
('b6ec765c-939a-4903-8662-9460b947774c', 'Taller FixPro Demo', 'Enrique Castillo', 'demo@fixpro.com', '8681234567', 'active', 'pro');

INSERT INTO users (id, tenant_id, name, email, password_hash, role, active) VALUES
('83679d6d-ba61-4745-886b-2ef0867c065f', NULL, 'Super Admin', 'admin@fixpro.com', '$2a$10$khjjFVA3xtC9bwjmBElJjuPAIXnb2a2OTqZaPI.1oUdbQ/Kgt8mmm', 'super_admin', TRUE),
('a682072a-f137-4e86-b5c3-384cc1ea012c', 'b6ec765c-939a-4903-8662-9460b947774c', 'Owner Demo', 'owner@fixpro.com', '$2a$10$jRBU9974kwdCwpy3aTVZYOqgoLC8QwGvuqH1RpMRJkpUoY7Kc5eX6', 'owner', TRUE);

INSERT INTO categories (id, tenant_id, name, color) VALUES
('25d7cf25-6644-4ee8-a376-fbb112b1c956', 'b6ec765c-939a-4903-8662-9460b947774c', 'Refacciones', '#3b82f6'),
('5a31bc62-b8e3-45c8-9aa8-d6cb9e7f8fbb', 'b6ec765c-939a-4903-8662-9460b947774c', 'Accesorios', '#10b981');

SELECT 'Seed generado correctamente' as status;
