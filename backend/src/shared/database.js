const { Pool } = require('pg');
function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL es obligatorio.');
  return new Pool({ connectionString, connectionTimeoutMillis: 5000, max: 10 });
}
module.exports = { createPool };
