import test from "node:test";
import assert from "node:assert/strict";
import { createEditorController } from "../../src/route-sheets/editor-controller.js";
import {
  createOperationStore,
  makeIntent,
  sameSource,
  cyclePeriod,
  verifyRenewal,
} from "../../src/route-sheets/lifecycle-model.js";
import { context, ids, clone } from "./editor-fixture.js";
const targetId = "aa000001-0000-4000-8000-000000000001";
const key = "aa000002-0000-4000-8000-000000000001";
const actor = {
  id: ids.user,
  cooperative_id: ids.coop,
  role: "COOPERATIVE_ADMIN",
};
const error = (
  status,
  message = "Conflicto de ciclos",
  code = "ROUTE_RENEWAL_TARGET_CONFLICT",
) => Object.assign(new Error(message), { status, code });
function setup(published = false) {
  const f = {
    source: context(),
    target: null,
    user: clone(actor),
    posts: [],
    current: null,
    pending: null,
    custom: null,
    unavailable: false,
  };
  if (published) f.source.sheet.status = "PUBLISHED";
  const store = {
    read: () => clone(f.pending),
    write: (_a, _id, value) => {
      f.pending = clone(value);
    },
    remove: () => {
      f.pending = null;
    },
  };
  f.store = store;
  function renew() {
    if (!f.target) {
      f.target = clone(f.source);
      f.target.sheet.id = targetId;
      f.target.sheet.routeDate = "2030-01-02";
      f.target.sheet.status = "DRAFT";
      for (const part of ["programming", "tariff"])
        f.target[part].routeSheetId = targetId;
      f.target.programming.programming.cycleStartDate = "2030-01-02";
    }
    return {
      replayed: f.posts.length > 1,
      renewal: {
        routeSheetId: targetId,
        sourceRouteSheetId: ids.sheet,
        seriesId: key,
        status: "DRAFT",
        createdBy: ids.user,
        createdAt: "2030-01-01T00:00:00.000Z",
        ...cyclePeriod(f.source, true),
        programmingRevision: 1,
        tariffRevision: 1,
      },
    };
  }
  const client = {
    async request(path, options) {
      if (path.endsWith("/me")) return { user: clone(f.user) };
      if (!options) {
        if (f.unavailable)
          throw f.unavailable === true
            ? new Error("Sin conexión")
            : f.unavailable;
        return clone(path.includes(targetId) ? f.target : f.source);
      }
      f.posts.push({ path, body: clone(options.data) });
      if (f.custom) return f.custom(path, options.data, renew);
      if (path.endsWith("/publish")) {
        f.source.sheet.status = "PUBLISHED";
        return {};
      }
      return renew();
    },
  };
  f.boot = () => {
    f.controller = createEditorController({
      client,
      sheetId: ids.sheet,
      newId: () => key,
      operationStore: store,
      view: {
        render: (s) => {
          f.current = clone(s);
        },
        touch: (s) => {
          f.current = clone(s);
        },
      },
    });
    return f.controller.load();
  };
  return f;
}

