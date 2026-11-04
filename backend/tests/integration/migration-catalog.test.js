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
function expectedUpgradedRows(table, rows) {
  if (table !== 'payment_proofs') return rows;
  return rows.map(({ row }) => {
    const proof = JSON.parse(row);
    if (!Object.hasOwn(proof, 'upload_authorized_by')) {
      proof.upload_authorized_by = null;
      proof.upload_authorized_at = null;
    }
    return { row: JSON.stringify(proof) };
  });
}
async function seedDevelop(pool, withVip = false) {
  const owners = await fleetFixtures(pool);
  const request = busRequest({
    ...owners.first,
    data: withVip ? { vipSeatKeys: ['deck-1-0-1'] } : {},
  });
  await new PgBusRepository(pool).create(request);
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
      (await pool.query("SELECT to_regclass('route_sheet_renewals') AS name")).rows[0].name,
    ).toBeNull();
    await migrate(url, 'down');
    expect(
      (
        await pool.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name='payment_proofs' AND column_name='upload_authorized_at'",
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await pool.query(
          "SELECT data_type FROM information_schema.columns WHERE table_name='payment_proofs' AND column_name='booking_id'",
        )
      ).rows[0].data_type,
    ).toBe('text');
    await migrate(url, 'down');
    expect(
      (await pool.query("SELECT tgname FROM pg_trigger WHERE tgname='bus_seats_immutable'")).rows,
    ).toEqual([]);
    await migrate(url, 'down');
    expect(
      (
        await pool.query(
          "SELECT data_type FROM information_schema.columns WHERE table_name='payment_proofs' AND column_name='booking_id'",
        )
      ).rows[0].data_type,
    ).toBe('uuid');
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

test('copia de develop conserva filas/definiciones y añade Reservas con procedencia', async () => {
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
        table === 'pgmigrations' ? expect.arrayContaining(rows) : expectedUpgradedRows(table, rows),
      );
    }
    expect(after.data.pgmigrations).toHaveLength(24);
    expect(after.definitions).toEqual(
      expect.arrayContaining(
        before.definitions.map((entry) =>
          entry.kind === 'column' &&
          ['payment_proofs', 'payment_proof_notification_outbox'].includes(entry.object) &&
          entry.detail.startsWith('booking_id:uuid:')
            ? { ...entry, detail: entry.detail.replace('booking_id:uuid:', 'booking_id:text:') }
            : entry,
        ),
      ),
    );
    expect(
      Object.keys(after.data)
        .filter((table) => !Object.hasOwn(before.data, table))
        .sort(),
    ).toEqual([
      'booking_proof_receipt_results',
      'booking_seat_allocations',
      'booking_trip_locks',
      'bookings',
      'route_sheet_renewals',
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
      await expect(migrate(url)).resolves.toHaveLength(withDevelop ? 6 : 24);
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
    await expect(migrate(url)).resolves.toHaveLength(24);
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
    await expect(migrate(url)).resolves.toHaveLength(24);
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
    await expect(migrate(url)).resolves.toHaveLength(7);
    const after = await snapshot(pool);
    for (const [table, rows] of Object.entries(before.data)) {
      expect(after.data[table]).toEqual(
        table === 'pgmigrations' ? expect.arrayContaining(rows) : expectedUpgradedRows(table, rows),
      );
    }
    expect(after.data.pgmigrations).toHaveLength(24);
    const categoryCheck = await pool.query(
      "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname='bus_seats_category_check'",
    );
    expect(categoryCheck.rows[0].definition).toContain('VIP');
    expect(
      (await pool.query("SELECT count(*)::int n FROM bus_seats WHERE category='VIP'")).rows[0].n,
    ).toBe(0);
  });
});

