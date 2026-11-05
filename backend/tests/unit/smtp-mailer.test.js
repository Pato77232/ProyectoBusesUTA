const { randomUUID } = require('node:crypto');
const { createSmtpMailer } = require('../../src/shared/mail/smtp-mailer');
const { run } = require('../../scripts/check-smtp');
const env = {
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: '587',
  SMTP_USER: 'qa@example.ec',
  SMTP_PASSWORD: 'qa-only-not-a-secret',
  SMTP_FROM: 'qa@example.ec',
};
const message = () => ({
  to: 'recipient@example.ec',
  subject: 'Prueba QA',
  text: 'Contenido ficticio',
  notificationId: randomUUID(),
});
test('sin configuración falla cerrado y no se crea un transporte', async () => {
  const factory = jest.fn(),
    mailer = createSmtpMailer({}, factory);
  expect(mailer.configured).toBe(false);
  await expect(mailer.send(message())).rejects.toMatchObject({ code: 'MAIL_NOT_CONFIGURED' });
  expect(factory).not.toHaveBeenCalled();
});
test.each([
  { SMTP_PORT: '25' },
  { SMTP_HOST: 'smtp://user:secret@host' },
  { SMTP_PASSWORD: '' },
  { SMTP_FROM: 'qa@example.ec\r\nBcc:third@example.ec' },
])('rechaza configuración insegura o parcial %p', (change) => {
  expect(() => createSmtpMailer({ ...env, ...change })).toThrow(
    expect.objectContaining({ code: 'MAIL_CONFIG_INVALID' }),
  );
});
test('clasifica rechazo temporal devuelto por SMTP sin accepted', async () => {
  const transport = {
    sendMail: jest.fn().mockResolvedValue({
      accepted: [],
      rejectedErrors: [{ responseCode: 450, message: env.SMTP_PASSWORD }],
    }),
  };
  await expect(createSmtpMailer(env, () => transport).send(message())).rejects.toMatchObject({
    code: 'MAIL_TEMPORARY_FAILURE',
    message: expect.not.stringContaining(env.SMTP_PASSWORD),
  });
});
test('requiere TLS y comunica aceptación, sin prometer entrega ni divulgar configuración', async () => {
  const transport = {
    verify: jest.fn().mockResolvedValue(true),
    sendMail: jest.fn().mockResolvedValue({ accepted: ['recipient@example.ec'] }),
  };
  const factory = jest.fn(() => transport),
    mailer = createSmtpMailer(env, factory),
    input = message();
  expect(factory).toHaveBeenCalledWith(
    expect.objectContaining({
      requireTLS: true,
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      disableFileAccess: true,
      disableUrlAccess: true,
      logger: false,
      debug: false,
    }),
  );
  expect(await mailer.verify()).toEqual({ status: 'CONFIGURATION_VERIFIED' });
  expect(await mailer.send(input)).toEqual({
    notificationId: input.notificationId,
    status: 'ACCEPTED',
  });
  expect(transport.sendMail).toHaveBeenCalledWith(
    expect.objectContaining({
      from: env.SMTP_FROM,
      messageId: `<${input.notificationId}@transviaje.local>`,
    }),
  );
  const tlsFactory = jest.fn(() => transport);
  createSmtpMailer({ ...env, SMTP_PORT: '465' }, tlsFactory);
  expect(tlsFactory.mock.calls[0][0].secure).toBe(true);
});
test('rechaza cabeceras inyectadas, remitente del cliente y archivos sin enviar', async () => {
  const transport = { sendMail: jest.fn() },
    mailer = createSmtpMailer(env, () => transport);
  for (const change of [
    { to: 'victim@example.ec\r\nCc:third@example.ec' },
    { subject: 'Prueba\nBcc:x' },
    { from: 'attacker@example.ec' },
    { attachments: [{ path: '/private' }] },
  ])
    await expect(mailer.send({ ...message(), ...change })).rejects.toMatchObject({
      code: 'MAIL_INVALID_MESSAGE',
    });
  expect(transport.sendMail).not.toHaveBeenCalled();
});
test('rechazo o caída no se convierten en aceptación ni exponen el error original', async () => {
  const transport = {
    sendMail: jest.fn().mockResolvedValue({ accepted: [], rejected: ['recipient@example.ec'] }),
    verify: jest.fn().mockRejectedValue(new Error(env.SMTP_PASSWORD)),
  };
  const mailer = createSmtpMailer(env, () => transport);
  await expect(mailer.send(message())).rejects.toMatchObject({ code: 'MAIL_NOT_ACCEPTED' });
  transport.sendMail.mockRejectedValue(new Error(env.SMTP_PASSWORD));
  await expect(mailer.send(message())).rejects.toMatchObject({
    code: 'MAIL_OUTCOME_UNCERTAIN',
    message: expect.not.stringContaining(env.SMTP_PASSWORD),
  });
  await expect(mailer.verify()).rejects.toMatchObject({ code: 'MAIL_CONNECTION_FAILED' });
});
test.each([
  [{ responseCode: 421 }, 'MAIL_TEMPORARY_FAILURE'],
  [{ responseCode: 550 }, 'MAIL_PERMANENT_FAILURE'],
  [{ code: 'ECONNECTION' }, 'MAIL_TEMPORARY_FAILURE'],
  [{ code: 'ETIMEDOUT' }, 'MAIL_OUTCOME_UNCERTAIN'],
])('clasifica fallos SMTP sin exponer detalles del transporte', async (failure, code) => {
  const transport = {
    sendMail: jest.fn().mockRejectedValue({ ...failure, message: env.SMTP_PASSWORD }),
  };
  const mailer = createSmtpMailer(env, () => transport);
  await expect(mailer.send(message())).rejects.toMatchObject({
    code,
    message: expect.not.stringContaining(env.SMTP_PASSWORD),
  });
});
test('el CLI verifica sin enviar por defecto y exige destinatario explícito para la prueba', async () => {
  const mailer = {
      verify: jest.fn().mockResolvedValue({ status: 'CONFIGURATION_VERIFIED' }),
      send: jest.fn(),
    },
    output = jest.fn();
  expect(await run({ env, args: [], createMailer: () => mailer, output })).toBe(0);
  expect(mailer.send).not.toHaveBeenCalled();
  expect(await run({ env, args: ['--send-test'], createMailer: () => mailer, output })).toBe(1);
  expect(mailer.send).not.toHaveBeenCalled();
  expect(await run({ env: {}, args: [], output })).toBe(1);
  expect(output).toHaveBeenLastCalledWith({ status: 'FAILED', code: 'MAIL_NOT_CONFIGURED' });
});
