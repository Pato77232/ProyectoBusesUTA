// FLEET-05 T1: formulario en Chrome real con datos controlados; sin backend ni paquetes nuevos.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { openBrowser } = require('./helpers/browser.cjs');

const root = path.resolve(__dirname, '..');
const output = process.env.QA_OUTPUT_DIR || path.join(os.tmpdir(), 'busesuta-fleet05-qa');
const PAGE = '/pages/registrar-bus.html';
const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
};
const SETUP = {
  busGroups: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Grupo Ejecutivo' }],
  seatLayouts: [
    {
      id: 'DOS',
      name: 'Dos pisos de prueba',
      version: 2,
      capacity: 3,
      decks: [
        {
          number: 2,
          elements: [
            { kind: 'SEAT', key: 's1', label: 1 },
            { kind: 'SEAT', key: 's2', label: 2 },
          ],
        },
        { number: 1, elements: [{ kind: 'SEAT', key: 's3', label: 3 }] },
      ],
    },
    {
      id: 'UNO',
      name: 'Un piso de prueba',
      version: 1,
      capacity: 1,
      decks: [{ number: 1, elements: [{ kind: 'SEAT', key: 'u1', label: 1 }] }],
    },
  ],
};

async function serve(request, response) {
  try {
    const { pathname } = new URL(request.url, 'http://localhost');
    const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(root + path.sep)) throw new Error('Ruta inválida');
    let data = await fs.readFile(filename);
    // Preparación autorizada por Edwin (FLEET-05 T3): revisar el formulario sin conectarlo a la API.
    if (pathname === PAGE)
      data = Buffer.from(
        data.toString().replace('<script type="module" src="/src/fleet/bus-page.js"></script>', ''),
      );
    response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'text/plain' });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end();
  }
}

async function loadPage(browser, origin, width) {
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.navigate', { url: origin + PAGE });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = await browser.evaluate(
      `document.readyState === 'complete' && location.pathname === '${PAGE}'`,
    );
    if (ready) return;
    await delay(50);
  }
  throw new Error('La pantalla no cargó');
}

const mount = (browser, setup) =>
  browser.evaluate(`(async () => {
    const { mountBusForm } = await import('/src/fleet/bus-form-view.js');
    window.sent = [];
    mountBusForm(document.querySelector('#bus-form'), {
      ...${JSON.stringify(setup)},
      onValid: (data, files) => window.sent.push({ data, photos: files.length }),
    });
  })()`);

const setValue = (browser, name, value) =>
  browser.evaluate(`(() => {
    const control = document.querySelector('[name="${name}"]');
    control.value = ${JSON.stringify(value)};
    control.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);

const attachPhoto = (browser, name, type, size) =>
  browser.evaluate(`(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(${size})], ${JSON.stringify(name)}, { type: '${type}' }));
    const input = document.querySelector('#photos');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);

const submit = (browser) => browser.evaluate(`document.querySelector('#bus-form').requestSubmit()`);

async function screenshot(browser, name) {
  const { data } = await browser.send('Page.captureScreenshot', { captureBeyondViewport: true });
  await fs.writeFile(path.join(output, name), Buffer.from(data, 'base64'));
}

async function checkInitialState(browser, origin) {
  await loadPage(browser, origin, 1280);
  const initial = await browser.evaluate(`({
    h1: document.querySelectorAll('h1').length,
    disabled: document.querySelector('#bus-fields').disabled,
    status: document.querySelector('#bus-form-status').textContent,
    unlabeled: [...document.querySelectorAll('input, select')].filter((c) => !c.labels.length).length,
    button: getComputedStyle(document.querySelector('button')).backgroundColor,
  })`);
  assert.equal(initial.h1, 1);
  assert.equal(initial.button, 'rgb(32, 32, 32)');
  assert.equal(initial.disabled, true);
  assert.match(initial.status, /Comprobando tu sesión/);
  assert.equal(initial.unlabeled, 0);
}

async function checkNoGroups(browser, origin) {
  await loadPage(browser, origin, 1280);
  await mount(browser, { busGroups: [], seatLayouts: SETUP.seatLayouts });
  const state = await browser.evaluate(`({
    disabled: document.querySelector('#bus-fields').disabled,
    status: document.querySelector('#bus-form-status').textContent,
  })`);
  assert.equal(state.disabled, true);
  assert.match(state.status, /no tiene grupos/);
}

async function checkErrors(browser, origin) {
  await loadPage(browser, origin, 1280);
  await mount(browser, SETUP);
  await submit(browser);
  const state = await browser.evaluate(`({
    focused: document.activeElement.id,
    invalid: document.querySelectorAll('[aria-invalid="true"]').length,
    errors: [...document.querySelectorAll('.field-error')].filter((e) => !e.hidden).length,
    sent: window.sent.length,
  })`);
  assert.deepEqual(state, { focused: 'bus-form-status', invalid: 8, errors: 8, sent: 0 });
  await screenshot(browser, 'errores-1280.png');
}

