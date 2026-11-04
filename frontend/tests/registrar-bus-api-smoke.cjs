// FLEET-05 T3: pantalla conectada con backend, proxy y PostgreSQL reales; datos exclusivos de QA.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { createRuntime } = require('../scripts/dev-runtime.cjs');
const { openBrowser } = require('./helpers/browser.cjs');

const PAGE = '/pages/registrar-bus.html';
const output = process.env.QA_OUTPUT_DIR || path.join(os.tmpdir(), 'busesuta-fleet05-t3-qa');
const WAIT_MS = 60_000;
const BUS = {
  plate: 'QAB-1234',
  unitNumber: '7',
  vin: 'VIN-QA-T3',
  bodyworkBrand: 'Marca ficticia',
  color: 'Blanco',
};
// JPEG real y pequeño, generado en el backend que ya tiene sharp.
const PHOTO_SCRIPT = `
  require('sharp')({ create: { width: 800, height: 600, channels: 3, background: '#4a6' } })
    .jpeg({ quality: 80 }).toBuffer().then((photo) => process.stdout.write(photo.toString('base64')));
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

async function waitFor(browser, expression, label) {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    if (await browser.evaluate(expression)) return;
    await delay(200);
  }
  throw new Error(`No se cumplió: ${label}`);
}

async function openPage(browser, origin) {
  await browser.send('Page.navigate', { url: origin + PAGE });
  await waitFor(
    browser,
    `document.readyState === 'complete' && location.pathname === '${PAGE}'`,
    'carga de la página',
  );
}

const statusText = (browser) =>
  browser.evaluate(`document.querySelector('#bus-form-status').textContent`);

async function signInAsAdmin(browser, runtime) {
  await browser.evaluate(`(async () => {
    const { createApiClient } = await import('/src/api/api-client.js');
    window.qaClient = createApiClient();
    window.qaCredentials = { email: crypto.randomUUID() + '@qa.invalid',
      password: crypto.randomUUID() + '-solo-QA' };
    await qaClient.request('/api/v1/auth/register', { method: 'POST', data: qaCredentials });
  })()`);
  const email = await browser.evaluate('qaCredentials.email');
  const [own, other] = psql(
    runtime,
    `INSERT INTO cooperatives(name, ruc) VALUES ('Cooperativa QA', '0011111111111'),
       ('Cooperativa ajena', '0022222222222') RETURNING id;`,
  ).split('\n');
  psql(
    runtime,
    `UPDATE users SET role = 'COOPERATIVE_ADMIN', cooperative_id = '${own}' WHERE email = '${email}';
     INSERT INTO bus_groups(cooperative_id, name, category) VALUES
       ('${own}', 'Grupo QA', 'LONG_ROUTE'), ('${other}', 'Grupo ajeno', 'LONG_ROUTE');`,
  );
  await browser.evaluate(
    `qaClient.request('/api/v1/auth/login', { method: 'POST', data: qaCredentials })`,
  );
  return own;
}

async function fillForm(browser, photo) {
  await browser.evaluate(`(() => {
    const form = document.querySelector('#bus-form');
    const set = (name, value) => {
      form.elements[name].value = value;
      form.elements[name].dispatchEvent(new Event('change', { bubbles: true }));
    };
    for (const [name, value] of Object.entries(${JSON.stringify(BUS)})) set(name, value);
    set('busGroupId', form.elements.busGroupId.options[1].value);
    set('seatLayoutId', 'SINGLE_DECK_2_2');
    form.querySelector('[name="disabledSeatKeys"][value="deck-1-0-0"]').click();
    form.querySelector('[name="vipSeatKeys"][value="deck-1-0-1"]').click();
    const bytes = Uint8Array.from(atob('${photo}'), (char) => char.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], 'bus-qa.jpg', { type: 'image/jpeg' }));
    form.elements.photos.files = transfer.files;
    form.elements.photos.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

// Dos clics seguidos: el segundo debe encontrar el formulario deshabilitado.
const doubleSubmit = (browser) =>
  browser.evaluate(`(() => {
    const button = document.querySelector('#bus-fields button[type="submit"]');
    button.click();
    button.click();
  })()`);

async function checkSignedOut(browser, origin) {
  await openPage(browser, origin);
  await waitFor(browser, `!document.querySelector('#login-link').hidden`, 'aviso sin sesión');
  assert.match(await statusText(browser), /Inicia sesión/);
  assert.equal(await browser.evaluate(`document.querySelector('#bus-fields').disabled`), true);
}