test('actualiza develop con Reservas existentes sin perder plazos ni ocupaciones', async () => {
  await database(async ({ pool, url }) => {
    await rawRun(url, activeNames.slice(0, 19));
    await seedDevelop(pool, true);
    await pool.query("INSERT INTO booking_trip_locks VALUES('coop-upgrade','trip-upgrade')");
    for (const [id, reception] of [
      ['pending-upgrade', 'NOT_RECEIVED'],
      ['received-upgrade', 'RECEIVED'],
      ['legacy-upgrade', 'UNKNOWN'],
    ]) {
      const known = reception !== 'UNKNOWN';
      const received = reception === 'RECEIVED';
      await pool.query(
        `INSERT INTO bookings(id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,
          base_price_cents,discount_cents,total_price_cents,created_at,expires_at,
          proof_window_started_at,proof_window_seconds,proof_reception_state,accepted_proof_id,proof_received_at)
        VALUES($1,'coop-upgrade','trip-upgrade','owner-upgrade',0,1,'PENDING_PAYMENT',$2,
          100,0,100,'2026-11-03T14:00:00Z','2026-11-03T14:05:00Z',$3,$4,$5,$6,$7)`,
        [
          id,
          { passengers: [{ seatId: 'seat-' + id }], totalPriceCents: 100 },
          known ? '2026-11-03T14:00:00Z' : null,
          known ? 300 : null,
          reception,
          received ? 'proof-upgrade' : null,
          received ? '2026-11-03T14:01:00Z' : null,
        ],
      );
      await pool.query(
        `INSERT INTO booking_seat_allocations VALUES($1,'coop-upgrade','trip-upgrade',$2,0,1,'RESERVED',true)`,
        [id, 'seat-' + id],
      );
    }
    const before = await snapshot(pool);
    expect(before.data.pgmigrations).toHaveLength(19);
    await expect(migrate(url)).resolves.toHaveLength(5);
    const after = await snapshot(pool);
    for (const [table, rows] of Object.entries(before.data)) {
      if (table === 'bookings') {
        const oldRows = rows.map(({ row }) => JSON.parse(row));
        const updatedRows = after.data.bookings.map(({ row }) => {
          const booking = JSON.parse(row);
          expect(booking.expired_at).toBeNull();
          delete booking.expired_at;
          return booking;
        });
        expect(updatedRows).toEqual(oldRows);
      } else {
        expect(after.data[table]).toEqual(
          table === 'pgmigrations'
            ? expect.arrayContaining(rows)
            : expectedUpgradedRows(table, rows),
        );
      }
    }
    expect(after.data.pgmigrations).toHaveLength(24);
    expect(after.data.booking_proof_receipt_results).toEqual([]);
    expect(after.data.booking_seat_allocations).toHaveLength(3);
    await expect(migrate(url)).resolves.toEqual([]);
    expect(await snapshot(pool)).toEqual(after);
  });
});

async function seedProofOutbox(pool) {
  await seedDevelop(pool, true);
  await pool.query(`UPDATE payment_proofs SET status='UPLOADED', file_key='qa-private-key',
    original_file_name='qa.pdf',media_type='application/pdf',file_size_bytes=16,uploaded_at='2026-11-03T14:01:00Z'`);
  await pool.query(`INSERT INTO payment_proof_notification_outbox(payment_proof_id,booking_id)
    SELECT id,booking_id FROM payment_proofs`);
}
async function expectBookingIdType(pool, expected) {
  const { rows } = await pool.query(`SELECT table_name,data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('payment_proofs','payment_proof_notification_outbox')
    AND column_name='booking_id' ORDER BY table_name`);
  expect(rows).toHaveLength(2);
  expect(rows.every((row) => row.data_type === expected)).toBe(true);
}
test('actualiza develop con comprobante/outbox, IDs opacos y procedencia sin perder filas', async () => {
  await database(async ({ pool, url }) => {
    await rawRun(url, activeNames.slice(0, 20));
    await seedProofOutbox(pool);
    const before = await snapshot(pool);
    await expectBookingIdType(pool, 'uuid');
    expect(before.data.pgmigrations).toHaveLength(20);
    await expect(migrate(url)).resolves.toHaveLength(4);
    await expectBookingIdType(pool, 'text');
    const after = await snapshot(pool);
    for (const [table, rows] of Object.entries(before.data)) {
      expect(after.data[table]).toEqual(
        table === 'pgmigrations' ? expect.arrayContaining(rows) : expectedUpgradedRows(table, rows),
      );
    }
    expect(after.data.pgmigrations).toHaveLength(24);
    await expect(migrate(url)).resolves.toEqual([]);
    expect(await snapshot(pool)).toEqual(after);
    await migrate(url, 'down');
    expect(
      (await pool.query("SELECT to_regclass('route_sheet_renewals') AS name")).rows[0].name,
    ).toBeNull();
    await migrate(url, 'down');
    expect(
      (
        await pool.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name='payment_proofs' AND column_name='upload_authorized_at'",
        )
      ).rows,
    ).toEqual([]);
    await expectBookingIdType(pool, 'text');
    await migrate(url, 'down');
    expect(
      (await pool.query("SELECT tgname FROM pg_trigger WHERE tgname='bus_seats_immutable'")).rows,
    ).toEqual([]);
    await migrate(url, 'down');
    await expectBookingIdType(pool, 'uuid');
    expect(await snapshot(pool)).toEqual(before);
    await expect(migrate(url)).resolves.toHaveLength(4);
    await expectBookingIdType(pool, 'text');
  });
});