async function checkLayoutChange(browser, origin) {
  await loadPage(browser, origin, 1280);
  await mount(browser, SETUP);
  await setValue(browser, 'seatLayoutId', 'DOS');
  const decks = await browser.evaluate(
    `[...document.querySelectorAll('.seat-deck legend')].map((e) => e.textContent)`,
  );
  assert.deepEqual(decks, ['Piso 2', 'Piso 1']);
  await browser.evaluate(`document.querySelector('[value="s2"]').click()`);
  await setValue(browser, 'seatLayoutId', 'UNO');
  const state = await browser.evaluate(`({
    notice: !document.querySelector('#seat-notice').hidden,
    checked: document.querySelectorAll('[name="disabledSeatKeys"]:checked').length,
    seats: document.querySelectorAll('[name="disabledSeatKeys"]').length,
  })`);
  assert.deepEqual(state, { notice: true, checked: 0, seats: 1 });
}

async function checkVipSelection(browser, origin) {
  await loadPage(browser, origin, 1280);
  await mount(browser, SETUP);
  await fillValidForm(browser);
  await browser.evaluate(`document.querySelector('[name="vipSeatKeys"][value="s1"]').click()`);
  const labels = await browser.evaluate(
    `[...document.querySelectorAll('#seat-section h3')].map((e) => e.textContent)`,
  );
  assert.deepEqual(labels, ['Asientos no ofrecidos', 'Asientos VIP']);
  await submit(browser);
  const [{ data }] = await browser.evaluate('window.sent');
  assert.deepEqual(data.vipSeatKeys, ['s1']);
  assert.deepEqual(data.disabledSeatKeys, ['s2']);
  await setValue(browser, 'seatLayoutId', 'UNO');
  const cleared = await browser.evaluate(
    `document.querySelectorAll('[name="vipSeatKeys"]:checked').length`,
  );
  assert.equal(cleared, 0);
  await screenshot(browser, 'vip-1280.png');
}

async function fillValidForm(browser) {
  for (const [name, value] of Object.entries({
    plate: 'TBM-2213',
    unitNumber: '7',
    vin: 'CHASIS-FICTICIO',
    bodyworkBrand: 'Marca ficticia',
    color: 'Blanco',
    busGroupId: SETUP.busGroups[0].id,
    seatLayoutId: 'DOS',
  })) {
    await setValue(browser, name, value);
  }
  await browser.evaluate(`document.querySelector('[value="s2"]').click()`);
  await attachPhoto(browser, 'bus-ficticio.png', 'image/png', 2048);
}

async function checkValidSubmission(browser, origin) {
  await loadPage(browser, origin, 1280);
  await mount(browser, SETUP);
  await fillValidForm(browser);
  await screenshot(browser, 'formulario-1280.png');
  await submit(browser);
  const sent = await browser.evaluate('window.sent');
  assert.deepEqual(sent, [
    {
      data: {
        plate: 'TBM-2213',
        vin: 'CHASIS-FICTICIO',
        unitNumber: 7,
        bodyworkBrand: 'Marca ficticia',
        color: 'Blanco',
        busGroupId: SETUP.busGroups[0].id,
        seatLayoutId: 'DOS',
        seatLayoutVersion: 2,
        disabledSeatKeys: ['s2'],
      },
      photos: 1,
    },
  ]);
}

async function checkPhotoLimit(browser, origin) {
  await loadPage(browser, origin, 1280);
  await mount(browser, SETUP);
  await attachPhoto(browser, 'grande.png', 'image/png', 5_000_001);
  const error = await browser.evaluate(`document.querySelector('#photos-error').textContent`);
  assert.match(error, /5 MB/);
}

async function checkMobileReflow(browser, origin) {
  await loadPage(browser, origin, 360);
  await mount(browser, SETUP);
  await fillValidForm(browser);
  const width = await browser.evaluate('document.documentElement.scrollWidth');
  assert.ok(width <= 360, `Desbordamiento horizontal: ${width}`);
  await screenshot(browser, 'formulario-360.png');
}

async function checkKeyboardOrder(browser, origin) {
  await loadPage(browser, origin, 1280);
  await mount(browser, SETUP);
  await browser.evaluate(`document.querySelector('#plate').focus()`);
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' });
  assert.equal(await browser.evaluate('document.activeElement.id'), 'unitNumber');
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const server = http.createServer(serve);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await openBrowser(origin);
  const checks = [
    checkInitialState,
    checkNoGroups,
    checkErrors,
    checkLayoutChange,
    checkValidSubmission,
    checkVipSelection,
    checkPhotoLimit,
    checkMobileReflow,
    checkKeyboardOrder,
  ];
  try {
    for (const check of checks) {
      await check(browser, origin);
      console.log(`ok ${check.name}`);
    }
    // Origen «null»: íconos data: de Bootstrap; no hay petición de red.
    assert.deepEqual(
      browser.outside.filter((source) => source !== 'null'),
      [],
    );
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`${checks.length} comprobaciones aprobadas; capturas en ${output}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
