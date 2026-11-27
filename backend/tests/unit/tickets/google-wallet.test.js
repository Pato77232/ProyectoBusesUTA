const crypto = require('node:crypto');
const {
  googleWalletTransitObject,
  ecuadorDateTime,
} = require('../../../src/modules/tickets/domain/google-wallet-pass');
const {
  createGoogleWalletLinkSigner,
  disabledGoogleWalletSigner,
  SAVE_URL_PREFIX,
} = require('../../../src/modules/tickets/infrastructure/google-wallet-link-signer');
const {
  readGoogleWalletConfig,
} = require('../../../src/modules/tickets/infrastructure/google-wallet-config');
const createGetGoogleWalletLink = require('../../../src/modules/tickets/application/get-google-wallet-link');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const EMAIL = 'wallet@transviaje-test.iam.gserviceaccount.com';
const NOW = new Date('2026-11-10T22:00:00Z');
const TICKET_ID = '6f1c2a4e-0b7d-4f3e-9a51-3c2d1e0f9a87';

const sheet = Object.freeze({
  bookingId: 'b-1',
  currency: 'USD',
  trip: {
    departureDate: '2026-11-12',
    origin: { position: 0, locationKey: 'Ambato', departureAt: '2026-11-12T13:30:00.000Z' },
    destination: { position: 1, locationKey: 'Quito', arrivalAt: '2026-11-12T16:00:00.000Z' },
  },
  tickets: [
    {
      ticketId: TICKET_ID,
      code: 'TV-ABCD-EFGH',
      qrPayload: 'TRANSVIAJE:TICKET:TV-ABCD-EFGH',
      seatId: 's-7',
      passenger: { fullName: 'Ana Prueba', identificationNumber: '1710034065' },
      totalPriceCents: 550,
    },
  ],
});