test('procedencia conserva cargas históricas y bloquea down cuando ya hay cargas autorizadas', async () => {
  await database(async ({ pool, url }) => {
    await rawRun(url, activeNames.slice(0, 21));
    await seedDevelop(pool);
    await pool.query(`UPDATE payment_proofs SET status='UPLOADED', file_key='legacy-file',
      original_file_name='legacy.pdf', media_type='application/pdf', file_size_bytes=16,
      uploaded_at='2026-11-03T14:01:00Z'`);
    const legacy = (await pool.query('SELECT * FROM payment_proofs')).rows[0];
    await expect(migrate(url)).resolves.toHaveLength(3);
    const migrated = (await pool.query('SELECT * FROM payment_proofs')).rows[0];
    expect(migrated).toMatchObject({
      id: legacy.id,
      booking_id: legacy.booking_id,
      status: 'UPLOADED',
      file_key: 'legacy-file',
      upload_authorized_by: null,
      upload_authorized_at: null,
    });

    await migrate(url, 'down');
    expect(
      (await pool.query("SELECT to_regclass('route_sheet_renewals') AS name")).rows[0].name,
    ).toBeNull();
    await pool.query(`UPDATE payment_proofs SET upload_authorized_by='qa-customer',
      upload_authorized_at='2026-11-03T14:02:00Z'`);
    const beforeDown = await snapshot(pool);
    await expect(migrate(url, 'down')).rejects.toMatchObject({ code: '23514' });
    expect(await snapshot(pool)).toEqual(beforeDown);
  });
});

test.each(['reserva opaca/2026:á', 'ABCDEFAB-0000-4000-8000-000000000001'])(
  'down rechaza sin cambios la identidad no canónica %s',
  async (id) => {
    await database(async ({ pool, url }) => {
      await migrate(url);
      await seedProofOutbox(pool);
      await migrate(url, 'down');
      await migrate(url, 'down');
      await migrate(url, 'down');
      await pool.query('UPDATE payment_proofs SET booking_id=$1', [id]);
      await pool.query('UPDATE payment_proof_notification_outbox SET booking_id=$1', [id]);
      const before = await snapshot(pool);
      await expect(migrate(url, 'down')).rejects.toMatchObject({ code: '23514' });
      expect(await snapshot(pool)).toEqual(before);
      await expectBookingIdType(pool, 'text');
      expect(before.data.pgmigrations).toHaveLength(21);
      for (const table of ['payment_proofs', 'payment_proof_notification_outbox']) {
        for (const invalid of ['', '   ']) {
          await expect(
            pool.query(`UPDATE ${table} SET booking_id=$1`, [invalid]),
          ).rejects.toMatchObject({ code: '23514' });
          expect(await snapshot(pool)).toEqual(before);
        }
      }
    });
  },
);
test('fallo DDL en la segunda tabla revierte los dos tipos y el historial', async () => {
  await database(async ({ pool, url }) => {
    await rawRun(url, activeNames.slice(0, 20));
    await seedProofOutbox(pool);
    const before = await snapshot(pool);
    await pool.query(`CREATE SCHEMA qa_opaque_failure;
      CREATE FUNCTION qa_opaque_failure.stop_second() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN
        IF EXISTS(SELECT 1 FROM pg_event_trigger_ddl_commands() WHERE command_tag='ALTER TABLE'
          AND object_identity='public.payment_proof_notification_outbox') THEN
          RAISE EXCEPTION 'Fallo QA en segunda tabla'; END IF; END $$;
      CREATE EVENT TRIGGER qa_fail_opaque ON ddl_command_end EXECUTE FUNCTION qa_opaque_failure.stop_second()`);
    try {
      await expect(migrate(url)).rejects.toThrow();
      expect(await snapshot(pool)).toEqual(before);
      await expectBookingIdType(pool, 'uuid');
    } finally {
      await pool.query('DROP EVENT TRIGGER qa_fail_opaque; DROP SCHEMA qa_opaque_failure CASCADE');
    }
    await expect(migrate(url)).resolves.toHaveLength(4);
    await expectBookingIdType(pool, 'text');
  });
});

