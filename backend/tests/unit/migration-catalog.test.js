const {
  activeNames,
  historicalNames,
  ignorePattern,
  validateCatalog,
  validateHistory,
} = require('../../scripts/migration-catalog');
const { transactionClient } = require('../../scripts/migrate');
const entry = (name) => ({ name, isFile: () => true });
const files = () => activeNames.map((name) => entry(name + '.js'));

test('catálogo explícito conserva las 18 de develop y añade una única instalación posterior', () => {
  expect(activeNames).toHaveLength(19);
  expect(activeNames[16]).toBe('1793730000000-commercial-trips');
  expect(activeNames[17]).toBe('1793740000000-allow-vip-bus-seats');
  expect(activeNames[18]).toBe('1793820000000-install-bookings');
  expect(new Set(activeNames).size).toBe(activeNames.length);
  expect([...activeNames].sort()).toEqual(activeNames);
  expect(() => validateCatalog(files())).not.toThrow();
});

test('el filtro anclado preserva ocultos y excluye exactamente originales', () => {
  const filter = new RegExp(`^${ignorePattern}$`);
  for (const name of ['.gitkeep', '.oculta.js', ...historicalNames.map((n) => n + '.js')]) {
    expect(filter.test(name)).toBe(true);
  }
  for (const name of [...activeNames.map((n) => n + '.js'), historicalNames[0] + '-otro.js']) {
    expect(filter.test(name)).toBe(false);
  }
  expect(() =>
    validateCatalog([
      ...files(),
      entry('.gitkeep'),
      ...historicalNames.map((n) => entry(n + '.js')),
    ]),
  ).not.toThrow();
});

test.each(['extra', 'missing', 'symlink'])('rechaza catálogo %s antes de usarlo', (kind) => {
  const entries = files();
  if (kind === 'extra') entries.push(entry('1793900000000-unknown.js'));
  if (kind === 'missing') entries.pop();
  if (kind === 'symlink') entries[0].isFile = () => false;
  expect(() => validateCatalog(entries)).toThrow(
    expect.objectContaining({ code: 'MIGRATION_CATALOG_INVALID' }),
  );
});

test('acepta únicamente prefijos conocidos, incluida base vacía y esquema ya instalado', () => {
  for (let length = 0; length <= activeNames.length; length += 1) {
    expect(() => validateHistory(activeNames.slice(0, length))).not.toThrow();
  }
});

test.each(historicalNames)('rechaza el original %s incluso tras el catálogo completo', (name) => {
  expect(() => validateHistory([...activeNames, name])).toThrow(
    expect.objectContaining({ code: 'MIGRATION_HISTORY_UNSUPPORTED' }),
  );
});

test.each([
  ['unknown'],
  [activeNames[1]],
  [activeNames[0], activeNames[2]],
  [activeNames[1], activeNames[0]],
  [activeNames[0], activeNames[0]],
  [...activeNames, 'extra'],
])('rechaza historia no prefijo %#', (...names) => {
  expect(() => validateHistory(names)).toThrow(
    expect.objectContaining({ code: 'MIGRATION_HISTORY_UNEXPECTED' }),
  );
});

test('adapta solo los límites del batch a savepoints y delega SQL/argumentos intactos', async () => {
  const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  const adapter = transactionClient(client);
  await adapter.query('BEGIN');
  await adapter.query('SELECT $1::text', ['dato']);
  await adapter.query('COMMIT');
  await adapter.query('ROLLBACK');
  expect(client.query.mock.calls).toEqual([
    ['SAVEPOINT migration_batch'],
    ['SELECT $1::text', ['dato']],
    ['RELEASE SAVEPOINT migration_batch'],
    ['ROLLBACK TO SAVEPOINT migration_batch'],
  ]);
});
