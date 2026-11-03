const { randomUUID } = require('node:crypto');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Pool } = require('pg');
const { assertTestDatabase } = require('../../scripts/test-database');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const executeFile = promisify(execFile);
const { activeNames, historicalNames } = require('../../scripts/migration-catalog');
const { testPool } = require('../helpers/database');
const { fleetFixtures, busRequest } = require('../helpers/fleet-bus');
const PgBusRepository = require('../../src/modules/fleet/infrastructure/pg-bus.repository');

let admin;
beforeAll(() => {
  admin = testPool();
});
afterAll(async () => {
  await admin.end();
});

async function database(execute) {
  assertTestDatabase();
  const name = 'catalog_' + randomUUID().replaceAll('-', '') + '_test';
  const url = new URL(assertTestDatabase());
  url.pathname = '/' + name;
  await admin.query('CREATE DATABASE ' + name);
  const pool = new Pool({ connectionString: url.href });
  try {
    await execute({ pool, url: url.href });
  } finally {
    await pool.end();
    // Solo el nombre aleatorio creado por esta función y con sufijo _test.
    if (!/^catalog_[a-f0-9]{32}_test$/.test(name)) throw new Error('Base QA inválida.');
    await admin.query('DROP DATABASE ' + name);
  }
}
async function worker(url, action, input = {}) {
  const { stdout } = await executeFile(
    process.execPath,
    [path.join(__dirname, '../helpers/migration-worker.js'), action, JSON.stringify(input)],
    { env: { ...process.env, DATABASE_URL: url } },
  );
  const response = JSON.parse(stdout);
  if (response.error)
    throw Object.assign(new Error(response.error.message), { code: response.error.code });
  return response.result;
}
const migrate = (url, direction = 'up') => worker(url, 'migrate', { direction });
const rawRun = (url, names) => worker(url, 'raw', { names });
async function snapshot(pool) {
  const tables = (
    await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
  ).rows;
  const data = {};
  for (const { tablename } of tables) {
    const quoted = '"' + tablename.replaceAll('"', '""') + '"';
    data[tablename] = (
      await pool.query(`SELECT row_to_json(t)::text AS row FROM public.${quoted} t ORDER BY 1`)
    ).rows;
  }
  const definitions = (
    await pool.query(`
    SELECT 'column' AS kind, table_name AS object, column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default,'') AS detail
      FROM information_schema.columns WHERE table_schema='public'
    UNION ALL SELECT 'constraint', c.relname, pg_get_constraintdef(k.oid)
      FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    UNION ALL SELECT 'index', tablename, indexdef FROM pg_indexes WHERE schemaname='public'
    UNION ALL SELECT 'function', p.proname, pg_get_functiondef(p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'
    ORDER BY 1,2,3`)
  ).rows;
  return { data, definitions };
}
async function seedDevelop(pool, withVip = false) {
  const owners = await fleetFixtures(pool);
  const bus = await new PgBusRepository(pool).create(busRequest(owners.first));
  if (withVip) {
    await pool.query(
      "UPDATE bus_seats SET category='VIP' WHERE id=(SELECT id FROM bus_seats WHERE bus_id=$1 ORDER BY label LIMIT 1)",
      [bus.id],
    );
  }
  const userId = randomUUID();
  await pool.query(
    "INSERT INTO users(id,email,password_hash,role) VALUES($1,'qa-migracion@example.ec','hash-ficticio','CUSTOMER')",
    [userId],
  );
  await pool.query("INSERT INTO auth_sessions(id,user_id,expires_at) VALUES($1,$2,'2030-01-01Z')", [
    randomUUID(),
    userId,
  ]);
  const { cooperativeId, busGroupId } = owners.first;
  const frequencyId = randomUUID();
  await pool.query(
    "INSERT INTO frequencies(id,cooperative_id,origin,destination,departure_time,ant_resolution_number) VALUES($1,$2,'Ambato','Quito','09:00','ANT-QA')",
    [frequencyId, cooperativeId],
  );
  await pool.query(
    "INSERT INTO frequency_stops(frequency_id,position,place) VALUES($1,1,'Latacunga')",
    [frequencyId],
  );
  await pool.query(
    'INSERT INTO frequency_segment_prices(frequency_id,from_position,to_position,amount) VALUES($1,0,1,2.50),($1,1,2,3.75)',
    [frequencyId],
  );
  await pool.query(
    "INSERT INTO route_sheets(cooperative_id,bus_group_id,route_date) VALUES($1,$2,'2030-01-01')",
    [cooperativeId, busGroupId],
  );
  await pool.query('INSERT INTO payment_proofs(booking_id,cooperative_id) VALUES($1,$2)', [
    randomUUID(),
    cooperativeId,
  ]);
}
async function failDuringBookings(pool) {
  await pool.query(`CREATE SCHEMA qa_failure;
    CREATE FUNCTION qa_failure.stop_bookings() RETURNS event_trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_event_trigger_ddl_commands() WHERE object_identity LIKE '%bookings_proof_context_immutable%') THEN
        RAISE EXCEPTION 'Fallo DDL inyectado por QA';
      END IF;
    END $$;
    CREATE EVENT TRIGGER qa_fail_bookings ON ddl_command_end EXECUTE FUNCTION qa_failure.stop_bookings()`);
}

