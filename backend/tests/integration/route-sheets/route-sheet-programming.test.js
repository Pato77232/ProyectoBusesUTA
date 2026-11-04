const { randomUUID } = require('node:crypto');
const { runMigration, testPool } = require('../../helpers/database');
const { rollbackBefore } = require('../../helpers/migration-target');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { createFrequenciesModule } = require('../../../src/modules/frequencies');
const { createFleetModule } = require('../../../src/modules/fleet');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const { busRequest, fleetFixtures } = require('../../helpers/fleet-bus');
const fixture = require('../../helpers/route-programming');
const PgRepository = require('../../../src/modules/route-sheets/infrastructure/repositories/pg-route-sheet-programming-repository');
const saveFactory = require('../../../src/modules/route-sheets/application/use-cases/save-route-sheet-programming.use-case');
const {
  readProgramming,
} = require('../../../src/modules/route-sheets/infrastructure/repositories/programming-records');

const pass = (_req, _res, next) => next();
const auth = { authenticate: pass, authorize: () => pass, csrfProtection: pass };
let pool, repo, frequencyQueries, busQueries, f, otherOwner, save, legacyUpgrade;

function makeSave(repository = repo, buses = busQueries) {
  return saveFactory({
    programmingRepository: repository,
    busQueryPort: buses,
    now: () => '2026-11-01T00:00:00Z',
  });
}

async function createSheet(date = '2026-11-02') {
  return (
    await pool.query(
      'INSERT INTO route_sheets(cooperative_id,bus_group_id,route_date) VALUES($1,$2,$3) RETURNING id',
      [f.cooperativeId, f.busGroupId, date],
    )
  ).rows[0].id;
}

beforeAll(async () => {
  assertTestDatabase();
  runMigration();
  pool = testPool();
  // Probar la transición desde el esquema previo y datos legados, no solo creación vacía.
  await pool.query('TRUNCATE cooperatives CASCADE');
  // Alcanzar el esquema previo a programación aunque se añadan migraciones posteriores.
  const target = '1793650000000-route-sheet-programming';
  const applied = (await pool.query('SELECT name FROM pgmigrations ORDER BY id DESC')).rows;
  expect(applied.map(({ name }) => name)).toContain(target);
  for (const { name } of applied) {
    runMigration('down');
    if (name === target) break;
  }
  expect(
    (await pool.query('SELECT name FROM pgmigrations')).rows.map(({ name }) => name),
  ).not.toContain(target);
  await pool.query('TRUNCATE cooperatives CASCADE');
  const owners = await fleetFixtures(pool);
  const sheet = (
    await pool.query(
      "INSERT INTO route_sheets(cooperative_id,bus_group_id,route_date) VALUES($1,$2,'2026-10-01') RETURNING id",
      [owners.first.cooperativeId, owners.first.busGroupId],
    )
  ).rows[0].id;
  const assignment = randomUUID();
  await pool.query(
    'INSERT INTO route_sheet_assignments(id,route_sheet_id,cooperative_id,bus_group_id,bus_id,frequency_id) VALUES($1,$2,$3,$4,$5,$6)',
    [
      assignment,
      sheet,
      owners.first.cooperativeId,
      owners.first.busGroupId,
      randomUUID(),
      randomUUID(),
    ],
  );
  runMigration();
  legacyUpgrade = (
    await pool.query('SELECT * FROM route_sheet_assignments WHERE id=$1', [assignment])
  ).rows[0];
  frequencyQueries = createFrequenciesModule({ pool, auth }).frequencyQueries;
  busQueries = createFleetModule({ pool, auth, env: { NODE_ENV: 'test' } }).busQueries;
  repo = new PgRepository(pool, { frequencySessionFactory: frequencyQueries.forTransaction });
  save = makeSave();
});

beforeEach(async () => {
  assertTestDatabase();
  await pool.query('TRUNCATE cooperatives CASCADE');
  const owners = await fleetFixtures(pool);
  otherOwner = owners.second;
  const bus = await new PgBusRepository(pool).create(busRequest(owners.first));
  f = fixture({ ...owners.first, busId: bus.id });
  f.context.routeSheetId = await createSheet();
  for (const frequency of f.frequencies) {
    await pool.query(
      'INSERT INTO frequencies(id,cooperative_id,origin,destination,departure_time,ant_resolution_number) VALUES($1,$2,$3,$4,$5,$6)',
      [
        frequency.id,
        f.cooperativeId,
        frequency.origin,
        frequency.destination,
        frequency.departureTime,
        frequency.antResolutionNumber,
      ],
    );
  }
});