// develop ya tiene IDs opacos; se agregan Fleet, procedencia y renovación sin reescribir historial.
test('actualiza develop y conserva identidades opacas al revertir Fleet, procedencia y renovación', async () => {
  await database(async ({ pool, url }) => {
    await rawRun(url, activeNames.slice(0, 21));
    await seedProofOutbox(pool);
    const opaque = 'reserva opaca/2026:á';
    await pool.query('UPDATE payment_proofs SET booking_id=$1', [opaque]);
    await pool.query('UPDATE payment_proof_notification_outbox SET booking_id=$1', [opaque]);
    const before = await snapshot(pool);
    expect(before.data.pgmigrations).toHaveLength(21);
    await expectBookingIdType(pool, 'text');
    await expect(migrate(url)).resolves.toHaveLength(3);
    const after = await snapshot(pool);
    expect(after.data.pgmigrations).toHaveLength(24);
    for (const [table, rows] of Object.entries(before.data)) {
      expect(after.data[table]).toEqual(
        table === 'pgmigrations' ? expect.arrayContaining(rows) : expectedUpgradedRows(table, rows),
      );
    }
    expect(after.definitions).toEqual(expect.arrayContaining(before.definitions));
    await expect(pool.query('UPDATE bus_seats SET offered=NOT offered')).rejects.toMatchObject({
      code: '23001',
    });
    await migrate(url, 'down');
    expect(
      (await pool.query("SELECT to_regclass('route_sheet_renewals') AS name")).rows[0].name,
    ).toBeNull();
    await migrate(url, 'down');
    expect(
      (
        await pool.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name='payment_proofs' AND column_name='upload_authorized_at'",
        )
      ).rows,
    ).toEqual([]);
    await migrate(url, 'down');
    expect(await snapshot(pool)).toEqual(before);
    await expectBookingIdType(pool, 'text');
    await expect(migrate(url)).resolves.toHaveLength(3);
    await expect(pool.query('DELETE FROM bus_seats')).rejects.toMatchObject({ code: '23001' });
  });
});

test('actualiza develop con 23 migraciones y revierte solo renovación sin perder datos ni protección de asientos', async () => {
  await database(async ({ pool, url }) => {
    await rawRun(url, activeNames.slice(0, 23));
    await seedProofOutbox(pool);
    const before = await snapshot(pool);
    expect(before.data.pgmigrations).toHaveLength(23);
    await expect(migrate(url)).resolves.toHaveLength(1);
    const after = await snapshot(pool);
    expect(after.data.pgmigrations).toHaveLength(24);
    expect(after.data.route_sheet_renewals).toEqual([]);
    for (const [table, rows] of Object.entries(before.data)) {
      expect(after.data[table]).toEqual(
        table === 'pgmigrations' ? expect.arrayContaining(rows) : rows,
      );
    }
    expect(after.definitions).toEqual(expect.arrayContaining(before.definitions));
    await expect(pool.query('UPDATE bus_seats SET offered=NOT offered')).rejects.toMatchObject({
      code: '23001',
    });
    await migrate(url, 'down');
    expect(await snapshot(pool)).toEqual(before);
    await expectBookingIdType(pool, 'text');
    await expect(pool.query('DELETE FROM bus_seats')).rejects.toMatchObject({ code: '23001' });
    await expect(migrate(url)).resolves.toHaveLength(1);
  });
});
