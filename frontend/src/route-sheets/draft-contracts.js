import { isDate, isUuid } from "./contracts.js";

export function readDraftRequest(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (key) => !["busGroupId", "routeDate", "notes"].includes(key),
    )
  )
    throw new Error("Los datos del borrador no son válidos.");
  if (!isUuid(input.busGroupId))
    throw new Error("Selecciona un grupo de buses.");
  if (!isDate(input.routeDate))
    throw new Error("Introduce una fecha válida para la hoja.");
  if (input.notes !== undefined && typeof input.notes !== "string")
    throw new Error("Las notas deben ser texto.");
  return {
    busGroupId: input.busGroupId,
    routeDate: input.routeDate,
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  };
}

export function readCreatedDraft(response, request, actor) {
  const sheet = response?.routeSheet;
  if (
    !sheet ||
    !isUuid(sheet.id) ||
    sheet.cooperativeId !== actor.cooperative_id ||
    sheet.createdBy !== actor.id ||
    sheet.busGroupId !== request.busGroupId ||
    sheet.routeDate !== request.routeDate ||
    sheet.status !== "DRAFT" ||
    (sheet.notes ?? null) !== (request.notes ?? null) ||
    (sheet.publishedBy !== undefined && sheet.publishedBy !== null) ||
    (sheet.publishedAt !== undefined && sheet.publishedAt !== null) ||
    !Array.isArray(sheet.assignments) ||
    sheet.assignments.length ||
    !Array.isArray(sheet.restDays) ||
    sheet.restDays.length
  )
    throw new Error("Alta no verificable.");
  return {
    id: sheet.id,
    busGroupId: sheet.busGroupId,
    routeDate: sheet.routeDate,
    status: sheet.status,
    notes: sheet.notes ?? null,
  };
}
