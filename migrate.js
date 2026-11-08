const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migración aplicada correctamente.');
}

if (require.main === module) {
  migrate()
    .catch((e) => { console.error('Error en migración:', e); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = migrate;
