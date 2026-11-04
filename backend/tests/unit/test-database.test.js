const { assertTestDatabase } = require('../../scripts/test-database');
describe('Guardia de base de pruebas', () => {
  test.each(['postgres://u:p@localhost/production', 'postgres://u:p@localhost/development?application_name=_test', 'invalid'])('rechaza %s', (url) => {
    expect(() => assertTestDatabase({ NODE_ENV: 'test', DATABASE_URL: url })).toThrow();
  });
  test('rechaza entorno distinto a test', () => {
    expect(() => assertTestDatabase({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@localhost/app_test' })).toThrow();
  });
  test('acepta nombre de base con sufijo y parámetros', () => {
    const url = 'postgres://u:p@localhost/app_test?application_name=jest';
    expect(assertTestDatabase({ NODE_ENV: 'test', DATABASE_URL: url })).toBe(url);
  });
});