test("publicación exige revisión explícita, manda ambas versiones y verifica PUBLISHED por consulta", async () => {
  const f = setup();
  await f.boot();
  f.controller.reviewLifecycle("publish");
  assert.equal(f.current.mode, "review");
  assert.equal(f.posts.length, 0);
  await f.controller.confirm();
  assert.equal(f.posts.length, 1);
  assert.deepEqual(f.posts[0].body, {
    expectedProgrammingRevision: 1,
    expectedRevision: 1,
  });
  assert.equal(f.current.context.sheet.status, "PUBLISHED");
  assert.equal(f.current.mode, "success");
  assert.equal(f.pending, null);
});
test("cancelar publicación no envía y cambios locales impiden ambas acciones", async () => {
  const f = setup();
  await f.boot();
  f.controller.reviewLifecycle("publish");
  f.controller.cancel();
  await f.controller.confirm();
  assert.equal(f.posts.length, 0);
  f.controller.edit("programming", (m) => {
    m.cycleLengthDays = "2";
  });
  f.controller.reviewLifecycle("publish");
  assert.equal(f.current.mode, "invalid");
  assert.equal(f.current.review, null);
});
test("borrador sin tarifa no ofrece publicación válida", async () => {
  const f = setup();
  f.source.tariff.revision = 0;
  f.source.tariff.tariff = null;
  await f.boot();
  f.controller.reviewLifecycle("publish");
  await f.controller.confirm();
  assert.equal(f.posts.length, 0);
});
test("cambio de cualquiera de las versiones después de revisar no envía publicación", async () => {
  for (const part of ["programming", "tariff"]) {
    const f = setup();
    await f.boot();
    f.controller.reviewLifecycle("publish");
    f.source[part].revision++;
    await f.controller.confirm();
    assert.equal(f.posts.length, 0);
    assert.equal(f.current.mode, "conflict");
  }
});
test("respuesta de publicación perdida se consulta sin reenviar incluso después de recargar", async () => {
  const f = setup();
  await f.boot();
  f.custom = () => {
    f.source.sheet.status = "PUBLISHED";
    throw new TypeError("Respuesta perdida");
  };
  f.controller.reviewLifecycle("publish");
  await f.controller.confirm();
  assert.equal(f.current.mode, "uncertain");
  assert.ok(f.pending);
  await f.boot();
  assert.equal(f.current.mode, "uncertain");
  await f.controller.reconcile();
  assert.equal(f.current.mode, "success");
  assert.equal(f.posts.length, 1);
  assert.equal(f.pending, null);
});
test("publicación no ejecutada exige otra revisión y no reenvía al consultar", async () => {
  const f = setup();
  await f.boot();
  f.custom = () => {
    throw new TypeError("Sin conexión");
  };
  f.controller.reviewLifecycle("publish");
  await f.controller.confirm();
  await f.controller.reconcile();
  assert.equal(f.current.mode, "ready");
  assert.equal(f.posts.length, 1);
  assert.equal(f.current.context.sheet.status, "DRAFT");
});
test("renovación crea enlace solo tras verificar destino y conserva origen publicado", async () => {
  const f = setup(true);
  await f.boot();
  const before = clone(f.source);
  f.controller.reviewLifecycle("renew");
  await f.controller.confirm();
  assert.equal(f.current.mode, "success");
  assert.equal(f.current.destination.id, targetId);
  assert.deepEqual(f.source, before);
  assert.equal(f.target.sheet.status, "DRAFT");
  assert.deepEqual(f.posts[0].body, {
    expectedProgrammingRevision: 1,
    expectedTariffRevision: 1,
    requestKey: key,
  });
});
test("renovación con respuesta perdida conserva cuerpo y clave al recargar y recuperar", async () => {
  const f = setup(true);
  await f.boot();
  let first = true;
  f.custom = (_path, _body, renew) => {
    const result = renew();
    if (first) {
      first = false;
      throw new TypeError("Respuesta perdida");
    }
    return result;
  };
  f.controller.reviewLifecycle("renew");
  await f.controller.confirm();
  assert.ok(f.pending);
  await f.boot();
  assert.equal(f.posts.length, 1);
  assert.equal(f.current.mode, "uncertain");
  await f.controller.reconcile();
  assert.deepEqual(f.posts[0].body, f.posts[1].body);
  assert.equal(f.current.destination.id, targetId);
  assert.equal(f.pending, null);
});
test("destino ya publicado al recuperar se muestra como publicado sin atribuir un borrador actual", async () => {
  const f = setup(true);
  await f.boot();
  let first = true;
  f.custom = (_p, _b, renew) => {
    const result = renew();
    if (first) {
      first = false;
      f.target.sheet.status = "PUBLISHED";
      throw new TypeError();
    }
    return result;
  };
  f.controller.reviewLifecycle("renew");
  await f.controller.confirm();
  await f.controller.reconcile();
  assert.equal(f.current.destination.status, "PUBLISHED");
});
test("destino ajeno o DTO con procedencia diferente no se enlazan y conservan recuperación", async () => {
  for (const mismatch of ["tenant", "source", "period"]) {
    const f = setup(true);
    await f.boot();
    f.custom = (_p, _b, renew) => {
      const result = renew();
      if (mismatch === "tenant") f.target.sheet.cooperativeId = key;
      if (mismatch === "source") result.renewal.sourceRouteSheetId = key;
      if (mismatch === "period")
        result.renewal.endExclusive = "2030-01-04T05:00:00.000Z";
      return result;
    };
    f.controller.reviewLifecycle("renew");
    await f.controller.confirm();
    assert.equal(f.current.destination, null);
    assert.equal(f.current.mode, "uncertain");
    assert.ok(f.pending);
  }
});
test("cupo/conflicto rechazado conserva hoja y no muestra un destino", async () => {
  const f = setup(true);
  await f.boot();
  f.custom = () => {
    throw error(409);
  };
  f.controller.reviewLifecycle("renew");
  await f.controller.confirm();
  assert.equal(f.current.mode, "conflict");
  assert.equal(f.pending, null);
  assert.equal(f.current.destination, null);
});
test("cambio de identidad antes de confirmar bloquea POST y limpia contexto", async () => {
  const f = setup();
  await f.boot();
  f.controller.reviewLifecycle("publish");
  f.user.id = key;
  await f.controller.confirm();
  assert.equal(f.posts.length, 0);
  assert.equal(f.current.context, null);
  assert.equal(f.current.blocked, true);
});
test("doble confirmación concurrente genera una sola solicitud", async () => {
  const f = setup();
  await f.boot();
  f.controller.reviewLifecycle("publish");
  await Promise.all([f.controller.confirm(), f.controller.confirm()]);
  assert.equal(f.posts.length, 1);
});
test("el almacenamiento falla de forma cerrada antes de enviar", async () => {
  const f = setup();
  await f.boot();
  // Una lectura fallida no autoriza descartar una intención anterior desconocida.
  const broken = createOperationStore(() => {
    throw new Error("Almacenamiento bloqueado");
  });
  assert.throws(() => broken.read(actor, ids.sheet));
  assert.throws(() => broken.write(actor, ids.sheet, {}));
  f.store.write = () => {
    throw new Error("Cuota agotada");
  };
  f.controller.reviewLifecycle("publish");
  await f.controller.confirm();
  assert.equal(f.posts.length, 0);
  assert.equal(f.current.mode, "error");
});

