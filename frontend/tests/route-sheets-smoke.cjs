// ROUTE-SHEETS-WEB-01: navegador, Nginx y API reales en un proyecto efímero exclusivo.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { setTimeout: delay } = require("node:timers/promises");
const { createRuntime } = require("../scripts/dev-runtime.cjs");
const { openBrowser } = require("./helpers/browser.cjs");
async function wait(browser, expression) {
  for (let i = 0; i < 160; i++) {
    if (await browser.evaluate(expression)) return;
    await delay(50);
  }
  throw new Error("No se alcanzó el estado esperado en hojas de ruta.");
}
async function main() {
  const runtime = createRuntime({
    project: `transviaje-frontend-qa-route-sheets-${process.pid}`,
    port: "0",
  });
  const credentials = Object.fromEntries(
    ["a", "b", "empty", "customer"].map((name) => [
      name,
      { email: `${randomUUID()}@qa.invalid`, password: `${randomUUID()}-QA` },
    ]),
  );
  const output =
    process.env.QA_OUTPUT_DIR ||
    path.join(os.tmpdir(), "route-sheets-web-01-qa");
  let browser,
    owned = false;
  try {
    assert.equal(runtime.exists(), false);
    owned = true;
    runtime.compose(["up", "-d", "--build", "--wait", "--wait-timeout", "120"]);
    const seed = `(async()=>{const {Pool}=require('pg');const {createHasher}=require('./src/modules/auth/infrastructure/password-hasher');const pool=new Pool({connectionString:process.env.DATABASE_URL});try{const creds=${JSON.stringify(credentials)};const hasher=await createHasher();const coops=(await pool.query("INSERT INTO cooperatives(name,ruc) VALUES('Hojas QA A','9911111111111'),('Hojas QA B','9922222222222'),('Hojas QA vacía','9933333333333') RETURNING id")).rows;const groups=[];for(let i=0;i<2;i++){groups.push((await pool.query("INSERT INTO bus_groups(cooperative_id,name,category) VALUES($1,$2,'LONG_ROUTE') RETURNING id",[coops[i].id,i===0?'<img src=x onerror=globalThis.qaXss=true>':'Grupo B'])).rows[0].id);}for(const [i,name] of ['a','b','empty','customer'].entries())await pool.query('INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,$3,$4)',[creds[name].email,await hasher.hash(creds[name].password),i===3?'CUSTOMER':'COOPERATIVE_ADMIN',i===3?null:coops[i].id]);process.stdout.write(JSON.stringify(groups));}finally{await pool.end();}})().catch(()=>{process.stderr.write('Falló preparación QA de hojas.');process.exitCode=1;});`;
    const groups = JSON.parse(
      runtime.compose(["exec", "-T", "backend", "node", "-e", seed]),
    );
    const origin =
      "http://" + runtime.compose(["port", "frontend", "8080"]).trim();
    browser = await openBrowser(origin);
    await browser.send("Page.addScriptToEvaluateOnNewDocument", {
      source:
        '(()=>{const original=window.fetch.bind(window);window.fetch=(input,init={})=>original(input,init).then(response=>{if(window.qaDropRouteSheetResponse&&init.method==="POST"&&String(input).includes("/api/v1/route-sheets")){window.qaDropRouteSheetResponse=false;throw new TypeError("response lost after write");}return response;});})();',
    });
    const api = (endpoint, options = {}) =>
      browser.evaluate(
        `(async()=>{const {createApiClient}=await import('/src/api/api-client.js');try{return {ok:true,data:await createApiClient().request(${JSON.stringify(endpoint)},${JSON.stringify(options)})};}catch(error){return {ok:false,status:error.status,code:error.code};}})()`,
      );
    const login = async (name) => {
      await api("/api/v1/auth/logout", { method: "POST" });
      assert.equal(
        (
          await api("/api/v1/auth/login", {
            method: "POST",
            data: credentials[name],
          })
        ).ok,
        true,
      );
    };
    const open = async (mode) => {
      await browser.send("Page.navigate", {
        url: origin + "/pages/hojas-ruta.html",
      });
      await wait(
        browser,
        `document.querySelector('#status-panel')?.dataset.mode===${JSON.stringify(mode)}`,
      );
    };
    await open("signed-out");
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#filters-fields').disabled`,
      ),
      true,
    );
    await login("a");
    for (const routeDate of ["2030-01-02", "2030-01-03"])
      assert.equal(
        (
          await api("/api/v1/route-sheets", {
            method: "POST",
            data: { busGroupId: groups[0], routeDate },
          })
        ).ok,
        true,
      );
    await login("b");
    assert.equal(
      (
        await api("/api/v1/route-sheets", {
          method: "POST",
          data: { busGroupId: groups[1], routeDate: "2030-01-04" },
        })
      ).ok,
      true,
    );
    await login("a");
    await open("ready");
    await browser.evaluate(`document.querySelector('#bus-group').focus()`);
    await browser.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
    });
    await browser.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
    });
    assert.equal(
      await browser.evaluate(`document.activeElement.id`),
      "sheet-state",
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelectorAll('#sheet-rows tr').length`,
      ),
      2,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#sheet-rows').textContent.includes('Grupo B')`,
      ),
      false,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#sheet-rows img')!==null || !!globalThis.qaXss`,
      ),
      false,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#sheet-rows td').textContent`,
      ),
      "02/01/2030",
    );
    await fs.mkdir(output, { recursive: true });
    for (const [width, name] of [
      [1280, "escritorio"],
      [360, "movil"],
    ]) {
      await browser.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      assert.equal(
        await browser.evaluate(
          `document.documentElement.scrollWidth<=innerWidth+1`,
        ),
        true,
      );
      const shot = await browser.send("Page.captureScreenshot", {
        captureBeyondViewport: true,
      });
      await fs.writeFile(
        path.join(output, name + ".png"),
        Buffer.from(shot.data, "base64"),
      );
    }
    await browser.evaluate(
      `document.querySelector('#from-date').value='2030-01-03';document.querySelector('#sheet-filters').requestSubmit()`,
    );
    await wait(
      browser,
      `document.querySelector('#status-panel').dataset.mode==='ready' && document.querySelectorAll('#sheet-rows tr').length===1`,
    );
    await browser.evaluate(
      `document.querySelector('#to-date').value='2030-01-02';document.querySelector('#sheet-filters').requestSubmit()`,
    );
    await wait(
      browser,
      `document.querySelector('#status-panel').dataset.mode==='invalid'`,
    );
    assert.equal(await browser.evaluate(`document.activeElement.id`), "status");
    await browser.evaluate(`document.querySelector('#sheet-filters').reset()`);
    await wait(
      browser,
      `document.querySelectorAll('#sheet-rows tr').length===2`,
    );
    const draftNotes = "<img src=x onerror=globalThis.qaDraftXss=true>";
    await browser.evaluate(
      `(function(){document.querySelector('#draft-group').value=${JSON.stringify(groups[0])};document.querySelector('#draft-route-date').value='2030-01-05';document.querySelector('#draft-notes-input').value=${JSON.stringify(draftNotes)};document.querySelector('#draft-form').requestSubmit();})()`,
    );
    await wait(
      browser,
      `document.querySelector('#draft-panel').dataset.mode==='success'`,
    );
    assert.equal(
      await browser.evaluate(`document.querySelector('#draft-result').hidden`),
      false,
    );
    const result = await browser.evaluate(
      `({id:document.querySelector('#draft-id').textContent,group:document.querySelector('#draft-group-name').textContent,date:document.querySelector('#draft-date').textContent,state:document.querySelector('#draft-state').textContent})`,
    );
    assert.match(
      result.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    assert.deepEqual(
      { group: result.group, date: result.date, state: result.state },
      {
        group: "<img src=x onerror=globalThis.qaXss=true>",
        date: "05/01/2030",
        state: "Borrador",
      },
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#draft-notes').textContent`,
      ),
      draftNotes,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#draft-result img')===null && !globalThis.qaDraftXss`,
      ),
      true,
    );
    await wait(
      browser,
      `document.querySelectorAll('#sheet-rows tr').length===3`,
    );
    await browser.evaluate(`document.querySelector('#another-draft').click()`);
    await wait(
      browser,
      `document.querySelector('#draft-panel').dataset.mode==='ready'`,
    );
    await browser.evaluate(
      `(function(){document.querySelector('#draft-group').value=${JSON.stringify(groups[0])};document.querySelector('#draft-route-date').value='2030-01-05';document.querySelector('#draft-notes-input').value='Reintento deliberado';document.querySelector('#draft-form').requestSubmit();})()`,
    );
    await wait(
      browser,
      `document.querySelector('#draft-panel').dataset.mode==='rejected'`,
    );
    assert.match(
      await browser.evaluate(
        `document.querySelector('#draft-status').textContent`,
      ),
      /Ya existe una hoja/,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelectorAll('#sheet-rows tr').length`,
      ),
      3,
    );
    await browser.evaluate(
      `(function(){document.querySelector('#draft-route-date').value='2030-01-06';document.querySelector('#draft-notes-input').value='Resultado de transporte incierto';globalThis.qaDropRouteSheetResponse=true;document.querySelector('#draft-form').requestSubmit();})()`,
    );
    await wait(
      browser,
      `document.querySelector('#draft-panel').dataset.mode==='uncertain'`,
    );
    assert.equal(
      (await api("/api/v1/route-sheets")).data.routeSheets.length,
      4,
    );
    await browser.evaluate(
      `document.querySelector('#from-date').value='2030-01-06';document.querySelector('#to-date').value='2030-01-06';document.querySelector('#sheet-filters').requestSubmit()`,
    );
    await wait(
      browser,
      `document.querySelectorAll('#sheet-rows tr').length===1`,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#draft-panel').dataset.mode`,
      ),
      "uncertain",
    );
    await browser.evaluate(
      `document.querySelector('#sheet-state').value='PUBLISHED';document.querySelector('#sheet-filters').requestSubmit()`,
    );
    await wait(
      browser,
      `document.querySelector('#status-panel').dataset.mode==='empty'`,
    );
    await browser.evaluate(`document.querySelector('#sheet-filters').reset()`);
    await wait(
      browser,
      `document.querySelectorAll('#sheet-rows tr').length===4`,
    );
    await login("b");
    await browser.evaluate(
      `document.querySelector('#sheet-filters').requestSubmit()`,
    );
    await wait(
      browser,
      `document.querySelector('#status-panel').dataset.mode==='session-changed'`,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelectorAll('#sheet-rows tr').length`,
      ),
      0,
    );
    await open("ready");
    assert.equal(
      await browser.evaluate(
        `document.querySelectorAll('#sheet-rows tr').length`,
      ),
      1,
    );
    await login("empty");
    await open("empty");
    assert.match(
      await browser.evaluate(`document.querySelector('#status').textContent`),
      /no tiene grupos/,
    );
    await login("customer");
    await open("forbidden");
    await login("a");
    await open("ready");
    await browser.send("Network.emulateNetworkConditions", {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    await browser.evaluate(
      `document.querySelector('#sheet-filters').requestSubmit()`,
    );
    await wait(
      browser,
      `document.querySelector('#status-panel').dataset.mode==='error'`,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelectorAll('#sheet-rows tr').length`,
      ),
      0,
    );
    await browser.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await browser.evaluate(`document.querySelector('#retry').click()`);
    await wait(
      browser,
      `document.querySelector('#status-panel').dataset.mode==='ready'`,
    );
    assert.equal(
      (await api("/api/v1/route-sheets")).data.routeSheets.length,
      4,
    );
    assert.deepEqual(
      browser.outside.filter((value) => value !== "null"),
      [],
    );
    console.log(
      "ok: imagen, sesión, aislamiento, alta, confirmación segura, duplicado, respuesta perdida tras escritura, fechas, filtros, vacío, grupos ausentes, cambio de sesión, rol, fallo de red, recuperación y escritorio/móvil",
    );
  } finally {
    try {
      await browser?.close();
    } finally {
      try {
        if (owned) runtime.compose(["down", "--remove-orphans"]);
      } finally {
        runtime.dispose();
      }
    }
  }
}
main().catch((error) => {
  process.stderr.write(
    error.name +
      " " +
      (error.stack || "")
        .split("\n")
        .filter(
          (line) =>
            line.includes("at ") && line.includes("route-sheets-smoke.cjs"),
        )
        .join("\n") +
      "\nFalló QA de hojas; detalles sensibles omitidos.\n",
  );
  process.exitCode = 1;
});
