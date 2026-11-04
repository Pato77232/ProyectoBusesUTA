// Interfaz real con respuestas HTTP controladas de QA; la API PostgreSQL se verifica por separado.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const { setTimeout: delay } = require('node:timers/promises');
const { openBrowser } = require('./helpers/browser.cjs');
const root = path.resolve(__dirname, '..');
const output = process.env.QA_OUTPUT_DIR || path.join(os.tmpdir(), 'transviaje-search-qa');
const tripId = 'aaaaaaaa-0000-4000-8000-000000000001';
let fail = false;
const methods = [];
const mime = {
  '.js': 'application/javascript',
  '.html': 'text/html',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/v1/trips') {
    methods.push(req.method);
    res.writeHead(fail ? 503 : 200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify(
        fail
          ? { error: { code: 'SEARCH_UNAVAILABLE', message: 'QA' } }
          : {
              truncated: false,
              trips: [
                {
                  tripId,
                  cooperativeName: 'Cooperativa QA <script>',
                  origin: 'Salcedo',
                  destination: 'Latacunga',
                  fromPosition: 1,
                  toPosition: 2,
                  boardingAt: '2030-01-01T12:30:00Z',
                  arrivalAt: '2030-01-01T13:00:00Z',
                  currency: 'USD',
                  amountCents: 250,
                },
              ],
            },
      ),
    );
    return;
  }
  try {
    const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + path.sep)) throw new Error('Ruta inválida');
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
async function wait(browser, expression) {
  for (let n = 0; n < 100; n++) {
    if (await browser.evaluate(expression)) return;
    await delay(50);
  }
  throw new Error('La página no alcanzó el estado esperado');
}
async function main() {
  await fs.mkdir(output, { recursive: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await openBrowser(origin);
    for (const width of [1280, 360]) {
      await browser.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await browser.send('Page.navigate', { url: origin + '/pages/buscar-viajes.html' });
      await wait(
        browser,
        'document.querySelector("#search-form") && document.readyState === "complete"',
      );
      await browser.evaluate(
        `document.querySelector('#origin').value='Salcedo';document.querySelector('#destination').value='Latacunga';document.querySelector('#date').value='2030-01-01';document.querySelector('#search-form').requestSubmit()`,
      );
      await wait(browser, 'document.querySelector("#search-status").dataset.mode === "ready"');
      const result = await browser.evaluate(
        `({href:document.querySelector('#search-results a').href,text:document.querySelector('#search-results').textContent,scripts:document.querySelectorAll('#search-results script').length,width:document.documentElement.scrollWidth})`,
      );
      const url = new URL(result.href);
      assert.equal(url.searchParams.get('tripId'), tripId);
      assert.equal(url.searchParams.get('fromPosition'), '1');
      assert.equal(url.searchParams.get('toPosition'), '2');
      assert.match(result.text, /2,50|2.50/);
      assert.equal(result.scripts, 0);
      assert.ok(result.width <= width + 1);
      const screenshot = await browser.send('Page.captureScreenshot', {
        captureBeyondViewport: true,
      });
      await fs.writeFile(
        path.join(output, `busqueda-${width}.png`),
        Buffer.from(screenshot.data, 'base64'),
      );
    }
    fail = true;
    await browser.evaluate(`document.querySelector('#search-form').requestSubmit()`);
    await wait(browser, 'document.querySelector("#search-status").dataset.mode === "error"');
    assert.equal(
      await browser.evaluate('document.querySelectorAll("#search-results li").length'),
      0,
    );
    assert.ok(methods.every((method) => method === 'GET'));
    process.stdout.write(
      'Búsqueda: enlaces por tramo, DOM seguro, móvil y fallo sin resultados antiguos aprobados.\n',
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  process.stderr.write(error.stack + '\n');
  process.exitCode = 1;
});
