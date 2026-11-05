// Smoke visual del inventario con respuestas ficticias de navegador; no usa API ni BD.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const zlib = require("node:zlib");
const { setTimeout: delay } = require("node:timers/promises");
const { openBrowser } = require("../helpers/browser.cjs");

const root = path.resolve(__dirname, "../..");
const evidence = path.resolve(root, "../docs/evidence/FLEET-10");
const BUS_ID = "33333333-3333-4333-8333-333333333333";
const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "COOPERATIVE_ADMIN",
  cooperative_id: "22222222-2222-4222-8222-222222222222",
};
const PHOTO_ID = "66666666-6666-4666-8666-666666666666";
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(name, data) {
  const type = Buffer.from(name);
  const content = Buffer.concat([type, data]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(content));
  return Buffer.concat([size, content, checksum]);
}

function createQaPhoto() {
  const width = 320;
  const height = 180;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const row = Buffer.alloc(1 + width * 4);
  for (let x = 0; x < width; x += 1) {
    row[1 + x * 4] = 102;
    row[2 + x * 4] = 71;
    row[3 + x * 4] = 240;
    row[4 + x * 4] = 255;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const PNG = createQaPhoto();
const SUMMARY = {
  id: BUS_ID,
  plate: "TBM-0013",
  unitNumber: 1,
  busGroupId: "44444444-4444-4444-8444-444444444444",
  busGroupName: "Rutas largas",
  capacity: 1,
  photoCount: 1,
};
const DETAIL = {
  id: BUS_ID,
  plate: "TBM-0013",
  vin: "VIN-FICTICIO-0013",
  unitNumber: 1,
  bodyworkBrand: "Carrocería de prueba",
  color: "Blanco",
  busGroup: { id: SUMMARY.busGroupId, name: SUMMARY.busGroupName },
  seatLayout: { id: "DOS_PISOS_QA", version: 1, snapshot: {} },
  capacity: 1,
  seats: [
    {
      seatId: "55555555-5555-4555-8555-555555555555",
      layoutSeatKey: "espacio-accesible-qa",
      label: 1,
      deck: 1,
      row: 0,
      column: 0,
      category: "ACCESSIBLE",
      offered: false,
    },
  ],
  photos: [
    { id: PHOTO_ID, contentType: "image/png", size: PNG.length, order: 0 },
  ],
};
const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ttf": "font/ttf",
};

async function serve(request, response) {
  const { pathname } = new URL(request.url, "http://127.0.0.1");
  if (pathname === `/api/v1/buses/${BUS_ID}/photos/${PHOTO_ID}`) {
    response.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
    });
    response.end(PNG);
    return;
  }
  const file = path.resolve(
    root,
    `.${pathname === "/" ? "/index.html" : pathname}`,
  );
  if (!file.startsWith(root + path.sep)) {
    response.writeHead(404).end();
    return;
  }
  try {
    response.writeHead(200, {
      "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
    });
    response.end(await fs.readFile(file));
  } catch {
    response.writeHead(404).end();
  }
}

async function wait(browser, expression) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await browser.evaluate(expression)) return;
    await delay(50);
  }
  throw new Error("La pantalla de inventario no alcanzó el estado esperado.");
}

async function screenshot(browser, filename) {
  const result = await browser.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  await fs.writeFile(
    path.join(evidence, filename),
    Buffer.from(result.data, "base64"),
  );
}

async function main() {
  const server = http.createServer(serve);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await openBrowser(origin);
  await fs.mkdir(evidence, { recursive: true });
  try {
    await browser.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        window.qaCalls = [];
        window.fetch = async (input, options = {}) => {
          const requestUrl = new URL(typeof input === 'string' ? input : input.url, location.href);
          const method = options.method || 'GET';
          window.qaCalls.push({ path: requestUrl.pathname, method });
          let body;
          if (requestUrl.pathname === '/api/v1/auth/me') body = { user: ${JSON.stringify(USER)} };
          else if (requestUrl.pathname === '/api/v1/buses') body = { buses: [${JSON.stringify(SUMMARY)}] };
          else if (requestUrl.pathname === '/api/v1/buses/${BUS_ID}') body = { bus: ${JSON.stringify(DETAIL)} };
          else throw new Error('Ruta de API QA no esperada');
          return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
        };
      `,
    });
    await browser.send("Page.navigate", { url: `${origin}/pages/buses.html` });
    await wait(
      browser,
      `document.querySelector('#bus-inventory a')?.textContent === 'Ver detalle del bus'`,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelectorAll('#bus-inventory article').length`,
      ),
      1,
    );
    await browser.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    assert.ok(
      (await browser.evaluate("document.documentElement.scrollWidth")) <= 1280,
    );
    await screenshot(browser, "inventario-1280.png");

    await browser.evaluate(
      `sessionStorage.setItem('fleet10ListCalls', JSON.stringify(window.qaCalls))`,
    );
    await browser.evaluate(
      `document.querySelector('#bus-inventory a').focus()`,
    );
    await browser.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Enter",
      code: "Enter",
    });
    await browser.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Enter",
      code: "Enter",
    });
    await wait(
      browser,
      `document.querySelector('#inventory-title')?.textContent.includes('Detalle del bus')`,
    );
    await wait(
      browser,
      `document.querySelector('#bus-inventory img')?.complete`,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#bus-inventory img').naturalWidth`,
      ),
      320,
    );
    assert.equal(
      await browser.evaluate(`document.body.innerText.includes('Accesible')`),
      true,
    );
    await browser.send("Emulation.setDeviceMetricsOverride", {
      width: 360,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
    assert.ok(
      (await browser.evaluate("document.documentElement.scrollWidth")) <= 360,
    );
    await screenshot(browser, "detalle-360.png");
    assert.deepEqual(
      await browser.evaluate(
        `JSON.parse(sessionStorage.getItem('fleet10ListCalls')).concat(window.qaCalls).map(({ path }) => path)`,
      ),
      [
        "/api/v1/auth/me",
        "/api/v1/buses",
        "/api/v1/auth/me",
        `/api/v1/buses/${BUS_ID}`,
      ],
    );
    assert.deepEqual(
      browser.outside.filter((source) => source !== "null"),
      [],
    );
    console.log(
      "Inventario y detalle con teclado, foto privada simulada, 1280 px y 360 px: aprobados.",
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
