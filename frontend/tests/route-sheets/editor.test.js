import test from "node:test";
import assert from "node:assert/strict";
import {
  ids,
  clone,
  context,
  applyProgramming,
  applyTariff,
} from "./editor-fixture.js";
import {
  readEditor,
  programModel,
  tariffModel,
  programmingBody,
  tariffBody,
  instant,
  localTime,
  decimal,
  canonical,
  removeRequired,
} from "../../src/route-sheets/editor-model.js";
import { createEditorController } from "../../src/route-sheets/editor-controller.js";
const valid = () => readEditor(context(), ids.sheet, ids.coop);
function setup() {
  const f = {
    raw: context(),
    user: { id: ids.user, role: "COOPERATIVE_ADMIN", cooperative_id: ids.coop },
    calls: [],
    last: null,
    put: null,
    sessionError: null,
  };
  const client = {
    async request(path, options) {
      f.calls.push({ path, options });
      if (path.endsWith("/me")) {
        if (f.sessionError) throw f.sessionError;
        return { user: clone(f.user) };
      }
      if (!options) return clone(f.raw);
      if (f.put) return f.put(path, options.data);
      return path.endsWith("/programming")
        ? applyProgramming(f.raw, options.data)
        : applyTariff(f.raw, options.data);
    },
  };
  const capture = (state) => {
    f.last = clone(state);
  };
  f.controller = createEditorController({
    client,
    sheetId: ids.sheet,
    view: { render: capture, touch: capture },
  });
  f.puts = () => f.calls.filter((r) => r.options?.method === "PUT");
  return f;
}
test("fechas locales conservan medianoche y fracciones sin depender de la zona del equipo", () => {
  for (const value of [
    "2030-01-02T00:00",
    "2030-01-02T00:00:45",
    "2030-01-02T00:00:45.123",
  ])
    assert.equal(instant(localTime(instant(value))), instant(value));
  assert.equal(instant("2030-01-02T00:00"), "2030-01-02T05:00:00.000Z");
  assert.throws(() => instant("2030-02-30T07:00"));
  assert.throws(() => instant("2030-01-01T24:00"));
});
test("importe y porcentajes se convierten exactamente sin miles ni valores implícitos", () => {
  assert.equal(decimal("4,50", 9_999_999_999), 450);
  assert.equal(decimal("1.25", 10000, true), 125);
  assert.equal(decimal("0", 10000, true), 0);
  for (const value of ["", "0", "1.001", "1e2", "1,000.00", "100000000"])
    assert.throws(() => decimal(value, 9_999_999_999));
});
test("programación leída conserva identidades y elimina solo metadatos derivados del PUT", () => {
  const c = valid(),
    m = programModel(c),
    body = programmingBody(m, c);
  assert.equal(body.programming.requiredServices[0].id, ids.required);
  assert.equal(body.programming.agendas[0].activities[0].id, ids.service);
  assert.equal(body.programming.agendas[0].activities[1].id, ids.transfer);
  assert.equal(body.programming.agendas[0].blocks[0].id, ids.block);
  assert.equal(body.programming.agendas[0].activities[0].readyAt, undefined);
  assert.equal(
    body.programming.agendas[0].activities[0].points[1].locationKey,
    undefined,
  );
  assert.equal(body.programming.cooperativeId, undefined);
  assert.equal(body.programming.agendas[0].activities[1].preparationMinutes, 0);
  assert.equal(m.requiredServices[0].locked, true);
});
test("vacíos no se convierten a cero y un servicio usado no se retira en silencio", () => {
  const c = valid(),
    m = programModel(c);
  assert.throws(() => removeRequired(m, ids.required));
  m.agendas[0].activities[0].preparationMinutes = "";
  assert.throws(() => programmingBody(m, c));
});
test("tarifas son explícitas por par, no suma de tramos; cero de porcentaje es válido", () => {
  const c = valid(),
    m = tariffModel(c);
  m.policy.vipSurchargeBps = "0";
  const body = tariffBody(m, c);
  assert.equal(body.policy.vipSurchargeBps, 0);
  assert.equal(
    body.frequencies[0].prices.find(
      (p) => p.fromPosition === 0 && p.toPosition === 2,
    ).amountCents,
    450,
  );
  assert.equal(body.expectedRevision, 1);
});
test("datos ajenos o revisiones incoherentes fallan antes de mostrar la hoja", () => {
  const c = context();
  c.buses[0].cooperativeId = ids.user;
  assert.throws(() => readEditor(c, ids.sheet, ids.coop));
  const p = context();
  p.programming.programming.cooperativeId = ids.user;
  assert.throws(() => readEditor(p, ids.sheet, ids.coop));
  const r = context();
  r.tariff.revision = 0;
  assert.throws(() => readEditor(r, ids.sheet, ids.coop));
});
test("cambio de recorrido no reutiliza importes ni suma precios para combinaciones nuevas", () => {
  const c = valid();
  c.frequencies[0].stops = [];
  const model = tariffModel(c);
  assert.equal(model.frequencies[0].prices.length, 1);
  assert.equal(model.frequencies[0].prices[0].amount, "");
});
test("comparación canónica ignora orden de actividades pero conserva contenido e identidades", () => {
  const c = valid();
  const a = programmingBody(programModel(c), c),
    b = clone(a);
  b.expectedRevision = 9;
  b.programming.agendas[0].activities.reverse();
  assert.equal(canonical(a), canonical(b));
  b.programming.agendas[0].activities[0].preparationMinutes++;
  assert.notEqual(canonical(a), canonical(b));
});
test("revisar y cancelar no envía; confirmar usa revisión leída y body sin tenant", async () => {
  const f = setup();
  await f.controller.load();
  f.controller.edit("programming", (m) => {
    m.agendas[0].activities[1].preparationMinutes = "5";
  });
  f.controller.review("programming");
  f.controller.cancel();
  assert.equal(f.puts().length, 0);
  f.controller.review("programming");
  await f.controller.confirm();
  assert.equal(f.last.mode, "success");
  assert.equal(f.last.context.programming.revision, 2);
  assert.equal(f.last.dirty.programming, false);
  assert.equal(f.puts()[0].options.data.expectedRevision, 1);
  assert.equal(f.puts()[0].options.data.cooperativeId, undefined);
});
test("tarifas y programación tienen revisiones independientes y no se guardan juntas", async () => {
  const f = setup();
  await f.controller.load();
  f.controller.edit("tariff", (m) => {
    m.policy.vipSurchargeBps = "1.25";
  });
  f.controller.review("tariff");
  await f.controller.confirm();
  assert.equal(f.last.context.tariff.revision, 2);
  assert.equal(f.last.context.programming.revision, 1);
  assert.equal(f.puts().length, 1);
  assert.equal(f.puts()[0].options.data.policy.vipSurchargeBps, 125);
});
test("programación local pendiente bloquea guardado de tarifas", async () => {
  const f = setup();
  await f.controller.load();
  f.controller.edit("programming", (m) => {
    m.cycleLengthDays = "2";
  });
  f.controller.review("tariff");
  await f.controller.confirm();
  assert.equal(f.puts().length, 0);
  assert.equal(f.last.mode, "invalid");
});
test("conflicto detectado antes de PUT conserva todos los campos locales", async () => {
  const f = setup();
  await f.controller.load();
  f.controller.edit("programming", (m) => {
    m.cycleLengthDays = "2";
  });
  f.controller.review("programming");
  f.raw.programming.revision = 2;
  await f.controller.confirm();
  assert.equal(f.puts().length, 0);
  assert.equal(f.last.mode, "conflict");
  assert.equal(f.last.models.programming.cycleLengthDays, "2");
  f.controller.reload();
  assert.equal(f.last.review.kind, "reload");
  f.controller.cancel();
  assert.equal(f.last.models.programming.cycleLengthDays, "2");
});
test("respuesta perdida tras escritura se verifica por GET sin repetir PUT", async () => {
  const f = setup();
  await f.controller.load();
  f.controller.edit("programming", (m) => {
    m.agendas[0].activities[1].preparationMinutes = "5";
  });
  f.controller.review("programming");
  f.put = async (_path, body) => {
    applyProgramming(f.raw, body);
    throw new TypeError("respuesta perdida");
  };
  await f.controller.confirm();
  assert.equal(f.last.mode, "uncertain");
  await f.controller.confirm();
  assert.equal(f.puts().length, 1);
  await f.controller.reconcile();
  assert.equal(f.last.mode, "success");
  assert.equal(f.puts().length, 1);
  assert.equal(f.last.dirty.programming, false);
});
test("respuesta perdida sin escritura conserva cambios para nueva revisión explícita", async () => {
  const f = setup();
  await f.controller.load();
  f.controller.edit("tariff", (m) => {
    m.policy.vipSurchargeBps = "10";
  });
  f.controller.review("tariff");
  f.put = async () => {
    throw new TypeError("sin respuesta");
  };
  await f.controller.confirm();
  await f.controller.reconcile();
  assert.equal(f.last.mode, "editing");
  assert.equal(f.last.models.tariff.policy.vipSurchargeBps, "10");
  assert.equal(f.last.dirty.tariff, true);
  assert.equal(f.puts().length, 1);
});
test("sesión cambiada limpia datos y nunca envía otro guardado", async () => {
  const f = setup();
  await f.controller.load();
  f.controller.edit("tariff", (m) => {
    m.policy.vipSurchargeBps = "10";
  });
  f.controller.review("tariff");
  f.user.cooperative_id = ids.group;
  await f.controller.confirm();
  assert.equal(f.last.mode, "session-changed");
  assert.equal(f.last.context, null);
  assert.equal(f.puts().length, 0);
});
test("hoja publicada queda en solo lectura y no admite preparar guardado", async () => {
  const f = setup();
  f.raw.sheet.status = "PUBLISHED";
  await f.controller.load();
  f.controller.edit("programming", (m) => {
    m.cycleLengthDays = "2";
  });
  f.controller.review("programming");
  await f.controller.confirm();
  assert.equal(f.puts().length, 0);
  assert.equal(f.last.dirty.programming, false);
});
test("doble confirmación conserva un único PUT", async () => {
  const f = setup();
  await f.controller.load();
  f.controller.edit("tariff", (m) => {
    m.policy.vipSurchargeBps = "10";
  });
  f.controller.review("tariff");
  await Promise.all([f.controller.confirm(), f.controller.confirm()]);
  assert.equal(f.puts().length, 1);
});
