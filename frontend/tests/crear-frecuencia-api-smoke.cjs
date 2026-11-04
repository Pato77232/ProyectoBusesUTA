// Navegador, imagen y API reales; datos ficticios en un proyecto Docker exclusivo.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { setTimeout: delay } = require('node:timers/promises');
const { createRuntime } = require('../scripts/dev-runtime.cjs');
const { openBrowser } = require('./helpers/browser.cjs');
const PAGE = '/pages/crear-frecuencia.html';
async function wait(browser, expression) {
  for (let i = 0; i < 160; i++) {
    if (await browser.evaluate(expression)) return;
    await delay(50);
  }
  throw new Error('No se alcanzó el estado QA esperado.');
}
async function fill(browser, hour = '00:00', stops = false) {
  await browser.evaluate(
    `(() => {for(const [id,value] of Object.entries({origin:'Ambato',destination:'Quito',departure_time:${JSON.stringify(hour)},ant_resolution_number:'ANT-QA-001'})){const node=document.getElementById(id);node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));}})()`,
  );
  if (stops)
    await browser.evaluate(
      `document.querySelector('#add-stop').click();const stop=document.querySelector('#stop-list input');stop.value='Latacunga';stop.dispatchEvent(new Event('input',{bubbles:true}));`,
    );
  await browser.evaluate(
    `document.querySelectorAll('#price-list input').forEach((node,index)=>{node.value=String(index+2);node.dispatchEvent(new Event('input',{bubbles:true}));})`,
  );
}
const ready = (browser) =>
  wait(
    browser,
    `!!document.querySelector('#frequency-fields') && !document.querySelector('#frequency-fields').disabled`,
  );
const success = (browser) =>
  wait(
    browser,
    `!!document.querySelector('#frequency-result') && !document.querySelector('#frequency-result').hidden`,
  );
const submit = (browser) =>
  browser.evaluate(
    `document.querySelector('#frequency-form').requestSubmit();document.querySelector('#frequency-form').requestSubmit()`,
  );
