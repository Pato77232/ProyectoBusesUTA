const { Client } = require('pg');
const { performance } = require('node:perf_hooks');
const { assertTestDatabase } = require('./test-database');
const { activeNames, validateHistory } = require('./migration-catalog');
const { migrate } = require('./migrate');

const SAFE_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'MIGRATION_CATALOG_INVALID',
  'MIGRATION_HISTORY_UNEXPECTED',
  'MIGRATION_SCHEMA_UNEXPECTED',
  'MIGRATION_LOCKED',
]);

function safeCode(error) {
  const code = error?.code;
  return typeof code === 'string' && (SAFE_CODES.has(code) || /^[0-9A-Z]{5}$/.test(code))
    ? code
    : 'DIAGNOSTIC_FAILED';
}

async function history(client) {
  const table = await client.query("SELECT to_regclass('public.pgmigrations') AS name");
  if (!table.rows[0].name) return [];
  const names = (await client.query('SELECT name FROM public.pgmigrations ORDER BY id')).rows.map(
    (row) => row.name,
  );
  validateHistory(names);
  return names;
}

async function diagnose({
  env = process.env,
  direction = 'status',
  target,
  createClient = (url) => new Client({ connectionString: url, connectionTimeoutMillis: 5000 }),
  runMigration = migrate,
  now = () => performance.now(),
} = {}) {
  const report = { ok: false, stage: 'validation', steps: [] };
  let client;
  try {
    const url = assertTestDatabase(env);
    if (
      !['status', 'up', 'down'].includes(direction) ||
      (direction === 'down' ? !activeNames.includes(target) : target !== undefined)
    )
      throw new Error('Solicitud de diagnóstico inválida.');
    report.stage = 'connection';
    client = createClient(url);
    await client.connect();
    report.stage = 'history';
    const names = await history(client);
    if (direction === 'down' && !names.includes(target)) throw new Error('Objetivo no aplicado.');
    const pending =
      direction === 'down'
        ? names.slice(names.indexOf(target)).reverse()
        : direction === 'up'
          ? [null]
          : [];
    for (const name of pending) {
      report.stage = direction;
      const step =
        direction === 'up'
          ? { direction, migrations: activeNames.slice(names.length), ok: false }
          : { direction, migration: name, ok: false };
      report.steps.push(step);
      const started = now();
      try {
        await runMigration(url, direction);
        step.ok = true;
      } finally {
        step.durationMs = Math.max(0, Math.round(now() - started));
      }
    }
    report.stage = 'history';
    report.applied = await history(client);
    report.ok = true;
    report.stage = 'complete';
  } catch (error) {
    report.error = { code: safeCode(error) };
  } finally {
    if (client) {
      try {
        await client.end();
      } catch {
        if (report.ok) {
          report.ok = false;
          report.stage = 'close';
          report.error = { code: 'DIAGNOSTIC_CLOSE_FAILED' };
        } else report.closeFailed = true;
      }
    }
  }
  return report;
}

if (require.main === module) {
  const [direction = 'status', target, extra] = process.argv.slice(2);
  diagnose({ direction: extra === undefined ? direction : 'invalid', target }).then((report) => {
    process.stdout.write(JSON.stringify(report) + '\n');
    process.exitCode = report.ok ? 0 : 1;
  });
}

module.exports = { diagnose };
