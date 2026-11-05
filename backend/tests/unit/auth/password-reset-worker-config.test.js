const {
  readPasswordResetWorkerConfig,
} = require('../../../src/modules/auth/infrastructure/password-reset-worker-config');

test('trabajador apagado por defecto y contrato configurado al habilitarlo', () => {
  expect(readPasswordResetWorkerConfig({})).toEqual({ enabled: false });
  const config = readPasswordResetWorkerConfig({
    PASSWORD_RESET_WORKER_ENABLED: 'true',
    PUBLIC_WEB_ORIGIN: 'https://pasajes.example.ec',
    NODE_ENV: 'production',
  });
  expect(config).toMatchObject({
    enabled: true,
    origin: 'https://pasajes.example.ec',
    tokenMinutes: 20,
    maxAttempts: 5,
    delays: [1, 5, 15, 15],
    retentionDays: 1,
    actionRetentionDays: 7,
  });
});

test.each([
  'http://pasajes.example.ec',
  'https://pasajes.example.ec/ruta',
  'https://pasajes.example.ec?x=1',
  'https://user:pass@pasajes.example.ec',
  'javascript:alert(1)',
  '//pasajes.example.ec',
])('rechaza origen público inseguro %s', (origin) => {
  expect(() =>
    readPasswordResetWorkerConfig({
      PASSWORD_RESET_WORKER_ENABLED: 'true',
      PUBLIC_WEB_ORIGIN: origin,
      NODE_ENV: 'production',
    }),
  ).toThrow();
});

test('acepta HTTP solo para desarrollo local', () => {
  expect(
    readPasswordResetWorkerConfig({
      PASSWORD_RESET_WORKER_ENABLED: 'true',
      PUBLIC_WEB_ORIGIN: 'http://localhost:8080',
    }).origin,
  ).toBe('http://localhost:8080');
  expect(() =>
    readPasswordResetWorkerConfig({
      PASSWORD_RESET_WORKER_ENABLED: 'true',
      PUBLIC_WEB_ORIGIN: 'http://localhost:8080',
      NODE_ENV: 'production',
    }),
  ).toThrow();
});

test('valida número de reintentos y configuración numérica', () => {
  const base = { PASSWORD_RESET_WORKER_ENABLED: 'true', PUBLIC_WEB_ORIGIN: 'https://example.ec' };
  expect(() =>
    readPasswordResetWorkerConfig({ ...base, PASSWORD_RESET_RETRY_DELAYS_MINUTES: '1,5' }),
  ).toThrow();
  expect(() => readPasswordResetWorkerConfig({ ...base, PASSWORD_RESET_CLAIM_MS: '0' })).toThrow();
  expect(() =>
    readPasswordResetWorkerConfig({ ...base, PASSWORD_RESET_ATTEMPT_RETENTION_DAYS: '0' }),
  ).toThrow();
  expect(() =>
    readPasswordResetWorkerConfig({ ...base, PASSWORD_RESET_ACTION_RETENTION_DAYS: '0' }),
  ).toThrow();
});
