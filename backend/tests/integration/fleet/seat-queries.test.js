const { randomUUID } = require('node:crypto');
const os = require('node:os');
const { createFleetModule } = require('../../../src/modules/fleet');
const {
  createBaseSeatLayouts,
} = require('../../../src/modules/fleet/infrastructure/seat-layout-bases');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { runMigration, testPool } = require('../../helpers/database');
const { busRequest, fleetFixtures } = require('../../helpers/fleet-bus');

const passThrough = (_req, _res, next) => next();
const auth = {
  authenticate: passThrough,
  authorize: () => passThrough,
  csrfProtection: passThrough,
};
const [singleDeck] = createBaseSeatLayouts();
const doubleDeck = createBaseSeatLayouts().find((layout) => layout.decks.length === 2);
let pool, repository, seatQueries, fixtures;

const seatKeys = (layout) =>
  layout.decks.flatMap((deck) =>
    deck.elements.filter((element) => element.kind === 'SEAT').map((element) => element.key),
  );

const registerBus = (owner, options = {}) =>
  repository.create(busRequest({ ...owner, ...options }));

beforeAll(() => {
  runMigration();
  pool = testPool();
  repository = new PgBusRepository(pool);
  seatQueries = createFleetModule({
    pool,
    auth,
    env: { BUS_PHOTO_STORAGE_DIR: os.tmpdir() },
  }).seatQueries;
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query('TRUNCATE bus_photos, bus_seats, buses, bus_groups, cooperatives CASCADE');
  fixtures = await fleetFixtures(pool);
});
afterAll(async () => {
  if (pool) await pool.end();
});

test('la API pública solo ofrece la lectura de asientos', () => {
  expect(Object.keys(seatQueries)).toEqual(['listByBus']);
});

test('entrega todos los asientos e indica los no ofrecidos con su identidad real', async () => {
  const keys = seatKeys(singleDeck);
  const bus = await registerBus(fixtures.first, { data: { disabledSeatKeys: [keys[0]] } });
  const { busId, seats } = await seatQueries.listByBus({
    busId: bus.id,
    cooperativeId: fixtures.first.cooperativeId,
  });
  const { rows } = await pool.query(
    'SELECT id, layout_seat_key, offered FROM bus_seats WHERE bus_id=$1 ORDER BY label',
    [bus.id],
  );
  expect(busId).toBe(bus.id);
  expect(seats).toHaveLength(keys.length);
  expect(
    seats.map(({ seatId, layoutSeatKey, offered }) => [seatId, layoutSeatKey, offered]),
  ).toEqual(rows.map((row) => [row.id, row.layout_seat_key, row.offered]));
  expect(seats.filter((seat) => !seat.offered).map((seat) => seat.layoutSeatKey)).toEqual([
    keys[0],
  ]);
});

test('el identificador del asiento no se repite entre buses con la misma plantilla', async () => {
  const first = await registerBus(fixtures.first);
  const second = await registerBus(fixtures.second, {
    data: { plate: 'TBM-0014', vin: 'VIN0014' },
  });
  const list = async (bus, owner) =>
    (await seatQueries.listByBus({ busId: bus.id, cooperativeId: owner.cooperativeId })).seats;
  const [firstSeat] = await list(first, fixtures.first);
  const [secondSeat] = await list(second, fixtures.second);
  expect(firstSeat.layoutSeatKey).toBe(secondSeat.layoutSeatKey);
  expect(firstSeat.seatId).not.toBe(secondSeat.seatId);
});

test('un bus de otra cooperativa responde igual que uno inexistente', async () => {
  const bus = await registerBus(fixtures.first);
  const { cooperativeId } = fixtures.second;
  const foreign = await seatQueries.listByBus({ busId: bus.id, cooperativeId });
  const missing = await seatQueries.listByBus({ busId: randomUUID(), cooperativeId });
  expect(foreign).toBeNull();
  expect(foreign).toEqual(missing);
});

test('dos consultas del mismo bus devuelven la misma identidad y orden', async () => {
  const query = {
    busId: (await registerBus(fixtures.first)).id,
    cooperativeId: fixtures.first.cooperativeId,
  };
  await expect(seatQueries.listByBus(query)).resolves.toEqual(await seatQueries.listByBus(query));
});

test('en dos pisos entrega primero el piso 2 y cada piso sigue la numeración', async () => {
  const bus = await registerBus(fixtures.first, { layout: doubleDeck });
  const { seats } = await seatQueries.listByBus({
    busId: bus.id,
    cooperativeId: fixtures.first.cooperativeId,
  });
  const decks = seats.map((seat) => seat.deck);
  const labels = seats.map((seat) => seat.label);
  expect(new Set(decks)).toEqual(new Set([1, 2]));
  expect(decks).toEqual([...decks].sort((a, b) => b - a));
  expect(labels).toEqual([...labels].sort((a, b) => a - b));
});

test('un bus con todos sus asientos no ofrecidos los devuelve con offered en false', async () => {
  const bus = await registerBus(fixtures.first);
  await pool.query('UPDATE bus_seats SET offered = false WHERE bus_id = $1', [bus.id]);
  const { seats } = await seatQueries.listByBus({
    busId: bus.id,
    cooperativeId: fixtures.first.cooperativeId,
  });
  expect(seats).toHaveLength(seatKeys(singleDeck).length);
  expect(seats.every((seat) => seat.offered === false)).toBe(true);
});

test('la salida solo contiene datos del asiento', async () => {
  const bus = await registerBus(fixtures.first);
  const result = await seatQueries.listByBus({
    busId: bus.id,
    cooperativeId: fixtures.first.cooperativeId,
  });
  expect(Object.keys(result).sort()).toEqual(['busId', 'seats']);
  expect(Object.keys(result.seats[0]).sort()).toEqual([
    'category',
    'column',
    'deck',
    'label',
    'layoutSeatKey',
    'offered',
    'row',
    'seatId',
  ]);
});
