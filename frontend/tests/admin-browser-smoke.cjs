// AUTH-WEB-03: recorrido real con contenedores y datos ficticios descartables.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");
const { createRuntime } = require("../scripts/dev-runtime.cjs");
const { openBrowser } = require("./helpers/browser.cjs");

async function wait(browser, expression) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    if (await browser.evaluate(expression)) return;
    await delay(50);
  }
  throw new Error("No se alcanzó el estado esperado.");
}

async function main() {
  const runtime = createRuntime({
    project: `transviaje-frontend-qa-admin-${process.pid}`,
    port: "0",
  });
  const users = Object.fromEntries(
    ["system", "cooperative", "clerk", "customer"].map((role) => [
      role,
      {
        email: `${randomUUID()}@qa.invalid`,
        password: `${randomUUID()}-QA`,
      },
    ]),
  );
  let browser;
  let owned = false;
  try {
    assert.equal(runtime.exists(), false);
    owned = true;
    runtime.compose(["up", "-d", "--build", "--wait", "--wait-timeout", "120"]);
    const seed = `(async()=>{const {Pool}=require('pg');const {createHasher}=require('./src/modules/auth/infrastructure/password-hasher');const pool=new Pool({connectionString:process.env.DATABASE_URL});try{const users=${JSON.stringify(users)};const hasher=await createHasher();for(const [key,role] of [['system','SYSTEM_ADMIN'],['customer','CUSTOMER']])await pool.query('INSERT INTO users(email,password_hash,role) VALUES($1,$2,$3)',[users[key].email,await hasher.hash(users[key].password),role]);}finally{await pool.end();}})().catch(()=>{process.stderr.write('Falló preparación QA.');process.exitCode=1;});`;
    runtime.compose(["exec", "-T", "backend", "node", "-e", seed]);
    const origin =
      "http://" + runtime.compose(["port", "frontend", "8080"]).trim();
    browser = await openBrowser(origin);
    const navigate = async (path) =>
      browser.send("Page.navigate", { url: origin + path });
    const api = (path, options = {}) =>
      browser.evaluate(
        `(async()=>{const {createApiClient}=await import('/src/api/api-client.js');return createApiClient().request(${JSON.stringify(path)},${JSON.stringify(options)});})()`,
      );
    async function login(key, initial = false) {
      if (!initial) await api("/api/v1/auth/logout", { method: "POST" });
      await navigate("/pages/login.html");
      await wait(
        browser,
        `!!document.querySelector('#login-email') && !document.querySelector('fieldset').disabled`,
      );
      await browser.evaluate(
        `document.querySelector('#login-email').value=${JSON.stringify(users[key].email)};document.querySelector('#login-password').value=${JSON.stringify(users[key].password)};document.querySelector('form').requestSubmit()`,
      );
      await wait(
        browser,
        `document.querySelector('#login-status')?.textContent==='Sesión iniciada.'`,
      );
    }
    await login("system", true);
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#administration-link').getAttribute('href')`,
      ),
      "/pages/cooperativas.html",
    );
    await navigate("/pages/cooperativas.html");
    await wait(
      browser,
      `!!document.querySelector('#admin-form') && !document.querySelector('#admin-form').hidden && !document.querySelector('fieldset').disabled`,
    );
    await browser.evaluate(
      `document.querySelector('[name=name]').value='Cooperativa QA';document.querySelector('[name=ruc]').value='0012345678901';document.querySelector('#admin-form').requestSubmit()`,
    );
    await wait(browser, `!document.querySelector('#admin-result').hidden`);
    const adminLink = await browser.evaluate(
      `document.querySelector('#admin-result a').getAttribute('href')`,
    );
    const cooperativeId = new URL(adminLink, origin).searchParams.get(
      "cooperativeId",
    );
    assert.match(cooperativeId, /^[0-9a-f-]{36}$/u);
    assert.equal(
      await browser.evaluate(
        `document.querySelectorAll('#admin-list li').length`,
      ),
      1,
    );

    await navigate(adminLink);
    await wait(
      browser,
      `!!document.querySelector('[name=cooperative]') && !document.querySelector('fieldset').disabled`,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('[name=cooperative]').value`,
      ),
      cooperativeId,
    );
    await browser.evaluate(
      `document.querySelector('[name=email]').value=${JSON.stringify(users.cooperative.email)};document.querySelector('[name=password]').value=${JSON.stringify(users.cooperative.password)};document.querySelector('[name=confirmation]').value=${JSON.stringify(users.cooperative.password)};document.querySelector('#admin-form').requestSubmit()`,
    );
    await wait(browser, `!document.querySelector('#admin-result').hidden`);
    assert.equal(
      await browser.evaluate(`document.querySelector('[name=password]').value`),
      "",
    );

    await login("cooperative");
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#administration-link').getAttribute('href')`,
      ),
      "/pages/oficinistas.html",
    );
    await navigate("/pages/oficinistas.html");
    await wait(
      browser,
      `!!document.querySelector('#admin-form') && !document.querySelector('fieldset').disabled`,
    );
    assert.equal(
      await browser.evaluate(`!!document.querySelector('[name=cooperative]')`),
      false,
    );
    await browser.evaluate(
      `document.querySelector('[name=email]').value=${JSON.stringify(users.clerk.email)};document.querySelector('[name=password]').value=${JSON.stringify(users.clerk.password)};document.querySelector('[name=confirmation]').value=${JSON.stringify(users.clerk.password)};document.querySelector('#admin-form').requestSubmit()`,
    );
    await wait(browser, `!document.querySelector('#admin-result').hidden`);
    assert.equal(
      await browser.evaluate(
        `document.querySelector('#admin-result').textContent.includes(${JSON.stringify(cooperativeId)})`,
      ),
      true,
    );

    await login("customer");
    await navigate("/pages/cooperativas.html");
    await wait(
      browser,
      `document.querySelector('#admin-status')?.textContent.includes('no tiene acceso')`,
    );
    assert.equal(
      await browser.evaluate(`document.querySelector('#admin-form').hidden`),
      true,
    );
    await browser.send("Emulation.setDeviceMetricsOverride", {
      width: 360,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
    assert.equal(
      await browser.evaluate(
        `document.documentElement.scrollWidth<=innerWidth+1`,
      ),
      true,
    );
    assert.deepEqual(
      browser.outside.filter((value) => value !== "null"),
      [],
    );
    process.stdout.write(
      "ok: cooperativa, administrador, oficinista, rol prohibido y reflujo móvil\n",
    );
  } finally {
    try {
      await browser?.close();
    } finally {
      try {
        if (owned) runtime.compose(["down", "--volumes", "--remove-orphans"]);
      } finally {
        runtime.dispose();
      }
    }
  }
}

main().catch(() => {
  process.stderr.write(
    "Falló el recorrido QA de administración; detalles sensibles omitidos.\n",
  );
  process.exitCode = 1;
});
