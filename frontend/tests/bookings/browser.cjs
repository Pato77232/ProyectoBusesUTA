// BOOK-03: navegador real + API/PostgreSQL reales; solo catálogo/acreditación son fixtures.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");
const express = require("../../../backend/node_modules/express");
const jwt = require("../../../backend/node_modules/jsonwebtoken");
const { openBrowser } = require("../helpers/browser.cjs");
const createApp = require("../../../backend/src/app");
const { createAuthModule } = require("../../../backend/src/modules/auth");
const {
  createBookingsModule,
} = require("../../../backend/src/modules/bookings");
const BookingServiceUnavailableError = require("../../../backend/src/modules/bookings/domain/booking-service-unavailable-error");
const {
  runMigration,
  testPool,
} = require("../../../backend/tests/helpers/database");
const {
  assertTestDatabase,
} = require("../../../backend/scripts/test-database");
const {
  summaryContext,
} = require("../../../backend/tests/unit/bookings/helpers/booking-summary-fixtures");

const root = path.resolve(__dirname, "../..");
const output = path.resolve(
  process.env.QA_OUTPUT_DIR || path.join(os.tmpdir(), "book03-screen-qa"),
);
const storageKey = "transviaje.bookings.attempt";
const env = {
  JWT_SECRET: "secreto-ficticio-qa-de-pantalla-1234567890123",
  BOOKING_PROOF_WINDOW_SECONDS: "180",
};
let pool;
let server;
let browser;
let createCalls = 0;
let dropReply = false;
let catalogEnabled = true;
const checks = [];

