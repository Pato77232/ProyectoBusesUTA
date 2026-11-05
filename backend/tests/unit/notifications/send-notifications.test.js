const createSendNotifications = require('../../../src/modules/notifications/application/send-notifications');
const { noticeMessage } = require('../../../src/modules/notifications/domain/notice-message');
const {
  readNotificationsWorkerConfig,
} = require('../../../src/modules/notifications/infrastructure/notifications-worker-config');
const startNotificationWorker = require('../../../src/modules/notifications/infrastructure/notification-worker');

const NOW = new Date('2026-11-05T12:00:00.000Z');
const ORIGIN = 'https://transviaje.example';
const config = {
  origin: ORIGIN,
  claimMs: 120000,
  batchSize: 3,
  maxAttempts: 3,
  delays: [1, 5],
};
const context = Object.freeze({
  bookingId: 'b-1',
  cooperativeId: 'c-1',
  ownerId: 'u-1',
  status: 'SOLD',
  currency: 'USD',
  totalPriceCents: 1275,
  trip: {
    departureDate: '2026-11-10',
    origin: { position: 0, locationKey: 'Ambato', departureAt: '2026-11-10T08:00:00-05:00' },
    destination: { position: 2, locationKey: 'Quito', arrivalAt: '2026-11-10T10:30:00-05:00' },
  },
  passengers: [{ fullName: 'María Pérez' }, { fullName: 'Joaquín Pérez' }],
});
const notice = (extra = {}) => ({
  id: '00000000-0000-4000-8000-000000000001',
  kind: 'TICKETS_READY',
  bookingId: 'b-1',
  cooperativeId: 'c-1',
  payload: {},
  attempts: 1,
  ...extra,
});

function harness({ claimed = [notice()], found = context, email = 'cliente@example.ec' } = {}) {
  const queue = [...claimed];
  const repository = {
    claimNext: jest.fn(async () => queue.shift() ?? null),
    finish: jest.fn(async () => true),
    retry: jest.fn(async () => true),
  };
  const bookingContexts = { findNotificationContext: jest.fn(async () => found) };
  const customerContacts = { findCustomerEmail: jest.fn(async () => email) };
  const mailer = { send: jest.fn(async () => ({ status: 'ACCEPTED' })) };
  const sender = createSendNotifications({
    repository,
    bookingContexts,
    customerContacts,
    mailer,
    config,
    clock: () => NOW,
  });
  return { sender, repository, bookingContexts, customerContacts, mailer };
}

const finished = (h) => h.repository.finish.mock.calls.map(([call]) => [call.state, call.code]);

test('envía el aviso de boletos al comprador y lo marca aceptado', async () => {
  const h = harness();
  await expect(h.sender.processNext()).resolves.toBe(true);
  expect(h.repository.claimNext).toHaveBeenCalledWith({ now: NOW, claimMs: 120000 });
  expect(h.bookingContexts.findNotificationContext).toHaveBeenCalledWith({
    bookingId: 'b-1',
    cooperativeId: 'c-1',
  });
  expect(h.customerContacts.findCustomerEmail).toHaveBeenCalledWith('u-1');
  const sent = h.mailer.send.mock.calls[0][0];
  expect(sent).toMatchObject({
    to: 'cliente@example.ec',
    subject: 'Tus boletos de transViaje están listos',
    notificationId: notice().id,
  });
  expect(sent.text).toContain(`${ORIGIN}/pages/boletos.html?reserva=b-1`);
  expect(finished(h)).toEqual([['ACCEPTED', null]]);
});

test('sin correo de cliente se omite sin reintentar', async () => {
  const h = harness({ email: null });
  await h.sender.processNext();
  expect(h.mailer.send).not.toHaveBeenCalled();
  expect(finished(h)).toEqual([['SKIPPED', 'NO_CUSTOMER_EMAIL']]);
});

test.each([
  ['reserva inexistente', null, 'BOOKING_NOT_FOUND'],
  ['estado que ya no corresponde', { ...context, status: 'EXPIRED' }, 'NOTICE_STATE_MISMATCH'],
])('%s cierra el aviso como fallido sin enviar', async (_label, found, code) => {
  const h = harness({ found });
  await h.sender.processNext();
  expect(h.mailer.send).not.toHaveBeenCalled();
  expect(finished(h)).toEqual([['FAILED', code]]);
});

