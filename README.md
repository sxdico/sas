# FixPro — Sistema Multi-Taller de Reparaciones y POS

## Requisitos
- Node.js 18+
- MySQL 8

## Instalación

### 1. Base de datos
```bash
mysql -u root -p < server/schema.sql
```

### 2. Backend (server/)
```bash
cd server
cp .env.example .env        # Edita con tus credenciales de MySQL
npm install
npm run seed                # Crea datos de prueba + usuarios
npm start                   # Inicia API en http://localhost:3001
```

### 3. Frontend (raíz del proyecto)
```bash
npm install
npm run dev                 # Inicia app en http://localhost:5173
```

## Credenciales de prueba (después de seed)

| Rol           | Email                       | Contraseña   |
|---------------|-----------------------------|--------------|
| Super Admin   | admin@fixpro.com            | admin1234    |
| Owner         | carlos@talleramirez.com     | demo1234     |
| Secretary     | ana@talleramirez.com        | demo1234     |
| Technician    | luis@talleramirez.com       | demo1234     |
| Cashier       | sofia@talleramirez.com      | demo1234     |

## Estructura
```
├── src/                    # Frontend React + Vite + Tailwind
│   ├── api/client.ts       # Cliente axios con JWT
│   ├── components/         # Layout con sidebar role-based
│   ├── context/            # AuthContext con localStorage
│   ├── pages/              # POS, Orders, Deliveries, Inventory, etc.
│   └── utils/permissions.ts # Sistema de permisos granular
├── server/                 # Backend Node.js + Express + Sequelize
│   ├── schema.sql          # Schema MySQL 8 completo
│   ├── src/
│   │   ├── models.js       # Modelos Sequelize
│   │   ├── middleware/auth.js  # authMiddleware + authorize()
│   │   ├── routes/         # auth, tenants, users, products, orders, sales, deliveries, notifications
│   │   ├── seed.js         # Datos de prueba
│   │   └── index.js        # Entry point del servidor
│   └── .env.example
```
