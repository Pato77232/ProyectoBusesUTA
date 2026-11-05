const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { start } = require("../../../backend/src/server");
const {
  createHasher,
} = require("../../../backend/src/modules/auth/infrastructure/password-hasher");
const PgBusRepository = require("../../../backend/src/modules/fleet/infrastructure/pg-bus.repository");
const {
  runMigration,
  testPool,
} = require("../../../backend/tests/helpers/database");
const {
  assertTestDatabase,
} = require("../../../backend/scripts/test-database");
const {
  fleetFixtures,
  busRequest,
} = require("../../../backend/tests/helpers/fleet-bus");
const fixtureFor = require("../../../backend/tests/helpers/route-programming");
const Browser = require("../../../backend/tests/helpers/session-browser");
const endpoint = "/api/v1/booking-benefit-requests";
const password = "benefit-request-qa-2030";
let pool,
  running,
  baseUrl,
  customer,
  another,
  clerk,
  foreign,
  admin,
  tripId,
  seatId,
  owner;

const assert = require("node:assert/strict");
const express = require("../../../backend/node_modules/express");
const nodePath = require("node:path");
const fs = require("node:fs/promises");
const { setTimeout: delay } = require("node:timers/promises");
const { openBrowser } = require("../helpers/browser.cjs");
let browser;
const checks = [];
async function until(expression, label) {
  for (let n = 0; n < 120; n++) {
    if (await browser.evaluate(expression)) return;
    await delay(60);
  }
  throw new Error("No se alcanzó: " + label);
}
async function navigate(url) {
  await browser.send("Page.navigate", { url });
  await until("document.readyState === 'complete'", "documento");
}
async function click(selector) {
  await browser.evaluate(
    `document.querySelector(${JSON.stringify(selector)}).click()`,
  );
}
async function login(email) {
  await browser.evaluate(`(async()=>{
 const csrf=await (await fetch('/api/v1/auth/csrf')).json();
 const response=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf.csrfToken},body:JSON.stringify({email:${JSON.stringify(email)},password:${JSON.stringify(password)}})});
 if(response.status!==200)throw new Error('Login QA fallido');
 })()`);
}
async function run() {
  assertTestDatabase();
  runMigration();
  pool = testPool();
  await pool.query(
    "TRUNCATE booking_benefit_requests,booking_guest_access_tokens,booking_benefit_reviews,booking_proof_receipt_results,booking_seat_allocations,bookings,booking_trip_locks",
  );
  await pool.query("TRUNCATE cooperatives,users,auth_sessions CASCADE");
  const probe = http.createServer();
  await new Promise((r) => probe.listen(0, "127.0.0.1", r));
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  running = await start({
    PORT: String(port),
    DATABASE_URL: assertTestDatabase(),
    NODE_ENV: "test",
    JWT_SECRET: "benefit-request-qa-secret-1234567890",
    BOOKING_EXPIRATION_ENABLED: "false",
  });
  baseUrl = `http://127.0.0.1:${port}`;
  const fixtures = await fleetFixtures(pool);
  owner = fixtures.first;
  const bus = await new PgBusRepository(pool).create(busRequest(owner));
  const fixture = fixtureFor({ ...owner, busId: bus.id, date: "2030-01-01" });
  for (const f of fixture.frequencies)
    await pool.query(
      `INSERT INTO frequencies(id,cooperative_id,origin,destination,departure_time,ant_resolution_number)
    VALUES($1,$2,$3,$4,$5,'ANT-QA')`,
      [f.id, owner.cooperativeId, f.origin, f.destination, f.departureTime],
    );
  const hash = await (await createHasher()).hash(password);
  for (const [email, role, tenant] of [
    ["benefit-admin@example.ec", "COOPERATIVE_ADMIN", owner.cooperativeId],
    ["benefit-customer@example.ec", "CUSTOMER", null],
    ["benefit-another@example.ec", "CUSTOMER", null],
    ["benefit-clerk@example.ec", "CLERK", owner.cooperativeId],
    ["benefit-foreign@example.ec", "CLERK", fixtures.second.cooperativeId],
  ])
    await pool.query(
      "INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,$3,$4)",
      [email, hash, role, tenant],
    );
  admin = new Browser(baseUrl);
  customer = new Browser(baseUrl);
  another = new Browser(baseUrl);
  clerk = new Browser(baseUrl);
  foreign = new Browser(baseUrl);
  for (const [browser, email] of [
    [admin, "benefit-admin@example.ec"],
    [customer, "benefit-customer@example.ec"],
    [another, "benefit-another@example.ec"],
    [clerk, "benefit-clerk@example.ec"],
    [foreign, "benefit-foreign@example.ec"],
  ])
    await browser.login(email, password);
  const created = await admin.request("/api/v1/route-sheets", "POST", {
    busGroupId: owner.busGroupId,
    routeDate: "2030-01-01",
  });
  assert.equal(created.status, 201);
  const path = "/api/v1/route-sheets/" + (await created.json()).routeSheet.id;
  assert.equal(
    (await admin.request(path + "/programming", "PUT", fixture.body)).status,
    200,
  );
  assert.equal(
    (
      await admin.request(path + "/tariff", "PUT", {
        expectedRevision: 0,
        policy: {
          vipSurchargeBps: 2500,
          minorDiscountBps: 5000,
          seniorDiscountBps: 5000,
          disabilityDiscountBps: 5000,
        },
        frequencies: fixture.frequencies.map((f) => ({
          frequencyId: f.id,
          prices: [{ fromPosition: 0, toPosition: 1, amountCents: 450 }],
        })),
      })
    ).status,
    200,
  );
  const published = await admin.request(path + "/publish", "POST", {});
  assert.equal(published.status, 200);
  tripId = (await published.json()).routeSheet.commercial.tripIds[0];
  const availability = await customer.request(
    `/api/v1/bookings/availability?tripId=${tripId}&fromPosition=0&toPosition=1`,
  );
  assert.equal(availability.status, 200);
  seatId = (await availability.json()).seats[0].seatId;
  const backend = running.server.listeners("request")[0];
  running.server.removeListener("request", backend);
  const app = express();
  app.use((req, res, next) =>
    req.path.startsWith("/api/") ? backend(req, res, next) : next(),
  );
  app.use(express.static(nodePath.resolve(__dirname, "../..")));
  running.server.on("request", app);
  browser = await openBrowser(baseUrl);
  await login("benefit-customer@example.ec");
  const purchaseUrl =
    baseUrl +
    "/pages/reservas.html?tripId=" +
    tripId +
    "&fromPosition=0&toPosition=1";
  await navigate(purchaseUrl);
  await until(
    "document.querySelectorAll('.booking-seat').length>0",
    "asientos reales",
  );
  await click(".booking-seat");
  await browser.evaluate(
    `(()=>{const values={fullName:'Persona QA <img src=x onerror=alert(1)>',identificationNumber:'0100000009',birthDate:'1990-01-01'};for(const [key,value] of Object.entries(values)){const n=document.querySelector('[data-field="'+key+'"]');n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));}})()`,
  );
  await click("#review-button");
  await until(
    "document.getElementById('booking-notice').textContent.includes('acreditación')",
    "total bloqueado",
  );
  await click("#request-benefit");
  await until(
    "document.getElementById('benefit-buyer-status').textContent.includes('Solicitud recibida')",
    "solicitud creada",
  );
  const stored = await pool.query(
    "SELECT id,status,purchase FROM booking_benefit_requests",
  );
  assert.equal(stored.rowCount, 1);
  assert.equal(stored.rows[0].status, "PENDING");
  checks.push("Compra real solicita acreditación sin reservar asientos");
  await login("benefit-clerk@example.ec");
  await navigate(baseUrl + "/pages/acreditaciones.html");
  await until(
    "document.querySelectorAll('.benefit-item').length===1",
    "bandeja real",
  );
  await click(".benefit-item");
  await until(
    "document.querySelectorAll('.benefit-passenger').length===1",
    "detalle real",
  );
  assert.equal(
    await browser.evaluate(
      "document.querySelector('#benefit-fields img')===null",
    ),
    true,
  );
  assert.equal(
    await browser.evaluate(
      "document.querySelector('[data-check=birth]').checked",
    ),
    false,
  );
  assert.equal(
    await browser.evaluate(
      "document.querySelector('[data-reference=birth]').disabled",
    ),
    true,
  );
  checks.push("Detalle presenta texto hostil sin HTML; casillas sin verificar");
  if (process.env.QA_OUTPUT_DIR) {
    await fs.mkdir(process.env.QA_OUTPUT_DIR, { recursive: true });
    for (const width of [1280, 360]) {
      await browser.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 950,
        deviceScaleFactor: 1,
        mobile: false,
      });
      assert.equal(
        await browser.evaluate(
          "document.documentElement.scrollWidth<=innerWidth",
        ),
        true,
      );
      const shot = await browser.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
      });
      await fs.writeFile(
        nodePath.join(
          process.env.QA_OUTPUT_DIR,
          "formulario-" + width + ".png",
        ),
        Buffer.from(shot.data, "base64"),
      );
    }
  }
  async function press(key) {
    const code = key === "Tab" ? 9 : key === "Enter" ? 13 : 32;
    for (const type of ["keyDown", "keyUp"])
      await browser.send("Input.dispatchKeyEvent", {
        type,
        key,
        code: key === " " ? "Space" : key,
        windowsVirtualKeyCode: code,
        ...(type === "keyDown" && key === "Enter" ? { text: "\r" } : {}),
      });
  }
  await browser.evaluate(
    "document.querySelector('[data-check=birth]').focus()",
  );
  await press(" ");
  assert.equal(
    await browser.evaluate(
      "document.querySelector('[data-check=birth]').checked",
    ),
    true,
  );
  await press("Tab");
  assert.equal(
    await browser.evaluate(
      "document.activeElement.matches('[data-kind=birth]')",
    ),
    true,
  );
  await press("Tab");
  assert.equal(
    await browser.evaluate(
      "document.activeElement.matches('[data-reference=birth]')",
    ),
    true,
  );
  await browser.send("Input.insertText", { text: "ref_identidad_qa" });
  await press("Tab");
  assert.equal(
    await browser.evaluate(
      "document.activeElement.matches('[data-check=disability]')",
    ),
    true,
  );
  await press("Tab");
  assert.equal(
    await browser.evaluate("document.activeElement.id==='confirmed-context'"),
    true,
  );
  await press(" ");
  await press("Tab");
  assert.equal(
    await browser.evaluate("document.activeElement.id==='save-benefits'"),
    true,
  );
  assert.equal(
    await browser.evaluate(
      "getComputedStyle(document.activeElement).outlineStyle!=='none'",
    ),
    true,
  );
  await press("Enter");
  await until(
    "document.getElementById('benefit-status').textContent.includes('Verificación guardada')",
    "revisión persistida",
  );
  assert.equal(
    await browser.evaluate(
      "document.querySelectorAll('.benefit-passenger').length",
    ),
    1,
  );
  assert.equal(
    await browser.evaluate(
      "document.querySelector('#benefit-fields img')===null",
    ),
    true,
  );
  const saved = await pool.query(
    "SELECT status,revision,review_decisions FROM booking_benefit_requests",
  );
  assert.equal(saved.rows[0].status, "REVIEWED");
  assert.equal(saved.rows[0].revision, 2);
  assert.equal(
    (await pool.query("SELECT count(*)::int n FROM booking_benefit_reviews"))
      .rows[0].n,
    1,
  );
  checks.push(
    "Guardado por teclado persiste revisión y fuente de cotización una sola vez",
  );
  const output = process.env.QA_OUTPUT_DIR;
  if (output) await fs.mkdir(output, { recursive: true });
  for (const width of [1280, 360]) {
    await browser.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 950,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await delay(150);
    assert.equal(
      await browser.evaluate(
        "document.documentElement.scrollWidth<=innerWidth",
      ),
      true,
    );
    if (output) {
      const shot = await browser.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
      });
      await fs.writeFile(
        nodePath.join(output, "acreditacion-" + width + ".png"),
        Buffer.from(shot.data, "base64"),
      );
    }
  }
  // Ampliación CSS 200 % en escritorio; no se atribuye revisión manual del menú de Chrome.
  await browser.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.evaluate("document.documentElement.style.zoom='200%'");
  assert.equal(
    await browser.evaluate("document.documentElement.scrollWidth<=innerWidth"),
    true,
  );
  assert.equal(
    await browser.evaluate(
      "document.querySelector('#refresh-benefits').getBoundingClientRect().width>0",
    ),
    true,
  );
  if (output) {
    const shot = await browser.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
    });
    await fs.writeFile(
      nodePath.join(output, "acreditacion-zoom200.png"),
      Buffer.from(shot.data, "base64"),
    );
  }
  await browser.evaluate("document.documentElement.style.zoom=''");
  checks.push("Reflujo 360/1280 y ampliación CSS 200 % sin scroll horizontal");
  assert.equal(
    await browser.evaluate(
      "Object.keys(localStorage).length===0 && !Object.keys(sessionStorage).some(k=>/benefit|acredit/i.test(k)) && !location.search",
    ),
    true,
  );
  const customerResult = await (
    await customer.request(endpoint + "/" + stored.rows[0].id)
  ).json();
  assert.equal(
    JSON.stringify(customerResult).includes("ref_identidad_qa"),
    false,
  );
  assert.equal(JSON.stringify(customerResult).includes("reviewedBy"), false);
  await login("benefit-customer@example.ec");
  await click("#refresh-benefits");
  await until(
    "document.getElementById('benefit-detail').hidden && document.querySelectorAll('.benefit-item').length===0",
    "limpieza por cambio de rol",
  );
  checks.push(
    "Cambio de cuenta retira datos privados; comprador no recibe evidencia ni actor",
  );
  await navigate(purchaseUrl);
  await until(
    "document.querySelectorAll('.booking-seat').length>0",
    "volver a compra",
  );
  await click(".booking-seat");
  await browser.evaluate(
    `(()=>{const values=${JSON.stringify(stored.rows[0].purchase.passengers[0])};for(const key of ['fullName','identificationNumber','birthDate']){const n=document.querySelector('[data-field="'+key+'"]');n.value=values[key];n.dispatchEvent(new Event('input',{bubbles:true}));}})()`,
  );
  await click("#review-button");
  await until(
    "!document.getElementById('summary-panel').hidden",
    "resumen real acreditado",
  );
  assert.equal(
    (await pool.query("SELECT count(*)::int n FROM bookings")).rows[0].n,
    0,
  );
  checks.push(
    "Resumen autorizado desde acreditación real; cero reservas/ocupaciones creadas por revisar",
  );
  // Bootstrap incluye SVG data: locales, cuyo origen URL es null. Ninguno solicita red externa.
  assert.deepEqual(
    browser.outside.filter((origin) => origin !== "null"),
    [],
  );
  console.log(
    JSON.stringify({
      checks,
      externalRequests: browser.outside.filter((origin) => origin !== "null")
        .length,
    }),
  );
}
run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    if (running) await running.stop();
    if (pool) await pool.end();
  });
