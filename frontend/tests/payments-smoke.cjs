// QA de navegador con imagen reconstruida, proxy real y PostgreSQL efímero.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { openBrowser } = require('./helpers/browser.cjs');

const root = path.resolve(__dirname, '../..');
const prefix = `busesuta-pagos-web-${process.pid}`;
const output = process.env.QA_OUTPUT_DIR || path.join(os.tmpdir(), prefix);
const apiImage = process.env.PAYMENTS_QA_API_IMAGE || 'busesuta-pagos-web-api-qa:local';
const frontendImage = process.env.PAYMENTS_QA_FRONTEND_IMAGE || 'busesuta-pagos-web-qa:local';
const docker = (args) =>
  execFileSync('docker', args, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const owned = [];
function mounts() {
  return ['src', 'scripts', 'migrations'].flatMap((name) => [
    '--mount',
    `type=bind,source=${path.join(root, 'backend', name)},target=/app/${name},readonly`,
  ]);
}
async function wait(browser, expression) {
  for (let i = 0; i < 160; i += 1) {
    if (await browser.evaluate(expression)) return;
    await delay(50);
  }
  throw new Error('La pantalla no alcanzó el estado esperado');
}
async function main() {
  let browser;
  let network = false;
  try {
    if (!process.env.BROWSER_BIN && process.platform === 'win32')
      process.env.BROWSER_BIN = path.join(
        process.env.PROGRAMFILES || 'C:\Program Files',
        'Google/Chrome/Application/chrome.exe',
      );
    await fs.mkdir(output, { recursive: true });
    // Sin overrides, reconstruir desde los Dockerfile y lockfile del repositorio.
    // Las imágenes pueden reutilizar sus capas; no se añaden dependencias.
    if (!process.env.PAYMENTS_QA_API_IMAGE)
      docker(['build', '--pull=false', '-t', apiImage, 'backend']);
    if (!process.env.PAYMENTS_QA_FRONTEND_IMAGE)
      docker(['build', '--pull=false', '-t', frontendImage, 'frontend']);
    docker(['network', 'create', prefix]);
    network = true;
    docker([
      'run',
      '-d',
      '--name',
      `${prefix}-db`,
      '--network',
      prefix,
      '--network-alias',
      'db',
      '--tmpfs',
      '/var/lib/postgresql/data',
      '-e',
      'POSTGRES_DB=pagos_web_test',
      '-e',
      'POSTGRES_USER=test_user',
      '-e',
      'POSTGRES_PASSWORD=test_only_password',
      'postgres:16.13-alpine',
    ]);
    owned.push(`${prefix}-db`);
    for (let i = 0; i < 60; i += 1) {
      try {
        docker(['exec', `${prefix}-db`, 'pg_isready', '-U', 'test_user', '-d', 'pagos_web_test']);
        break;
      } catch {
        await delay(250);
      }
    }
    const database = 'DATABASE_URL=postgres://test_user:test_only_password@db:5432/pagos_web_test';
    docker([
      'run',
      '-d',
      '--name',
      `${prefix}-api`,
      '--network',
      prefix,
      '--network-alias',
      'backend',
      ...mounts(),
      '--mount',
      `type=bind,source=${path.join(__dirname, 'helpers', 'payments-qa-server.cjs')},target=/qa/server.cjs,readonly`,
      '-e',
      'NODE_ENV=test',
      '-e',
      database,
      apiImage,
      'node',
      '/qa/server.cjs',
    ]);
    owned.push(`${prefix}-api`);
    docker([
      'run',
      '-d',
      '--name',
      `${prefix}-frontend`,
      '--network',
      prefix,
      '-p',
      '127.0.0.1::8080',
      '--read-only',
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,size=16m,mode=1777',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges:true',
      frontendImage,
      'nginx',
      '-c',
      '/etc/nginx/nginx-proxy.conf',
      '-g',
      'daemon off;',
    ]);
    owned.push(`${prefix}-frontend`);
    const origin = 'http://' + docker(['port', `${prefix}-frontend`, '8080']).trim();
    let ready = false;
    for (let i = 0; i < 100; i += 1) {
      try {
        if ((await fetch(origin + '/api/v1/health')).ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(250);
    }
    assert.equal(ready, true, 'API QA saludable');
    const fixtures = JSON.parse(
      docker(['exec', `${prefix}-api`, 'cat', '/tmp/payments-web-fixtures.json']),
    );
    browser = await openBrowser(origin);
    await browser.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.qaCalls=[]; const originalFetch=window.fetch.bind(window); window.fetch=(url,options)=>{qaCalls.push(String(url));return originalFetch(url,options);};`,
    });
    const navigate = async () => {
      await browser.send('Page.navigate', { url: origin + '/pages/comprobantes.html' });
      await wait(
        browser,
        `document.querySelector('#status-panel') && document.querySelector('#status-panel').dataset.mode !== 'loading'`,
      );
    };
    const login = async (account) =>
      browser.evaluate(`(async()=>{
      const {createApiClient}=await import('/src/api/api-client.js');
      window.qaClient=createApiClient();
      await qaClient.request('/api/v1/auth/login',{method:'POST',data:${JSON.stringify(account)}});
    })()`);
    const logout = async () =>
      browser.evaluate(
        `(async()=>{const {createApiClient}=await import('/src/api/api-client.js');await createApiClient().request('/api/v1/auth/logout',{method:'POST'})})()`,
      );
    await navigate();
    assert.equal(
      await browser.evaluate(
        `!document.querySelector('#session-link').hidden && !qaCalls.some(p=>p.includes('payment-proofs'))`,
      ),
      true,
    );
    for (const role of ['customer', 'admin']) {
      await login(fixtures.accounts[role]);
      await navigate();
      assert.equal(
        await browser.evaluate(
          `document.querySelector('#status-panel').dataset.mode === 'denied' && !qaCalls.some(p=>p.includes('payment-proofs'))`,
        ),
        true,
      );
      await logout();
    }
    await login(fixtures.accounts.a);
    await navigate();
    assert.equal(await browser.evaluate(`document.querySelectorAll('.payment-proof').length`), 50);
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#proofs img') === null && document.querySelector('#proofs').textContent.includes('<img src=x onerror=alert(1)>.png')`,
      ),
      true,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('.payment-details').textContent.includes('0,00')`,
      ),
      true,
    );
    assert.equal(
      await browser.evaluate(
        `(async()=>{const r=await fetch(document.querySelector('.payment-file-link').getAttribute('href'));return r.status===200 && r.headers.get('content-type').startsWith('image/png') && r.headers.get('cache-control').includes('no-store')})()`,
      ),
      true,
    );
    assert.equal(
      await browser.evaluate(
        `(async()=> (await fetch('/api/v1/payment-proofs/${fixtures.otherProof}/file')).status)()`,
      ),
      404,
    );
    for (const [label, width, height, zoom] of [
      ['desktop', 1280, 900, 1],
      ['mobile', 360, 800, 1],
      ['zoom-200', 640, 450, 2],
    ]) {
      await browser.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await browser.evaluate(`document.documentElement.style.fontSize='${16 * zoom}px'`);
      await delay(100);
      assert.equal(
        await browser.evaluate(`document.documentElement.scrollWidth <= innerWidth`),
        true,
        `sin desborde ${label}`,
      );
      if (label !== 'zoom-200') {
        if (label === 'mobile')
          await browser.evaluate(
            "document.querySelector('.payment-inbox').scrollIntoView({behavior:'instant',block:'start'})",
          );
        const screenshot = await browser.send('Page.captureScreenshot', { format: 'png' });
        await fs.writeFile(
          path.join(output, `${label}.png`),
          Buffer.from(screenshot.data, 'base64'),
        );
      }
    }
    await browser.evaluate(`document.documentElement.style.fontSize='16px'`);
    await browser.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await browser.evaluate(`document.querySelector('#refresh').focus()`);
    await browser.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
    });
    await browser.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
    });
    assert.equal(
      await browser.evaluate(`document.activeElement.classList.contains('payment-file-link')`),
      true,
    );
    await browser.evaluate(`document.querySelector('#next').focus()`);
    assert.equal(
      await browser.evaluate(`getComputedStyle(document.activeElement).outlineStyle !== 'none'`),
      true,
    );
    await browser.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
      text: '\r',
    });
    await browser.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
    });
    await wait(browser, `document.querySelector('#page-number').textContent === 'Página 2'`);
    assert.equal(await browser.evaluate(`document.querySelectorAll('.payment-proof').length`), 1);
    await browser.evaluate(`document.querySelector('#previous').click()`);
    await wait(browser, `document.querySelector('#page-number').textContent === 'Página 1'`);
    await logout();
    await login(fixtures.accounts.b);
    await navigate();
    assert.equal(
      await browser.evaluate(
        `document.querySelectorAll('.payment-proof').length === 1 && document.querySelector('#proofs').textContent.includes('comprobante-QA-52.png')`,
      ),
      true,
    );
    await logout();
    await login(fixtures.accounts.empty);
    await navigate();
    assert.equal(
      await browser.evaluate(
        `document.querySelectorAll('.payment-proof').length === 0 && !document.querySelector('#empty-state').hidden && document.querySelector('#status-panel').dataset.mode === 'ready'`,
      ),
      true,
    );
    assert.equal(
      await browser.evaluate(`localStorage.length===0 && sessionStorage.length===0`),
      true,
    );
    assert.equal(browser.outside.length, 0);
    for (const asset of [
      '/pages/comprobantes.html',
      '/src/payments/pending-view.js',
      '/src/styles/payments.css',
      '/pages/login.html',
      '/pages/registrar-bus.html',
    ])
      assert.equal((await fetch(origin + asset)).status, 200);
    assert.equal((await fetch(origin + '/tests/helpers/payments-qa-server.cjs')).status, 404);
    docker(['stop', `${prefix}-api`]);
    await browser.evaluate(`document.querySelector('#refresh').click()`);
    await wait(browser, `document.querySelector('#status-panel').dataset.mode === 'error'`);
    assert.equal(
      await browser.evaluate(
        `!document.querySelector('#retry').hidden && document.querySelectorAll('.payment-proof').length===0`,
      ),
      true,
    );
    process.stdout.write(
      `QA Pagos aprobado: sesión/roles, 50+1, dos cooperativas, archivo privado, XSS, vacío/error, teclado, móvil/200 %, imagen. Capturas: ${output}\n`,
    );
  } finally {
    await browser?.close();
    for (const name of owned.reverse()) docker(['rm', '-f', name]);
    if (network) docker(['network', 'rm', prefix]);
  }
}
main().catch((error) => {
  process.stderr.write(
    `${error.name}: ${error.message}\n` +
      (error.stack || '')
        .split('\n')
        .filter((line) => line.includes('at ') && line.includes('payments-smoke.cjs'))
        .join('\n') +
      '\n',
  );
  process.exitCode = 1;
});
