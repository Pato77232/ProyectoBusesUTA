import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUpcomingController,
  dayLabel,
  ecuadorDate,
  groupByDay,
  shiftDate,
  stopsText,
} from '../../src/search/upcoming.js';

const NOW = Date.parse('2026-11-11T15:00:00Z'); // 10:00 en Ecuador
const trip = (boardingAt, extra = {}) => ({
  tripId: '6f1c2a4e-0b7d-4f3e-9a51-3c2d1e0f9a87',
  cooperativeId: '8f1c2a4e-0b7d-4f3e-9a51-3c2d1e0f9a87',
  cooperativeName: 'Cooperativa QA',
  fromPosition: 0,
  toPosition: 2,
  origin: 'Ambato',
  destination: 'Quito',
  stopCount: 1,
  boardingAt,
  arrivalAt: new Date(Date.parse(boardingAt) + 3 * 3600000).toISOString(),
  currency: 'USD',
  amountCents: 550,
  ...extra,
});

test('usa la fecha local de Ecuador, también de noche', () => {
  assert.equal(ecuadorDate('2026-11-12T04:00:00Z'), '2026-11-11');
  assert.equal(ecuadorDate('2026-11-12T05:00:00Z'), '2026-11-12');
  assert.equal(shiftDate('2026-11-30', 1), '2026-12-01');
  assert.equal(shiftDate('2026-11-01', -1), '2026-10-31');
});

test('nombra los días como Hoy, Mañana y luego con su fecha', () => {
  assert.equal(dayLabel('2026-11-11', NOW), 'Hoy');
  assert.equal(dayLabel('2026-11-12', NOW), 'Mañana');
  assert.match(dayLabel('2026-11-13', NOW), /^Viernes.*13.*noviembre/i);
});

test('agrupa las salidas por día local y en orden', () => {
  const groups = groupByDay(
    [
      trip('2026-11-12T13:30:00Z'),
      trip('2026-11-12T03:00:00Z'), // 22:00 del 11 en Ecuador
      trip('2026-11-11T20:00:00Z'),
    ],
    NOW,
  );
  assert.deepEqual(
    groups.map((g) => [g.label, g.trips.length]),
    [
      ['Hoy', 2],
      ['Mañana', 1],
    ],
  );
});

test('describe las paradas', () => {
  assert.equal(stopsText(0), 'Directo');
  assert.equal(stopsText(1), '1 parada');
  assert.equal(stopsText(3), '3 paradas');
});

function setup(response) {
  const calls = [];
  const shown = [];
  const controller = createUpcomingController({
    client: {
      async request(path) {
        calls.push(path);
        if (response instanceof Error) throw response;
        return response;
      },
    },
    view: { busy() {}, show: (mode, message, trips) => shown.push([mode, message, trips]) },
  });
  return { controller, calls, shown };
}

test('sin parámetros pide las próximas salidas y las muestra', async () => {
  const { controller, calls, shown } = setup({
    trips: [trip('2026-11-12T13:30:00Z')],
    truncated: false,
    days: 7,
  });
  await controller.load();
  assert.deepEqual(calls, ['/api/v1/trips/upcoming']);
  assert.equal(shown.at(-1)[0], 'ready');
  assert.equal(shown.at(-1)[2].length, 1);
});

test('la boletería pide un día y su cooperativa', async () => {
  const { controller, calls } = setup({ trips: [], truncated: false, days: 7 });
  await controller.load({ date: '2026-11-12', cooperativeId: 'c-1' });
  assert.deepEqual(calls, ['/api/v1/trips/upcoming?date=2026-11-12&cooperativeId=c-1']);
});

test('explica la lista vacía, la truncada y el error', async () => {
  let s = setup({ trips: [], truncated: false, days: 7 });
  await s.controller.load();
  assert.match(s.shown.at(-1)[1], /próximos 7 días/);
  s = setup({ trips: [], truncated: false, days: 7 });
  await s.controller.load({ date: '2026-11-12' });
  assert.match(s.shown.at(-1)[1], /ese día/);
  s = setup({ trips: [trip('2026-11-12T13:30:00Z')], truncated: true, days: 7 });
  await s.controller.load();
  assert.match(s.shown.at(-1)[1], /primeras salidas/);
  const broken = { ...trip('2026-11-12T13:30:00Z'), boardingAt: 'no-es-fecha' };
  for (const bad of [new Error('red'), { trips: [broken], truncated: false }]) {
    s = setup(bad);
    await s.controller.load();
    assert.equal(s.shown.at(-1)[0], 'error');
    assert.deepEqual(s.shown.at(-1)[2], []);
  }
});
