const nodemailer = require('nodemailer');
const DomainError = require('../errors/domain-error');

const TIMEOUT_MS = 15000;
const MAX_SUBJECT_LENGTH = 200;
const MAX_TEXT_LENGTH = 50000;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const EMAIL = /^[^\s<>@,;]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const isEmail = (value) => typeof value === 'string' && EMAIL.test(value);
const fail = (code, message) => {
  throw new DomainError(message, code, 503);
};

function readConfig(env) {
  const names = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'];
  if (names.every((name) => !env[name])) return null;
  if (
    names.some((name) => typeof env[name] !== 'string' || !env[name]) ||
    !/^[a-z0-9.-]+$/i.test(env.SMTP_HOST) ||
    !['465', '587'].includes(env.SMTP_PORT) ||
    !isEmail(env.SMTP_FROM) ||
    /[\r\n]/.test(env.SMTP_USER)
  )
    fail('MAIL_CONFIG_INVALID', 'La configuración SMTP está incompleta o no es válida.');
  return {
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: env.SMTP_PORT === '465',
    requireTLS: env.SMTP_PORT !== '465',
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  };
}

function createSmtpMailer(env = {}, createTransport = nodemailer.createTransport) {
  const config = readConfig(env);
  const transport = config ? createTransport(config) : null;
  const requireTransport = () => {
    if (!transport) fail('MAIL_NOT_CONFIGURED', 'El envío de correo no está configurado.');
  };
  return Object.freeze({
    configured: Boolean(transport),
    async verify() {
      requireTransport();
      try {
        await transport.verify();
      } catch {
        fail('MAIL_CONNECTION_FAILED', 'No se pudo verificar la conexión SMTP.');
      }
      return Object.freeze({ status: 'CONFIGURATION_VERIFIED' });
    },
    async send(input) {
      requireTransport();
      if (
        !input ||
        Object.keys(input).some(
          (key) => !['to', 'subject', 'text', 'notificationId'].includes(key),
        ) ||
        !isEmail(input.to) ||
        typeof input.subject !== 'string' ||
        !input.subject.trim() ||
        /[\r\n]/.test(input.subject) ||
        input.subject.length > MAX_SUBJECT_LENGTH ||
        typeof input.text !== 'string' ||
        !input.text.trim() ||
        input.text.length > MAX_TEXT_LENGTH ||
        typeof input.notificationId !== 'string' ||
        !UUID.test(input.notificationId)
      )
        fail('MAIL_INVALID_MESSAGE', 'Los datos del aviso no son válidos.');
      let result;
      try {
        result = await transport.sendMail({
          from: env.SMTP_FROM,
          to: input.to,
          subject: input.subject,
          text: input.text,
          messageId: `<${input.notificationId}@transviaje.local>`,
        });
      } catch {
        fail('MAIL_OUTCOME_UNCERTAIN', 'No se pudo confirmar la aceptación SMTP del aviso.');
      }
      if (
        !Array.isArray(result?.accepted) ||
        !result.accepted.some(
          (address) =>
            typeof address === 'string' && address.toLowerCase() === input.to.toLowerCase(),
        )
      )
        fail('MAIL_NOT_ACCEPTED', 'El servidor SMTP no confirmó la aceptación del aviso.');
      return Object.freeze({ notificationId: input.notificationId, status: 'ACCEPTED' });
    },
  });
}
module.exports = { createSmtpMailer };
