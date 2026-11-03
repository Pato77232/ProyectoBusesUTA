// AUTH-WEB-01: pantalla e imagen reales con usuario y PostgreSQL exclusivos de QA.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { setTimeout: delay } = require('node:timers/promises');
const { createRuntime } = require('../scripts/dev-runtime.cjs');
const { openBrowser } = require('./helpers/browser.cjs');

async function wait(browser, expression) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await browser.evaluate(expression)) return;
    await delay(50);
  }
  throw new Error('No se alcanzó el estado esperado en la pantalla QA');
}

async function submit(browser, wrong = false, keyboard = false) {
  await browser.evaluate(`(() => {
    document.querySelector('#login-email').value = qaCredentials.email;
    document.querySelector('#login-password').value = ${wrong ? "'contraseña-errónea-QA'" : 'qaCredentials.password'};
  })()`);
  if (keyboard) {
    await browser.evaluate(`document.querySelector('#login-password').focus()`);
    for (const type of ['keyDown', 'keyUp']) {
      await browser.send('Input.dispatchKeyEvent', {
        type,
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
        ...(type === 'keyDown' ? { text: '\r' } : {}),
      });
    }
  } else {
    await browser.evaluate(
      `document.querySelector('form').requestSubmit(); document.querySelector('form').requestSubmit()`,
    );
  }
}