const another = async (browser) => {
  await browser.evaluate(`document.querySelector('#new-frequency').click()`);
  await ready(browser);
};
async function api(browser, endpoint, options = {}) {
  return browser.evaluate(
    `(async()=>{const {createApiClient}=await import('/src/api/api-client.js');try{return {ok:true,data:await createApiClient().request(${JSON.stringify(endpoint)},${JSON.stringify(options)})};}catch(error){return {ok:false,status:error.status,code:error.code};}})()`,
  );
}
async function main() {
  const runtime = createRuntime({
    project: `transviaje-frontend-qa-frequencies-${process.pid}`,
    port: '0',
  });
  const credentials = Object.fromEntries(
    ['adminA', 'adminB', 'customer'].map((role) => [
      role,
      { email: randomUUID() + '@qa.invalid', password: randomUUID() + '-QA' },
    ]),
  );
  const output =
    process.env.QA_OUTPUT_DIR ||
    path.join(os.tmpdir(), 'frequencies-web-01-api');
  let browser,
    owned = false;
  try {
    assert.equal(runtime.exists(), false);
    owned = true;
    runtime.compose(['up', '-d', '--build', '--wait', '--wait-timeout', '120']);
    const seed = `(async()=>{const {Pool}=require('pg');const {createHasher}=require('./src/modules/auth/infrastructure/password-hasher');const pool=new Pool({connectionString:process.env.DATABASE_URL});try{const creds=${JSON.stringify(credentials)};const hasher=await createHasher();const coops=(await pool.query("INSERT INTO cooperatives(name,ruc) VALUES('QA A','0011111111111'),('QA B','0022222222222') RETURNING id")).rows;for(const [index,key] of ['adminA','adminB','customer'].entries()){await pool.query('INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,$3,$4)',[creds[key].email,await hasher.hash(creds[key].password),key==='customer'?'CUSTOMER':'COOPERATIVE_ADMIN',index<2?coops[index].id:null]);}process.stdout.write(JSON.stringify(coops.map(row=>row.id)));}finally{await pool.end();}})().catch(()=>{process.stderr.write('Falló preparación QA.');process.exitCode=1;});`;
    const cooperativeIds = JSON.parse(
      runtime.compose(['exec', '-T', 'backend', 'node', '-e', seed]),
    );
    const origin =
      'http://' + runtime.compose(['port', 'frontend', '8080']).trim();
    browser = await openBrowser(origin);
    await browser.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.qaCalls=[];const originalFetch=window.fetch.bind(window);window.fetch=async(url,options={})=>{const call={url:String(url),method:options.method||'GET'};qaCalls.push(call);const response=await originalFetch(url,options);call.status=response.status;if(window.qaLoseResponse&&call.url==='/api/v1/frequencies'&&call.method==='POST'){window.qaLoseResponse=false;throw new TypeError('Recepción perdida solo en QA, después del servidor real');}return response;};`,
    });
    async function open() {
      await browser.send('Page.navigate', { url: origin + PAGE });
    }
    async function login(role) {
      // La pantalla de login conserva una sesión existente: cerrarla realmente
      // antes de cambiar de usuario en este recorrido de QA.
      await api(browser, '/api/v1/auth/logout', { method: 'POST' });
      await browser.send('Page.navigate', {
        url: origin + '/pages/login.html',
      });
      await wait(
        browser,
        `!!document.querySelector('fieldset') && !document.querySelector('fieldset').disabled`,
      );
      await browser.evaluate(
        `document.querySelector('#login-email').value=${JSON.stringify(credentials[role].email)};document.querySelector('#login-password').value=${JSON.stringify(credentials[role].password)};document.querySelector('form').requestSubmit();`,
      );
      await wait(
        browser,
        `document.querySelector('#login-status')?.textContent==='Sesión iniciada.'`,
      );
    }
    async function capture(name, width = 1280, zoom = 1) {
      await fs.mkdir(output, { recursive: true });
      await browser.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await browser.evaluate(
        `document.documentElement.style.zoom='${zoom}';window.scrollTo(0,0)`,
      );
      assert.equal(
        await browser.evaluate(
          'document.documentElement.scrollWidth<=innerWidth+1',
        ),
        true,
      );
      const { data } = await browser.send('Page.captureScreenshot', {
        captureBeyondViewport: true,
      });
      await fs.writeFile(
        path.join(output, name + '.png'),
        Buffer.from(data, 'base64'),
      );
      await browser.evaluate(`document.documentElement.style.zoom='1'`);
    }
    await open();
    await wait(
      browser,
      `document.querySelector('#review-status')?.textContent.includes('Inicia sesión')`,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#frequency-fields').disabled`,
      ),
      true,
    );
    assert.equal(
      (await api(browser, '/api/v1/frequencies', { method: 'POST', data: {} }))
        .status,
      401,
    );
    console.log('ok acceso sin sesión');
    await login('customer');
    await open();
    await wait(
      browser,
      `document.querySelector('#review-status')?.textContent.includes('Necesitas una sesión')`,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#frequency-fields').disabled`,
      ),
      true,
    );
    assert.equal(
      (await api(browser, '/api/v1/frequencies', { method: 'POST', data: {} }))
        .status,
      403,
    );
    console.log('ok rol no autorizado');
    await login('adminA');
    await open();
    await ready(browser);
    await fill(browser);
    await submit(browser);
    await success(browser);
    const firstId = await browser.evaluate(
      `document.querySelector('#frequency-summary dd').textContent`,
    );
    assert.equal(
      await browser.evaluate(
        `qaCalls.filter(call=>call.url==='/api/v1/frequencies'&&call.method==='POST').length`,
      ),
      1,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#frequency-fields').disabled`,
      ),
      true,
    );
    const first = (await api(browser, '/api/v1/frequencies/' + firstId)).data
      .frequency;
    assert.equal(first.departure_time, '00:00');
    assert.equal(first.cooperative_id, cooperativeIds[0]);
    assert.deepEqual(first.segment_prices, [2]);
    await capture('alta-directa');
    console.log('ok alta directa, medianoche y doble envío');
    await another(browser);
    assert.equal(
      await browser.evaluate(`document.querySelector('#origin').value`),
      '',
    );
    await fill(browser, '07:00', true);
    await submit(browser);
    await success(browser);
    const withStops = (
      await api(browser, '/api/v1/frequencies')
    ).data.frequencies.find((row) => row.departure_time === '07:00');
    assert.deepEqual(withStops.stops, ['Latacunga']);
    assert.deepEqual(withStops.segment_prices, [2, 3]);
    console.log('ok alta con parada y precios reales');
    await another(browser);
    await fill(browser);
    await submit(browser);
    await wait(
      browser,
      `document.querySelector('#review-status')?.textContent.includes('Ya existe')`,
    );
    assert.equal(
      await browser.evaluate(`document.querySelector('#origin').value`),
      'Ambato',
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#frequency-fields').disabled`,
      ),
      false,
    );
    await capture('duplicado-movil', 360);
    console.log('ok duplicado preserva datos');
    await fill(browser, '01:00');
    await browser.evaluate(
      `fetch('/api/v1/auth/csrf',{cache:'no-store'}).then(()=>null)`,
    );
    const before = await browser.evaluate(
      `qaCalls.filter(call=>call.url==='/api/v1/frequencies'&&call.method==='POST').length`,
    );
    await submit(browser);
    await wait(
      browser,
      `document.querySelector('#review-status')?.textContent.includes('solicitud venció')`,
    );
    assert.equal(
      await browser.evaluate(
        `qaCalls.filter(call=>call.url==='/api/v1/frequencies'&&call.method==='POST').length`,
      ),
      before + 1,
    );
    await submit(browser);
    await success(browser);
    console.log('ok CSRF real y reenvío solo manual');
    await another(browser);
    await fill(browser, '02:00');
    await api(browser, '/api/v1/auth/logout', { method: 'POST' });
    const calls = await browser.evaluate('qaCalls.length');
    await submit(browser);
    await wait(
      browser,
      `document.querySelector('#review-status')?.textContent.includes('Inicia sesión')`,
    );
    assert.equal(
      await browser.evaluate(`document.querySelector('#origin').value`),
      'Ambato',
    );
    assert.equal(
      await browser.evaluate(
        `qaCalls.slice(${calls}).some(call=>call.url==='/api/v1/frequencies')`,
      ),
      false,
    );
    console.log('ok sesión vencida conserva datos sin POST');
    await login('adminB');
    await open();
    await ready(browser);
    await fill(browser);
    await submit(browser);
    await success(browser);
    const secondId = await browser.evaluate(
      `document.querySelector('#frequency-summary dd').textContent`,
    );
    assert.equal(
      (await api(browser, '/api/v1/frequencies/' + secondId)).data.frequency
        .cooperative_id,
      cooperativeIds[1],
    );
    assert.equal(
      (await api(browser, '/api/v1/frequencies/' + firstId)).status,
      404,
    );
    assert.equal(
      (await api(browser, '/api/v1/frequencies')).data.frequencies.length,
      1,
    );
    console.log('ok aislamiento de cooperativas');
    await another(browser);
    await fill(browser, '03:00');
    await capture('formulario-zoom-200', 1280, 2);
    await browser.evaluate('window.qaLoseResponse=true');
    await submit(browser);
    await wait(
      browser,
      `document.querySelector('#review-status')?.textContent.includes('podría haberse creado')`,
    );
    const writes = await browser.evaluate(
      `qaCalls.filter(call=>call.url==='/api/v1/frequencies'&&call.method==='POST').length`,
    );
    assert.equal(
      (await api(browser, '/api/v1/frequencies')).data.frequencies.length,
      2,
    );
    await browser.evaluate(`document.querySelector('#check-session').click()`);
    await wait(
      browser,
      `document.querySelector('#review-status')?.textContent.includes('no se pudo confirmar el registro')`,
    );
    await submit(browser);
    assert.equal(
      await browser.evaluate(
        `qaCalls.filter(call=>call.url==='/api/v1/frequencies'&&call.method==='POST').length`,
      ),
      writes,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#frequency-fields').disabled`,
      ),
      true,
    );
    console.log('ok pérdida de recepción tras alta real sin reenvío');
    for (const file of [
      PAGE,
      '/src/frequencies/frequency-controller.js',
      '/src/frequencies/frequency-form-view.js',
      '/src/frequencies/frequency-form.js',
      '/src/frequencies/frequency-page.js',
      '/src/styles/frequency-form.css',
    ])
      assert.equal((await fetch(origin + file)).status, 200);
    assert.equal(
      (await fetch(origin + '/tests/crear-frecuencia-api-smoke.cjs')).status,
      404,
    );
    runtime.compose(['stop', 'backend']);
    await browser.send('Page.reload');
    await wait(
      browser,
      `document.querySelector('#review-status')?.textContent.includes('No pudimos comprobar')`,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#frequency-fields').disabled`,
      ),
      true,
    );
    assert.deepEqual(
      browser.outside.filter((value) => value !== 'null'),
      [],
    );
    console.log('ok imagen y caída real de API; 10 recorridos aprobados');
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
        .filter(
          (line) =>
            line.includes('at ') &&
            line.includes('crear-frecuencia-api-smoke.cjs'),
        )
        .join('\n') +
      '\nFalló QA; detalles sensibles omitidos.\n',
  );
  process.exitCode = 1;
});
