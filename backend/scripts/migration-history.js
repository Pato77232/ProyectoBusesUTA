const { MigrationSafetyError, validateHistory } = require('./migration-catalog');

function unexpectedSchema() {
  return new MigrationSafetyError(
    'MIGRATION_HISTORY_UNEXPECTED',
    'El esquema no corresponde al historial conocido. Se necesita revisión antes de migrar; no se aplicaron cambios.',
  );
}

async function assertHistory(client) {
  const {
    rows: [relation],
  } = await client.query(
    "SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='pgmigrations'",
  );
  let names = [];
  if (relation) {
    if (relation.relkind !== 'r') throw unexpectedSchema();
    const { rows: columns } = await client.query(
      "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='pgmigrations' ORDER BY ordinal_position",
    );
    if (
      columns.length !== 3 ||
      columns[0].column_name !== 'id' ||
      columns[0].data_type !== 'integer' ||
      columns[1].column_name !== 'name' ||
      columns[1].data_type !== 'character varying' ||
      columns[2].column_name !== 'run_on' ||
      columns[2].data_type !== 'timestamp without time zone'
    ) {
      throw unexpectedSchema();
    }
    if (
      columns.some(({ is_nullable }) => is_nullable !== 'NO') ||
      !columns[0].column_default?.startsWith('nextval(')
    )
      throw unexpectedSchema();
    const { rows: primaryKey } = await client.query(`
      SELECT a.attname FROM pg_index i
      JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
      WHERE i.indrelid='public.pgmigrations'::regclass AND i.indisprimary AND i.indnkeyatts=1`);
    if (primaryKey.length !== 1 || primaryKey[0].attname !== 'id') throw unexpectedSchema();
    const { rows } = await client.query('SELECT name FROM public.pgmigrations ORDER BY run_on, id');
    names = rows.map(({ name }) => name);
    validateHistory(names);
  }
  // Sin historial no adoptar tablas/funciones/tipos de otra instalación.
  if (names.length === 0) {
    const { rows } = await client.query(`
      SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind NOT IN ('i','I')
        AND c.relname NOT IN ('pgmigrations','pgmigrations_id_seq')
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
      UNION ALL
      SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public'
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
      UNION ALL
      SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
      WHERE n.nspname='public' AND t.typtype IN ('e','d')
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_type'::regclass AND d.objid=t.oid AND d.deptype='e')`);
    if (rows.length) throw unexpectedSchema();
  }
  const installed = names.includes('1793820000000-install-bookings');
  {
    const { rows } = await client.query(`
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('bookings','booking_trip_locks','booking_seat_allocations')
      UNION ALL
      SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='protect_booking_proof_context'`);
    if ((!installed && rows.length) || (installed && rows.length !== 4)) throw unexpectedSchema();
  }
}

module.exports = { assertHistory };