afterAll(async () => {
  if (pool) await pool.end();
});

test('upgrade conserva asignación legada sin inventar tiempos', () => {
  expect(legacyUpgrade).toMatchObject({
    required_service_id: null,
    departure_at: null,
    arrival_at: null,
    preparation_minutes: null,
  });
});

test('guarda tres frecuencias del mismo bus con proveedores públicos reales y auditoría', async () => {
  const result = await save({ ...f.context, ...f.body });
  expect(result.revision).toBe(1);
  expect(result.programming.agendas[0].activities.map((a) => a.id)).toEqual(
    f.body.programming.agendas[0].activities.map((a) => a.id),
  );
  expect(result.programming.agendas[0].activities[0].points).toEqual([
    { position: 0, locationKey: 'Ambato', departureAt: '2026-11-02T12:00:00.000Z' },
    { position: 1, locationKey: 'Latacunga', arrivalAt: '2026-11-02T13:00:00.000Z' },
  ]);
  expect(
    (await pool.query('SELECT count(*)::int n FROM route_sheet_modification_logs')).rows[0].n,
  ).toBe(1);
  expect(
    (
      await pool.query('SELECT tariff_revision,tariff_draft FROM route_sheets WHERE id=$1', [
        f.context.routeSheetId,
      ])
    ).rows[0],
  ).toEqual({ tariff_revision: 0, tariff_draft: null });
});

test('edición conserva IDs, incrementa revisión y rechaza revisión antigua sin tocar datos', async () => {
  await save({ ...f.context, ...f.body });
  const result = await save({ ...f.context, ...f.body, expectedRevision: 1 });
  expect(result.revision).toBe(2);
  await expect(save({ ...f.context, ...f.body, expectedRevision: 1 })).rejects.toMatchObject({
    code: 'ROUTE_PROGRAMMING_REVISION_CONFLICT',
  });
  expect((await readProgramming(pool, f.context.routeSheetId, f.cooperativeId)).revision).toBe(2);
});

test('hoja ajena y publicada no se pueden programar', async () => {
  await expect(
    save({ ...f.context, ...f.body, cooperativeId: otherOwner.cooperativeId }),
  ).rejects.toMatchObject({ code: 'ROUTE_SHEET_NOT_FOUND', httpStatus: 404 });
  await pool.query("UPDATE route_sheets SET status='PUBLISHED' WHERE id=$1", [
    f.context.routeSheetId,
  ]);
  await expect(save({ ...f.context, ...f.body })).rejects.toMatchObject({
    code: 'ROUTE_PROGRAMMING_NOT_EDITABLE',
  });
  expect((await pool.query('SELECT count(*)::int n FROM route_sheet_programmings')).rows[0].n).toBe(
    0,
  );
});

test('bus ajeno o de otro grupo se rechaza usando Fleet real', async () => {
  const foreign = await new PgBusRepository(pool).create(
    busRequest({ ...otherOwner, data: { plate: 'TBA0014', vin: 'VIN0014' } }),
  );
  f.body.programming.agendas[0].busId = foreign.id;
  await expect(save({ ...f.context, ...f.body })).rejects.toMatchObject({
    code: 'ROUTE_PROGRAMMING_BUS_CONFLICT',
  });
});

test('no publica ni guarda frecuencia inactiva', async () => {
  await pool.query("UPDATE frequencies SET status='INACTIVE' WHERE id=$1", [f.frequencies[0].id]);
  await expect(save({ ...f.context, ...f.body })).rejects.toMatchObject({
    code: 'ROUTE_PROGRAMMING_FREQUENCY_CONFLICT',
  });
  expect((await pool.query('SELECT count(*)::int n FROM route_sheet_assignments')).rows[0].n).toBe(
    0,
  );
});

