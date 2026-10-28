// Pruebas de navegador de T1 con Node 24 y Chrome; sin paquetes adicionales.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const root = path.resolve(__dirname, '..');
const output = process.env.QA_OUTPUT_DIR || path.join(os.tmpdir(), 'busesuta-front01-qa');
const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
};

async function serve(request, response) {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!filename.startsWith(root + path.sep)) throw new Error('Ruta inválida');
    const data = await fs.readFile(filename);
    response.writeHead(200, {
      'Content-Type': mime[path.extname(filename)] || 'text/plain',
    });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end();
  }
}

async function debuggingPort(profile, browser) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (browser.exitCode !== null) throw new Error('Chrome terminó antes de iniciar las pruebas');
    try {
      return (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
    } catch {
      await delay(100);
    }
  }
  throw new Error('Chrome no habilitó el puerto de pruebas');
}

function connect(socket) {
  let id = 0;
  const pending = new Map();
  const failures = [];
  const requests = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const operation = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) operation.reject(new Error(JSON.stringify(message.error)));
      else operation.resolve(message.result);
    }
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) {
      failures.push(message.params.response.url);
    }
    if (message.method === 'Runtime.exceptionThrown') failures.push('Excepción de navegador');
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      id += 1;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    assert.equal(result.exceptionDetails, undefined, 'La evaluación del navegador falló');
    return result.result.value;
  };
  return { send, evaluate, failures, requests };
}

async function press(client, key) {
  const keyCode = { Tab: 9, Enter: 13 }[key];
  for (const type of ['keyDown', 'keyUp']) {
    await client.send('Input.dispatchKeyEvent', {
      type,
      key,
      code: key,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
      ...(type === 'keyDown' && key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}),
    });
  }
}

async function verifyPage(client, url, width, name, zoom = 1) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await client.send('Page.navigate', { url });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    ready = await client.evaluate(
      `document.readyState === 'complete' && !!document.querySelector('h1')`,
    );
    if (ready) break;
    await delay(50);
  }
  assert.ok(ready, 'La página no terminó de cargar');
  const fontLoaded = await client.evaluate(
    `document.fonts.ready.then(() => document.fonts.check('800 32px "Plus Jakarta Sans"'))`,
  );
  assert.equal(fontLoaded, true, 'La tipografía local debe cargar');
  await client.evaluate(`document.documentElement.style.zoom = '${zoom}'`);
  const logoLoaded = await client.evaluate(`(() => {
    const logo = document.querySelector('.brand-logo');
    return logo.complete && logo.naturalWidth > 0;
  })()`);
  assert.equal(logoLoaded, true, 'El logo local debe cargar');
  const state = await client.evaluate(`(() => ({
    language: document.documentElement.lang,
    headings: document.querySelectorAll('h1').length,
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    overflow: [...document.querySelectorAll('body *')].filter(element =>
      element.getBoundingClientRect().right > innerWidth + 1
    ).slice(0, 8).map(element => element.tagName + '.' + element.className),
    bootstrapLoaded: getComputedStyle(document.querySelector('.row')).display === 'flex',
    linksValid: [...document.querySelectorAll('a')].every(a =>
      a.hash.length > 1 && !!document.getElementById(a.hash.slice(1)))
  }))()`);
  assert.equal(state.language, 'es');
  assert.equal(state.headings, 1);
  assert.equal(state.bootstrapLoaded, true, 'Bootstrap local debe aplicar su rejilla');
  assert.equal(state.linksValid, true, 'Todos los enlaces deben tener un destino real');
  assert.ok(
    state.width <= state.viewport + 1,
    `${name}: desbordamiento horizontal: ${JSON.stringify(state)}`,
  );

  await press(client, 'Tab');
  assert.equal(
    await client.evaluate(`document.activeElement.classList.contains('skip-link')`),
    true,
  );
  const focus = await client.evaluate(`getComputedStyle(document.activeElement).outlineStyle`);
  assert.notEqual(focus, 'none', 'El foco de teclado debe ser visible');
  await press(client, 'Enter');
  assert.equal(await client.evaluate(`document.activeElement.id`), 'contenido');

  let summaryFocused = false;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await press(client, 'Tab');
    summaryFocused = await client.evaluate(
      `document.activeElement === document.querySelectorAll('summary')[1]`,
    );
    if (summaryFocused) break;
  }
  assert.equal(summaryFocused, true, 'Las preguntas deben ser accesibles usando Tab');
  await press(client, 'Enter');
  assert.equal(await client.evaluate(`document.querySelectorAll('details')[1].open`), true);
  await client.evaluate(`document.activeElement.blur(); window.scrollTo(0, 0)`);
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
  });
  await fs.writeFile(path.join(output, name + '.png'), Buffer.from(screenshot.data, 'base64'));
  process.stdout.write(`Aprobado: ${name}, teclado, destinos y rejilla local\n`);
}

async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'busesuta-chrome-'));
  const server = http.createServer(serve);
  let browser;
  let socket;
  try {
    await fs.mkdir(output, { recursive: true });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const origin = process.env.QA_BASE_URL || `http://127.0.0.1:${server.address().port}`;
    const target = new URL(origin);
    assert.equal(target.protocol, 'http:', 'La prueba solo admite HTTP local');
    assert.equal(target.hostname, '127.0.0.1', 'La prueba solo admite loopback');
    assert.equal(target.pathname, '/', 'La URL de prueba debe apuntar a la raíz');
    browser = spawn(
      process.env.BROWSER_BIN || 'google-chrome',
      [
        '--headless=new',
        '--no-first-run',
        '--disable-background-networking',
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
        'about:blank',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let browserErrors = '';
    browser.stderr.on('data', (chunk) => {
      browserErrors += chunk.toString();
    });
    browser.on('error', (error) => {
      browserErrors += error.message;
    });
    const port = await debuggingPort(profile, browser).catch((error) => {
      throw new Error(error.message + '\n' + browserErrors);
    });
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(pages.find((page) => page.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    const client = connect(socket);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');
    for (const [width, name, zoom] of [
      [1280, 'desktop', 1],
      [360, 'mobile', 1],
      [1280, 'zoom-200', 2],
    ]) {
      await verifyPage(client, origin, width, name, zoom);
    }
    assert.deepEqual(client.failures, [], 'No deben fallar recursos ni JavaScript');
    assert.ok(
      client.requests.every((url) => new URL(url).origin === origin),
      'Sin recursos remotos',
    );
    process.stdout.write(
      `Capturas: ${output}\nZoom 200 % emulado con CSS; no certifica zoom nativo.\n`,
    );
  } finally {
    if (socket) socket.close();
    if (browser?.pid && browser.exitCode === null) {
      const closed = once(browser, 'exit');
      browser.kill();
      await closed;
    }
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

main().catch((error) => {
  process.stderr.write(error.stack + '\n');
  process.exitCode = 1;
});
