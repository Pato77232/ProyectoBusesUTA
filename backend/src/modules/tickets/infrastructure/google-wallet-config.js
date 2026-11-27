const fs = require('node:fs');
const {
  createGoogleWalletLinkSigner,
  disabledGoogleWalletSigner,
} = require('./google-wallet-link-signer');

const NAMES = Object.freeze([
  'GOOGLE_WALLET_ISSUER_ID',
  'GOOGLE_WALLET_CLASS_SUFFIX',
  'GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_WALLET_PRIVATE_KEY_FILE',
  'GOOGLE_WALLET_ORIGINS',
]);
const ISSUER_ID = /^\d{1,30}$/;
const CLASS_SUFFIX = /^[A-Za-z0-9._-]{1,100}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DISABLED = Object.freeze({ enabled: false, signer: disabledGoogleWalletSigner });

function origins(value) {
  const list = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const valid = list.every((item) => {
    try {
      const url = new URL(item);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === item;
    } catch {
      return false;
    }
  });
  return valid && list.length ? list : null;
}

function serviceAccountKey(path, email, readFile) {
  const key = JSON.parse(readFile(path, 'utf8'));
  if (typeof key?.private_key !== 'string' || key.client_email !== email) return null;
  return key.private_key;
}

/**
 * Lee la configuración de Google Wallet (BOLETOS-03). Sin variables, la función queda
 * deshabilitada en silencio; si están incompletas o la clave no sirve, también, con un
 * aviso que nunca incluye la clave ni sus valores. La aplicación sigue funcionando.
 */
function readGoogleWalletConfig(env = process.env, { readFile = fs.readFileSync, warn } = {}) {
  const notify = (message) => warn?.(message);
  if (NAMES.every((name) => !env[name])) return DISABLED;
  if (NAMES.some((name) => typeof env[name] !== 'string' || !env[name].trim())) {
    notify('Google Wallet queda deshabilitado: la configuración está incompleta.');
    return DISABLED;
  }
  const allowedOrigins = origins(env.GOOGLE_WALLET_ORIGINS);
  if (
    !ISSUER_ID.test(env.GOOGLE_WALLET_ISSUER_ID) ||
    !CLASS_SUFFIX.test(env.GOOGLE_WALLET_CLASS_SUFFIX) ||
    !EMAIL.test(env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL) ||
    !allowedOrigins
  ) {
    notify('Google Wallet queda deshabilitado: la configuración no es válida.');
    return DISABLED;
  }
  try {
    const privateKey = serviceAccountKey(
      env.GOOGLE_WALLET_PRIVATE_KEY_FILE,
      env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL,
      readFile,
    );
    if (!privateKey) throw new Error('clave');
    return Object.freeze({
      enabled: true,
      issuerId: env.GOOGLE_WALLET_ISSUER_ID,
      classSuffix: env.GOOGLE_WALLET_CLASS_SUFFIX,
      signer: createGoogleWalletLinkSigner({
        serviceAccountEmail: env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL,
        privateKey,
        origins: allowedOrigins,
      }),
    });
  } catch {
    notify('Google Wallet queda deshabilitado: no se pudo leer la clave de la cuenta de servicio.');
    return DISABLED;
  }
}

module.exports = { readGoogleWalletConfig, GOOGLE_WALLET_ENV_NAMES: NAMES };