async function until(expression, label) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await browser.evaluate(expression)) return;
    await delay(50);
  }
  throw new Error("No se alcanzó el estado de QA: " + label);
}
async function navigate(url) {
  await browser.send("Page.navigate", { url });
  await until(
    "document.readyState === 'complete' && document.body.classList.contains('booking-page') && !document.getElementById('booking-notice').textContent.includes('Preparando')",
    "página preparada",
  );
}
async function press(key) {
  const code = { Tab: 9, Enter: 13, " ": 32 }[key];
  for (const type of ["keyDown", "keyUp"])
    await browser.send("Input.dispatchKeyEvent", {
      type,
      key,
      code: key === " " ? "Space" : key,
      windowsVirtualKeyCode: code,
      nativeVirtualKeyCode: code,
      ...(type === "keyDown" && key === "Enter" ? { text: "\r" } : {}),
    });
}
async function activate(selector) {
  await browser.evaluate(
    "document.querySelector(" + JSON.stringify(selector) + ").focus()",
  );
  await press("Enter");
}
async function fill(values) {
  await browser.evaluate(`(() => {
    const values = ${JSON.stringify(values)};
    for (const [field,value] of Object.entries(values)) {
      const input = document.querySelector('[data-field="' + field + '"]');
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  })()`);
}
async function screenshot(name) {
  await browser.evaluate("document.fonts.ready");
  const layout = await browser.send("Page.getLayoutMetrics");
  const size = layout.cssContentSize;
  const result = await browser.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width: Math.ceil(size.width),
      height: Math.ceil(size.height),
      scale: 1,
    },
  });
  await fs.writeFile(
    path.join(output, name + ".png"),
    Buffer.from(result.data, "base64"),
  );
}
async function viewport(width) {
  await browser.send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await delay(80);
  assert.equal(
    await browser.evaluate(
      "document.documentElement.scrollWidth <= innerWidth + 1",
    ),
    true,
    "La pantalla no debe desbordar horizontalmente",
  );
}
function luminance(rgb) {
  const values = rgb
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number)
    .map((value) => {
      const channel = value / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
async function contrast() {
  const rows = await browser.evaluate(`[...document.querySelectorAll(
    '.booking-panel p,.booking-panel label,.booking-panel h2,.booking-button,.booking-kicker,.booking-notice,.booking-summary-passengers small,.booking-steps li'
  )].filter(element => element.getBoundingClientRect().height > 0).map(element => {
    let parent = element;
    let background;
    while (parent) {
      const value = getComputedStyle(parent).backgroundColor;
      if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') { background = value; break; }
      parent = parent.parentElement;
    }
    return { selector: element.tagName + '.' + element.className,
      color: getComputedStyle(element).color, background: background || 'rgb(255, 255, 255)' };
  })`);
  for (const row of rows) {
    const light = luminance(row.color);
    const dark = luminance(row.background);
    const ratio =
      (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
    assert.ok(
      ratio >= 4.5,
      "Contraste insuficiente: " + row.selector + " = " + ratio.toFixed(2),
    );
  }
}

async function main() {
  assertTestDatabase();
  runMigration();
  pool = testPool();
  await pool.query(
    "TRUNCATE auth_sessions, users, booking_seat_allocations, bookings, booking_trip_locks",
  );
  const userId = randomUUID();
  const sid = randomUUID();
  await pool.query(
    `INSERT INTO users(id,email,password_hash,role)
    VALUES($1,'qa-reservas-ficticio@example.ec','hash-fixture-no-usado','CUSTOMER')`,
    [userId],
  );
  await pool.query(
    `INSERT INTO auth_sessions(id,user_id,expires_at)
    VALUES($1,$2,CURRENT_TIMESTAMP+interval '1 hour')`,
    [sid, userId],
  );
  const token = jwt.sign(
    { sub: userId, sid, role: "CUSTOMER", cooperative_id: null },
    env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "30m" },
  );
  const fixture = summaryContext();
  const trip = fixture.trip;
  trip.departureDate = new Date(Date.now() + 86400000)
    .toISOString()
    .slice(0, 10);
  const auth = await createAuthModule({ pool, env });
  const bookings = createBookingsModule({
    pool,
    auth,
    env,
    tripCatalog: {
      async findBookableById(id) {
        if (!catalogEnabled) throw new BookingServiceUnavailableError();
        return id === trip.tripId
          ? {
              ...trip,
              seatIds: [...trip.seatIds],
              segmentPricesCents: [...trip.segmentPricesCents],
            }
          : null;
      },
    },
    passengerVerifier: {
      async verify({ passengers }) {
        return passengers.map(({ seatId }) => ({
          seatId,
          birthDateVerified: true,
          disabilityVerified: false,
        }));
      },
    },
  });
  const backend = createApp({ auth, bookings, pool });
  const app = express();
  app.use((req, res, next) => {
    if (req.method === "POST" && req.path === "/api/v1/bookings") {
      createCalls += 1;
      if (dropReply) {
        dropReply = false;
        const originalEnd = res.end.bind(res);
        res.end = (...args) => {
          if (res.statusCode !== 201) return originalEnd(...args);
          // Proxy de QA: pierde el 201 después del COMMIT y responde 502.
          res.statusCode = 502;
          res.removeHeader("Content-Length");
          res.setHeader("Content-Type", "application/json");
          return originalEnd(
            JSON.stringify({
              error: {
                code: "QA_GATEWAY_FAILURE",
                message: "Respuesta de confirmación perdida en QA.",
              },
            }),
          );
        };
      }
    }
    if (req.path.startsWith("/api/")) return backend(req, res, next);
    next();
  });
  app.use(express.static(root));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const pageUrl =
    origin +
    "/pages/reservas.html?tripId=viaje-prueba&fromPosition=1&toPosition=3";
  await fs.mkdir(output, { recursive: true });
  browser = await openBrowser(origin);
  await browser.send("Network.setCacheDisabled", { cacheDisabled: true });
  await viewport(1280);
  await navigate(origin + "/pages/reservas.html");
  assert.match(
    await browser.evaluate(
      "document.getElementById('booking-notice').textContent",
    ),
    /Elige primero un viaje/,
  );
  checks.push("Entrada sin viaje no inventa catálogo");
  await navigate(pageUrl);
  await until(
    "document.getElementById('booking-notice').textContent.includes('sesión de cliente')",
    "sesión requerida",
  );
  assert.equal(
    await browser.evaluate("document.querySelectorAll('.booking-seat').length"),
    0,
  );
  checks.push("401 sin compra ni asientos inventados");
  await browser.send("Network.setCookie", {
    name: "access_token",
    value: token,
    url: origin,
    httpOnly: true,
    sameSite: "Lax",
  });
  await navigate(pageUrl);
  await until(
    "document.querySelectorAll('.booking-seat').length === 3",
    "asientos reales de fixture",
  );
  await press("Tab");
  assert.equal(
    await browser.evaluate(
      "document.activeElement.classList.contains('skip-link')",
    ),
    true,
  );
  assert.notEqual(
    await browser.evaluate(
      "getComputedStyle(document.activeElement).outlineStyle",
    ),
    "none",
  );
  await press("Enter");
  assert.equal(
    await browser.evaluate("document.activeElement.id"),
    "contenido",
  );
  for (let count = 0; count < 20; count += 1) {
    if (
      await browser.evaluate("document.activeElement.dataset.seatId === '01'")
    )
      break;
    await press("Tab");
  }
  assert.equal(
    await browser.evaluate("document.activeElement.dataset.seatId"),
    "01",
  );
  await press("Enter");
  await until(
    "!document.getElementById('passenger-form').hidden",
    "pasajero seleccionado",
  );
  await fill({
    fullName: "Pasajera de Prueba",
    identificationNumber: "0100000009",
    birthDate: "1990-01-01",
  });
  await activate("#review-button");
  await until(
    "!document.getElementById('summary-panel').hidden",
    "resumen del servidor",
  );
  assert.equal(
    await browser.evaluate(
      "document.getElementById('confirm-booking').disabled",
    ),
    true,
  );
  await screenshot("reservas-escritorio-resumen");
  await contrast();
  await viewport(360);
  await screenshot("reservas-movil-resumen");
  await viewport(1280);
  await browser.evaluate("document.documentElement.style.zoom='2'");
  await delay(80);
  assert.equal(
    await browser.evaluate(
      "document.documentElement.scrollWidth <= innerWidth+1",
    ),
    true,
  );
  await screenshot("reservas-contenido-200");
  await browser.evaluate("document.documentElement.style.zoom='1'");
  checks.push(
    "Teclado, foco, aceptación obligatoria, contraste y reflujo 360/1280/200% CSS",
  );

  trip.segmentPricesCents[1] += 100;
  await browser.evaluate("document.getElementById('accept-summary').focus()");
  await press(" ");
  await activate("#confirm-booking");
  await until(
    "document.getElementById('booking-notice').textContent.includes('resumen cambió')",
    "rechazo de precio cambiado",
  );
  assert.equal(
    await browser.evaluate(
      "document.querySelector('[data-field=fullName]').value",
    ),
    "Pasajera de Prueba",
  );
  assert.equal(
    await browser.evaluate("document.getElementById('accept-summary').checked"),
    false,
  );
  assert.equal((await pool.query("SELECT * FROM bookings")).rows.length, 0);
  await activate("#review-button");
  await until(
    "!document.getElementById('summary-panel').hidden",
    "nuevo resumen",
  );
  assert.equal(
    await browser.evaluate(
      "document.getElementById('confirm-booking').disabled",
    ),
    true,
  );
  checks.push("Cambio de tarifa conserva datos y exige nueva aceptación");

  dropReply = true;
  await browser.evaluate("document.getElementById('accept-summary').focus()");
  await press(" ");
  await activate("#confirm-booking");
  await browser.evaluate("document.getElementById('confirm-booking').click()");
  await until(
    "!document.getElementById('pending-panel').hidden && document.getElementById('booking-notice').textContent.includes('No pudimos confirmar')",
    "respuesta perdida tras COMMIT",
  );
  const { rows } = await pool.query("SELECT id,expires_at FROM bookings");
  assert.equal(rows.length, 1);
  const reference = await browser.evaluate(
    "sessionStorage.getItem(" + JSON.stringify(storageKey) + ")",
  );
  assert.match(reference, /^[0-9a-f-]{36}$/);
  const persisted = await browser.evaluate(
    "JSON.stringify(Object.entries(sessionStorage))",
  );
  assert.doesNotMatch(
    persisted,
    /Pasajera|0100000009|1990-01-01|csrf|access_token/,
  );
  const callsBefore = createCalls;
  await browser.send("Page.reload", { ignoreCache: true });
  await until(
    "!document.getElementById('receipt-panel').hidden",
    "recuperación tras recarga",
  );
  assert.equal(
    createCalls,
    callsBefore,
    "Recargar consulta GET, no repite compra",
  );
  assert.equal(
    await browser.evaluate(
      "document.getElementById('booking-reference').textContent",
    ),
    rows[0].id,
  );
  assert.equal(
    await browser.evaluate(
      "document.getElementById('booking-expiry').dateTime",
    ),
    rows[0].expires_at.toISOString(),
  );
  assert.equal(
    (await pool.query("SELECT * FROM booking_seat_allocations")).rows.length,
    1,
  );
  await screenshot("reservas-recuperada");
  checks.push(
    "COMMIT real, respuesta perdida, doble envío bloqueado y recuperación tras recarga sin PII almacenada",
  );

  await browser.evaluate(
    "sessionStorage.removeItem(" + JSON.stringify(storageKey) + ")",
  );
  catalogEnabled = false;
  await navigate(pageUrl);
  await until(
    "document.getElementById('booking-notice').textContent.includes('todavía no está disponible')",
    "503 sin catálogo",
  );
  assert.equal(
    await browser.evaluate("document.querySelectorAll('.booking-seat').length"),
    0,
  );
  await viewport(360);
  await screenshot("reservas-no-disponible");
  assert.equal(
    await browser.evaluate(
      "document.getElementById('retry-availability').hidden",
    ),
    false,
  );
  catalogEnabled = true;
  await activate("#retry-availability");
  await until(
    "document.querySelectorAll('.booking-seat').length === 3",
    "recuperación tras servicio disponible",
  );
  checks.push("503 sin inventario ficticio y botón visible de nueva consulta");
  assert.deepEqual(
    browser.outside.filter((origin) => origin !== "null"),
    [],
    "Todas las solicitudes HTTP de la página son del mismo origen",
  );
  process.stdout.write(
    JSON.stringify({
      checks,
      output,
      zoom: "200% de contenido mediante CSS; zoom nativo y lector de pantalla pendientes",
    }) + "\n",
  );
}

main()
  .catch(async (error) => {
    if (browser) await screenshot("reservas-error-qa").catch(() => {});
    process.stderr.write(error.stack + "\n");
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (pool) await pool.end();
  });
