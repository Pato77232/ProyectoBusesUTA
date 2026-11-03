// FREQUENCIES-WEB-01 sección 1: navegador real, sin API ni sesión simuladas.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const { setTimeout: delay } = require('node:timers/promises');
const { openBrowser } = require('./helpers/browser.cjs');
const root = path.resolve(__dirname, '..');
const output =
  process.env.QA_OUTPUT_DIR || path.join(os.tmpdir(), 'frequencies-web-01-qa');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
};
let apiCalls = 0;
async function serve(request, response) {
  try {
    const { pathname } = new URL(request.url, 'http://localhost');
    if (pathname.startsWith('/api/')) apiCalls += 1;
    const filename = path.resolve(
      root,
      `.${pathname === '/' ? '/index.html' : pathname}`,
    );
    if (!filename.startsWith(root + path.sep)) throw new Error('Ruta inválida');
    const bytes = await fs.readFile(filename);
    response.writeHead(200, {
      'Content-Type': mime[path.extname(filename)] || 'text/plain',
    });
    response.end(bytes);
  } catch {
    response.writeHead(404);
    response.end();
  }
}
async function load(browser, origin, width = 1280) {
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.navigate', {
    url: origin + '/pages/crear-frecuencia.html',
  });
  for (let i = 0; i < 100; i += 1) {
    if (
      await browser.evaluate(
        `location.pathname === '/pages/crear-frecuencia.html' && document.readyState === 'complete' && document.querySelector('#frequency-fields')?.disabled === false`,
      )
    )
      return;
    await delay(50);
  }
  throw new Error('Formulario no inicializado');
}
async function set(browser, id, value) {
  await browser.evaluate(
    `(() => {const node=document.getElementById(${JSON.stringify(id)});node.value=${JSON.stringify(value)};node.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
}
const click = (browser, selector) =>
  browser.evaluate(
    `document.querySelector(${JSON.stringify(selector)}).click()`,
  );
async function key(browser, name, code = name) {
  await browser.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: name,
    code,
    windowsVirtualKeyCode: name === 'Enter' ? 13 : 9,
    ...(name === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}),
  });
  await browser.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: name,
    code,
    windowsVirtualKeyCode: name === 'Enter' ? 13 : 9,
  });
}
async function capture(browser, name) {
  const { data } = await browser.send('Page.captureScreenshot', {
    captureBeyondViewport: true,
  });
  await fs.writeFile(path.join(output, name), Buffer.from(data, 'base64'));
}
async function initial(browser, origin) {
  await load(browser, origin);
  assert.equal(
    await browser.evaluate(`document.querySelector('h1').textContent`),
    'Crear frecuencia',
  );
  assert.equal(
    await browser.evaluate(`document.querySelector('#status').value`),
    'ACTIVE',
  );
  assert.equal(
    await browser.evaluate(
      `document.querySelectorAll('input:not([type=hidden]),select').length`,
    ),
    6,
  );
  assert.equal(
    await browser.evaluate(
      `Array.from(document.querySelectorAll('input,select')).every(node=>document.querySelector('label[for="'+node.id+'"]'))`,
    ),
    true,
  );
  assert.equal(
    await browser.evaluate(
      `document.querySelector('#prices-hint').textContent.includes('No fijan el precio de venta')`,
    ),
    true,
  );
  assert.equal(
    await browser.evaluate(`document.querySelector('[name=cooperative_id]')`),
    null,
  );
}
async function errors(browser, origin) {
  await load(browser, origin);
  await click(browser, 'button[type=submit]');
  assert.equal(await browser.evaluate('document.activeElement.id'), 'origin');
  assert.equal(
    await browser.evaluate(
      `document.querySelectorAll('[aria-invalid=true]').length`,
    ),
    5,
  );
  assert.equal(
    await browser.evaluate(
      `document.querySelector('#ant_resolution_number-error').hidden`,
    ),
    false,
  );
  await capture(browser, 'errores-escritorio.png');
}
async function direct(browser, origin) {
  await load(browser, origin);
  for (const [id, value] of Object.entries({
    origin: 'Ambato',
    destination: 'Quito',
    departure_time: '00:00',
    ant_resolution_number: 'ANT-PRUEBA',
    'price-0': '4,50',
  }))
    await set(browser, id, value);
  await click(browser, 'button[type=submit]');
  assert.equal(
    await browser.evaluate(
      `document.querySelectorAll('[aria-invalid=true]').length`,
    ),
    0,
  );
  assert.equal(
    await browser.evaluate('document.activeElement.id'),
    'review-status',
  );
  assert.match(
    await browser.evaluate(
      `document.querySelector('#review-status').textContent`,
    ),
    /todavía no guarda/,
  );
  await capture(browser, 'directa-escritorio.png');
}
async function stops(browser, origin) {
  await load(browser, origin);
  await set(browser, 'origin', 'Ambato');
  await set(browser, 'destination', 'Quito');
  await browser.evaluate(`document.querySelector('#add-stop').focus()`);
  await key(browser, 'Enter');
  assert.equal(await browser.evaluate('document.activeElement.id'), 'stop-1');
  await set(browser, 'stop-1', 'Latacunga');
  await click(browser, '#add-stop');
  await set(browser, 'stop-2', 'Machachi');
  for (let i = 0; i < 3; i += 1)
    await set(browser, `price-${i}`, String(i + 1));
  await browser.evaluate(
    `document.querySelector('[aria-label="Subir parada 2"]').focus()`,
  );
  await key(browser, 'Enter');
  assert.equal(await browser.evaluate('document.activeElement.id'), 'stop-2');
  assert.deepEqual(
    await browser.evaluate(
      `Array.from(document.querySelectorAll('#stop-list input')).map(node=>node.value)`,
    ),
    ['Machachi', 'Latacunga'],
  );
  assert.deepEqual(
    await browser.evaluate(
      `Array.from(document.querySelectorAll('#price-list input')).map(node=>node.value)`,
    ),
    ['', '', ''],
  );
  await browser.evaluate(
    `document.querySelector('[aria-label="Quitar parada 1"]').focus()`,
  );
  await key(browser, 'Enter');
  assert.equal(await browser.evaluate('document.activeElement.id'), 'stop-1');
  await click(browser, '[aria-label="Quitar parada 1"]');
  assert.equal(await browser.evaluate('document.activeElement.id'), 'add-stop');
}
async function duplicateAndText(browser, origin) {
  await load(browser, origin);
  await set(browser, 'origin', 'Ambato');
  await set(browser, 'destination', 'Quito');
  await click(browser, '#add-stop');
  await set(browser, 'stop-1', ' AMBATO ');
  await click(browser, 'button[type=submit]');
  assert.equal(
    await browser.evaluate(
      `document.querySelector('#stop-1').getAttribute('aria-invalid')`,
    ),
    'true',
  );
  await set(browser, 'stop-1', '<img src=x onerror=alert(1)>');
  assert.equal(
    await browser.evaluate(
      `document.querySelectorAll('#price-list img').length`,
    ),
    0,
  );
  assert.equal(
    await browser.evaluate(
      `document.querySelector('#price-list label').textContent.includes('<img')`,
    ),
    true,
  );
}
async function keyboardAndMobile(browser, origin) {
  await load(browser, origin, 360);
  await browser.evaluate(`document.querySelector('#origin').focus()`);
  await key(browser, 'Tab');
  assert.equal(
    await browser.evaluate('document.activeElement.id'),
    'destination',
  );
  assert.equal(
    await browser.evaluate(
      'getComputedStyle(document.activeElement).outlineWidth',
    ),
    '3px',
  );
  assert.equal(
    await browser.evaluate(`document.documentElement.scrollWidth<=innerWidth`),
    true,
  );
  await capture(browser, 'movil-360.png');
  // Reflujo equivalente a escritorio de 1280 px con ampliación del 200 %.
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 640,
    height: 450,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await browser.evaluate(`document.body.style.fontSize='200%'`);
  assert.equal(
    await browser.evaluate(`document.documentElement.scrollWidth<=innerWidth`),
    true,
  );
  await capture(browser, 'texto-200.png');
}
async function contrast(browser, origin) {
  await load(browser, origin);
  const colors =
    await browser.evaluate(`['label','.field-hint','.field-error','.btn-dark','a[href="/pages/login.html"]'].map(selector => {
    const node = document.querySelector(selector), style = getComputedStyle(node);
    return {color:style.color,background:selector==='.btn-dark'?style.backgroundColor:getComputedStyle(document.body).backgroundColor};
  })`);
  const luminance = (color) => {
    const rgb = color
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((value) => {
        const channel = value / 255;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  for (const { color, background } of colors) {
    const a = luminance(color),
      b = luminance(background);
    assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5);
  }
}
async function main() {
  await fs.mkdir(output, { recursive: true });
  const server = http.createServer(serve);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await openBrowser(origin);
    const checks = [
      initial,
      errors,
      direct,
      stops,
      duplicateAndText,
      keyboardAndMobile,
      contrast,
    ];
    for (const check of checks) {
      await check(browser, origin);
      console.log(`ok ${check.name}`);
    }
    assert.equal(apiCalls, 0);
    assert.deepEqual(
      browser.outside.filter((origin) => origin !== 'null'),
      [],
    );
    console.log(
      '7 comprobaciones aprobadas; sin solicitudes API. Capturas: ' + output,
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
