import test from "node:test";
import assert from "node:assert/strict";
import { createRouteSheetListController } from "../../src/route-sheets/list-controller.js";
import {
  readCreatedDraft,
  readDraftRequest,
} from "../../src/route-sheets/draft-contracts.js";

const id = (number) =>
  `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const actor = {
  id: id(1),
  cooperative_id: id(2),
  role: "COOPERATIVE_ADMIN",
};
const group = { id: id(3), name: "Grupo A" };
const request = {
  busGroupId: group.id,
  routeDate: "2030-01-02",
  notes: "Revisión de temporada",
};

function createdDraft(body = request) {
  return {
    routeSheet: {
      id: id(4),
      cooperativeId: actor.cooperative_id,
      busGroupId: body.busGroupId,
      routeDate: body.routeDate,
      createdBy: actor.id,
      status: "DRAFT",
      notes: body.notes ?? null,
      publishedBy: null,
      publishedAt: null,
      assignments: [],
      restDays: [],
    },
  };
}

function fixture(options = {}) {
  const f = {
    calls: [],
    listCalls: 0,
    postCalls: 0,
    user: { ...actor },
    groups: [group],
    rows: [],
    draftRenders: [],
    listRenders: [],
    busyChanges: [],
    viewResets: 0,
    draftResets: 0,
    ...options,
  };
  f.controller = createRouteSheetListController({
    client: {
      async request(path, requestOptions = {}) {
        f.calls.push({ path, options: requestOptions });
        if (path === "/api/v1/auth/me") {
          if (f.sessionChangeAfterPost && f.postCalls) {
            return { user: { ...f.user, id: id(99) } };
          }
          return { user: f.user };
        }
        if (path === "/api/v1/bus-groups") {
          if (f.groupError) throw f.groupError;
          return { busGroups: f.groups };
        }
        if (
          path === "/api/v1/route-sheets" &&
          requestOptions.method === "POST"
        ) {
          f.postCalls += 1;
          f.onPost?.();
          if (f.postGate) await f.postGate;
          if (f.postError) throw f.postError;
          const response = f.postResponse
            ? f.postResponse(requestOptions.data)
            : createdDraft(requestOptions.data);
          if (!f.postResponse) {
            f.rows.push({
              id: response.routeSheet.id,
              cooperativeId: response.routeSheet.cooperativeId,
              busGroupId: response.routeSheet.busGroupId,
              routeDate: response.routeSheet.routeDate,
              status: response.routeSheet.status,
            });
          }
          return response;
        }
        if (path.startsWith("/api/v1/route-sheets")) {
          f.listCalls += 1;
          if (f.listErrorAt === f.listCalls) throw f.listError;
          return { routeSheets: f.rows };
        }
        throw new Error(`Solicitud inesperada: ${path}`);
      },
    },
    view: {
      render: (state) => f.listRenders.push(state),
      setBusy: (busy) => f.busyChanges.push(busy),
      resetFilters: () => {
        f.viewResets += 1;
      },
    },
    draftView: {
      render: (state) => f.draftRenders.push(state),
      reset: () => {
        f.draftResets += 1;
      },
    },
  });
  f.lastDraft = () => f.draftRenders.at(-1);
  f.lastList = () => f.listRenders.at(-1);
  f.load = () => f.controller.load();
  return f;
}

test("valida campos requeridos y normaliza notas sin añadir datos de tenant", () => {
  assert.deepEqual(readDraftRequest(request), request);
  assert.deepEqual(readDraftRequest({ ...request, notes: "  Revisión  " }), {
    ...request,
    notes: "Revisión",
  });
  assert.deepEqual(
    readDraftRequest({
      busGroupId: group.id,
      routeDate: request.routeDate,
      notes: " ",
    }),
    { busGroupId: group.id, routeDate: request.routeDate },
  );
  for (const invalid of [
    { ...request, busGroupId: "" },
    { ...request, routeDate: "2030-02-30" },
    { ...request, cooperativeId: actor.cooperative_id },
    { ...request, notes: 42 },
  ]) {
    assert.throws(() => readDraftRequest(invalid));
  }
});

test("acepta solo una respuesta que confirma autoría, cooperativa y borrador vacío", () => {
  assert.deepEqual(readCreatedDraft(createdDraft(), request, actor), {
    id: id(4),
    busGroupId: group.id,
    routeDate: request.routeDate,
    status: "DRAFT",
    notes: request.notes,
  });
  for (const change of [
    (sheet) => (sheet.cooperativeId = id(90)),
    (sheet) => (sheet.createdBy = id(90)),
    (sheet) => (sheet.busGroupId = id(90)),
    (sheet) => (sheet.routeDate = "2030-01-03"),
    (sheet) => (sheet.status = "PUBLISHED"),
    (sheet) => (sheet.publishedAt = "2030-01-02T00:00:00Z"),
    (sheet) => (sheet.assignments = [{ id: id(5) }]),
    (sheet) => (sheet.restDays = [{ id: id(6) }]),
  ]) {
    const response = createdDraft();
    change(response.routeSheet);
    assert.throws(() => readCreatedDraft(response, request, actor));
  }
});

test("mantiene el alta bloqueada hasta verificar sesión y cargar grupos", async () => {
  const f = fixture();
  assert.equal(f.lastDraft(), undefined);
  await f.load();
  assert.equal(f.lastDraft().mode, "ready");
  assert.equal(f.lastDraft().locked, false);

  const noGroups = fixture({ groups: [] });
  await noGroups.load();
  assert.equal(noGroups.lastDraft().locked, true);
  assert.match(noGroups.lastDraft().message, /grupo de buses/);
});

test("crea y confirma el borrador, y solo después recarga el listado", async () => {
  const f = fixture();
  await f.load();
  await f.controller.createDraft(request);

  const post = f.calls.find((call) => call.options.method === "POST");
  assert.deepEqual(post, {
    path: "/api/v1/route-sheets",
    options: { method: "POST", data: request },
  });
  assert.equal(f.postCalls, 1);
  assert.equal(f.lastDraft().mode, "success");
  assert.deepEqual(f.lastDraft().created, {
    id: id(4),
    busGroupId: group.id,
    routeDate: request.routeDate,
    status: "DRAFT",
    notes: request.notes,
  });
  assert.equal(f.viewResets, 1);
  assert.equal(f.lastList().mode, "ready");
  assert.equal(f.lastList().rows.length, 1);
  assert.equal(f.calls.at(-4).path, "/api/v1/bus-groups");
});

test("un conflicto duplicado permite corregir y enviar conscientemente", async () => {
  const f = fixture({
    postError: {
      status: 409,
      code: "ROUTE_SHEET_ALREADY_EXISTS_FOR_DATE_AND_GROUP",
    },
  });
  await f.load();
  await f.controller.createDraft(request);
  assert.equal(f.lastDraft().mode, "rejected");
  assert.match(f.lastDraft().message, /Ya existe una hoja/);
  assert.equal(f.postCalls, 1);
  assert.equal(f.lastDraft().locked, false);
});

test("un CSRF vencido se distingue como rechazo y no causa reintento automático", async () => {
  const f = fixture({
    postError: { status: 403, code: "CSRF_TOKEN_INVALID" },
  });
  await f.load();
  await f.controller.createDraft(request);
  assert.equal(f.lastDraft().mode, "rejected");
  assert.equal(f.postCalls, 1);
  assert.equal(
    f.calls.filter((call) => call.options.method === "POST").length,
    1,
  );
});

test("un fallo antes de POST pide volver a consultar sin crear", async () => {
  const f = fixture();
  await f.load();
  f.groupError = new Error("red");
  await f.controller.createDraft(request);
  assert.equal(f.lastDraft().mode, "check-error");
  assert.equal(f.postCalls, 0);
  assert.equal(f.lastDraft().locked, true);
});

test("una respuesta perdida deja resultado incierto y nunca reenvía el POST", async () => {
  const f = fixture({ postError: { status: 0, code: "NETWORK_ERROR" } });
  await f.load();
  await f.controller.createDraft(request);
  assert.equal(f.lastDraft().mode, "uncertain");
  assert.match(f.lastDraft().message, /podría haberse creado/);
  assert.equal(f.lastDraft().locked, true);
  await f.controller.load({ status: "DRAFT" });
  assert.equal(f.lastDraft().mode, "uncertain");
  assert.equal(f.postCalls, 1);
});

test("un cambio de sesión durante el alta bloquea el envío y descarta datos", async () => {
  const f = fixture({ sessionChangeAfterPost: true });
  await f.load();
  await f.controller.createDraft(request);
  assert.equal(f.postCalls, 1);
  assert.equal(f.lastDraft().mode, "uncertain");
  assert.match(f.lastDraft().message, /sesión cambió después del envío/);
  assert.deepEqual(f.lastDraft().groups, []);
  const callCount = f.calls.length;
  await f.controller.load();
  assert.equal(f.calls.length, callCount);
});

test("un cambio de grupo antes del alta evita enviar el POST", async () => {
  const f = fixture();
  await f.load();
  f.groups = [{ id: id(8), name: "Grupo nuevo" }];
  await f.controller.createDraft(request);
  assert.equal(f.postCalls, 0);
  assert.equal(f.lastDraft().mode, "invalid");
  assert.match(f.lastDraft().message, /ya no está disponible/);
});

test("bloquea alta duplicada y consulta mientras el POST está pendiente", async () => {
  let release;
  let markStarted;
  const postStarted = new Promise((resolve) => {
    markStarted = resolve;
  });
  const f = fixture({
    postGate: new Promise((resolve) => {
      release = resolve;
    }),
    onPost: () => markStarted(),
  });
  await f.load();
  const pending = f.controller.createDraft(request);
  await postStarted;
  await f.controller.createDraft(request);
  await f.controller.load({ status: "DRAFT" });
  assert.equal(f.postCalls, 1);
  assert.equal(
    f.calls.some((call) => call.path.includes("?status=DRAFT")),
    false,
  );
  release();
  await pending;
  assert.equal(f.postCalls, 1);
  assert.ok(f.busyChanges.includes(true));
  assert.ok(f.busyChanges.includes(false));
});

test("un error al recargar conserva la confirmación y no repite el alta", async () => {
  const f = fixture({ listErrorAt: 2, listError: new Error("red") });
  await f.load();
  await f.controller.createDraft(request);
  assert.equal(f.lastDraft().mode, "success");
  assert.equal(f.lastList().mode, "error");
  assert.equal(f.postCalls, 1);
});

test("crear otro vuelve a verificar sesión y grupos antes de habilitar el formulario", async () => {
  const f = fixture();
  await f.load();
  await f.controller.createDraft(request);
  await f.controller.startAnother();
  assert.equal(f.lastDraft().mode, "ready");
  assert.equal(f.lastDraft().locked, false);
  assert.equal(f.draftResets, 1);
  assert.equal(f.postCalls, 1);
});
