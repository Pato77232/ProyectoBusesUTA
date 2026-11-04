// FRONT-01 T3d: cliente real desde la imagen; datos y perfiles exclusivos de QA.
const assert = require('node:assert/strict');
const { createRuntime } = require('../scripts/dev-runtime.cjs');
const { openBrowser } = require('./helpers/browser.cjs');

async function cases(browser, origin) {
  for (const file of ['api-client', 'api-error', 'csrf-cache', 'json-transport']) {
    const response = await fetch(`${origin}/src/api/${file}.js`);
    assert.equal(response.status, 200, file);
    assert.match(response.headers.get('content-type'), /javascript/);
  }
  assert.equal((await fetch(origin + '/tests/api-client-smoke.cjs')).status, 404);
  await browser.evaluate(`(async () => {
    const { createApiClient } = await import('/src/api/api-client.js');
    window.qaCalls = [];
    window.qaClient = createApiClient({ fetchImpl: (url, options) => {
      qaCalls.push({ url, method: options.method, token: options.headers['X-CSRF-Token'] });
      return fetch(url, options);
    }});
    window.qaCredentials = { email: crypto.randomUUID() + '@qa.invalid',
      password: crypto.randomUUID() + '-solo-QA' };
    window.qaError = async (operation) => {
      try { await operation; return null; }
      catch (error) { return { code: error.code, status: error.status }; }
    };
  })()`);
  assert.deepEqual(await browser.evaluate(`qaError(qaClient.request('/api/v1/auth/me'))`), {
    code: 'UNAUTHENTICATED',
    status: 401,
  });
  assert.equal(
    await browser.evaluate(`qaClient.request('/api/v1/auth/register', {
    method: 'POST', data: qaCredentials })`),
    null,
  );
  assert.deepEqual(
    await browser.evaluate(`qaError(qaClient.request('/api/v1/auth/login', {
    method: 'POST', data: { ...qaCredentials, password: 'contraseña-errónea-solo-QA' } }))`),
    { code: 'INVALID_CREDENTIALS', status: 401 },
  );
  assert.equal(
    await browser.evaluate(`qaClient.request('/api/v1/auth/login', {
    method: 'POST', data: qaCredentials })`),
    null,
  );
  assert.equal(
    await browser.evaluate(`(async () => {
    const { user } = await qaClient.request('/api/v1/auth/me');
    return user.email === qaCredentials.email && user.role === 'CUSTOMER' &&
      user.cooperative_id === null;
  })()`),
    true,
  );
  const { cookies } = await browser.send('Network.getCookies', { urls: [origin] });
  const access = cookies.find((cookie) => cookie.name === 'access_token');
  assert.ok(access);
  assert.deepEqual(
    {
      httpOnly: access.httpOnly,
      secure: access.secure,
      sameSite: access.sameSite,
      path: access.path,
    },
    { httpOnly: true, secure: false, sameSite: 'Lax', path: '/' },
  );
  assert.equal(await browser.evaluate(`document.cookie.includes('access_token=')`), false);
  // Conflicto controlado: obtiene CSRF ligado a sesión sin crear otro usuario.
  assert.deepEqual(
    await browser.evaluate(`qaError(qaClient.request('/api/v1/auth/register', {
    method: 'POST', data: qaCredentials }))`),
    { code: 'REGISTRATION_CONFLICT', status: 409 },
  );
  assert.equal(
    await browser.evaluate(`(() => {
    const tokens = qaCalls.filter(call => call.method === 'POST').map(call => call.token);
    return tokens.at(-1) !== tokens.at(-2);
  })()`),
    true,
    'CSRF cambia después del login',
  );
  // Rota cookies fuera del cliente para provocar un rechazo CSRF real.
  await browser.evaluate(
    `fetch('/api/v1/auth/csrf', { cache: 'no-store' }).then(r => r.json()).then(() => null)`,
  );
  assert.deepEqual(
    await browser.evaluate(`qaError(qaClient.request('/api/v1/auth/logout', {
    method: 'POST' }))`),
    { code: 'CSRF_TOKEN_INVALID', status: 403 },
  );
  assert.equal(
    await browser.evaluate(`qaCalls.filter(call => call.url.endsWith('/logout')).length`),
    1,
  );
  assert.equal(
    await browser.evaluate(`qaClient.request('/api/v1/auth/me').then(r => r.user.role)`),
    'CUSTOMER',
  );
  assert.equal(
    await browser.evaluate(`qaClient.request('/api/v1/auth/logout', { method: 'POST' })`),
    null,
  );
  assert.equal(
    await browser.evaluate(`qaCalls.filter(call => call.url.endsWith('/logout')).length`),
    2,
  );
  assert.deepEqual(
    await browser.evaluate(`qaError(qaClient.request('/api/v1/auth/register', {
    method: 'POST', data: qaCredentials }))`),
    { code: 'REGISTRATION_CONFLICT', status: 409 },
  );
  assert.equal(
    await browser.evaluate(`(() => {
    const posts = qaCalls.filter(call => call.method === 'POST');
    return posts.at(-1).token !== posts.at(-2).token;
  })()`),
    true,
    'CSRF cambia después del logout',
  );
  assert.deepEqual(await browser.evaluate(`qaError(qaClient.request('/api/v1/auth/me'))`), {
    code: 'UNAUTHENTICATED',
    status: 401,
  });
  assert.deepEqual(
    await browser.evaluate(`(() => {
    const controller = new AbortController(); controller.abort();
    return qaError(qaClient.request('/api/v1/health', { signal: controller.signal }));
  })()`),
    { code: 'REQUEST_ABORTED', status: 0 },
  );
  await browser.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  try {
    assert.deepEqual(await browser.evaluate(`qaError(qaClient.request('/api/v1/health'))`), {
      code: 'NETWORK_ERROR',
      status: 0,
    });
  } finally {
    await browser.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
  }
  assert.deepEqual(
    browser.outside.filter((url) => url !== 'null'),
    [],
  );
}

async function main() {
  const runtime = createRuntime({
    project: `transviaje-frontend-qa-client-${process.pid}`,
    port: '0',
  });
  let browser;
  let owned = false;
  try {
    assert.equal(runtime.exists(), false, 'Proyecto QA exclusivo');
    owned = true;
    runtime.compose(['up', '-d', '--build', '--wait', '--wait-timeout', '120']);
    const origin = `http://${runtime.compose(['port', 'frontend', '8080']).trim()}`;
    browser = await openBrowser(origin);
    await cases(browser, origin);
    const counts = runtime
      .compose([
        'exec',
        '-T',
        'db',
        'psql',
        '-U',
        'frontend_dev',
        '-d',
        'transviaje_frontend_dev',
        '-Atc',
        'SELECT (SELECT count(*) FROM users), count(*), count(revoked_at) FROM auth_sessions;',
      ])
      .trim();
    assert.equal(counts, '1|1|1', 'Un usuario QA y una sesión revocada, sin reintentos de login');
    runtime.compose(['stop', 'backend']);
    const result = await browser.evaluate(`qaError(qaClient.request('/api/v1/health'))`);
    assert.equal(result.code, 'SERVER_ERROR');
    assert.ok([502, 503, 504].includes(result.status));
    assert.equal((await fetch(origin)).status, 200, 'Portada independiente del backend');
    process.stdout.write(
      'Aprobado: módulos/MIME, sesión real, CSRF, cookies, errores y caída del backend.\n',
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

main().catch(() => {
  process.stderr.write('Falló la comprobación T3d; detalles sensibles omitidos.\n');
  process.exitCode = 1;
});