test("fallo de lectura posterior al POST conserva intención porque no demuestra rechazo", async () => {
  const f = setup(true);
  await f.boot();
  f.custom = (_p, _b, renew) => {
    const result = renew();
    f.unavailable = error(404);
    return result;
  };
  f.controller.reviewLifecycle("renew");
  await f.controller.confirm();
  assert.equal(f.current.mode, "uncertain");
  assert.ok(f.pending);
  assert.equal(f.current.destination, null);
  f.unavailable = false;
  f.custom = null;
  await f.controller.reconcile();
  assert.equal(f.current.destination.id, targetId);
  assert.deepEqual(f.posts[0].body, f.posts[1].body);
});

test("fallo al leer operación pendiente bloquea acciones al cargar", async () => {
  const f = setup();
  f.store.read = () => {
    throw new Error("Intención ilegible");
  };
  await f.boot();
  assert.equal(f.current.blocked, true);
  f.controller.reviewLifecycle("publish");
  await f.controller.confirm();
  assert.equal(f.posts.length, 0);
});
test("almacenamiento separa identidad y valida cuerpo estricto de recuperación", () => {
  const map = new Map(),
    storage = {
      getItem: (k) => map.get(k),
      setItem: (k, v) => map.set(k, v),
      removeItem: (k) => map.delete(k),
    };
  const store = createOperationStore(() => storage),
    intent = makeIntent("publish", context(), actor, () => key);
  store.write(actor, ids.sheet, intent);
  assert.deepEqual(store.read(actor, ids.sheet), intent);
  assert.equal(store.read({ ...actor, id: key }, ids.sheet), null);
  intent.body.cooperativeId = ids.coop;
  store.write(actor, ids.sheet, intent);
  assert.throws(() => store.read(actor, ids.sheet));
  store.remove(actor, ids.sheet);
  assert.equal(store.read(actor, ids.sheet), null);
});
test("resumen usa período contiguo local y comparación semántica detecta cambios guardados", () => {
  const c = context(),
    intent = makeIntent("publish", c, actor, () => key);
  assert.deepEqual(cyclePeriod(c, true), {
    startAt: "2030-01-02T05:00:00.000Z",
    endExclusive: "2030-01-03T05:00:00.000Z",
    cycleLengthDays: 1,
  });
  assert.equal(sameSource(c, intent), true);
  c.tariff.tariff.frequencies[0].prices[0].amountCents++;
  assert.equal(sameSource(c, intent), false);
  assert.throws(() => verifyRenewal({}, intent, c));
});
