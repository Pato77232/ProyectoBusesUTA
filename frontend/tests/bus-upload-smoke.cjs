// FLEET-05 T2: alta multipart por el proxy real; datos y perfiles exclusivos de QA.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { createRuntime } = require('../scripts/dev-runtime.cjs');
const { openBrowser } = require('./helpers/browser.cjs');

const MAX_REQUEST_BYTES = 50_065_536;
const DEFAULT_PROXY_LIMIT_BYTES = 1_048_576;
const PHOTOS = 10;
const UPLOAD_TIMEOUT_MS = 120_000;
const DATABASE_DELAY_SECONDS = 15;
// Generada en el backend, que ya tiene sharp: JPEG de 24 MP, el peor caso de decodificación.
const PHOTO_SCRIPT = `
  const sharp = require('sharp');
  (async () => {
    const noise = { type: 'gaussian', mean: 128, sigma: 12 };
    const base = sharp({ create: { width: 6000, height: 4000, channels: 3,
      background: '#808080', noise } });
    const raw = await base.raw().toBuffer();
    for (let quality = 90; quality >= 10; quality -= 2) {
      const photo = await sharp(raw, { raw: { width: 6000, height: 4000, channels: 3 } })
        .jpeg({ quality }).toBuffer();
      if (photo.length <= 5000000) return process.stdout.write(photo.toString('base64'));
    }
    throw new Error('Foto demasiado grande');
  })();
`;

const psql = (runtime, sql) =>
  runtime
    .compose([
      'exec',
      '-T',
      'db',
      'psql',
      '-U',
      'frontend_dev',
      '-d',
      'transviaje_frontend_dev',
      '-Atqc',
      sql,
    ])
    .trim();

async function signInAsAdmin(browser, runtime) {
  await browser.evaluate(`(async () => {
    const { createApiClient } = await import('/src/api/api-client.js');
    window.qaClient = createApiClient();
    window.qaCredentials = { email: crypto.randomUUID() + '@qa.invalid',
      password: crypto.randomUUID() + '-solo-QA' };
    await qaClient.request('/api/v1/auth/register', { method: 'POST', data: qaCredentials });
    window.qaEmail = qaCredentials.email;
  })()`);
  const email = await browser.evaluate('qaEmail');
  const cooperative = psql(
    runtime,
    `INSERT INTO cooperatives(name, ruc) VALUES ('Cooperativa QA', '0011111111111') RETURNING id;`,
  );
  psql(
    runtime,
    `UPDATE users SET role = 'COOPERATIVE_ADMIN', cooperative_id = '${cooperative}'
     WHERE email = '${email}';`,
  );
  const group = psql(
    runtime,
    `INSERT INTO bus_groups(cooperative_id, name, category)
     VALUES ('${cooperative}', 'Grupo QA', 'LONG_ROUTE') RETURNING id;`,
  );
  await browser.evaluate(
    `qaClient.request('/api/v1/auth/login', { method: 'POST', data: qaCredentials })`,
  );
  return group;
}

const busData = (group) => ({
  plate: 'QAB-1234',
  vin: `VIN-${randomUUID()}`,
  unitNumber: 7,
  bodyworkBrand: 'Marca ficticia',
  color: 'Blanco',
  busGroupId: group,
  seatLayoutId: 'SINGLE_DECK_2_2',
  seatLayoutVersion: 1,
  disabledSeatKeys: [],
});

async function waitForUpload(browser) {
  const deadline = Date.now() + UPLOAD_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await browser.evaluate('window.qaUpload');
    if (result) return result;
    await delay(250);
  }
  throw new Error('La carga no terminó a tiempo');
}

async function holdBusInsert(runtime) {
  // Bloqueo exclusivo de la BD efímera: retrasa el alta real sin alterar producción.
  runtime.compose([
    'exec',
    '-d',
    'db',
    'psql',
    '-U',
    'frontend_dev',
    '-d',
    'transviaje_frontend_dev',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `BEGIN; LOCK TABLE buses IN ACCESS EXCLUSIVE MODE;
     SELECT pg_sleep(${DATABASE_DELAY_SECONDS}); COMMIT;`,
  ]);
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (
      psql(
        runtime,
        `SELECT count(*) FROM pg_locks
        WHERE relation = 'buses'::regclass AND mode = 'AccessExclusiveLock' AND granted;`,
      ) === '1'
    )
      return;
    await delay(100);
  }
  throw new Error('No se obtuvo el bloqueo de prueba del alta');
}

