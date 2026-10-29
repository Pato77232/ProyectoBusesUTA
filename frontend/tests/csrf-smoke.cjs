// FRONT-01 T2.3. Tokens/cookies solo en memoria; sin usuarios o sesiones de acceso.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { createRuntime, docker } = require('../scripts/dev-runtime.cjs');
const { openBrowser, cookieMetadata } = require('./helpers/browser.cjs');

async function waitFor(operation, message) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if (await operation()) return;
    } catch {
      // DNS/servidor puede estar transicionando al recrear el backend QA.
    }
    await delay(300);
  }
  throw new Error(message);
}

async function issue(browser, headers = {}) {
  return browser.evaluate(`(async () => {
    const response = await fetch('/api/v1/auth/csrf', { cache: 'no-store', headers: ${JSON.stringify(headers)} });
    const body = await response.json();
    window.qaToken = body.csrfToken;
    return { status: response.status, cache: response.headers.get('cache-control'),
      tokenValid: /^[a-f0-9]{64}\\.\\d+\\.[a-f0-9]{64}$/.test(body.csrfToken) };
  })()`);
}

async function submit(browser, tokenExpression, credentials = 'same-origin') {
  return browser.evaluate(`(async () => {
    const headers = { 'Content-Type': 'application/json' };
    const token = ${tokenExpression};
    if (token !== undefined) headers['X-CSRF-Token'] = token;
    const response = await fetch('/api/v1/auth/register', {
      method: 'POST', headers, credentials: ${JSON.stringify(credentials)}, body: '{}'
    });
    const body = await response.json();
    return { status: response.status, code: body.error?.code, cache: response.headers.get('cache-control') };
  })()`);
}

function rejected(result, scenario) {
  assert.deepEqual(
    result,
    { status: 403, code: 'CSRF_TOKEN_INVALID', cache: 'no-store' },
    scenario,
  );
}

function validated(result) {
  assert.deepEqual(
    result,
    { status: 400, code: 'VALIDATION_ERROR', cache: 'no-store' },
    'CSRF válido debe llegar a validación de datos, sin registrar una cuenta',
  );
}