async function checkRegistration(browser, origin, runtime, cooperativeId, photo) {
  await openPage(browser, origin);
  await waitFor(
    browser,
    `!document.querySelector('#bus-fields').disabled`,
    'formulario habilitado',
  );
  const groups = await browser.evaluate(
    `[...document.querySelector('#busGroupId').options].slice(1).map((option) => option.text)`,
  );
  assert.deepEqual(groups, ['Grupo QA']);
  await fillForm(browser, photo);
  await doubleSubmit(browser);
  await waitFor(
    browser,
    `/registrado/.test(document.querySelector('#bus-form-status').textContent)`,
    'alta confirmada',
  );
  assert.match(await statusText(browser), /QAB-1234 registrado: unidad 7, 41 asientos ofrecidos/);
  assert.equal(psql(runtime, 'SELECT count(*) FROM buses;'), '1');
  assert.equal(psql(runtime, 'SELECT cooperative_id FROM buses;'), cooperativeId);
  assert.equal(
    psql(
      runtime,
      `SELECT string_agg(layout_seat_key || ':' || category || ':' || offered, ',' ORDER BY label)
       FROM bus_seats WHERE layout_seat_key IN ('deck-1-0-0', 'deck-1-0-1');`,
    ),
    'deck-1-0-0:NORMAL:false,deck-1-0-1:VIP:true',
  );
  assert.equal(psql(runtime, 'SELECT count(*) FROM bus_photos;'), '1');
  await fs.mkdir(output, { recursive: true });
  const { data } = await browser.send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(path.join(output, 'registrado-1280.png'), Buffer.from(data, 'base64'));
}

async function checkDuplicate(browser, origin, runtime, photo) {
  await openPage(browser, origin);
  await waitFor(
    browser,
    `!document.querySelector('#bus-fields').disabled`,
    'formulario habilitado',
  );
  await fillForm(browser, photo);
  await browser.evaluate(`document.querySelector('#bus-form').requestSubmit()`);
  await waitFor(
    browser,
    `/ya están registrados/.test(document.querySelector('#bus-form-status').textContent)`,
    'rechazo 409',
  );
  const kept = await browser.evaluate(`({
    plate: document.querySelector('#plate').value,
    photos: document.querySelector('#photos').files.length,
    enabled: !document.querySelector('#bus-fields').disabled,
    focused: document.activeElement.id,
  })`);
  assert.deepEqual(kept, {
    plate: 'QAB-1234',
    photos: 1,
    enabled: true,
    focused: 'bus-form-status',
  });
  assert.equal(psql(runtime, 'SELECT count(*) FROM buses;'), '1');
}

async function main() {
  const runtime = createRuntime({ project: `transviaje-frontend-qa-t3-${process.pid}`, port: '0' });
  let browser;
  let owned = false;
  try {
    assert.equal(runtime.exists(), false, 'Proyecto QA exclusivo');
    owned = true;
    runtime.compose(['up', '-d', '--build', '--wait', '--wait-timeout', '120'], {
      maxBuffer: 16 * 1024 * 1024,
    });
    const origin = `http://${runtime.compose(['port', 'frontend', '8080']).trim()}`;
    const photo = runtime.compose(['exec', '-T', 'backend', 'node', '-e', PHOTO_SCRIPT]).trim();
    browser = await openBrowser(origin);
    const checks = [
      ['sin sesión', () => checkSignedOut(browser, origin)],
      [
        'alta',
        async () => {
          await openPage(browser, origin);
          const cooperativeId = await signInAsAdmin(browser, runtime);
          await checkRegistration(browser, origin, runtime, cooperativeId, photo);
        },
      ],
      ['duplicado', () => checkDuplicate(browser, origin, runtime, photo)],
    ];
    for (const [name, check] of checks) {
      await check();
      process.stdout.write(`ok ${name}\n`);
    }
    process.stdout.write(`${checks.length} comprobaciones aprobadas; captura en ${output}\n`);
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      try {
        if (owned) runtime.compose(['down', '--remove-orphans', '--volumes']);
      } finally {
        runtime.dispose();
      }
    }
  }
}

main().catch((error) => {
  process.stderr.write(`Falló la comprobación FLEET-05 T3: ${error.message}\n`);
  process.exitCode = 1;
});