test.each([
  ['MAIL_TEMPORARY_FAILURE', 1, 1],
  ['MAIL_OUTCOME_UNCERTAIN', 2, 5],
])('fallo %s en el intento %i se reintenta en %i minutos', async (code, attempts, minutes) => {
  const h = harness({ claimed: [notice({ attempts })] });
  h.mailer.send.mockRejectedValue(Object.assign(new Error('x'), { code }));
  await h.sender.processNext();
  expect(h.repository.retry).toHaveBeenCalledWith({
    id: notice().id,
    attempts,
    code,
    nextAttemptAt: new Date(NOW.getTime() + minutes * 60000),
  });
  expect(h.repository.finish).not.toHaveBeenCalled();
});

test('en el último intento un fallo temporal queda fallido', async () => {
  const h = harness({ claimed: [notice({ attempts: 3 })] });
  h.mailer.send.mockRejectedValue(
    Object.assign(new Error('x'), { code: 'MAIL_TEMPORARY_FAILURE' }),
  );
  await h.sender.processNext();
  expect(finished(h)).toEqual([['FAILED', 'MAIL_TEMPORARY_FAILURE']]);
});

test.each(['MAIL_PERMANENT_FAILURE', 'MAIL_NOT_ACCEPTED', 'MAIL_INVALID_MESSAGE'])(
  'fallo permanente %s no se reintenta',
  async (code) => {
    const h = harness();
    h.mailer.send.mockRejectedValue(Object.assign(new Error('x'), { code }));
    await h.sender.processNext();
    expect(h.repository.retry).not.toHaveBeenCalled();
    expect(finished(h)).toEqual([['FAILED', code]]);
  },
);

test('un código de error desconocido se guarda como UNKNOWN_ERROR', async () => {
  const h = harness();
  h.mailer.send.mockRejectedValue(new Error('detalle con datos'));
  await h.sender.processNext();
  expect(h.repository.retry.mock.calls[0][0].code).toBe('UNKNOWN_ERROR');
});

test('Reservas o Auth caídos se reintentan; datos incoherentes no', async () => {
  const unavailable = harness();
  unavailable.bookingContexts.findNotificationContext.mockRejectedValue({
    code: 'BOOKING_NOTIFICATION_QUERY_UNAVAILABLE',
  });
  await unavailable.sender.processNext();
  expect(unavailable.repository.retry.mock.calls[0][0].code).toBe('BOOKING_UNAVAILABLE');

  const integrity = harness();
  integrity.bookingContexts.findNotificationContext.mockRejectedValue({
    code: 'BOOKING_NOTIFICATION_DATA_INTEGRITY_ERROR',
  });
  await integrity.sender.processNext();
  expect(finished(integrity)).toEqual([['FAILED', 'BOOKING_INTEGRITY_ERROR']]);

  const contact = harness();
  contact.customerContacts.findCustomerEmail.mockRejectedValue(new Error('pool'));
  await contact.sender.processNext();
  expect(contact.repository.retry.mock.calls[0][0].code).toBe('CONTACT_UNAVAILABLE');
});

test('un aviso reclamado de nuevo por encima del máximo se cierra sin enviar', async () => {
  const h = harness({ claimed: [notice({ attempts: 4 })] });
  await h.sender.processNext();
  expect(h.mailer.send).not.toHaveBeenCalled();
  expect(finished(h)).toEqual([['FAILED', 'MAX_ATTEMPTS_REACHED']]);
});

test('una ronda procesa como máximo batchSize avisos y se detiene si no hay más', async () => {
  const many = harness({ claimed: [notice(), notice(), notice(), notice()] });
  await many.sender.runBatch();
  expect(many.mailer.send).toHaveBeenCalledTimes(3);
  const few = harness({ claimed: [notice()] });
  await few.sender.runBatch();
  expect(few.repository.claimNext).toHaveBeenCalledTimes(2);
});

