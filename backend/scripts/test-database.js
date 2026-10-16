function assertTestDatabase(env = process.env) {
  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error('URL de pruebas inválida.');
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    env.NODE_ENV !== 'test' ||
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !database.endsWith('_test')
  ) {
    throw new Error('Limpieza prohibida: se exige NODE_ENV=test y base terminada en _test.');
  }
  return env.DATABASE_URL;
}
module.exports = { assertTestDatabase };