function decodeSaveUrl(url) {
  const token = url.slice(SAVE_URL_PREFIX.length);
  const [header, claims, signature] = token.split('.');
  return {
    header: JSON.parse(Buffer.from(header, 'base64url')),
    claims: JSON.parse(Buffer.from(claims, 'base64url')),
    valid: crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${header}.${claims}`),
      publicKey,
      Buffer.from(signature, 'base64url'),
    ),
  };
}

const signer = () =>
  createGoogleWalletLinkSigner({
    serviceAccountEmail: EMAIL,
    privateKey: PRIVATE_PEM,
    origins: ['http://localhost:8088'],
    clock: () => NOW,
  });

describe('BOLETOS-03: pase de Google Wallet', () => {
  test('arma el transitObject con el QR de BOLETOS-01 y sin la cédula', () => {
    const object = googleWalletTransitObject({
      issuerId: '3388000000012345678',
      classSuffix: 'transviaje_bus',
      sheet,
      ticket: sheet.tickets[0],
    });
    expect(object).toMatchObject({
      id: `3388000000012345678.${TICKET_ID}`,
      classId: '3388000000012345678.transviaje_bus',
      state: 'ACTIVE',
      tripType: 'ONE_WAY',
      ticketNumber: 'TV-ABCD-EFGH',
      barcode: {
        type: 'QR_CODE',
        value: 'TRANSVIAJE:TICKET:TV-ABCD-EFGH',
        alternateText: 'TV-ABCD-EFGH',
      },
      purchaseDetails: { ticketCost: { faceValue: { currencyCode: 'USD', micros: 5500000 } } },
    });
    expect(object.ticketLeg).toEqual({
      originName: { defaultValue: { language: 'es', value: 'Ambato' } },
      destinationName: { defaultValue: { language: 'es', value: 'Quito' } },
      departureDateTime: '2026-11-12T08:30:00-05:00',
      arrivalDateTime: '2026-11-12T11:00:00-05:00',
    });
    const json = JSON.stringify(object);
    expect(json).not.toContain('1710034065');
    expect(json).not.toContain('Ana Prueba');
  });

  test('expresa la hora en Ecuador aunque cambie el día', () => {
    expect(ecuadorDateTime('2026-11-13T03:15:00Z')).toBe('2026-11-12T22:15:00-05:00');
  });

  test('rechaza identificadores que Google no admite o datos incompletos', () => {
    const base = { issuerId: '123', classSuffix: 'bus', sheet, ticket: sheet.tickets[0] };
    expect(() => googleWalletTransitObject({ ...base, issuerId: '12 3' })).toThrow(
      expect.objectContaining({ code: 'TICKET_INTEGRITY_ERROR' }),
    );
    expect(() => googleWalletTransitObject({ ...base, classSuffix: 'bus/1' })).toThrow();
    expect(() => googleWalletTransitObject({ ...base, sheet: { ...sheet, trip: {} } })).toThrow();
  });
});

describe('BOLETOS-03: firma del enlace', () => {
  test('firma con RS256 un JWT que se verifica con la clave pública', () => {
    const url = signer().saveUrl({ id: '1.x' });
    expect(url.startsWith(SAVE_URL_PREFIX)).toBe(true);
    const { header, claims, valid } = decodeSaveUrl(url);
    expect(valid).toBe(true);
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(claims).toEqual({
      iss: EMAIL,
      aud: 'google',
      typ: 'savetowallet',
      iat: NOW.getTime() / 1000,
      origins: ['http://localhost:8088'],
      payload: { transitObjects: [{ id: '1.x' }] },
    });
  });

  test('no entrega un enlace demasiado largo', () => {
    expect(() => signer().saveUrl({ id: '1.x', relleno: 'x'.repeat(2000) })).toThrow(
      expect.objectContaining({ code: 'TICKET_INTEGRITY_ERROR' }),
    );
  });

  test('sin configuración el firmante responde deshabilitado', () => {
    expect(disabledGoogleWalletSigner.enabled).toBe(false);
    expect(() => disabledGoogleWalletSigner.saveUrl({})).toThrow(
      expect.objectContaining({ code: 'GOOGLE_WALLET_DISABLED', httpStatus: 503 }),
    );
  });
});

describe('BOLETOS-03: configuración', () => {
  const env = {
    GOOGLE_WALLET_ISSUER_ID: '3388000000012345678',
    GOOGLE_WALLET_CLASS_SUFFIX: 'transviaje_bus',
    GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: EMAIL,
    GOOGLE_WALLET_PRIVATE_KEY_FILE: '/run/secrets/wallet.json',
    GOOGLE_WALLET_ORIGINS: 'http://localhost:8088, https://qa.example.test',
  };
  const keyFile = JSON.stringify({ client_email: EMAIL, private_key: PRIVATE_PEM });
  const read = (content) => () => content;

  test('sin variables queda deshabilitado sin avisos', () => {
    const warn = jest.fn();
    expect(readGoogleWalletConfig({}, { warn }).enabled).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  test('con las cinco variables y una clave válida queda habilitado', () => {
    const config = readGoogleWalletConfig(env, { readFile: read(keyFile) });
    expect(config).toMatchObject({
      enabled: true,
      issuerId: '3388000000012345678',
      classSuffix: 'transviaje_bus',
    });
    const { claims, valid } = decodeSaveUrl(config.signer.saveUrl({ id: '1.x' }));
    expect(valid).toBe(true);
    expect(claims.origins).toEqual(['http://localhost:8088', 'https://qa.example.test']);
  });

  test.each([
    ['incompleta', { ...env, GOOGLE_WALLET_ORIGINS: '' }, keyFile],
    ['emisor no numérico', { ...env, GOOGLE_WALLET_ISSUER_ID: 'abc' }, keyFile],
    ['origen con ruta', { ...env, GOOGLE_WALLET_ORIGINS: 'http://localhost:8088/x' }, keyFile],
    ['clave ilegible', env, 'no es json'],
    [
      'clave de otra cuenta',
      env,
      JSON.stringify({ client_email: 'otra@x.test', private_key: PRIVATE_PEM }),
    ],
    ['clave inválida', env, JSON.stringify({ client_email: EMAIL, private_key: 'x' })],
  ])(
    'deshabilita con aviso si la configuración es %s, sin mostrar la clave',
    (_, values, content) => {
      const warn = jest.fn();
      expect(readGoogleWalletConfig(values, { readFile: read(content), warn }).enabled).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).not.toContain('PRIVATE');
      expect(warn.mock.calls[0][0]).not.toContain(EMAIL);
    },
  );
});

describe('BOLETOS-03: enlace del boleto del propietario', () => {
  const googleWallet = {
    enabled: true,
    issuerId: '123',
    classSuffix: 'bus',
    signer: { saveUrl: jest.fn(() => `${SAVE_URL_PREFIX}firmado`) },
  };

  test('devuelve el enlace del boleto pedido', async () => {
    const issueOwnerTickets = jest.fn(async () => sheet);
    const getLink = createGetGoogleWalletLink({ issueOwnerTickets, googleWallet });
    await expect(
      getLink({ bookingId: 'b-1', ticketId: TICKET_ID, ownerId: 'u-1' }),
    ).resolves.toEqual({
      saveUrl: `${SAVE_URL_PREFIX}firmado`,
    });
    expect(issueOwnerTickets).toHaveBeenCalledWith({ bookingId: 'b-1', ownerId: 'u-1' });
    expect(googleWallet.signer.saveUrl.mock.calls[0][0].id).toBe(`123.${TICKET_ID}`);
  });

  test('un boleto que no es de la reserva responde 404', async () => {
    const getLink = createGetGoogleWalletLink({
      issueOwnerTickets: async () => sheet,
      googleWallet,
    });
    await expect(
      getLink({ bookingId: 'b-1', ticketId: 'otro', ownerId: 'u-1' }),
    ).rejects.toMatchObject({
      code: 'TICKET_NOT_FOUND',
      httpStatus: 404,
    });
  });

  test('deshabilitado no consulta boletos ni firma', async () => {
    const issueOwnerTickets = jest.fn();
    const getLink = createGetGoogleWalletLink({
      issueOwnerTickets,
      googleWallet: { enabled: false, signer: disabledGoogleWalletSigner },
    });
    await expect(
      getLink({ bookingId: 'b-1', ticketId: TICKET_ID, ownerId: 'u-1' }),
    ).rejects.toMatchObject({
      code: 'GOOGLE_WALLET_DISABLED',
    });
    expect(issueOwnerTickets).not.toHaveBeenCalled();
  });

  test('propaga los errores de la consulta de boletos sin firmar', async () => {
    const signerCall = jest.fn();
    const getLink = createGetGoogleWalletLink({
      issueOwnerTickets: async () => {
        throw Object.assign(new Error('x'), { code: 'TICKET_NOT_FOUND', httpStatus: 404 });
      },
      googleWallet: { ...googleWallet, signer: { saveUrl: signerCall } },
    });
    await expect(
      getLink({ bookingId: 'b-1', ticketId: TICKET_ID, ownerId: 'u-2' }),
    ).rejects.toMatchObject({
      code: 'TICKET_NOT_FOUND',
    });
    expect(signerCall).not.toHaveBeenCalled();
  });
});
