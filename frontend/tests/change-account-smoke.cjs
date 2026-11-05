const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const { createRuntime } = require("../scripts/dev-runtime.cjs");
const { openBrowser } = require("./helpers/browser.cjs");

async function wait(browser, expression) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await browser.evaluate(expression)) return;
    await delay(50);
  }
  throw new Error("Estado de cambio de cuenta no alcanzado.");
}

async function main() {
  const runtime = createRuntime({
    port: 0,
    project: "transviaje-frontend-qa-cambio-cuenta",
  });
  let owned = false,
    browser;
  try {
    assert.equal(runtime.exists(), false);
    owned = true;
    runtime.compose(["up", "-d", "--build", "--wait", "--wait-timeout", "120"]);
    const accounts = {
      admin: randomUUID() + "@qa.invalid",
      customer: randomUUID() + "@qa.invalid",
      password: randomUUID() + "-QA",
    };
    const provision = `
      const fs = require('node:fs');
      const { Client } = require('pg');
      const { createHasher } = require('./src/modules/auth/infrastructure/password-hasher');
      (async () => {
        const qa = JSON.parse(fs.readFileSync(0, 'utf8'));
        const hash = await (await createHasher()).hash(qa.password);
        const c = new Client({ connectionString: process.env.DATABASE_URL });
        await c.connect();
        try { await c.query("INSERT INTO users(email,password_hash,role) VALUES($1,$3,'SYSTEM_ADMIN'),($2,$3,'CUSTOMER')", [qa.admin,qa.customer,hash]); }
        finally { await c.end(); }
      })().catch(() => { process.stderr.write('No se pudieron preparar usuarios QA.'); process.exitCode = 1; });
    `;
    runtime.compose(["exec", "-T", "backend", "node", "-e", provision], {
      input: JSON.stringify(accounts),
    });
    const origin =
      "http://" + runtime.compose(["port", "frontend", "8080"]).trim();
    browser = await openBrowser(origin);
    await browser.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
      window.qaLogoutCalls = 0;
      window.qaLoseLogout = false;
      const original = window.fetch.bind(window);
      window.fetch = async (url, options = {}) => {
        if (window.qaLoseLogout && String(url).endsWith('/auth/logout')) {
          qaLogoutCalls++;
          await new Promise(resolve => setTimeout(resolve, 200));
          await original(url, options);
          window.qaLoseLogout = false;
          throw new TypeError('Respuesta perdida solo en QA');
        }
        return original(url, options);
      };
    `,
    });
    await browser.send("Page.navigate", { url: origin + "/pages/login.html" });
    await wait(
      browser,
      `!!document.querySelector('fieldset') && !document.querySelector('fieldset').disabled`,
    );
    await browser.evaluate(`window.qa = ${JSON.stringify(accounts)}`);
    async function login(kind) {
      await browser.evaluate(`(() => {
        document.querySelector('#login-email').value = qa.${kind};
        document.querySelector('#login-password').value = qa.password;
        document.querySelector('form').requestSubmit();
      })()`);
      await wait(
        browser,
        `document.querySelector('#session-email').textContent === qa.${kind}`,
      );
    }
    await login("admin");
    assert.equal(
      await browser.evaluate(
        `!document.querySelector('#administration-link').hidden`,
      ),
      true,
    );
    const output = path.resolve(
      __dirname,
      "../../docs/evidence/AUTH-WEB-01/cambio-cuenta",
    );
    await fs.mkdir(output, { recursive: true });
    for (const [width, scale, label] of [
      [1280, 1, "desktop"],
      [360, 1, "mobile"],
      [1280, 2, "zoom-200"],
    ]) {
      await browser.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await browser.evaluate(
        `document.documentElement.style.zoom = '${scale}'`,
      );
      assert.equal(
        await browser.evaluate(
          `document.documentElement.scrollWidth <= innerWidth + 1`,
        ),
        true,
      );
      const shot = await browser.send("Page.captureScreenshot", {
        format: "png",
      });
      await fs.writeFile(
        path.join(output, label + ".png"),
        Buffer.from(shot.data, "base64"),
      );
    }
    await browser.evaluate(
      `document.documentElement.style.zoom = '1'; document.querySelector('#administration-link').focus()`,
    );
    for (const type of ["keyDown", "keyUp"])
      await browser.send("Input.dispatchKeyEvent", {
        type,
        key: "Tab",
        code: "Tab",
        windowsVirtualKeyCode: 9,
      });
    assert.equal(
      await browser.evaluate(`document.activeElement.id`),
      "change-account",
    );
    assert.equal(
      await browser.evaluate(
        `getComputedStyle(document.activeElement).outlineStyle`,
      ),
      "solid",
    );
    for (const type of ["keyDown", "keyUp"])
      await browser.send("Input.dispatchKeyEvent", {
        type,
        key: "Enter",
        code: "Enter",
        windowsVirtualKeyCode: 13,
        ...(type === "keyDown" ? { text: "\r" } : {}),
      });
    await wait(browser, `!document.querySelector('form').hidden`);
    assert.equal(
      await browser.evaluate(
        `document.activeElement.id === 'login-email' && document.querySelector('#login-email').value === '' && document.querySelector('#login-password').value === '' && document.querySelector('#session-email').textContent === '' && !document.querySelector('#administration-link').hasAttribute('href')`,
      ),
      true,
    );
    assert.equal(
      await browser.evaluate(`fetch('/api/v1/auth/me').then(r => r.status)`),
      401,
    );
    await login("customer");
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#administration-link').hidden`,
      ),
      true,
    );
    await browser.evaluate(`(() => {
      window.qaLogoutCalls = 0;
      window.qaLoseLogout = true;
      document.querySelector('#change-account').click();
      document.querySelector('#change-account').click();
    })()`);
    await wait(browser, `!document.querySelector('form').hidden`);
    assert.equal(await browser.evaluate(`qaLogoutCalls`), 1);
    assert.equal(
      await browser.evaluate(`fetch('/api/v1/auth/me').then(r => r.status)`),
      401,
    );
    process.stdout.write(
      "Cambio de cuenta real aprobado: administrador a cliente, teclado/foco, limpieza, 360/1280/200 %, respuesta perdida y doble clic.\n",
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
            line.includes("at ") && line.includes("change-account-smoke.cjs"),
        )
        .join("\n") +
      "\n",
  );
  process.stderr.write(
    "Falló cambio de cuenta QA; detalles sensibles omitidos.\n",
  );
  process.exitCode = 1;
});