async function main() {
  const runtime = createRuntime({
    project: `transviaje-frontend-qa-login-${process.pid}`,
    port: '0',
  });
  const output = process.env.QA_OUTPUT_DIR || path.join(os.tmpdir(), 'transviaje-login-api');
  let browser;
  let owned = false;
  try {
    assert.equal(runtime.exists(), false);
    owned = true;
    runtime.compose(['up', '-d', '--build', '--wait', '--wait-timeout', '120']);
    const origin = 'http://' + runtime.compose(['port', 'frontend', '8080']).trim();
    browser = await openBrowser(origin);
    await browser.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
      window.qaCredentials = { email: crypto.randomUUID() + '@qa.invalid', password: crypto.randomUUID() + '-QA' };
      window.qaCalls = [];
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (url, options = {}) => {
        qaCalls.push({ url, method: options.method || 'GET' });
        const response = await originalFetch(url, options);
        if (window.qaLoseResponse && String(url).endsWith('/auth/login')) {
          window.qaLoseResponse = false;
          throw new TypeError('Fallo de recepción inducido solo en QA');
        }
        return response;
      };
    `,
    });
    await browser.send('Page.navigate', { url: origin + '/pages/login.html' });
    await wait(
      browser,
      `!!document.querySelector('fieldset') && !document.querySelector('fieldset').disabled`,
    );
    await browser.evaluate(`(async () => {
      const { createApiClient } = await import('/src/api/api-client.js');
      window.qaClient = createApiClient();
      await qaClient.request('/api/v1/auth/register', { method: 'POST', data: qaCredentials });
    })()`);
    await submit(browser, true);
    await wait(
      browser,
      `document.querySelector('#login-status').textContent.includes('no son correctos')`,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#login-password').value === '' && document.querySelector('#login-email').value === qaCredentials.email`,
      ),
      true,
    );
    // El 401 anterior invalida la caché. Un 400 de validación conserva el token;
    // permite comprobar después el rechazo CSRF real sin tocar la política común.
    await browser.evaluate(
      `window.qaOriginalEmail = qaCredentials.email; qaCredentials.email = 'a..b@qa.invalid'`,
    );
    await submit(browser);
    await wait(
      browser,
      `document.querySelector('#login-status').textContent.includes('Revisa el correo')`,
    );
    await browser.evaluate(`qaCredentials.email = qaOriginalEmail`);
    // Rota la cookie después del 400 y conserva el token anterior en la caché.

    await browser.evaluate(`fetch('/api/v1/auth/csrf', { cache: 'no-store' }).then(() => null)`);
    await submit(browser);
    await wait(
      browser,
      `document.querySelector('#login-status').textContent.includes('solicitud venció')`,
    );
    assert.equal(
      await browser.evaluate(`qaCalls.filter(call => call.url.endsWith('/login')).length`),
      3,
    );
    // Tab y Shift+Tab alcanzan envío y contraseña con foco visible.
    for (const shift of [false, true]) {
      for (const type of ['keyDown', 'keyUp']) {
        await browser.send('Input.dispatchKeyEvent', {
          type,
          key: 'Tab',
          code: 'Tab',
          windowsVirtualKeyCode: 9,
          modifiers: shift ? 8 : 0,
        });
      }
      assert.equal(
        await browser.evaluate(
          shift
            ? `document.activeElement.id === 'login-password'`
            : `document.activeElement === document.querySelector('button[type="submit"]')`,
        ),
        true,
      );
      assert.equal(
        await browser.evaluate(`getComputedStyle(document.activeElement).outlineStyle`),
        'solid',
      );
    }
    await fs.mkdir(output, { recursive: true });
    for (const [width, scale, name] of [
      [1280, 1, 'desktop'],
      [360, 1, 'mobile'],
      [1280, 2, 'zoom-200'],
    ]) {
      await browser.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await browser.evaluate(
        `document.documentElement.style.zoom = '${scale}'; document.activeElement.blur(); window.scrollTo(0,0)`,
      );
      assert.equal(
        await browser.evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`),
        true,
      );
      assert.equal(
        await browser.evaluate(
          `[...document.querySelectorAll('input')].every(input => input.labels.length === 1)`,
        ),
        true,
      );
      const shot = await browser.send('Page.captureScreenshot', { format: 'png' });
      await fs.writeFile(path.join(output, name + '.png'), Buffer.from(shot.data, 'base64'));
    }
    await browser.evaluate(`document.documentElement.style.zoom = '1'`);
    await submit(browser, false, true);
    await wait(
      browser,
      `document.querySelector('#login-status').textContent === 'Sesión iniciada.'`,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#session-email').textContent === qaCredentials.email && document.querySelector('form').hidden && document.querySelector('#login-password').value === ''`,
      ),
      true,
    );
    assert.equal(
      await browser.evaluate(`qaCalls.filter(call => call.url.endsWith('/login')).length`),
      4,
    );
    assert.equal(await browser.evaluate(`document.cookie.includes('access_token=')`), false);
    await browser.send('Page.reload');
    await wait(
      browser,
      `document.querySelector('#login-status')?.textContent === 'Sesión iniciada.'`,
    );
    assert.equal(
      await browser.evaluate(`qaCalls.filter(call => call.url.endsWith('/login')).length`),
      0,
    );
    // Revoca la sesión QA y recarga; la página volverá a consultar me.
    await browser.evaluate(`(async () => {
      const { createApiClient } = await import('/src/api/api-client.js');
      await createApiClient().request('/api/v1/auth/logout', { method: 'POST' });
    })()`);
    await browser.send('Page.reload');
    await wait(
      browser,
      `!!document.querySelector('fieldset') && !document.querySelector('fieldset').disabled`,
    );
    await browser.evaluate(`(async () => {
      const { createApiClient } = await import('/src/api/api-client.js');
      await createApiClient().request('/api/v1/auth/register', { method: 'POST', data: qaCredentials });
      window.qaLoseResponse = true;
    })()`);
    await submit(browser);
    await wait(browser, `!document.querySelector('#check-session').hidden`);
    assert.equal(
      await browser.evaluate(`qaCalls.filter(call => call.url.endsWith('/login')).length`),
      1,
    );
    await browser.evaluate(`document.querySelector('#check-session').click()`);
    await wait(
      browser,
      `document.querySelector('#login-status').textContent === 'Sesión iniciada.'`,
    );
    assert.equal(
      await browser.evaluate(`qaCalls.filter(call => call.url.endsWith('/login')).length`),
      1,
    );
    for (const file of ['login-controller', 'login-view', 'login-page']) {
      const response = await fetch(origin + '/src/auth/' + file + '.js');
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /javascript/);
    }
    const home = await fetch(origin).then((response) => response.text());
    assert.match(home, /href="\.\/pages\/login\.html"/);
    for (const file of [
      '/src/styles/login.css',
      '/pages/registrar-bus.html',
      '/src/fleet/bus-form-view.js',
    ]) {
      assert.equal((await fetch(origin + file)).status, 200);
    }
    assert.equal((await fetch(origin + '/tests/login-smoke.cjs')).status, 404);
    runtime.compose(['stop', 'backend']);
    await browser.send('Page.reload');
    await wait(
      browser,
      `!!document.querySelector('#check-session') && !document.querySelector('#check-session').hidden`,
    );
    assert.equal(await browser.evaluate(`document.querySelector('form').hidden`), true);
    assert.equal((await fetch(origin)).status, 200);
    process.stdout.write(
      `Login real aprobado: credenciales, CSRF, sesión, doble envío, recuperación e imagen. Capturas: ${output}\n`,
    );
  } finally {
    try {
      await browser?.close();
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
  process.stderr.write(
    error.name +
      ' ' +
      (error.stack || '')
        .split('\n')
        .filter((line) => line.includes('at ') && line.includes('login-smoke.cjs'))
        .join('\n') +
      '\n',
  );
  process.stderr.write('Falló login QA; detalles sensibles omitidos.\n');
  process.exitCode = 1;
});