describe('textos', () => {
  test('boletos: tramo, pasajeros, total y enlace; sin cédulas', () => {
    const { subject, text } = noticeMessage({ kind: 'TICKETS_READY', context, origin: ORIGIN });
    expect(subject).toBe('Tus boletos de transViaje están listos');
    expect(text).toContain('Ambato → Quito');
    expect(text).toContain('María Pérez, Joaquín Pérez');
    expect(text).toMatch(/12,75/);
    expect(text).toContain('https://transviaje.example/pages/boletos.html?reserva=b-1');
    expect(text).not.toMatch(/\d{10}/);
  });

  test('rechazo incluye la justificación; vencimiento avisa la liberación', () => {
    const rejected = noticeMessage({
      kind: 'PROOF_REJECTED',
      context: { ...context, status: 'REJECTED' },
      payload: { justification: 'El monto no coincide' },
      origin: ORIGIN,
    });
    expect(rejected.subject).toBe('Tu comprobante de pago fue rechazado');
    expect(rejected.text).toContain('Motivo: El monto no coincide');
    const expired = noticeMessage({
      kind: 'BOOKING_EXPIRED',
      context: { ...context, trip: null },
      origin: ORIGIN,
    });
    expect(expired.subject).toBe('Tu reserva venció');
    expect(expired.text).toContain('Los asientos se liberaron');
    expect(expired.text).not.toContain('Viaje:');
  });
});

describe('configuración', () => {
  const enabled = { NOTIFICATIONS_WORKER_ENABLED: 'true', PUBLIC_WEB_ORIGIN: ORIGIN };

  test('apagado por defecto', () => {
    expect(readNotificationsWorkerConfig({})).toEqual({ enabled: false });
    expect(readNotificationsWorkerConfig({ NOTIFICATIONS_WORKER_ENABLED: 'false' })).toEqual({
      enabled: false,
    });
  });

  test('encendido con valores por defecto configurables', () => {
    expect(readNotificationsWorkerConfig(enabled)).toEqual({
      enabled: true,
      origin: ORIGIN,
      pollMs: 5000,
      claimMs: 120000,
      batchSize: 10,
      maxAttempts: 5,
      delays: [1, 5, 15, 60],
    });
    expect(
      readNotificationsWorkerConfig({
        ...enabled,
        NOTIFICATIONS_MAX_ATTEMPTS: '2',
        NOTIFICATIONS_RETRY_DELAYS_MINUTES: '3',
      }),
    ).toMatchObject({ maxAttempts: 2, delays: [3] });
  });

  test.each([
    { NOTIFICATIONS_WORKER_ENABLED: 'si' },
    { NOTIFICATIONS_WORKER_ENABLED: 'true' },
    { ...enabled, PUBLIC_WEB_ORIGIN: 'http://transviaje.example' },
    { ...enabled, PUBLIC_WEB_ORIGIN: 'https://transviaje.example/pages' },
    { ...enabled, NODE_ENV: 'production', PUBLIC_WEB_ORIGIN: 'http://localhost:8081' },
    { ...enabled, NOTIFICATIONS_RETRY_DELAYS_MINUTES: '1,5' },
    { ...enabled, NOTIFICATIONS_POLL_MS: '0' },
  ])('configuración inválida %j falla al arrancar', (env) => {
    expect(() => readNotificationsWorkerConfig(env)).toThrow();
  });

  test('en local acepta http://localhost', () => {
    expect(
      readNotificationsWorkerConfig({ ...enabled, PUBLIC_WEB_ORIGIN: 'http://localhost:8081' })
        .origin,
    ).toBe('http://localhost:8081');
  });
});

test('el bucle no se solapa, informa fallos sin detalles y se detiene', async () => {
  jest.useFakeTimers();
  try {
    const onFailure = jest.fn();
    const runBatch = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('SQL privado'), { name: 'DatabaseError' }))
      .mockResolvedValue();
    const worker = startNotificationWorker({ runBatch, intervalMs: 1000, onFailure });
    await jest.advanceTimersByTimeAsync(0);
    expect(onFailure).toHaveBeenCalledWith({ errorType: 'DatabaseError' });
    await jest.advanceTimersByTimeAsync(1000);
    expect(runBatch).toHaveBeenCalledTimes(2);
    await worker.stop();
    await jest.advanceTimersByTimeAsync(5000);
    expect(runBatch).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});
