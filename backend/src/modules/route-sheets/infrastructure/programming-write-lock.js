// Mismo espacio de advisory lock que la migración de programación. No datos del tenant.
const PROGRAMMING_LOCK_KEY = 1793650000;

async function lockProgrammingWrites(executor) {
  await executor.query('SELECT pg_advisory_xact_lock($1)', [PROGRAMMING_LOCK_KEY]);
}

module.exports = lockProgrammingWrites;
