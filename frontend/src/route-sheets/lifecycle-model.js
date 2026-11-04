import { isUuid } from "./contracts.js";
import {
  canonical,
  programmingBody,
  programModel,
  tariffBody,
  tariffModel,
  localTime,
} from "./editor-model.js";

const DAY_MS = 86_400_000;
export function cyclePeriod(context, next = false) {
  const p = context.programming.programming;
  const length = p?.cycleLengthDays;
  const start = Date.parse(`${p?.cycleStartDate}T00:00:00-05:00`);
  if (!Number.isInteger(length) || length < 1 || !Number.isFinite(start))
    throw new Error("Guarda una programación completa antes de continuar.");
  const from = start + (next ? length * DAY_MS : 0);
  return {
    startAt: new Date(from).toISOString(),
    endExclusive: new Date(from + length * DAY_MS).toISOString(),
    cycleLengthDays: length,
  };
}
export const periodLabel = (period) =>
  `${localTime(period.startAt).slice(0, 16).replace("T", " ")} hasta ${localTime(period.endExclusive).slice(0, 16).replace("T", " ")} (fin excluido, UTC−05:00)`;

export function savedSignature(context) {
  return canonical({
    programming: programmingBody(programModel(context), context),
    tariff: tariffBody(tariffModel(context), context),
  });
}
export function makeIntent(kind, context, actor, newId) {
  const status = kind === "publish" ? "DRAFT" : "PUBLISHED";
  if (
    !["publish", "renew"].includes(kind) ||
    context.sheet.status !== status ||
    context.programming.revision < 1 ||
    context.tariff.revision < 1
  )
    throw new Error(
      "Guarda programación y tarifas, y comprueba el estado de la hoja.",
    );
  const body =
    kind === "publish"
      ? {
          expectedProgrammingRevision: context.programming.revision,
          expectedRevision: context.tariff.revision,
        }
      : {
          expectedProgrammingRevision: context.programming.revision,
          expectedTariffRevision: context.tariff.revision,
          requestKey: newId(),
        };
  return {
    kind,
    body,
    actorId: actor.id,
    cooperativeId: actor.cooperative_id,
    sheetId: context.sheet.id,
    busGroupId: context.sheet.busGroupId,
    signature: savedSignature(context),
    period: cyclePeriod(context, kind === "renew"),
  };
}
export function sameSource(context, intent) {
  return (
    context.sheet.id === intent.sheetId &&
    context.sheet.busGroupId === intent.busGroupId &&
    context.programming.revision === intent.body.expectedProgrammingRevision &&
    context.tariff.revision ===
      (intent.body.expectedRevision ?? intent.body.expectedTariffRevision) &&
    savedSignature(context) === intent.signature
  );
}
export function verifyRenewal(result, intent, target) {
  const r = result?.renewal;
  if (
    typeof result?.replayed !== "boolean" ||
    !r ||
    !isUuid(r.routeSheetId) ||
    r.routeSheetId === intent.sheetId ||
    r.routeSheetId !== target.sheet.id ||
    r.sourceRouteSheetId !== intent.sheetId ||
    !isUuid(r.seriesId) ||
    r.status !== "DRAFT" ||
    r.createdBy !== intent.actorId ||
    r.programmingRevision !== 1 ||
    r.tariffRevision !== 1 ||
    !Number.isFinite(Date.parse(r.createdAt)) ||
    r.startAt !== intent.period.startAt ||
    r.endExclusive !== intent.period.endExclusive ||
    r.cycleLengthDays !== intent.period.cycleLengthDays ||
    target.sheet.cooperativeId !== intent.cooperativeId ||
    target.sheet.busGroupId !== intent.busGroupId ||
    cyclePeriod(target).startAt !== intent.period.startAt ||
    cyclePeriod(target).endExclusive !== intent.period.endExclusive
  )
    throw new Error("No se pudo verificar el borrador de renovación.");
  return {
    id: r.routeSheetId,
    status: target.sheet.status,
    period: intent.period,
  };
}

// Solo la intención mínima; no tokens, credenciales ni datos de pasajeros.
export function createOperationStore(
  storage = () => globalThis.sessionStorage,
) {
  const key = (actor, sheetId) =>
    `route-sheet-operation:${actor.cooperative_id}:${actor.id}:${sheetId}`;
  return {
    read(actor, sheetId) {
      const raw = storage()?.getItem(key(actor, sheetId));
      if (!raw) return null;
      const intent = JSON.parse(raw);
      if (
        !intent ||
        !["publish", "renew"].includes(intent.kind) ||
        intent.actorId !== actor.id ||
        intent.cooperativeId !== actor.cooperative_id ||
        intent.sheetId !== sheetId ||
        !isUuid(intent.busGroupId) ||
        typeof intent.signature !== "string" ||
        !Number.isInteger(intent.body?.expectedProgrammingRevision) ||
        intent.body.expectedProgrammingRevision < 1 ||
        !Number.isInteger(
          intent.body.expectedRevision ?? intent.body.expectedTariffRevision,
        ) ||
        (intent.body.expectedRevision ?? intent.body.expectedTariffRevision) <
          1 ||
        (intent.kind === "renew" && !isUuid(intent.body.requestKey)) ||
        Object.keys(intent.body).some(
          (k) =>
            !(
              intent.kind === "publish"
                ? ["expectedRevision", "expectedProgrammingRevision"]
                : [
                    "expectedTariffRevision",
                    "expectedProgrammingRevision",
                    "requestKey",
                  ]
            ).includes(k),
        ) ||
        !Number.isFinite(Date.parse(intent.period?.startAt)) ||
        !Number.isFinite(Date.parse(intent.period?.endExclusive)) ||
        !Number.isInteger(intent.period.cycleLengthDays) ||
        intent.period.cycleLengthDays < 1 ||
        Date.parse(intent.period.endExclusive) -
          Date.parse(intent.period.startAt) !==
          intent.period.cycleLengthDays * DAY_MS
      )
        throw new Error(
          "La intención guardada no es verificable. No se enviarán operaciones.",
        );
      return intent;
    },
    write(actor, sheetId, intent) {
      const target = storage();
      if (!target)
        throw new Error(
          "No se pudo registrar la operación en esta pestaña. Habilita almacenamiento antes de confirmar.",
        );
      target.setItem(key(actor, sheetId), JSON.stringify(intent));
    },
    remove(actor, sheetId) {
      storage()?.removeItem(key(actor, sheetId));
    },
  };
}