async function checkFullUpload(browser, group, photo) {
  await browser.evaluate(`(() => {
    const bytes = Uint8Array.from(atob('${photo}'), (char) => char.charCodeAt(0));
    const formData = new FormData();
    formData.set('data', ${JSON.stringify(JSON.stringify(busData(group)))});
    for (let index = 0; index < ${PHOTOS}; index += 1) {
      formData.append('photos', new File([bytes], 'bus-' + index + '.jpg', { type: 'image/jpeg' }));
    }
    window.qaUpload = null;
    const started = performance.now();
    qaClient.request('/api/v1/buses', { method: 'POST', formData }).then(
      ({ bus }) => { qaUpload = { plate: bus.plate, ms: performance.now() - started }; },
      (error) => { qaUpload = { code: error.code, status: error.status }; },
    );
  })()`);
  const result = await waitForUpload(browser);
  assert.equal(result.plate, 'QAB-1234', `Alta rechazada: ${result.code} ${result.status}`);
  return result.ms;
}

function checkOversized(browser, path, bytes) {
  return browser.evaluate(`(async () => {
    const formData = new FormData();
    formData.append('photos', new File([new Uint8Array(${bytes})], 'grande.jpg',
      { type: 'image/jpeg' }));
    try {
      await qaClient.request('${path}', { method: 'POST', formData });
      return { ok: true };
    } catch (error) {
      return { code: error.code, status: error.status };
    }
  })()`);
}

async function main() {
  const runtime = createRuntime({
    project: `transviaje-frontend-qa-buses-${process.pid}`,
    port: '0',
  });
  let browser;
  let owned = false;
  try {
    assert.equal(runtime.exists(), false, 'Proyecto QA exclusivo');
    owned = true;
    runtime.compose(['up', '-d', '--build', '--wait', '--wait-timeout', '120'], {
      maxBuffer: 16 * 1024 * 1024,
    });
    const origin = `http://${runtime.compose(['port', 'frontend', '8080']).trim()}`;
    runtime.compose(['exec', '-T', 'frontend', 'nginx', '-t', '-c', '/etc/nginx/nginx-proxy.conf']);
    const photo = runtime
      .compose(['exec', '-T', 'backend', 'node', '-e', PHOTO_SCRIPT], {
        maxBuffer: 16 * 1024 * 1024,
      })
      .trim();
    browser = await openBrowser(origin);
    const group = await signInAsAdmin(browser, runtime);
    const photoBytes = Buffer.from(photo, 'base64').length;
    await holdBusInsert(runtime);
    const ms = await checkFullUpload(browser, group, photo);
    assert.ok(ms > 10_000 && ms < 60_000, `Respuesta fuera de la ventana 10–60 s: ${ms} ms`);
    assert.equal(psql(runtime, 'SELECT count(*) FROM buses;'), '1');
    assert.deepEqual(await checkOversized(browser, '/api/v1/buses', MAX_REQUEST_BYTES + 1), {
      code: 'PAYLOAD_TOO_LARGE',
      status: 413,
    });
    assert.deepEqual(
      await checkOversized(browser, '/api/v1/cooperatives', DEFAULT_PROXY_LIMIT_BYTES + 1),
      { code: 'PAYLOAD_TOO_LARGE', status: 413 },
    );
    assert.equal(psql(runtime, 'SELECT count(*) FROM buses;'), '1');
    process.stdout.write(
      `Aprobado: ${PHOTOS} fotos de ${photoBytes} bytes en ${Math.round(ms)} ms; ` +
        'límites de 413 en /api/v1/buses y en otra ruta.\n',
    );
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      try {
        if (owned) runtime.compose(['down', '--remove-orphans']);
      } finally {
        runtime.dispose();
      }
    }
  }
}

main().catch((error) => {
  process.stderr.write(`Falló la comprobación FLEET-05 T2: ${error.message}\n`);
  process.exitCode = 1;
});