test('adopta borrador legado e impide que un escritor antiguo reutilice el bus', async () => {
  await pool.query(
    'INSERT INTO route_sheet_assignments(route_sheet_id,cooperative_id,bus_group_id,bus_id,frequency_id) VALUES($1,$2,$3,$4,$5)',
    [f.context.routeSheetId, f.cooperativeId, f.busGroupId, f.busId, f.frequencies[0].id],
  );
  await save({ ...f.context, ...f.body });
  expect(
    (
      await pool.query(
        'SELECT count(*)::int n FROM route_sheet_assignments WHERE required_service_id IS NULL',
      )
    ).rows[0].n,
  ).toBe(0);
  const next = await createSheet('2026-11-03');
  await expect(
    pool.query(
      'INSERT INTO route_sheet_assignments(route_sheet_id,cooperative_id,bus_group_id,bus_id,frequency_id) VALUES($1,$2,$3,$4,$5)',
      [next, f.cooperativeId, f.busGroupId, f.busId, f.frequencies[0].id],
    ),
  ).rejects.toMatchObject({ code: '23514' });
});

test('un compromiso legado externo sin horas falla cerrado', async () => {
  const next = await createSheet('2026-11-03');
  await pool.query(
    'INSERT INTO route_sheet_assignments(route_sheet_id,cooperative_id,bus_group_id,bus_id,frequency_id) VALUES($1,$2,$3,$4,$5)',
    [next, f.cooperativeId, f.busGroupId, f.busId, f.frequencies[0].id],
  );
  await expect(save({ ...f.context, ...f.body })).rejects.toMatchObject({
    code: 'ROUTE_PROGRAMMING_LEGACY_UNVERIFIABLE',
  });
});

