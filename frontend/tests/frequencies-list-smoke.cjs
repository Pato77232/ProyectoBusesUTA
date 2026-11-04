const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { setTimeout: delay } = require("node:timers/promises");
const { createRuntime } = require("../scripts/dev-runtime.cjs");
const { openBrowser } = require("./helpers/browser.cjs");
async function wait(browser, expression) {
  for (let attempt = 0; attempt < 180; attempt++) {
    if (await browser.evaluate(expression)) return;
    await delay(50);
  }
  throw new Error("No se alcanzó el estado esperado de frecuencias.");
}
async function main() {
  const runtime = createRuntime({
    project: `transviaje-frontend-qa-frequency-list-${process.pid}`,
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
    path.join(os.tmpdir(), "frequencies-web-02-qa");
  let browser,
    owned = false;
  try {
    assert.equal(runtime.exists(), false);
    owned = true;
    runtime.compose(["up", "-d", "--build", "--wait", "--wait-timeout", "120"]);
    const seed = `(async()=>{
      const {Pool}=require('pg');const {randomUUID}=require('node:crypto');
      const {createHasher}=require('./src/modules/auth/infrastructure/password-hasher');
      const PgFrequencyRepository=require('./src/modules/frequencies/infrastructure/pg-frequency.repository');
      const PgBusRepository=require('./src/modules/fleet/infrastructure/pg-bus.repository');
      const {createBaseSeatLayouts}=require('./src/modules/fleet/infrastructure/seat-layout-bases');
      const {createBusSeatConfiguration}=require('./src/modules/fleet/domain/bus-seat-configuration');
      const pool=new Pool({connectionString:process.env.DATABASE_URL});try{
        const creds=${JSON.stringify(credentials)};const hasher=await createHasher();
        const coops=(await pool.query("INSERT INTO cooperatives(name,ruc) VALUES('Frecuencias QA A','9811111111111'),('Frecuencias QA B','9822222222222'),('Frecuencias vacías','9833333333333') RETURNING id")).rows;
        for(const [i,name] of ['a','b','empty','customer'].entries()) await pool.query('INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,$3,$4)',[creds[name].email,await hasher.hash(creds[name].password),i===3?'CUSTOMER':'COOPERATIVE_ADMIN',i===3?null:coops[i].id]);
        const group=(await pool.query("INSERT INTO bus_groups(cooperative_id,name,category) VALUES($1,'Grupo QA','LONG_ROUTE') RETURNING id",[coops[0].id])).rows[0].id;
        const layout=createBaseSeatLayouts()[0];const metadata={plate:'TBM0901',vin:'VIN0901',unitNumber:'01',bodyworkBrand:'Marca QA',color:'Azul',busGroupId:group,seatLayoutId:layout.id,seatLayoutVersion:layout.version};
        const bus=await new PgBusRepository(pool).create({id:randomUUID(),cooperativeId:coops[0].id,data:metadata,configuration:createBusSeatConfiguration(metadata,layout),photos:[{fileKey:randomUUID(),contentType:'image/jpeg',size:100}]});
        const repository=new PgFrequencyRepository(pool);const create=(origin,destination,departure_time,status='ACTIVE',stops=[],segment_prices=[4])=>repository.create(coops[0].id,{origin,destination,departure_time,status,stops,segment_prices,ant_resolution_number:'ANT-QA-02'});
        const free=await create('Ambato','Quito','00:00','ACTIVE',['Latacunga'],[2,3]);
        await create('<img src=x onerror=globalThis.qaXss=true>','Cuenca','09:00','INACTIVE',[],[5]);
        const busy=await create('Ambato','Riobamba','07:00');
        process.stdout.write(JSON.stringify({free:free.id,busy:busy.id,bus:bus.id,group}));
      }finally{await pool.end();}})().catch(()=>{process.stderr.write('Falló preparación QA de frecuencias.');process.exitCode=1;});`;
    const ids = JSON.parse(
      runtime.compose(["exec", "-T", "backend", "node", "-e", seed]),
    );
    const origin =
      "http://" + runtime.compose(["port", "frontend", "8080"]).trim();
    browser = await openBrowser(origin);
    await browser.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(()=>{const original=window.fetch.bind(window);window.qaPatchCount=0;window.fetch=(input,init={})=>{const status=init.method==='PATCH'&&String(input).endsWith('/status');if(status)window.qaPatchCount++;return original(input,init).then(response=>{if(status&&window.qaDropStatus){window.qaDropStatus=false;throw new TypeError('response lost after write');}return response;});};})();`,
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
    const mode = (value) =>
      wait(
        browser,
        `document.querySelector('#status-panel')?.dataset.mode===${JSON.stringify(value)}`,
      );
    const open = async (value) => {
      await browser.send("Page.navigate", {
        url: origin + "/pages/frecuencias.html",
      });
      await mode(value);
    };
    const click = (selector) =>
      browser.evaluate(
        `document.querySelector(${JSON.stringify(selector)}).click()`,
      );
    const select = async (id) => {
      await click(`#frequency-rows button[data-id="${id}"]`);
      await mode("detail");
    };
    const load = async () => {
      await browser.evaluate(
        `document.querySelector('#frequency-filters').requestSubmit()`,
      );
      await mode("ready");
    };
    await open("signed-out");
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#filters-fields').disabled`,
      ),
      true,
    );
    await login("a");
    const created = await api("/api/v1/route-sheets", {
      method: "POST",
      data: { busGroupId: ids.group, routeDate: "2030-01-01" },
    });
    assert.equal(created.ok, true);
    const endpoint = "/api/v1/route-sheets/" + created.data.routeSheet.id;
    const requiredServiceId = randomUUID();
    const programming = {
      expectedRevision: 0,
      programming: {
        cycleStartDate: "2030-01-01",
        cycleLengthDays: 1,
        requiredServices: [
          {
            id: requiredServiceId,
            frequencyId: ids.busy,
            departureAt: "2030-01-01T07:00:00-05:00",
          },
        ],
        agendas: [
          {
            busId: ids.bus,
            initialAvailability: {
              availableAt: "2030-01-01T00:00:00-05:00",
              locationKey: "Ambato",
            },
            blocks: [],
            activities: [
              {
                id: randomUUID(),
                kind: "SERVICE",
                requiredServiceId,
                frequencyId: ids.busy,
                departureAt: "2030-01-01T07:00:00-05:00",
                arrivalAt: "2030-01-01T10:00:00-05:00",
                preparationMinutes: 15,
                points: [
                  { position: 0, departureAt: "2030-01-01T07:00:00-05:00" },
                  { position: 1, arrivalAt: "2030-01-01T10:00:00-05:00" },
                ],
              },
              {
                id: randomUUID(),
                kind: "TRANSFER",
                originKey: "Riobamba",
                destinationKey: "Ambato",
                departureAt: "2030-01-01T10:15:00-05:00",
                arrivalAt: "2030-01-01T13:00:00-05:00",
                preparationMinutes: 15,
              },
            ],
          },
        ],
      },
    };
    assert.equal(
      (
        await api(endpoint + "/programming", {
          method: "PUT",
          data: programming,
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await api(endpoint + "/tariff", {
          method: "PUT",
          data: {
            expectedRevision: 0,
            policy: {
              vipSurchargeBps: 0,
              minorDiscountBps: 5000,
              seniorDiscountBps: 5000,
              disabilityDiscountBps: 5000,
            },
            frequencies: [
              {
                frequencyId: ids.busy,
                prices: [{ fromPosition: 0, toPosition: 1, amountCents: 400 }],
              },
            ],
          },
        })
      ).ok,
      true,
    );
    assert.equal(
      (await api(endpoint + "/publish", { method: "POST", data: {} })).ok,
      true,
    );
    await open("ready");
    assert.equal(
      await browser.evaluate(
        `document.querySelectorAll('#frequency-rows tr').length`,
      ),
      3,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelectorAll('#frequency-rows img').length`,
      ),
      0,
    );
    assert.equal(await browser.evaluate(`!!window.qaXss`), false);
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#frequency-rows').textContent.includes('<img')`,
      ),
      true,
    );
    await browser.evaluate(
      `document.querySelector('#filter-status').value='ACTIVE'`,
    );
    await load();
    assert.equal(
      await browser.evaluate(
        `document.querySelectorAll('#frequency-rows tr').length`,
      ),
      2,
    );
    await select(ids.free);
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#frequency-detail').textContent.includes('00:00')`,
      ),
      true,
    );
    await click("#change-state");
    await mode("confirm");
    assert.equal(
      await browser.evaluate(`document.activeElement.id`),
      "confirmation-title",
    );
    for (let i = 0; i < 2; i++) {
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
    }
    assert.equal(
      await browser.evaluate(`document.activeElement.id`),
      "cancel-change",
    );
    await browser.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
      text: "\r",
      unmodifiedText: "\r",
    });
    await browser.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
    });
    await mode("detail");
    assert.equal(await browser.evaluate(`window.qaPatchCount`), 0);
    await click("#change-state");
    await click("#confirm-change");
    await mode("success");
    assert.equal(
      (await api("/api/v1/frequencies/" + ids.free)).data.frequency.status,
      "INACTIVE",
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelectorAll('#frequency-rows tr').length`,
      ),
      1,
    );
    await click("#change-state");
    await browser.evaluate(`window.qaDropStatus=true`);
    await click("#confirm-change");
    await mode("uncertain");
    assert.equal(
      (await api("/api/v1/frequencies/" + ids.free)).data.frequency.status,
      "ACTIVE",
    );
    const patches = await browser.evaluate(`window.qaPatchCount`);
    await click("#retry");
    await mode("detail");
    assert.equal(await browser.evaluate(`window.qaPatchCount`), patches);
    await load();
    await select(ids.busy);
    await click("#change-state");
    await click("#confirm-change");
    await mode("rejected");
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#status').textContent.includes('ciclos')`,
      ),
      true,
    );
    assert.equal(
      (await api("/api/v1/frequencies/" + ids.busy)).data.frequency.status,
      "ACTIVE",
    );
    await click("#retry");
    await mode("ready");
    await browser.send("Network.emulateNetworkConditions", {
      offline: true,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await browser.evaluate(
      `document.querySelector('#frequency-filters').requestSubmit()`,
    );
    await mode("error");
    assert.equal(
      await browser.evaluate(
        `document.querySelectorAll('#frequency-rows tr').length`,
      ),
      0,
    );
    await browser.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await click("#retry");
    await mode("ready");
    await login("b");
    await browser.evaluate(
      `document.querySelector('#frequency-filters').requestSubmit()`,
    );
    await mode("session-changed");
    assert.equal(
      await browser.evaluate(
        `document.querySelectorAll('#frequency-rows tr').length`,
      ),
      0,
    );
    assert.equal((await api("/api/v1/frequencies/" + ids.free)).status, 404);
    await open("empty");
    await login("customer");
    await open("forbidden");
    await login("empty");
    await open("empty");
    await login("a");
    await open("ready");
    await select(ids.free);
    const contrasts = await browser.evaluate(`(()=>{
      const rgb=(value)=>value.match(/[0-9.]+/g).slice(0,3).map(Number);
      const luminance=(color)=>rgb(color).map(v=>{const c=v/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[0.2126,0.7152,0.0722][i],0);
      const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
      const body=getComputedStyle(document.body), note=getComputedStyle(document.querySelector('.frequency-note')), button=getComputedStyle(document.querySelector('.frequency-list .btn-dark'));
      return [ratio(body.color,body.backgroundColor),ratio(note.color,body.backgroundColor),ratio(button.color,button.backgroundColor)];
    })()`);
    assert.equal(
      contrasts.every((value) => value >= 4.5),
      true,
    );
    await fs.mkdir(output, { recursive: true });
    for (const [width, name] of [
      [1280, "desktop"],
      [360, "mobile"],
      [640, "reflow"],
    ]) {
      await browser.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      assert.equal(
        await browser.evaluate(
          `document.documentElement.scrollWidth <= window.innerWidth`,
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
    assert.deepEqual(
      browser.outside.filter((value) => value !== "null"),
      [],
    );
    process.stdout.write(
      "ok: imagen, filtros, detalle, teclado/cancelación, cambio real, 409, respuesta perdida sin reenvío, sesión, tenant, rol, vacío, XSS, red y reflujo 360/640/1280\n",
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
      "\n" +
      (error.stack || "")
        .split("\n")
        .filter(
          (line) =>
            line.includes("at ") && line.includes("frequencies-list-smoke.cjs"),
        )
        .join("\n") +
      "\nFalló QA de frecuencias; datos sensibles omitidos.\n",
  );
  process.exitCode = 1;
});
