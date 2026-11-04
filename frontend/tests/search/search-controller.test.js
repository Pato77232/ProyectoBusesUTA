import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSearchController } from '../../src/search/search-controller.js';
const input = { origin: ' Loja ', destination: 'Ambato', date: '2030-01-01' };
const trip = {
  tripId: 'aaaaaaaa-0000-4000-8000-000000000001',
  cooperativeName: 'Cooperativa QA',
  origin: 'Loja',
  destination: 'Ambato',
  fromPosition: 0,
  toPosition: 1,
  boardingAt: '2030-01-01T10:00:00Z',
  arrivalAt: '2030-01-01T20:00:00Z',
  currency: 'USD',
  amountCents: 1500,
};
test('consulta solo filtros públicos y distingue resultados de ausencia de viajes', async () => {
  const calls = [],
    states = [];
  const controller = createSearchController({
    client: {
      request: async (path) => {
        calls.push(path);
        return { trips: [trip], truncated: false };
      },
    },
    view: {
      busy() {},
      show(...args) {
        states.push(args);
      },
    },
  });
  await controller.search(input);
  assert.match(calls[0], /^\/api\/v1\/trips\?origin=Loja&destination=Ambato&date=/);
  assert.equal(states.at(-1)[0], 'ready');
  assert.equal(states.at(-1)[2][0], trip);
});
test('un fallo o DTO corrupto no se muestra como vacío ni conserva resultados antiguos', async () => {
  for (const response of [
    null,
    { trips: [{ ...trip, amountCents: -1 }], truncated: false },
    { trips: [trip, trip], truncated: false },
  ]) {
    const states = [];
    await createSearchController({
      client: { request: async () => response },
      view: {
        busy() {},
        show(...args) {
          states.push(args);
        },
      },
    }).search(input);
    assert.equal(states.at(-1)[0], 'error');
    assert.deepEqual(states.at(-1)[2], []);
  }
});