test('dos escrituras concurrentes de igual revisión producen un solo éxito', async () => {
  const results = await Promise.allSettled([
    save({ ...f.context, ...f.body }),
    save({ ...f.context, ...f.body }),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((r) => r.status === 'rejected').reason.code).toBe(
    'ROUTE_PROGRAMMING_REVISION_CONFLICT',
  );
  expect((await readProgramming(pool, f.context.routeSheetId, f.cooperativeId)).revision).toBe(1);
});

test('dos hojas concurrentes no dejan el mismo bus en ciclos superpuestos', async () => {
  const second = await createSheet('2026-11-03');
  f.body.programming.cycleLengthDays = 2;
  const next = fixture({
    cooperativeId: f.cooperativeId,
    busGroupId: f.busGroupId,
    busId: f.busId,
    date: '2026-11-03',
  });
  // Misma identidad de frecuencia autorizada; identidades de salida/asignación distintas.
  next.body.programming.requiredServices.forEach((s, index) => {
    s.frequencyId = f.frequencies[index].id;
  });
  next.body.programming.agendas[0].activities.forEach((a, index) => {
    a.frequencyId = f.frequencies[index].id;
  });
  const results = await Promise.allSettled([
    save({ ...f.context, ...f.body }),
    save({ ...f.context, routeSheetId: second, ...next.body }),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((r) => r.status === 'rejected').reason.code).toBe(
    'ROUTE_CYCLE_SEQUENCE_CONFLICT',
  );
  expect((await pool.query('SELECT count(*)::int n FROM route_sheet_programmings')).rows[0].n).toBe(
    1,
  );
});

test('vecino anterior fuera del ciclo impide declarar ubicación inicial falsa', async () => {
  await save({ ...f.context, ...f.body });
  const next = fixture({
    cooperativeId: f.cooperativeId,
    busGroupId: f.busGroupId,
    busId: f.busId,
    date: '2026-11-03',
  });
  next.body.programming.requiredServices.forEach((s, index) => {
    s.frequencyId = f.frequencies[index].id;
  });
  next.body.programming.agendas[0].activities.forEach((a, index) => {
    a.frequencyId = f.frequencies[index].id;
  });
  // La agenda local cierra pero contradice al último viaje del ciclo anterior.
  const first = next.body.programming.agendas[0].activities.shift();
  const afternoonFrequency = randomUUID();
  next.body.programming.agendas[0].activities.push({
    ...first,
    frequencyId: afternoonFrequency,
    departureAt: '2026-11-03T14:00:00-05:00',
    arrivalAt: '2026-11-03T15:00:00-05:00',
    points: [
      { position: 0, departureAt: '2026-11-03T14:00:00-05:00' },
      { position: 1, arrivalAt: '2026-11-03T15:00:00-05:00' },
    ],
  });
  next.body.programming.requiredServices[0].departureAt = '2026-11-03T14:00:00-05:00';
  next.body.programming.requiredServices[0].frequencyId = afternoonFrequency;
  await pool.query(
    "INSERT INTO frequencies(id,cooperative_id,origin,destination,departure_time,ant_resolution_number) VALUES($1,$2,'Ambato','Latacunga','14:00','ANT-FICTICIA')",
    [afternoonFrequency, f.cooperativeId],
  );
  next.body.programming.agendas[0].initialAvailability.locationKey = 'Latacunga';
  const sheet = await createSheet('2026-11-03');
  await expect(save({ ...f.context, routeSheetId: sheet, ...next.body })).rejects.toMatchObject({
    code: 'BUS_AGENDA_LOCATION_CONFLICT',
  });
});

test('un fallo después de escribir filas revierte programación, IDs y auditoría', async () => {
  const error = new Error('Fallo ficticio después de persistir');
  const failingPool = {
    connect: async () => {
      const client = await pool.connect();
      return {
        release: () => client.release(),
        query: (sql, params) => {
          if (sql.includes('INSERT INTO route_sheet_modification_logs')) throw error;
          return client.query(sql, params);
        },
      };
    },
  };
  const failing = makeSave(
    new PgRepository(failingPool, { frequencySessionFactory: frequencyQueries.forTransaction }),
  );
  await expect(failing({ ...f.context, ...f.body })).rejects.toBe(error);
  for (const table of [
    'route_sheet_programmings',
    'route_sheet_assignments',
    'route_sheet_programming_ids',
    'route_sheet_modification_logs',
  ])
    expect((await pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n).toBe(0);
});

test('identidad comercial no se recicla en otra salida ni otra hoja', async () => {
  await save({ ...f.context, ...f.body });
  const next = JSON.parse(JSON.stringify(f.body));
  next.programming.agendas[0].activities[0].kind = 'TRANSFER';
  next.programming.agendas[0].activities[0] = {
    id: next.programming.agendas[0].activities[0].id,
    kind: 'TRANSFER',
    originKey: 'Ambato',
    destinationKey: 'Latacunga',
    departureAt: '2026-11-02T07:00:00-05:00',
    arrivalAt: '2026-11-02T08:00:00-05:00',
    preparationMinutes: 15,
  };
  next.programming.requiredServices.shift();
  await expect(save({ ...f.context, ...next, expectedRevision: 1 })).rejects.toMatchObject({
    code: 'ROUTE_PROGRAMMING_IDENTITY_CONFLICT',
  });
  expect((await readProgramming(pool, f.context.routeSheetId, f.cooperativeId)).revision).toBe(1);
});

test('un escritor legado no puede insertar ni retirar asignaciones programadas', async () => {
  await save({ ...f.context, ...f.body });
  await expect(
    pool.query('DELETE FROM route_sheet_assignments WHERE route_sheet_id=$1', [
      f.context.routeSheetId,
    ]),
  ).rejects.toMatchObject({ code: '23514' });
  await expect(
    pool.query(
      'INSERT INTO route_sheet_rest_days(route_sheet_id,cooperative_id,bus_group_id,bus_id) VALUES($1,$2,$3,$4)',
      [f.context.routeSheetId, f.cooperativeId, f.busGroupId, f.busId],
    ),
  ).rejects.toMatchObject({ code: '23514' });
});

test('la migración no permite down que destruya programación real', async () => {
  await save({ ...f.context, ...f.body });
  const target = '1793650000000-route-sheet-programming';
  const applied = (await pool.query('SELECT name FROM pgmigrations ORDER BY id DESC')).rows;
  expect(applied.map(({ name }) => name)).toContain(target);
  try {
    for (const { name } of applied) {
      if (name === target) break;
      runMigration('down');
    }
    expect(
      (await pool.query('SELECT name FROM pgmigrations ORDER BY id DESC LIMIT 1')).rows[0].name,
    ).toBe(target);
    expect(() => runMigration('down')).toThrow();
    expect((await readProgramming(pool, f.context.routeSheetId, f.cooperativeId)).revision).toBe(1);
  } finally {
    runMigration();
  }
});

function followingBody(date) {
  const next = fixture({
    cooperativeId: f.cooperativeId,
    busGroupId: f.busGroupId,
    busId: f.busId,
    date,
  });
  next.body.programming.requiredServices.forEach((s, index) => {
    s.frequencyId = f.frequencies[index].id;
  });
  next.body.programming.agendas[0].activities.forEach((a, index) => {
    a.frequencyId = f.frequencies[index].id;
  });
  return next.body;
}

test('dos ciclos consecutivos conservan historia y un tercero no terminado se rechaza', async () => {
  await save({ ...f.context, ...f.body });
  const second = await createSheet('2026-11-03');
  await save({ ...f.context, routeSheetId: second, ...followingBody('2026-11-03') });
  const third = await createSheet('2026-11-04');
  await expect(
    save({ ...f.context, routeSheetId: third, ...followingBody('2026-11-04') }),
  ).rejects.toMatchObject({ code: 'ROUTE_CYCLE_LIMIT_EXCEEDED' });
  expect((await readProgramming(pool, f.context.routeSheetId, f.cooperativeId)).revision).toBe(1);
});

test('misma frecuencia en dos días conserva asignaciones distintas dentro de una hoja', async () => {
  f.body.programming.cycleLengthDays = 2;
  const next = followingBody('2026-11-03');
  f.body.programming.requiredServices.push(...next.programming.requiredServices);
  f.body.programming.agendas[0].activities.push(...next.programming.agendas[0].activities);
  const result = await save({ ...f.context, ...f.body });
  expect(result.programming.agendas[0].activities).toHaveLength(6);
  expect(
    (await pool.query('SELECT count(DISTINCT frequency_id)::int n FROM route_sheet_assignments'))
      .rows[0].n,
  ).toBe(3);
});

test('editar programación conserva tarifario y revisión tarifaria existentes', async () => {
  await save({ ...f.context, ...f.body });
  const PgTariffRepository = require('../../../src/modules/route-sheets/infrastructure/repositories/pg-route-sheet-tariff-repository');
  const configure =
    require('../../../src/modules/route-sheets/application/use-cases/configure-route-sheet-tariff.use-case')(
      {
        tariffRepository: new PgTariffRepository(pool, {
          frequencySessionFactory: frequencyQueries.forTransaction,
        }),
        frequencyQueryPort: frequencyQueries,
      },
    );
  await configure({
    ...f.context,
    body: {
      expectedRevision: 0,
      policy: {
        vipSurchargeBps: 2500,
        minorDiscountBps: 5000,
        seniorDiscountBps: 5000,
        disabilityDiscountBps: 5000,
      },
      frequencies: f.frequencies.map((v) => ({
        frequencyId: v.id,
        prices: [{ fromPosition: 0, toPosition: 1, amountCents: 450 }],
      })),
    },
  });
  const before = (
    await pool.query(
      'SELECT tariff_draft,tariff_revision,tariff_updated_at FROM route_sheets WHERE id=$1',
      [f.context.routeSheetId],
    )
  ).rows[0];
  await save({ ...f.context, ...f.body, expectedRevision: 1 });
  const after = (
    await pool.query(
      'SELECT tariff_draft,tariff_revision,tariff_updated_at FROM route_sheets WHERE id=$1',
      [f.context.routeSheetId],
    )
  ).rows[0];
  expect(after).toEqual(before);
});

test('claves compuestas impiden vincular paradas con cooperativa ajena', async () => {
  await save({ ...f.context, ...f.body });
  await expect(
    pool.query(
      'INSERT INTO route_sheet_service_points(assignment_id,route_sheet_id,cooperative_id,position,location_key,arrival_at) VALUES($1,$2,$3,5,$4,$5)',
      [
        f.body.programming.agendas[0].activities[0].id,
        f.context.routeSheetId,
        otherOwner.cooperativeId,
        'Ajena',
        '2026-11-02T13:00:00Z',
      ],
    ),
  ).rejects.toMatchObject({ code: '23503' });
});

test('el bloqueo cubre escritores antiguos mientras se valida una programación', async () => {
  const legacySheet = await createSheet('2026-11-03');
  let release, entered;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const delayed = {
    ...busQueries,
    findById: async (...args) => {
      entered();
      await gate;
      return busQueries.findById(...args);
    },
  };
  const pending = makeSave(repo, delayed)({ ...f.context, ...f.body });
  const client = await pool.connect();
  try {
    await ready;
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='100ms'");
    await expect(
      client.query(
        'INSERT INTO route_sheet_assignments(route_sheet_id,cooperative_id,bus_group_id,bus_id,frequency_id) VALUES($1,$2,$3,$4,$5)',
        [legacySheet, f.cooperativeId, f.busGroupId, f.busId, f.frequencies[0].id],
      ),
    ).rejects.toMatchObject({ code: '55P03' });
    await client.query('ROLLBACK');
  } finally {
    release();
    client.release();
  }
  await pending;
  expect(
    (
      await pool.query(
        'SELECT count(*)::int n FROM route_sheet_assignments WHERE required_service_id IS NULL',
      )
    ).rows[0].n,
  ).toBe(0);
});

test('un UUID registrado en otra cooperativa no se puede reutilizar ni revela datos', async () => {
  await save({ ...f.context, ...f.body });
  const bus = await new PgBusRepository(pool).create(
    busRequest({ ...otherOwner, data: { plate: 'TBC0024', vin: 'VIN0024' } }),
  );
  const other = fixture({ ...otherOwner, busId: bus.id });
  const sheet = (
    await pool.query(
      "INSERT INTO route_sheets(cooperative_id,bus_group_id,route_date) VALUES($1,$2,'2026-11-02') RETURNING id",
      [otherOwner.cooperativeId, otherOwner.busGroupId],
    )
  ).rows[0].id;
  other.context.routeSheetId = sheet;
  for (const frequency of other.frequencies)
    await pool.query(
      'INSERT INTO frequencies(id,cooperative_id,origin,destination,departure_time,ant_resolution_number) VALUES($1,$2,$3,$4,$5,$6)',
      [
        frequency.id,
        otherOwner.cooperativeId,
        frequency.origin,
        frequency.destination,
        frequency.departureTime,
        frequency.antResolutionNumber,
      ],
    );
  const foreignId = f.body.programming.requiredServices[0].id;
  other.body.programming.requiredServices[0].id = foreignId;
  other.body.programming.agendas[0].activities[0].requiredServiceId = foreignId;
  await expect(save({ ...other.context, ...other.body })).rejects.toMatchObject({
    code: 'ROUTE_PROGRAMMING_IDENTITY_CONFLICT',
    httpStatus: 409,
  });
  expect(await readProgramming(pool, sheet, otherOwner.cooperativeId)).toBeNull();
  expect((await readProgramming(pool, f.context.routeSheetId, f.cooperativeId)).revision).toBe(1);
});

test('colisión con asignación legada ajena se traduce a conflicto y revierte', async () => {
  const foreignSheet = (
    await pool.query(
      "INSERT INTO route_sheets(cooperative_id,bus_group_id,route_date) VALUES($1,$2,'2026-11-02') RETURNING id",
      [otherOwner.cooperativeId, otherOwner.busGroupId],
    )
  ).rows[0].id;
  await pool.query(
    'INSERT INTO route_sheet_assignments(id,route_sheet_id,cooperative_id,bus_group_id,bus_id,frequency_id) VALUES($1,$2,$3,$4,$5,$6)',
    [
      f.body.programming.agendas[0].activities[0].id,
      foreignSheet,
      otherOwner.cooperativeId,
      otherOwner.busGroupId,
      randomUUID(),
      randomUUID(),
    ],
  );
  await expect(save({ ...f.context, ...f.body })).rejects.toMatchObject({
    code: 'ROUTE_PROGRAMMING_IDENTITY_CONFLICT',
  });
  expect(await readProgramming(pool, f.context.routeSheetId, f.cooperativeId)).toBeNull();
  expect(
    (
      await pool.query(
        'SELECT count(*)::int n FROM route_sheet_assignments WHERE route_sheet_id=$1',
        [foreignSheet],
      )
    ).rows[0].n,
  ).toBe(1);
});
