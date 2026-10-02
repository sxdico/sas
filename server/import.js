import fs from 'fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const sql = fs.readFileSync('./schema.sql', 'utf8');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    multipleStatements: true
  });

  console.log('Conectando a Clever Cloud...');
  await connection.query(sql);
  console.log('Tablas creadas con exito en Clever Cloud!');
  await connection.end();
}

run().catch(e => console.error('Error:', e.message));