async function browserCases(origin) {
  const browser = await openBrowser(origin);
  let other;
  try {
    assert.deepEqual(await issue(browser), { status: 200, cache: 'no-store', tokenValid: true });
    const { cookies } = await browser.send('Network.getCookies', { urls: [origin] });
    const attributes = cookies
      .map(({ name, httpOnly, secure, sameSite, path: cookiePath, domain }) => ({
        name,
        httpOnly,
        secure,
        sameSite,
        path: cookiePath,
        domain,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    assert.deepEqual(attributes, [
      {
        name: 'csrf_browser',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
        path: '/',
        domain: '127.0.0.1',
      },
      {
        name: 'csrf_token',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
        path: '/',
        domain: '127.0.0.1',
      },
    ]);
    assert.equal(
      await browser.evaluate(`(() => {
      const names = document.cookie.split(';').map(part => part.trim().split('=')[0]);
      return names.includes('csrf_token') && !names.includes('csrf_browser');
    })()`),
      true,
      'JavaScript no puede leer la cookie HttpOnly',
    );
    await waitFor(
      () => browser.receipts.some((receipt) => receipt.length === 2),
      'Faltan dos Set-Cookie reales',
    );
    assert.deepEqual(browser.receipts[0].map((cookie) => cookie.name).sort(), [
      'csrf_browser',
      'csrf_token',
    ]);
    rejected(await submit(browser, 'undefined'), 'Sin cabecera CSRF');
    rejected(
      await submit(
        browser,
        `window.qaToken.slice(0, -1) + (window.qaToken.endsWith('a') ? 'b' : 'a')`,
      ),
      'Token alterado',
    );
    rejected(await submit(browser, 'window.qaToken', 'omit'), 'Sin cookies aunque se envíe token');
    validated(await submit(browser, 'window.qaToken'));
    process.stdout.write(
      'Aprobado: dos cookies, flags/HttpOnly, no-store y retransmisión real del navegador\n',
    );

    // Un segundo perfil conserva otro nonce: no puede reutilizar el token del primero.
    other = await openBrowser(origin);
    assert.equal((await issue(other)).status, 200);
    const token = await browser.evaluate('window.qaToken');
    rejected(await submit(other, JSON.stringify(token)), 'Token de otro perfil');
    // Incluso copiando el token legible, el nonce HttpOnly del otro perfil no firma ese token.
    const copied = await other.send('Network.setCookie', {
      name: 'csrf_token',
      value: token,
      url: origin,
      path: '/',
      sameSite: 'Lax',
      secure: false,
      httpOnly: false,
    });
    assert.equal(copied.success, true);
    rejected(
      await submit(other, JSON.stringify(token)),
      'Token y cookie legible copiados, nonce distinto',
    );
    assert.equal((await issue(other)).status, 200);
    validated(await submit(other, 'window.qaToken'));
    await browser.evaluate('window.qaPreviousToken = window.qaToken');
    assert.equal((await issue(browser)).status, 200);
    assert.equal(await browser.evaluate('window.qaToken !== window.qaPreviousToken'), true);
    rejected(await submit(browser, 'window.qaPreviousToken'), 'Token previo a rotación');
    validated(await submit(browser, 'window.qaToken'));
    const spoofed = await issue(browser, {
      'X-Forwarded-Proto': 'https',
      Forwarded: 'for=203.0.113.23;proto=https',
    });
    assert.equal(spoofed.status, 200);
    const afterSpoof = await browser.send('Network.getCookies', { urls: [origin] });
    assert.ok(
      afterSpoof.cookies.every((cookie) => cookie.secure === false),
      'No confiar en HTTPS indicado por cliente',
    );
    assert.ok(!afterSpoof.cookies.some((cookie) => cookie.name.startsWith('__Host-')));
    assert.deepEqual(browser.outside, []);
    assert.deepEqual(other.outside, []);
    process.stdout.write(
      'Aprobado: perfiles separados, token rotado y proto falsificado sobre backend real\n',
    );
  } finally {
    try {
      await other?.close();
    } finally {
      await browser.close();
    }
  }
}

// Receptor de transporte exclusivo de QA; no es el backend ni acredita autenticación.
const receiver = `const http = require('node:http');
http.createServer((req, res) => {
  let body = ''; req.on('data', part => { body += part; });
  req.on('end', () => {
    const names = ['host','forwarded','x-real-ip','x-forwarded-for','x-forwarded-proto','x-forwarded-host','x-forwarded-port'];
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({kind:'transport-probe', method:req.method, url:req.url, body,
      headers:Object.fromEntries(names.map(name=>[name, req.headers[name] || null]))}));
  });
}).listen(3000);`;

async function main() {
  const runtime = createRuntime({
    project: `transviaje-frontend-qa-csrf-${process.pid}`,
    port: '0',
  });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'transviaje-csrf-qa-'));
  let owned = false;
  let probe;
  try {
    assert.equal(runtime.exists(), false, 'Proyecto QA exclusivo');
    owned = true;
    runtime.compose(['config', '--quiet']);
    runtime.compose(['up', '-d', '--build', '--wait', '--wait-timeout', '120']);
    const origin = `http://${runtime.compose(['port', 'frontend', '8080']).trim()}`;
    const readCounts = () =>
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
          '-tAc',
          'SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM auth_sessions)',
        ])
        .trim();
    assert.equal(readCounts(), '0|0', 'Base nueva, sin identidades de acceso');
    await browserCases(origin);
    assert.equal(readCounts(), '0|0', 'Las pruebas CSRF no deben crear usuarios o sesiones');

    // Cambia únicamente NODE_ENV en un archivo QA sin secretos, no el Compose de producción.
    const production = path.join(directory, 'production-cookie-check.json');
    fs.writeFileSync(
      production,
      JSON.stringify({ services: { backend: { environment: { NODE_ENV: 'production' } } } }),
    );
    runtime.compose(['-f', production, 'up', '-d', '--no-deps', '--force-recreate', 'backend']);
    let productionCookies;
    await waitFor(async () => {
      const response = await fetch(origin + '/api/v1/auth/csrf', {
        signal: AbortSignal.timeout(15000),
      });
      if (response.status !== 200) return false;
      productionCookies = response.headers.getSetCookie().map(cookieMetadata);
      return productionCookies.some((cookie) => cookie.name === '__Host-csrf_browser');
    }, 'No se observaron cookies de producción desde backend real');
    assert.equal(productionCookies.length, 2);
    assert.ok(
      productionCookies.every(
        (cookie) =>
          cookie.secure &&
          cookie.path === 'path=/' &&
          cookie.sameSite === 'samesite=lax' &&
          !cookie.hasDomain,
      ),
    );
    assert.equal(
      productionCookies.find((cookie) => cookie.name === '__Host-csrf_browser').httpOnly,
      true,
    );
    assert.equal(productionCookies.find((cookie) => cookie.name === 'csrf_token').httpOnly, false);
    assert.equal(readCounts(), '0|0');
    process.stdout.write(
      'Aprobado: Secure/__Host del backend real en modo production, sin afirmar prueba TLS\n',
    );

    const backendId = runtime.compose(['ps', '-aq', 'backend']).trim();
    const image = docker(['inspect', '--format', '{{.Config.Image}}', backendId]).trim();
    const networks = JSON.parse(
      docker(['inspect', '--format', '{{json .NetworkSettings.Networks}}', backendId]),
    );
    const network = Object.keys(networks)[0];
    runtime.compose(['rm', '-s', '-f', 'backend']);
    probe = `${runtime.project}-headers`;
    docker([
      'run',
      '--rm',
      '-d',
      '--name',
      probe,
      '--network',
      network,
      '--network-alias',
      'backend',
      '--entrypoint',
      'node',
      image,
      '-e',
      receiver,
    ]);
    let observed;
    await waitFor(async () => {
      const response = await fetch(origin + '/api/v1/probe?trace=t23', {
        method: 'POST',
        body: '{"probe":"t23"}',
        signal: AbortSignal.timeout(15000),
        headers: {
          'Content-Type': 'application/json',
          Forwarded: 'for=203.0.113.23;proto=https',
          'X-Real-IP': '203.0.113.23',
          'X-Forwarded-For': '203.0.113.23, 198.51.100.8',
          'X-Forwarded-Proto': 'https',
          'X-Forwarded-Host': 'spoof.invalid',
          'X-Forwarded-Port': '443',
        },
      });
      if (response.status !== 200) return false;
      observed = await response.json();
      return observed.kind === 'transport-probe';
    }, 'El receptor de transporte QA no recibió la petición');
    assert.equal(observed.method, 'POST');
    assert.equal(observed.url, '/api/v1/probe?trace=t23');
    assert.equal(observed.body, '{"probe":"t23"}');
    assert.equal(observed.headers.forwarded, null);
    assert.equal(net.isIP(observed.headers['x-real-ip']), 4);
    assert.notEqual(observed.headers['x-real-ip'], '203.0.113.23');
    assert.equal(observed.headers['x-forwarded-for'], observed.headers['x-real-ip']);
    assert.equal(observed.headers['x-forwarded-proto'], 'http');
    assert.equal(observed.headers.host, new URL(origin).host);
    assert.equal(observed.headers['x-forwarded-host'], new URL(origin).host);
    assert.equal(observed.headers['x-forwarded-port'], '8080');
    process.stdout.write(
      'Aprobado: receptor QA observa método/URI/query/cuerpo y cabeceras saneadas\n',
    );
  } finally {
    try {
      if (probe) docker(['rm', '-f', probe]);
    } finally {
      try {
        if (owned) runtime.compose(['down', '--remove-orphans']);
      } finally {
        runtime.dispose();
        fs.rmSync(directory, { recursive: true, force: true });
      }
    }
  }
}

main().catch((error) => {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
});
