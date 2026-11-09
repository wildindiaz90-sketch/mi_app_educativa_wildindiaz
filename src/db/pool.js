require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('Falta la variable de entorno DATABASE_URL');
}

// Render (y la mayoría de PostgreSQL gestionados) requieren SSL en conexiones externas.
const useSsl =
  process.env.DATABASE_SSL === 'true' ||
  (process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL !== 'false');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});

pool.on('error', (err) => console.error('Error inesperado en el pool de PostgreSQL:', err.message));

module.exports = pool;
