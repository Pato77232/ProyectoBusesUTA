const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { setTimeout: delay } = require("node:timers/promises");
const { createRuntime } = require("../scripts/dev-runtime.cjs");
const { openBrowser } = require("./helpers/browser.cjs");
async function wait(browser, expression) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await browser.evaluate(expression)) return;
    await delay(50);
  }
  process.stderr.write(
    "Estado QA: " +
      (await browser.evaluate(
        `document.querySelector('#editor-status')?.textContent || document.querySelector('#status')?.textContent || 'sin pantalla'`,
      )) +
      "\n",
  );
  throw new Error("No se alcanzó el estado esperado del editor.");
}
async function main() {
  const runtime = createRuntime({
    project: `transviaje-frontend-qa-sheet-editor-${process.pid}`,
    port: "0",
  });
  const credentials = Object.fromEntries(
    ["a", "b", "customer"].map((name) => [
      name,
      { email: `${randomUUID()}@qa.invalid`, password: `${randomUUID()}-QA` },
    ]),
  );
  const output =
    process.env.QA_OUTPUT_DIR ||
    path.join(os.tmpdir(), "route-sheets-web-02-qa");
  let browser,
    owned = false;
  try {
    assert.equal(runtime.exists(), false);
    owned = true;
    runtime.compose(["up", "-d", "--build", "--wait", "--wait-timeout", "120"]);
    const seed = `(async()=>{const {Pool}=require('pg');const {randomUUID}=require('node:crypto');const {createHasher}=require('./src/modules/auth/infrastructure/password-hasher');const PgBusRepository=require('./src/modules/fleet/infrastructure/pg-bus.repository');const PgFrequencyRepository=require('./src/modules/frequencies/infrastructure/pg-frequency.repository');const {createBaseSeatLayouts}=require('./src/modules/fleet/infrastructure/seat-layout-bases');const {createBusSeatConfiguration}=require('./src/modules/fleet/domain/bus-seat-configuration');const pool=new Pool({connectionString:process.env.DATABASE_URL});try{
      const creds=${JSON.stringify(credentials)};const hasher=await createHasher();const coops=(await pool.query("INSERT INTO cooperatives(name,ruc) VALUES('Editor QA A','9711111111111'),('Editor QA B','9722222222222') RETURNING id")).rows;
      const groups=[];for(let i=0;i<2;i++)groups.push((await pool.query("INSERT INTO bus_groups(cooperative_id,name,category) VALUES($1,$2,'LONG_ROUTE') RETURNING id",[coops[i].id,'Grupo editor '+i])).rows[0].id);
      for(const [i,name]of ['a','b','customer'].entries())await pool.query('INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,$3,$4)',[creds[name].email,await hasher.hash(creds[name].password),i===2?'CUSTOMER':'COOPERATIVE_ADMIN',i===2?null:coops[i].id]);
      const layout=createBaseSeatLayouts()[0];const buses=[];for(let i=0;i<3;i++){const c=i===2?1:0;const data={plate:'TBM090'+i,vin:'VIN090'+i,unitNumber:String(i+1),bodyworkBrand:'Marca QA',color:'Azul',busGroupId:groups[c],seatLayoutId:layout.id,seatLayoutVersion:layout.version};buses.push((await new PgBusRepository(pool).create({id:randomUUID(),cooperativeId:coops[c].id,data,configuration:createBusSeatConfiguration(data,layout),photos:[{fileKey:randomUUID(),contentType:'image/jpeg',size:100}]})).id);}
      const repo=new PgFrequencyRepository(pool);const first=await repo.create(coops[0].id,{origin:'Ambato',destination:'Quito',departure_time:'23:00',status:'ACTIVE',stops:['Latacunga'],segment_prices:[2,3],ant_resolution_number:'ANT-QA-EDITOR'});const second=await repo.create(coops[0].id,{origin:'Quito',destination:'Ambato',departure_time:'08:00',status:'ACTIVE',stops:[],segment_prices:[5.25],ant_resolution_number:'ANT-QA-EDITOR'});process.stdout.write(JSON.stringify({group:groups[0],buses,frequencies:[first.id,second.id]}));
    }finally{await pool.end();}})().catch(()=>{process.stderr.write('Falló preparación QA del editor.');process.exitCode=1;});`;
    const ids = JSON.parse(
      runtime.compose(["exec", "-T", "backend", "node", "-e", seed]),
    );
    const origin =
      "http://" + runtime.compose(["port", "frontend", "8080"]).trim();
    browser = await openBrowser(origin);
    await browser.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(()=>{const original=window.fetch.bind(window);window.qaEditorPuts=0;window.fetch=(input,init={})=>{const program=init.method==='PUT'&&String(input).endsWith('/programming'),tariff=init.method==='PUT'&&String(input).endsWith('/tariff');if(program||tariff)window.qaEditorPuts++;return original(input,init).then(response=>{if((program&&window.qaDropProgram)||(tariff&&window.qaDropTariff)){window.qaDropProgram=false;window.qaDropTariff=false;throw new TypeError('response lost after write');}return response;});};})();`,
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
    await browser.send("Page.navigate", {
      url: origin + "/pages/hojas-ruta.html",
    });
    await wait(
      browser,
      `document.querySelector('#status-panel')?.dataset.mode==='signed-out'`,
    );
    await login("a");
    const created = await api("/api/v1/route-sheets", {
      method: "POST",
      data: { busGroupId: ids.group, routeDate: "2030-01-01" },
    });
    assert.equal(created.ok, true);
    const sheetId = created.data.routeSheet.id,
      root = "/api/v1/route-sheets/" + sheetId;
    const mode = (value) =>
      wait(
        browser,
        `document.querySelector('#editor-status-panel')?.dataset.mode===${JSON.stringify(value)}`,
      );
    const open = async (value) => {
      await browser.send("Page.navigate", {
        url: origin + "/pages/programar-hoja.html?id=" + sheetId,
      });
      await mode(value);
    };
    const set = (selector, value) =>
      browser.evaluate(
        `(()=>{const input=document.querySelector(${JSON.stringify(selector)});if(!input)throw new Error('Campo QA ausente');input.value=${JSON.stringify(value)};input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`,
      );
    const click = (selector) =>
      browser.evaluate(
        `document.querySelector(${JSON.stringify(selector)}).click()`,
      );
    const button = (text, selector = "#program-fields-content") =>
      browser.evaluate(
        `(()=>{const button=Array.from(document.querySelector(${JSON.stringify(selector)}).querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(text)});if(!button)throw new Error('Acción QA ausente');button.click();})()`,
      );
    const review = async (kind) => {
      await browser.evaluate(
        `document.querySelector(${JSON.stringify(kind === "programming" ? "#program-form" : "#tariff-form")}).requestSubmit()`,
      );
      await mode("review");
    };
    const confirm = async (expected = "success") => {
      await click("#review-confirm");
      await mode(expected);
    };
    await open("ready");
    assert.equal(
      await browser.evaluate(
        `document.querySelectorAll('[data-field="newBus"] option').length`,
      ),
      3,
    );
    assert.equal(
      await browser.evaluate(`document.querySelectorAll('textarea').length`),
      0,
    );
    await set('[data-field="cycleLengthDays"]', "2");
    for (const frequencyId of ids.frequencies) {
      await set('[data-field="newFrequency"]', frequencyId);
      await button("Añadir servicio requerido");
    }
    const services = await browser.evaluate(
      `Array.from(document.querySelectorAll('.required-service')).map(n=>n.dataset.serviceId)`,
    );
    await set(
      `.required-service[data-service-id="${services[1]}"] [data-field="serviceDate"]`,
      "2030-01-02",
    );
    for (const busId of ids.buses.slice(0, 2)) {
      await set('[data-field="newBus"]', busId);
      await button("Añadir agenda de bus");
    }
    const a0 = '.bus-agenda[data-agenda="0"]',
      a1 = '.bus-agenda[data-agenda="1"]';
    for (const agenda of [a0, a1]) {
      await set(agenda + ' [data-field="availableAt"]', "2030-01-01T00:00");
      await set(agenda + ' [data-field="initialLocation"]', "Ambato");
    }
    for (const service of services) {
      await set(a0 + ' [data-field="serviceToAssign"]', service);
      await button("Asignar servicio al bus", a0);
    }
    const activity = (index) => a0 + ` [data-activity="${index}"]`;
    await set(activity(0) + ' [data-field="arrivalAt"]', "2030-01-02T02:00");
    await set(activity(0) + ' [data-field="preparationMinutes"]', "15");
    await set(
      activity(0) + ' [data-field="point-1-arrivalAt"]',
      "2030-01-02T00:15",
    );
    await set(
      activity(0) + ' [data-field="point-1-departureAt"]',
      "2030-01-02T00:30",
    );
    await set(activity(1) + ' [data-field="arrivalAt"]', "2030-01-02T10:00");
    await set(activity(1) + ' [data-field="preparationMinutes"]', "15");
    for (const [index, from, to, departure, arrival] of [
      [2, "Quito", "Latacunga", "02:15", "03:00"],
      [3, "Latacunga", "Quito", "03:30", "04:00"],
    ]) {
      await button("Añadir traslado", a0);
      for (const [field, value] of [
        ["transferOrigin", from],
        ["transferDestination", to],
        ["departureAt", "2030-01-02T" + departure],
        ["arrivalAt", "2030-01-02T" + arrival],
        ["preparationMinutes", "0"],
      ])
        await set(activity(index) + ` [data-field="${field}"]`, value);
    }
    async function addBlock(agenda, index, kind, start, end, reason) {
      await button("Añadir descanso o mantenimiento", agenda);
      for (const [field, value] of [
        ["blockKind", kind],
        ["blockStart", start],
        ["blockEnd", end],
        ["blockReason", reason],
      ])
        await set(
          agenda + ` [data-block="${index}"] [data-field="${field}"]`,
          value,
        );
    }
    await addBlock(
      a0,
      0,
      "MAINTENANCE",
      "2030-01-02T04:30",
      "2030-01-02T06:00",
      "Mantenimiento declarado",
    );
    await addBlock(
      a0,
      1,
      "REST",
      "2030-01-02T10:30",
      "2030-01-02T23:59",
      "Descanso declarado",
    );
    await addBlock(
      a1,
      0,
      "REST",
      "2030-01-01T00:00",
      "2030-01-02T23:59",
      "Descanso del segundo bus",
    );
    await review("programming");
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#review-content').textContent.includes('Latacunga')`,
      ),
      true,
    );
    assert.equal(
      await browser.evaluate(`document.activeElement.id`),
      "review-title",
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
      "review-cancel",
    );
    const contrasts = await browser.evaluate(`(()=>{
      const rgb=value=>value.match(/[0-9.]+/g).slice(0,3).map(Number);
      const luminance=color=>rgb(color).map(v=>{const c=v/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[0.2126,0.7152,0.0722][i],0);
      const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
      const body=getComputedStyle(document.body),note=getComputedStyle(document.querySelector('.editor-note')),button=getComputedStyle(document.querySelector('#review-confirm'));
      return [ratio(body.color,body.backgroundColor),ratio(note.color,body.backgroundColor),ratio(button.color,button.backgroundColor)];
    })()`);
    assert.equal(
      contrasts.every((value) => value >= 4.5),
      true,
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
    await mode("editing");
    assert.equal(await browser.evaluate(`window.qaEditorPuts`), 0);
    await review("programming");
    await confirm();
    const saved = (await api(root + "/editor")).data;
    assert.equal(saved.programming.revision, 1);
    assert.equal(saved.programming.programming.agendas.length, 2);
    assert.equal(
      saved.programming.programming.agendas
        .flatMap((a) => a.activities)
        .filter((a) => a.kind === "TRANSFER").length,
      2,
    );
    assert.deepEqual(
      saved.programming.programming.requiredServices.map((s) => s.id).sort(),
      services.slice().sort(),
    );
    for (const [key, value] of [
      ["vipSurchargeBps", "12.50"],
      ["minorDiscountBps", "50"],
      ["seniorDiscountBps", "40"],
      ["disabilityDiscountBps", "60"],
    ])
      await set(`[data-field="${key}"]`, value);
    const priceInputs = await browser.evaluate(
      `Array.from(document.querySelectorAll('#tariff-fields-content input[data-field^="price-"]')).map(n=>({field:n.dataset.field,label:document.querySelector('label[for="'+n.id+'"]').textContent}))`,
    );
    for (const p of priceInputs) {
      const amount = p.label.startsWith("Ambato → Quito")
        ? "4.50"
        : p.label.startsWith("Ambato → Latacunga")
          ? "2.00"
          : p.label.startsWith("Latacunga → Quito")
            ? "3.00"
            : "5.25";
      await set(`[data-field="${p.field}"]`, amount);
    }
    await review("tariff");
    await confirm();
    let context = (await api(root + "/editor")).data;
    assert.equal(context.tariff.revision, 1);
    assert.equal(context.programming.revision, 1);
    const price = context.tariff.tariff.frequencies
      .find((f) => f.frequencyId === ids.frequencies[0])
      .prices.find((p) => p.fromPosition === 0 && p.toPosition === 2);
    assert.equal(price.amountCents, 450);
    const identitySet = context.programming.programming.agendas
      .flatMap((a) => [...a.activities, ...a.blocks])
      .map((a) => a.id)
      .sort();
    await open("ready");
    assert.equal(
      await browser.evaluate(
        `Array.from(document.querySelectorAll('[data-field="serviceDate"]')).every(n=>n.readOnly)`,
      ),
      true,
    );
    const ownIndex = await browser.evaluate(
      `Array.from(document.querySelectorAll('.bus-agenda')).findIndex(n=>n.querySelector('[data-field="busId"]').value===${JSON.stringify(ids.buses[0])})`,
    );
    const own = `.bus-agenda[data-agenda="${ownIndex}"]`;
    const transferIndex = await browser.evaluate(
      `Array.from(document.querySelector(${JSON.stringify(own)}).querySelectorAll('.editor-activity[data-kind]')).find(n=>n.dataset.kind==='TRANSFER').dataset.activity`,
    );
    const preparation =
      own +
      ` [data-activity="${transferIndex}"] [data-field="preparationMinutes"]`;
    await set(preparation, "5");
    const otherWriter = await browser.evaluate(
      `(async()=>{const {createApiClient}=await import('/src/api/api-client.js');const {readEditor,programModel,programmingBody}=await import('/src/route-sheets/editor-model.js');const client=createApiClient();const source=await client.request(${JSON.stringify(root + "/editor")});const context=readEditor(source,source.sheet.id,source.sheet.cooperativeId);const body=programmingBody(programModel(context),context);body.programming.agendas.find(a=>a.busId===${JSON.stringify(ids.buses[0])}).activities.find(a=>a.kind==='TRANSFER').preparationMinutes=10;return (await client.request(${JSON.stringify(root + "/programming")},{method:'PUT',data:body})).revision;})()`,
    );
    assert.equal(otherWriter, 2);
    const beforeConflict = await browser.evaluate(`window.qaEditorPuts`);
    await review("programming");
    await confirm("conflict");
    assert.equal(await browser.evaluate(`window.qaEditorPuts`), beforeConflict);
    assert.equal(
      await browser.evaluate(
        `document.querySelector(${JSON.stringify(preparation)}).value`,
      ),
      "5",
    );
    await click("#editor-reload");
    await mode("review");
    await click("#review-confirm");
    await mode("ready");
    assert.equal(
      await browser.evaluate(
        `document.querySelector(${JSON.stringify(preparation)}).value`,
      ),
      "10",
    );
    await set(preparation, "5");
    await review("programming");
    await browser.evaluate(`window.qaDropProgram=true`);
    await confirm("uncertain");
    const beforeCheck = await browser.evaluate(`window.qaEditorPuts`);
    await click("#editor-check");
    await mode("success");
    assert.equal(await browser.evaluate(`window.qaEditorPuts`), beforeCheck);
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#program-version').textContent`,
      ),
      "3",
    );
    await set('[data-field="vipSurchargeBps"]', "0");
    await review("tariff");
    await browser.evaluate(`window.qaDropTariff=true`);
    await confirm("uncertain");
    const beforeTariffCheck = await browser.evaluate(`window.qaEditorPuts`);
    await click("#editor-check");
    await mode("success");
    assert.equal(
      await browser.evaluate(`window.qaEditorPuts`),
      beforeTariffCheck,
    );
    context = (await api(root + "/editor")).data;
    assert.equal(context.tariff.revision, 2);
    assert.equal(context.tariff.tariff.policy.vipSurchargeBps, 0);
    assert.deepEqual(
      context.programming.programming.agendas
        .flatMap((a) => [...a.activities, ...a.blocks])
        .map((a) => a.id)
        .sort(),
      identitySet,
    );
    await addBlock(
      own,
      2,
      "REST",
      "2030-01-02T00:00",
      "2030-01-02T01:00",
      "Conflicto deliberado QA",
    );
    await review("programming");
    await confirm("rejected");
    assert.equal((await api(root + "/editor")).data.programming.revision, 3);
    assert.equal(
      await browser.evaluate(
        `document.querySelector(${JSON.stringify(own + ' [data-block="2"] [data-field="blockReason"]')}).value`,
      ),
      "Conflicto deliberado QA",
    );
    await click("#editor-reload");
    await mode("review");
    await click("#review-confirm");
    await mode("ready");
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
          `document.documentElement.scrollWidth<=window.innerWidth`,
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
    // Publicación existente solo como preparación QA: no hay botón de publicación en 2.2.
    assert.equal(
      (await api(root + "/publish", { method: "POST", data: {} })).ok,
      true,
    );
    await click("#editor-reload");
    await mode("ready");
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#program-fields').disabled && document.querySelector('#tariff-fields').disabled`,
      ),
      true,
    );
    const beforeReadonly = await browser.evaluate(`window.qaEditorPuts`);
    await browser.evaluate(
      `document.querySelector('#program-form').requestSubmit()`,
    );
    assert.equal(await browser.evaluate(`window.qaEditorPuts`), beforeReadonly);
    await login("b");
    await click("#editor-reload");
    await mode("session-changed");
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#program-fields-content').textContent`,
      ),
      "",
    );
    assert.equal((await api(root + "/editor")).status, 404);
    await login("customer");
    await open("forbidden");
    assert.deepEqual(
      browser.outside.filter((value) => value !== "null"),
      [],
    );
    process.stdout.write(
      "ok: editor en imagen real, programación de dos buses, dos servicios, paradas tras medianoche, traslados, descanso/mantenimiento, tarifas por par, IDs, revisiones independientes, conflicto concurrente, respuestas perdidas sin reenvío, rollback, solo lectura, sesión/tenant/rol y reflujo\n",
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
            line.includes("at ") &&
            line.includes("route-sheet-editor-smoke.cjs"),
        )
        .join("\n") +
      "\nFalló QA del editor; datos sensibles omitidos.\n",
  );
  process.exitCode = 1;
});