test('base vacía instala esquema real, omite ocultos/originales y no duplica al reintentar', async () => {
  await database(async ({ pool, url }) => {
    expect((await snapshot(pool)).data).toEqual({});
    await migrate(url);
    const names = (await pool.query('SELECT name FROM pgmigrations ORDER BY id')).rows.map(
      ({ name }) => name,
    );
    expect(names).toEqual(activeNames);
    for (const name of historicalNames) expect(names).not.toContain(name);
    expect(
      (
        await pool.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name='bookings' AND column_name IN ('creation_request_key','proof_window_started_at','proof_reception_state')",
        )
      ).rows,
    ).toHaveLength(3);
    expect(
      (
        await pool.query(
          "SELECT tgname FROM pg_trigger WHERE tgname='bookings_proof_context_immutable'",
        )
      ).rows,
    ).toHaveLength(1);
    const before = await snapshot(pool);
    await expect(migrate(url)).resolves.toEqual([]);
    expect(await snapshot(pool)).toEqual(before);
    await migrate(url, 'down');
    expect(
      (await pool.query("SELECT to_regclass('booking_proof_receipt_results') AS name")).rows[0]
        .name,
    ).toBeNull();
    await migrate(url, 'down');
    expect((await pool.query("SELECT to_regclass('bookings') AS name")).rows[0].name).toBeNull();
    expect((await pool.query('SELECT name FROM pgmigrations ORDER BY id')).rows).toHaveLength(18);
    await migrate(url);
    expect(
      (await pool.query('SELECT name FROM pgmigrations ORDER BY id')).rows.map(({ name }) => name),
    ).toEqual(activeNames);
  });
});

test('copia de develop con datos conserva cada fila/definición y añade solamente Reservas', async () => {
  await database(async ({ pool, url }) => {
    await rawRun(url, activeNames.slice(0, 18));
    await seedDevelop(pool, true);
    expect(
      (await pool.query("SELECT count(*)::int n FROM bus_seats WHERE category='VIP'")).rows[0].n,
    ).toBe(1);
    const before = await snapshot(pool);
    expect(before.data.pgmigrations).toHaveLength(18);
    expect(before.data.bus_seats.length).toBeGreaterThan(0);
    await migrate(url);
    const after = await snapshot(pool);
    for (const [table, rows] of Object.entries(before.data)) {
      expect(after.data[table]).toEqual(
        table === 'pgmigrations' ? expect.arrayContaining(rows) : rows,
      );
    }
    expect(after.data.pgmigrations).toHaveLength(20);
    expect(after.definitions).toEqual(expect.arrayContaining(before.definitions));
    expect(
      Object.keys(after.data)
        .filter((table) => !Object.hasOwn(before.data, table))
        .sort(),
    ).toEqual([
      'booking_proof_receipt_results',
      'booking_seat_allocations',
      'booking_trip_locks',
      'bookings',
    ]);
    expect(after.data.bookings).toEqual([]);
  });
});

test.each([1, 2, 3])(
  'rechaza historial con %i originales aplicados sin cambiar nada',
  async (count) => {
    await database(async ({ pool, url }) => {
      await rawRun(url, historicalNames.slice(0, count));
      const before = await snapshot(pool);
      await expect(migrate(url)).rejects.toMatchObject({ code: 'MIGRATION_HISTORY_UNSUPPORTED' });
      await expect(migrate(url, 'down')).rejects.toMatchObject({
        code: 'MIGRATION_HISTORY_UNSUPPORTED',
      });
      expect(await snapshot(pool)).toEqual(before);
    });
  },
);

test('rechaza un hueco real del historial antes de DDL, sin reparar ni borrar filas', async () => {
  await database(async ({ pool, url }) => {
    await rawRun(url, [activeNames[1]]);
    const before = await snapshot(pool);
    await expect(migrate(url)).rejects.toMatchObject({ code: 'MIGRATION_HISTORY_UNEXPECTED' });
    expect(await snapshot(pool)).toEqual(before);
  });
});

