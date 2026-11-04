import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouteSheetListController } from '../../src/route-sheets/list-controller.js';
import { isDate, readFilters } from '../../src/route-sheets/contracts.js';
const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const user = { id: id(1), cooperative_id: id(2), role: 'COOPERATIVE_ADMIN' };
const sheet = () => ({
  id: id(3),
  cooperativeId: id(2),
  busGroupId: id(4),
  routeDate: '2030-01-02',
  status: 'DRAFT',
});
function fixture() {
  const f = {
    calls: [],
    renders: [],
    user: { ...user },
    groups: [{ id: id(4), name: 'Grupo A' }],
    rows: [sheet()],
  };
  f.controller = createRouteSheetListController({
    client: {
      async request(path) {
        f.calls.push(path);
        if (path.endsWith('/me')) {
          f.sessions = (f.sessions || 0) + 1;
          return {
            user:
              f.change && f.sessions > 1 ? { ...f.user, id: id(99) } : f.user,
          };
        }
        if (f.error) throw f.error;
        if (path.endsWith('/bus-groups')) return { busGroups: f.groups };
        if (f.wait) await f.wait;
        return { routeSheets: f.rows };
      },
    },
    view: { render: (state) => f.renders.push(state) },
  });
  f.last = () => f.renders.at(-1);
  return f;
}
test('lee datos propios con sesión comprobada antes y después, sin cuerpos ni mutaciones', async () => {
  const f = fixture();
  await f.controller.load({
    busGroupId: id(4),
    fromDate: '2030-01-01',
    toDate: '2030-01-03',
    status: 'DRAFT',
  });
  assert.equal(f.last().mode, 'ready');
  assert.equal(f.last().rows.length, 1);
  assert.deepEqual(f.calls, [
    '/api/v1/auth/me',
    '/api/v1/bus-groups',
    '/api/v1/auth/me',
    `/api/v1/route-sheets?busGroupId=${id(4)}&fromDate=2030-01-01&toDate=2030-01-03&status=DRAFT`,
    '/api/v1/auth/me',
  ]);
});
test('distingue vacío de ausencia de grupos', async () => {
  const f = fixture();
  f.rows = [];
  await f.controller.load();
  assert.equal(f.last().mode, 'empty');
  assert.match(f.last().message, /filtros/);
  f.groups = [];
  await f.controller.load();
  assert.match(f.last().message, /no tiene grupos/);
});
for (const role of ['CUSTOMER', 'CLERK', 'SYSTEM_ADMIN'])
  test(`rol ${role} no consulta datos operativos`, async () => {
    const f = fixture();
    f.user.role = role;
    await f.controller.load();
    assert.equal(f.last().mode, 'forbidden');
    assert.deepEqual(f.calls, ['/api/v1/auth/me']);
  });
test('sesión malformada falla sin consultar grupos', async () => {
  const f = fixture();
  f.user.cooperative_id = 'ajena';
  await f.controller.load();
  assert.equal(f.last().mode, 'error');
  assert.equal(f.calls.length, 1);
});
for (const status of [401, 403, 500])
  test(`error ${status} elimina resultados anteriores`, async () => {
    const f = fixture();
    await f.controller.load();
    f.error = { status };
    await f.controller.load();
    assert.equal(f.last().rows.length, 0);
    assert.equal(
      f.last().mode,
      status === 401 ? 'signed-out' : status === 403 ? 'forbidden' : 'error',
    );
  });
test('un fallo de red permite reintentar pero nunca muestra vacío', async () => {
  const f = fixture();
  f.error = new Error('red');
  await f.controller.load();
  assert.equal(f.last().mode, 'error');
  delete f.error;
  await f.controller.load();
  assert.equal(f.last().mode, 'ready');
});
test('cambio de usuario durante la consulta bloquea y descarta sus datos', async () => {
  const f = fixture();
  f.change = true;
  await f.controller.load();
  assert.equal(f.last().mode, 'session-changed');
  assert.equal(f.last().rows.length, 0);
  const calls = f.calls.length;
  await f.controller.load();
  assert.equal(f.calls.length, calls);
});
test('cambio de cooperativa en una nueva consulta elimina la lista anterior', async () => {
  const f = fixture();
  await f.controller.load();
  f.user.cooperative_id = id(98);
  await f.controller.load();
  assert.equal(f.last().mode, 'session-changed');
  assert.equal(f.last().rows.length, 0);
});
for (const change of [
  (r) => (r.cooperativeId = id(98)),
  (r) => (r.status = 'OTRO'),
  (r) => (r.routeDate = '2030-02-30'),
  (r) => (r.busGroupId = id(97)),
])
  test(`fila inválida falla cerrado: ${change.toString()}`, async () => {
    const f = fixture();
    change(f.rows[0]);
    await f.controller.load();
    assert.equal(f.last().mode, 'error');
    assert.deepEqual(f.last().rows, []);
  });
test('respuesta ausente o IDs duplicados no equivalen a lista vacía', async () => {
  const f = fixture();
  f.rows = undefined;
  await f.controller.load();
  assert.equal(f.last().mode, 'error');
  f.rows = [sheet(), sheet()];
  await f.controller.load();
  assert.equal(f.last().mode, 'error');
});
test('rechaza resultados que no respetan el filtro solicitado', async () => {
  const f = fixture();
  await f.controller.load({ status: 'PUBLISHED' });
  assert.equal(f.last().mode, 'error');
});
test('grupo que ya no existe no solicita hojas', async () => {
  const f = fixture();
  await f.controller.load({ busGroupId: id(99) });
  assert.equal(f.last().mode, 'invalid');
  assert.equal(f.calls.length, 3);
});

test('un cambio de sesión al leer grupos también bloquea el filtro de grupo ausente', async () => {
  const f = fixture();
  f.change = true;
  await f.controller.load({ busGroupId: id(99) });
  assert.equal(f.last().mode, 'session-changed');
  assert.deepEqual(f.last().groups, []);
  assert.equal(
    f.calls.some((path) => path.startsWith('/api/v1/route-sheets')),
    false,
  );
});
test('grupos duplicados o sin nombre fallan sin cargar hojas', async () => {
  const f = fixture();
  f.groups.push({ ...f.groups[0] });
  await f.controller.load();
  assert.equal(f.last().mode, 'error');
  assert.equal(f.calls.length, 2);
});
test('una carga en curso impide solicitudes duplicadas', async () => {
  const f = fixture();
  let release;
  f.wait = new Promise((resolve) => {
    release = resolve;
  });
  const pending = f.controller.load();
  await f.controller.load();
  release();
  await pending;
  assert.equal(f.calls.filter((p) => p.includes('/route-sheets')).length, 1);
});
test('fechas civiles y filtros inválidos se validan sin consultas ni tenant elegido', async () => {
  assert.equal(isDate('2028-02-29'), true);
  assert.equal(isDate('2030-02-29'), false);
  assert.equal(isDate('0000-01-01'), false);
  const f = fixture();
  for (const filter of [
    { fromDate: '2030-02-30' },
    { fromDate: '2030-02-02', toDate: '2030-02-01' },
    { status: 'OTRO' },
    { cooperativeId: id(5) },
  ]) {
    await f.controller.load(filter);
    assert.equal(f.last().mode, 'invalid');
  }
  assert.deepEqual(f.calls, []);
  assert.deepEqual(readFilters({ status: '' }), {});
});
