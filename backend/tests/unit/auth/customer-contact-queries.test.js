const createCustomerContactQueries = require('../../../src/modules/auth/infrastructure/pg-customer-contact.queries');

const id = '00000000-0000-4000-8000-000000000001';

test('devuelve el correo de un CUSTOMER filtrando por rol', async () => {
  const pool = { query: jest.fn().mockResolvedValue({ rows: [{ email: 'cliente@example.ec' }] }) };
  await expect(createCustomerContactQueries({ pool }).findCustomerEmail(id)).resolves.toBe(
    'cliente@example.ec',
  );
  const [sql, args] = pool.query.mock.calls[0];
  expect(sql).toContain("role = 'CUSTOMER'");
  expect(args).toEqual([id]);
});

test('sin usuario devuelve null', async () => {
  const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  await expect(createCustomerContactQueries({ pool }).findCustomerEmail(id)).resolves.toBeNull();
});

test.each([undefined, '', 'guest-token', 'propietario-privado', 42])(
  'identificador %j que no es UUID devuelve null sin consultar',
  async (value) => {
    const pool = { query: jest.fn() };
    await expect(
      createCustomerContactQueries({ pool }).findCustomerEmail(value),
    ).resolves.toBeNull();
    expect(pool.query).not.toHaveBeenCalled();
  },
);

test('no se construye sin conexión', () => {
  expect(() => createCustomerContactQueries()).toThrow(TypeError);
});