test('rechaza entrada desconocida generada por el runner, sin escribir historial a mano', async () => {
  await database(async ({ pool, url }) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'catalog-migration-'));
    try {
      await writeFile(
        path.join(directory, '1793900000000-unexpected.js'),
        "exports.up = pgm => pgm.createTable('qa_unknown', { id: 'integer' });",
      );
      await worker(url, 'fixture', { directory });
      const before = await snapshot(pool);
      await expect(migrate(url)).rejects.toMatchObject({ code: 'MIGRATION_HISTORY_UNEXPECTED' });
      expect(await snapshot(pool)).toEqual(before);
    } finally {
      // Verificar la ruta absoluta del directorio exclusivo antes de borrarlo.
      const resolved = path.resolve(directory);
      if (
        path.dirname(resolved) !== path.resolve(os.tmpdir()) ||
        !path.basename(resolved).startsWith('catalog-migration-')
      ) {
        throw new Error('Ruta de fixture QA inesperada.');
      }
      await rm(resolved, { recursive: true, force: true });
    }
  });
});

test('rechaza tablas sin historial y objetos de Reservas sin su registro activo', async () => {
  await database(async ({ pool, url }) => {
    await pool.query('CREATE TABLE qa_existing(id integer)');
    const first = await snapshot(pool);
    await expect(migrate(url)).rejects.toMatchObject({ code: 'MIGRATION_HISTORY_UNEXPECTED' });
    expect(await snapshot(pool)).toEqual(first);
  });
  await database(async ({ pool, url }) => {
    await rawRun(url, activeNames.slice(0, 18));
    await pool.query('CREATE TABLE bookings(id text)');
    const before = await snapshot(pool);
    await expect(migrate(url)).rejects.toMatchObject({ code: 'MIGRATION_HISTORY_UNEXPECTED' });
    expect(await snapshot(pool)).toEqual(before);
  });
});

test.each([false, true])(
  'fallo durante DDL revierte esquema e historial; base develop=%s',
  async (withDevelop) => {
    await database(async ({ pool, url }) => {
      if (withDevelop) {
        await rawRun(url, activeNames.slice(0, 18));
        await seedDevelop(pool);
      }
      await failDuringBookings(pool);
      const before = await snapshot(pool);
      await expect(migrate(url)).rejects.toThrow('Fallo DDL inyectado por QA');
      expect(await snapshot(pool)).toEqual(before);
      expect((await pool.query("SELECT to_regclass('bookings') AS name")).rows[0].name).toBeNull();
      await pool.query('DROP EVENT TRIGGER qa_fail_bookings; DROP SCHEMA qa_failure CASCADE');
      await expect(migrate(url)).resolves.toHaveLength(withDevelop ? 2 : 20);
    });
  },
);

test('el bloqueo compartido impide validar mientras otro migrador tiene autoridad', async () => {
  await database(async ({ pool, url }) => {
    const lockId = await worker(url, 'lockId');
    const holder = await pool.connect();
    try {
      await holder.query('SELECT pg_advisory_lock($1)', [lockId]);
      const before = await snapshot(pool);
      await expect(migrate(url)).rejects.toMatchObject({ code: 'MIGRATION_LOCKED' });
      expect(await snapshot(pool)).toEqual(before);
    } finally {
      await holder.query('SELECT pg_advisory_unlock($1)', [lockId]);
      holder.release();
    }
    await expect(migrate(url)).resolves.toHaveLength(20);
  });
});

test('historial legítimo vacío tras down conserva su índice interno y permite reaplicar', async () => {
  await database(async ({ pool, url }) => {
    await rawRun(url, activeNames.slice(0, 1));
    await migrate(url, 'down');
    expect((await pool.query('SELECT * FROM pgmigrations')).rows).toEqual([]);
    expect((await pool.query("SELECT to_regclass('pgmigrations_pkey') AS name")).rows[0].name).toBe(
      'pgmigrations_pkey',
    );
    await expect(migrate(url)).resolves.toHaveLength(20);
    expect(
      (await pool.query('SELECT name FROM pgmigrations ORDER BY id')).rows.map(({ name }) => name),
    ).toEqual(activeNames);
  });
});

test('también actualiza la base anterior de 17 migraciones conservando sus filas', async () => {
  await database(async ({ pool, url }) => {
    await rawRun(url, activeNames.slice(0, 17));
    await seedDevelop(pool);
    const before = await snapshot(pool);
    await expect(migrate(url)).resolves.toHaveLength(3);
    const after = await snapshot(pool);
    for (const [table, rows] of Object.entries(before.data)) {
      expect(after.data[table]).toEqual(
        table === 'pgmigrations' ? expect.arrayContaining(rows) : rows,
      );
    }
    expect(after.data.pgmigrations).toHaveLength(20);
    const categoryCheck = await pool.query(
      "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname='bus_seats_category_check'",
    );
    expect(categoryCheck.rows[0].definition).toContain('VIP');
    expect(
      (await pool.query("SELECT count(*)::int n FROM bus_seats WHERE category='VIP'")).rows[0].n,
    ).toBe(0);
  });
});
