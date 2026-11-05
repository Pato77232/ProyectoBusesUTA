const crypto = require('node:crypto');
const TicketError = require('../domain/ticket-error');

const SAVE_URL_PREFIX = 'https://pay.google.com/gp/v/save/';
// Google recomienda no superar este largo para que el enlace funcione en todos los navegadores.
const MAX_SAVE_URL_LENGTH = 1800;
const MS_PER_SECOND = 1000;

const base64url = (value) => Buffer.from(value).toString('base64url');

/**
 * Firma el JWT «Guardar en Google Wallet» con RS256 usando `node:crypto` (BOLETOS-03).
 * Un enlace demasiado largo es un error de integridad: no se entrega truncado.
 */
function createGoogleWalletLinkSigner({
  serviceAccountEmail,
  privateKey,
  origins,
  clock = () => new Date(),
}) {
  if (!serviceAccountEmail || !privateKey || !Array.isArray(origins) || !origins.length)
    throw new TypeError('Faltan datos para firmar enlaces de Google Wallet.');
  const key = crypto.createPrivateKey(privateKey);

  return Object.freeze({
    enabled: true,
    saveUrl(transitObject) {
      const header = { alg: 'RS256', typ: 'JWT' };
      const claims = {
        iss: serviceAccountEmail,
        aud: 'google',
        typ: 'savetowallet',
        iat: Math.floor(clock().getTime() / MS_PER_SECOND),
        origins,
        payload: { transitObjects: [transitObject] },
      };
      const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
      const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), key);
      const url = `${SAVE_URL_PREFIX}${unsigned}.${base64url(signature)}`;
      if (url.length > MAX_SAVE_URL_LENGTH) throw new TicketError();
      return url;
    },
  });
}

/** Firmante usado cuando falta la configuración: la función queda deshabilitada. */
const disabledGoogleWalletSigner = Object.freeze({
  enabled: false,
  saveUrl() {
    throw new TicketError('GOOGLE_WALLET_DISABLED');
  },
});

module.exports = {
  createGoogleWalletLinkSigner,
  disabledGoogleWalletSigner,
  MAX_SAVE_URL_LENGTH,
  SAVE_URL_PREFIX,
};
