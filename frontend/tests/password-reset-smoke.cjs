const assert = require('node:assert/strict');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { createRuntime } = require('../scripts/dev-runtime.cjs');
const { openBrowser } = require('./helpers/browser.cjs');

async function wait(browser, expression) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await browser.evaluate(expression)) return;
    await delay(50);
  }
  throw new Error('No se alcanzó el estado esperado en recuperación QA');
}

async function main() {
  const runtime = createRuntime({
    project: `transviaje-frontend-qa-reset-${process.pid}`,
    port: '0',
  });
  let browser;
  let owned = false;
  try {
    assert.equal(runtime.exists(), false);
    owned = true;
    runtime.compose(['up', '-d', '--build', '--wait', '--wait-timeout', '120']);
    const origin =
      'http://' + runtime.compose(['port', 'frontend', '8080']).trim();
    const email = `${randomUUID()}@qa.invalid`;
    const oldPassword = `${randomUUID()}-anterior`;
    const newPassword = `${randomUUID()}-nueva`;
    browser = await openBrowser(origin);
    await browser.send('Page.navigate', {
      url: `${origin}/pages/recuperar-cuenta.html`,
    });
    await wait(browser, `document.querySelector('#reset-email') !== null`);
    await browser.evaluate(`(async () => {
      const { createApiClient } = await import('/src/api/api-client.js');
      await createApiClient().request('/api/v1/auth/register', {
        method: 'POST',
        data: { email: ${JSON.stringify(email)}, password: ${JSON.stringify(oldPassword)} },
      });
      document.querySelector('#reset-email').value = ${JSON.stringify(email)};
      document.querySelector('#request-form').requestSubmit();
    })()`);
    await wait(
      browser,
      `document.querySelector('#reset-status')?.textContent.includes('Si la cuenta existe')`,
    );

    // El worker y SMTP se prueban aparte; esta prueba inserta solo el hash QA.
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const sql = `UPDATE auth_email_actions SET state='ACCEPTED',token_hash='${tokenHash}',token_expires_at=CURRENT_TIMESTAMP+INTERVAL '20 minutes' WHERE user_id=(SELECT id FROM users WHERE email='${email}') AND state='PENDING';`;
    const updated = runtime.compose([
      'exec',
      '-T',
      'db',
      'psql',
      '-U',
      'frontend_dev',
      '-d',
      'transviaje_frontend_dev',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ]);
    assert.match(updated, /UPDATE 1/);

    const page = await fetch(`${origin}/pages/restablecer.html`);
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
    await browser.send('Page.navigate', {
      url: `${origin}/pages/restablecer.html#token=${token}`,
    });
    await wait(
      browser,
      `document.querySelector('#confirm-form')?.hidden === false`,
    );
    assert.equal(await browser.evaluate(`location.hash === ''`), true);
    assert.equal(
      await browser.evaluate(
        `[...document.querySelectorAll('input')].every(input => input.labels.length === 1)`,
      ),
      true,
    );
    assert.equal(
      await browser.evaluate(`document.querySelectorAll('input').length === 2`),
      true,
    );
    await browser.evaluate(`document.querySelector('#new-password').focus()`);
    for (const type of ['keyDown', 'keyUp']) {
      await browser.send('Input.dispatchKeyEvent', {
        type,
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
      });
    }
    assert.equal(await browser.evaluate(`document.activeElement.id`), 'confirm-password');
    assert.equal(
      await browser.evaluate(
        `getComputedStyle(document.activeElement).outlineStyle`,
      ),
      'solid',
    );
    for (const width of [1280, 360]) {
      await browser.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      assert.equal(
        await browser.evaluate(
          `document.documentElement.scrollWidth <= innerWidth + 1`,
        ),
        true,
      );
    }
    await browser.evaluate(`(() => {
      document.querySelector('#new-password').value = ${JSON.stringify(newPassword)};
      document.querySelector('#confirm-password').value = ${JSON.stringify(newPassword)};
      document.querySelector('#confirm-form').requestSubmit();
    })()`);
    await wait(
      browser,
      `document.querySelector('#reset-status')?.textContent.includes('Contraseña cambiada')`,
    );
    assert.equal(
      await browser.evaluate(`document.querySelector('#confirm-form').hidden`),
      true,
    );

    await browser.send('Page.navigate', { url: `${origin}/pages/login.html` });
    await wait(
      browser,
      `document.querySelector('fieldset')?.disabled === false`,
    );
    await browser.evaluate(`(() => {
      document.querySelector('#login-email').value = ${JSON.stringify(email)};
      document.querySelector('#login-password').value = ${JSON.stringify(newPassword)};
      document.querySelector('form').requestSubmit();
    })()`);
    await wait(
      browser,
      `document.querySelector('#login-status')?.textContent === 'Sesión iniciada.'`,
    );
    assert.deepEqual(browser.outside, []);
    process.stdout.write(
      'Recuperación QA aprobada: solicitud, token en fragmento, cambio y login.\n',
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
  const frames = (error.stack || '')
    .split('\n')
    .filter((line) => line.includes('at ') && line.includes('password-reset-smoke.cjs'))
    .join('\n');
  process.stderr.write(
    `${error.name}: falló recuperación QA; detalles sensibles omitidos.\n${frames}\n`,
  );
  process.exitCode = 1;
});
