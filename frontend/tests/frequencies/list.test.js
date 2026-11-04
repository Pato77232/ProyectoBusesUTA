import test from "node:test";
import assert from "node:assert/strict";
import { createFrequencyListController } from "../../src/frequencies/list-controller.js";
import {
  readFilters,
  readFrequency,
  readList,
} from "../../src/frequencies/list-contracts.js";
const coop = "10000000-0000-4000-8000-000000000001";
const id = "20000000-0000-4000-8000-000000000001";
const row = () => ({
  id,
  cooperative_id: coop,
  origin: "Ambato",
  destination: "Quito",
  departure_time: "00:00",
  ant_resolution_number: "ANT-QA",
  status: "ACTIVE",
  stops: ["Latacunga"],
  segment_prices: [2, 3],
});
function setup() {
  const state = {
    user: {
      id: "30000000-0000-4000-8000-000000000001",
      cooperative_id: coop,
      role: "COOPERATIVE_ADMIN",
    },
    rows: [row()],
    calls: [],
    rendered: [],
    patch: null,
    sessionError: null,
    detail: null,
  };
  const client = {
    async request(path, options) {
      state.calls.push({ path, options });
      if (path.endsWith("/me")) {
        if (state.sessionError) throw state.sessionError;
        return { user: { ...state.user } };
      }
      if (options?.method === "PATCH") {
        if (state.patch) return state.patch(options);
        state.rows[0] = { ...state.rows[0], status: options.data.status };
        return { frequency: state.rows[0] };
      }
      if (path === "/api/v1/frequencies" || path.includes("?"))
        return { frequencies: state.rows };
      return { frequency: state.detail || state.rows[0] };
    },
  };
  const controller = createFrequencyListController({
    client,
    view: { render: (value) => state.rendered.push(value), setBusy() {} },
  });
  return {
    state,
    controller,
    last: () => state.rendered.at(-1),
    patches: () =>
      state.calls.filter((call) => call.options?.method === "PATCH"),
  };
}
async function ready(f) {
  await f.controller.load();
  await f.controller.select(id);
}
test("omite filtros vacíos y normaliza espacios sin enviar tenant", () => {
  assert.deepEqual(
    readFilters({ origin: " Ambato ", status: "", destination: " " }),
    { origin: "Ambato" },
  );
  assert.throws(() => readFilters({ cooperative_id: coop }));
  assert.throws(() => readFilters({ status: "OTRO" }));
});
test("DTO copiado e inmutable conserva medianoche y valores históricos", () => {
  const source = row(),
    result = readFrequency(source, coop);
  source.stops[0] = "Alterada";
  assert.equal(result.departure_time, "00:00");
  assert.deepEqual(result.stops, ["Latacunga"]);
  assert.equal(Object.isFrozen(result.segment_prices), true);
});
test("rechaza tenant ajeno, duplicados, estados y recorridos no verificables", () => {
  assert.throws(() => readFrequency({ ...row(), cooperative_id: id }, coop));
  assert.throws(() => readList({ frequencies: [row(), row()] }, coop, {}));
  assert.throws(() => readFrequency({ ...row(), stops: ["Quito"] }, coop));
  assert.throws(() => readFrequency({ ...row(), segment_prices: [1] }, coop));
  assert.throws(() => readFrequency({ ...row(), status: "OTRO" }, coop));
  assert.throws(() =>
    readList({ frequencies: [row()] }, coop, { origin: "Loja" }),
  );
});
test("lista, consulta detalle y confirma con relectura, sesión y body mínimo", async () => {
  const f = setup();
  await ready(f);
  f.controller.beginChange();
  assert.equal(f.last().mode, "confirm");
  await f.controller.confirm();
  assert.equal(f.last().mode, "success");
  assert.equal(f.last().selected.status, "INACTIVE");
  assert.deepEqual(f.patches()[0].options.data, { status: "INACTIVE" });
  assert.equal(
    f.state.calls.filter((call) => call.path === `/api/v1/frequencies/${id}`)
      .length,
    2,
  );
  assert.equal(f.state.calls.at(-1).path, "/api/v1/auth/me");
});
test("cancelar y confirmar sin intención no envían cambios", async () => {
  const f = setup();
  await ready(f);
  f.controller.beginChange();
  f.controller.cancel();
  await f.controller.confirm();
  assert.equal(f.patches().length, 0);
});
test("estado cambiado por otro actor exige nueva revisión y actualiza la fila", async () => {
  const f = setup();
  await ready(f);
  f.controller.beginChange();
  f.state.rows[0] = { ...f.state.rows[0], status: "INACTIVE" };
  await f.controller.confirm();
  assert.equal(f.last().mode, "detail");
  assert.equal(f.last().pending, null);
  assert.equal(f.last().rows[0].status, "INACTIVE");
  assert.equal(f.patches().length, 0);
});
test("cambiar usuario o cooperativa limpia información y bloquea modificaciones", async () => {
  const f = setup();
  await ready(f);
  f.controller.beginChange();
  f.state.user.cooperative_id = id;
  await f.controller.confirm();
  assert.equal(f.last().mode, "session-changed");
  assert.equal(f.last().rows.length, 0);
  await f.controller.load();
  assert.equal(f.patches().length, 0);
});
test("rol distinto no consulta frecuencias", async () => {
  const f = setup();
  f.state.user.role = "CUSTOMER";
  await f.controller.load();
  assert.equal(f.last().mode, "forbidden");
  assert.equal(f.state.calls.length, 1);
});
test("lista vacía se distingue de error y un fallo borra datos anteriores", async () => {
  const f = setup();
  f.state.rows = [];
  await f.controller.load();
  assert.equal(f.last().mode, "empty");
  f.state.rows = [row()];
  await ready(f);
  f.state.sessionError = new Error("sin conexión");
  await f.controller.load();
  assert.equal(f.last().mode, "error");
  assert.deepEqual(f.last().rows, []);
  assert.equal(f.last().selected, null);
});
test("otra cooperativa en el DTO no se muestra", async () => {
  const f = setup();
  f.state.rows[0].cooperative_id = id;
  await f.controller.load();
  assert.equal(f.last().mode, "error");
  assert.equal(f.last().rows.length, 0);
});
for (const [status, code] of [
  [409, "FREQUENCY_HAS_COMMITMENTS"],
  [503, "FREQUENCY_COMMITMENTS_UNAVAILABLE"],
]) {
  test(`rechazo ${status} conserva backend y obliga a volver a consultar`, async () => {
    const f = setup();
    await ready(f);
    f.controller.beginChange();
    f.state.patch = async () => {
      throw { status, code };
    };
    await f.controller.confirm();
    assert.equal(f.last().mode, "rejected");
    assert.equal(f.state.rows[0].status, "ACTIVE");
    assert.equal(f.last().selected, null);
    await f.controller.confirm();
    assert.equal(f.patches().length, 1);
  });
}
test("respuesta perdida después de escribir no se reenvía y se consulta el estado real", async () => {
  const f = setup();
  await ready(f);
  f.controller.beginChange();
  f.state.patch = async ({ data }) => {
    f.state.rows[0] = { ...row(), status: data.status };
    throw new TypeError("respuesta perdida");
  };
  await f.controller.confirm();
  assert.equal(f.last().mode, "uncertain");
  await f.controller.load();
  await f.controller.confirm();
  assert.equal(f.patches().length, 1);
  await f.controller.reconcile();
  assert.equal(f.last().selected.status, "INACTIVE");
  assert.equal(f.last().uncertain, null);
  assert.equal(f.patches().length, 1);
});
test("fallo de sesión posterior a PATCH recibido no afirma que se rechazó la modificación", async () => {
  const f = setup();
  await ready(f);
  f.controller.beginChange();
  f.state.patch = async ({ data }) => {
    f.state.rows[0] = { ...row(), status: data.status };
    f.state.sessionError = { status: 503 };
    return { frequency: f.state.rows[0] };
  };
  await f.controller.confirm();
  assert.equal(f.last().mode, "uncertain");
  assert.equal(f.state.rows[0].status, "INACTIVE");
});
test("respuesta PATCH corrupta falla cerrada sin mostrar éxito", async () => {
  const f = setup();
  await ready(f);
  f.controller.beginChange();
  f.state.patch = async () => ({ frequency: { ...row(), cooperative_id: id } });
  await f.controller.confirm();
  assert.equal(f.last().mode, "uncertain");
});

test("un 503 técnico genérico no prueba rechazo y requiere comprobar el estado actual", async () => {
  const f = setup();
  await ready(f);
  f.controller.beginChange();
  f.state.patch = async () => {
    throw { status: 503, code: "SERVER_ERROR" };
  };
  await f.controller.confirm();
  assert.equal(f.last().mode, "uncertain");
  await f.controller.confirm();
  assert.equal(f.patches().length, 1);
});
test("doble confirmación envía un solo PATCH", async () => {
  const f = setup();
  await ready(f);
  f.controller.beginChange();
  await Promise.all([f.controller.confirm(), f.controller.confirm()]);
  assert.equal(f.patches().length, 1);
});
test("filtrado por activa retira la fila tras confirmar su desactivación", async () => {
  const f = setup();
  await f.controller.load({ status: "ACTIVE" });
  await f.controller.select(id);
  f.controller.beginChange();
  await f.controller.confirm();
  assert.equal(f.last().rows.length, 0);
  assert.equal(f.last().selected.status, "INACTIVE");
});
