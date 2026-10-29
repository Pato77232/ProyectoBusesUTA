// Empaquetado de BOOK-03: contenedor/red exclusivos, archivos y MIME reales.
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const root = path.resolve(__dirname, "../../..");
const image = "busesuta-frontend:book03-pantalla";
const name = "busesuta-book03-assets-" + process.pid;
const network = name + "-net";
function docker(...args) {
  return execFileSync("docker", args, { cwd: root, encoding: "utf8" }).trim();
}
async function main() {
  let networkCreated = false;
  let started = false;
  try {
    docker("build", "-t", image, "frontend");
    docker("run", "--rm", "--entrypoint", "nginx", image, "-t");
    assert.equal(
      docker("image", "inspect", image, "--format", "{{.Config.User}}"),
      "nginx",
    );
    docker("network", "create", network);
    networkCreated = true;
    docker(
      "run",
      "--rm",
      "-d",
      "--name",
      name,
      "--network",
      network,
      "--read-only",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=16m,mode=1777",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges:true",
      "-p",
      "127.0.0.1::8080",
      image,
    );
    started = true;
    const binding = docker("port", name, "8080/tcp");
    assert.match(binding, /^127\.0\.0\.1:\d+$/);
    const origin = "http://" + binding;
    let ready = false;
    for (let count = 0; count < 60; count += 1) {
      try {
        if ((await fetch(origin + "/pages/reservas.html")).status === 200) {
          ready = true;
          break;
        }
      } catch {}
      await delay(100);
    }
    assert.equal(
      ready,
      true,
      "La página debe estar servida desde la imagen real",
    );
    for (const [resource, mime] of [
      ["/pages/reservas.html", /^text\/html/],
      ["/src/bookings/page.js", /^(application|text)\/javascript/],
      ["/src/bookings/api.js", /^(application|text)\/javascript/],
      ["/src/bookings/access.js", /^(application|text)\/javascript/],
      ["/src/bookings/flow.js", /^(application|text)\/javascript/],
      ["/src/api/json-transport.js", /^(application|text)\/javascript/],
      ["/src/api/api-error.js", /^(application|text)\/javascript/],
      ["/src/styles/app.css", /^text\/css/],
    ]) {
      const response = await fetch(origin + resource);
      assert.equal(
        response.status,
        200,
        "Recurso de la pantalla debe existir: " + resource,
      );
      assert.match(response.headers.get("content-type"), mime);
    }
    for (const resource of [
      "/DESIGN.md",
      "/package.json",
      "/tests/bookings/browser.cjs",
      "/pages/inexistente.html",
    ]) {
      assert.equal(
        (await fetch(origin + resource)).status,
        404,
        "Sin documentos/tests ni fallback de rutas",
      );
    }
    const files = docker(
      "exec",
      name,
      "find",
      "/usr/share/nginx/html",
      "-type",
      "f",
    );
    assert.doesNotMatch(
      files,
      /tests\/|\.env|DESIGN|package\.json|provenance\.json/,
    );
    process.stdout.write(
      "BOOK-03 imagen: página/módulos/MIME correctos, usuario nginx, exclusiones y 404 correctos.\n",
    );
  } finally {
    if (started) docker("stop", name);
    if (networkCreated) docker("network", "rm", network);
  }
}
main().catch((error) => {
  process.stderr.write(error.stack + "\n");
  process.exitCode = 1;
});
