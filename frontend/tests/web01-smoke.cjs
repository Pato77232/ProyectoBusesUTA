const assert = require('node:assert/strict');

async function main() {
  const origin = process.env.FRONTEND_URL || 'http://127.0.0.1:8080';
  const get = (path) => fetch(new URL(path, origin), { signal: AbortSignal.timeout(15000) });
  const page = await get('/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  const html = await page.text();
  assert.match(html, /Bienvenido a transViaje/);
  assert.doesNotMatch(html, /<form\b|<script\b/i);
  for (const path of ['/missing.html', '/api/v10/health', '/tests/smoke.cjs']) {
    assert.equal((await get(path)).status, 404, path);
  }
  const health = await get('/api/v1/health');
  if (process.env.API_UNAVAILABLE === '1') {
    assert.ok([502, 503, 504].includes(health.status));
    assert.doesNotMatch(await health.text(), /Bienvenido a transViaje/);
  } else {
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    const missing = await get('/api/v1/missing');
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('content-type'), /application\/json/);
  }
  process.stdout.write('Portada, aislamiento de rutas y proxy comprobados.\n');
}
main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
