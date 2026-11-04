import { isUuid, isDate } from "./contracts.js";
const OFFSET_MS = 5 * 60 * 60 * 1000;
export const POLICY = [
  "vipSurchargeBps",
  "minorDiscountBps",
  "seniorDiscountBps",
  "disabilityDiscountBps",
];
const fail = (message) => {
  throw new Error(message);
};
const text = (value) =>
  typeof value === "string" && value.trim()
    ? value.trim().normalize("NFC")
    : fail("Completa los campos de texto obligatorios.");
export function whole(value, minimum = 0) {
  if (
    !/^[0-9]+$/.test(String(value)) ||
    value === "" ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < minimum
  )
    fail("Introduce un entero válido en días y minutos.");
  return Number(value);
}
export function localTime(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    fail("Fecha y hora no verificables.");
  return new Date(Date.parse(value) - OFFSET_MS).toISOString().slice(0, -1);
}
export function instant(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value)
  )
    fail("Completa fecha y hora de cada actividad y parada.");
  const parsed = new Date(value + "-05:00");
  const normalized =
    value.length === 16
      ? value + ":00.000"
      : value.length === 19
        ? value + ".000"
        : value.slice(0, 19) + value.slice(19).padEnd(4, "0");
  if (
    !Number.isFinite(parsed.getTime()) ||
    localTime(parsed.toISOString()) !== normalized
  )
    fail("Introduce fechas y horas reales.");
  return parsed.toISOString();
}
const id = (value) =>
  isUuid(value) ? value : fail("Identidad no verificable. Recarga la hoja.");
export const pointsOf = (frequency) => [
  frequency.origin,
  ...frequency.stops,
  frequency.destination,
];
export function decimal(value, maximum, allowZero = false) {
  if (typeof value !== "string" || !/^\d+(?:[.,]\d{1,2})?$/.test(value))
    fail(
      "Introduce importes y porcentajes con hasta dos decimales, sin separadores de miles.",
    );
  const [integer, fraction = ""] = value.replace(",", ".").split(".");
  const number = Number(integer) * 100 + Number(fraction.padEnd(2, "0"));
  if (
    !Number.isSafeInteger(number) ||
    number < (allowZero ? 0 : 1) ||
    number > maximum
  )
    fail("Importe o porcentaje fuera del rango permitido.");
  return number;
}
export const displayDecimal = (number) =>
  `${Math.floor(number / 100)}.${String(number % 100).padStart(2, "0")}`;
function assertUnique(rows, key = "id") {
  if (new Set(rows.map((row) => row[key])).size !== rows.length)
    fail("La respuesta contiene identidades repetidas.");
}
export function readEditor(value, sheetId, tenant) {
  const sheet = value?.sheet;
  if (
    !sheet ||
    sheet.id !== sheetId ||
    sheet.cooperativeId !== tenant ||
    !isUuid(sheet.busGroupId) ||
    typeof sheet.busGroupName !== "string" ||
    !sheet.busGroupName.trim() ||
    !isDate(sheet.routeDate) ||
    !["DRAFT", "PUBLISHED"].includes(sheet.status) ||
    typeof sheet.hasLegacyAssignments !== "boolean" ||
    !Array.isArray(value.buses) ||
    !Array.isArray(value.frequencies)
  )
    fail("No se pudo verificar la hoja y sus catálogos.");
  for (const bus of value.buses)
    if (
      !isUuid(bus.id) ||
      bus.cooperativeId !== tenant ||
      bus.busGroupId !== sheet.busGroupId ||
      typeof bus.plate !== "string" ||
      !bus.plate.trim() ||
      !Number.isSafeInteger(bus.unitNumber) ||
      bus.unitNumber < 1
    )
      fail("Catálogo de buses no verificable.");
  for (const frequency of value.frequencies)
    if (
      !isUuid(frequency.id) ||
      frequency.cooperativeId !== tenant ||
      !["ACTIVE", "INACTIVE"].includes(frequency.status) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(frequency.departureTime) ||
      !Array.isArray(frequency.stops) ||
      !pointsOf(frequency).every(
        (place) => typeof place === "string" && place.trim(),
      )
    )
      fail("Catálogo de frecuencias no verificable.");
  assertUnique(value.buses);
  assertUnique(value.frequencies);
  for (const record of [value.programming, value.tariff])
    if (
      !record ||
      record.routeSheetId !== sheetId ||
      record.cooperativeId !== tenant ||
      !Number.isInteger(record.revision) ||
      record.revision < 0
    )
      fail("Revisiones no verificables.");
  if (
    (value.programming.revision === 0) !==
      (value.programming.programming === null) ||
    (value.tariff.revision === 0) !== (value.tariff.tariff === null)
  )
    fail("Contenido y revisión no coinciden.");
  if (
    value.programming.programming &&
    (value.programming.programming.cooperativeId !== tenant ||
      value.programming.programming.busGroupId !== sheet.busGroupId)
  )
    fail("Programación de otro contexto.");
  if (value.tariff.tariff) {
    const tariff = value.tariff.tariff;
    if (
      tariff.schemaVersion !== 1 ||
      tariff.currency !== "USD" ||
      tariff.policy?.discountStrategy !== "MAX_ELIGIBLE" ||
      POLICY.some(
        (key) =>
          !Number.isInteger(tariff.policy[key]) ||
          tariff.policy[key] < 0 ||
          tariff.policy[key] > 10000,
      ) ||
      !Array.isArray(tariff.frequencies)
    )
      fail("Tarifario no verificable.");
    assertUnique(tariff.frequencies, "frequencyId");
    for (const entry of tariff.frequencies) {
      id(entry.frequencyId);
      if (
        !Array.isArray(entry.routePoints) ||
        entry.routePoints.length < 2 ||
        !Array.isArray(entry.prices)
      )
        fail("Recorrido tarifario no verificable.");
      const pairs = new Set();
      for (const price of entry.prices) {
        if (
          !Number.isInteger(price.fromPosition) ||
          !Number.isInteger(price.toPosition) ||
          price.fromPosition < 0 ||
          price.toPosition <= price.fromPosition ||
          price.toPosition >= entry.routePoints.length ||
          !Number.isSafeInteger(price.amountCents) ||
          price.amountCents <= 0 ||
          price.amountCents > 9_999_999_999
        )
          fail("Importes no verificables.");
        pairs.add(`${price.fromPosition}-${price.toPosition}`);
      }
      if (
        pairs.size !== entry.prices.length ||
        pairs.size !==
          (entry.routePoints.length * (entry.routePoints.length - 1)) / 2
      )
        fail("Faltan combinaciones tarifarias.");
    }
  }
  const context = globalThis.structuredClone(value);
  const model = programModel(context);
  if (context.programming.programming) programmingBody(model, context);
  return context;
}
function frequencyOf(context, frequencyId) {
  return (
    context.frequencies.find((f) => f.id === frequencyId) ||
    fail("La frecuencia referenciada no está disponible.")
  );
}
export function serviceDeparture(service, context) {
  if (!isDate(service.date)) fail("Selecciona el día de salida del servicio.");
  return instant(
    `${service.date}T${frequencyOf(context, service.frequencyId).departureTime}`,
  );
}
export function programModel(context) {
  const source = context.programming.programming;
  if (!source)
    return {
      cycleStartDate: context.sheet.routeDate,
      cycleLengthDays: "",
      requiredServices: [],
      agendas: [],
    };
  return {
    cycleStartDate: source.cycleStartDate,
    cycleLengthDays: String(source.cycleLengthDays),
    requiredServices: source.requiredServices.map((s) => ({
      id: s.id,
      frequencyId: s.frequencyId,
      date: localTime(s.departureAt).slice(0, 10),
      locked: true,
    })),
    agendas: source.agendas.map((a) => {
      if (
        (a.cooperativeId && a.cooperativeId !== context.sheet.cooperativeId) ||
        (a.busGroupId && a.busGroupId !== context.sheet.busGroupId)
      )
        fail("Agenda ajena.");
      return {
        busId: a.busId,
        initialAvailability: {
          availableAt: localTime(a.initialAvailability.availableAt),
          locationKey: a.initialAvailability.locationKey,
        },
        activities: a.activities.map((item) => {
          if (
            (item.cooperativeId &&
              item.cooperativeId !== context.sheet.cooperativeId) ||
            (item.busId && item.busId !== a.busId)
          )
            fail("Actividad ajena.");
          const base = {
            id: item.id,
            kind: item.kind,
            departureAt: localTime(item.departureAt),
            arrivalAt: localTime(item.arrivalAt),
            preparationMinutes: String(item.preparationMinutes),
            locked: true,
          };
          return item.kind === "SERVICE"
            ? {
                ...base,
                requiredServiceId: item.requiredServiceId,
                frequencyId: item.frequencyId,
                points: item.points.map((p) => ({
                  position: p.position,
                  ...(p.arrivalAt ? { arrivalAt: localTime(p.arrivalAt) } : {}),
                  ...(p.departureAt
                    ? { departureAt: localTime(p.departureAt) }
                    : {}),
                })),
              }
            : {
                ...base,
                originKey: item.originKey,
                destinationKey: item.destinationKey,
              };
        }),
        blocks: a.blocks.map((b) => ({
          id: b.id,
          kind: b.kind,
          startAt: localTime(b.startAt),
          endAt: localTime(b.endAt),
          reason: b.reason,
        })),
      };
    }),
  };
}
export function tariffModel(context, previous) {
  const saved = context.tariff.tariff;
  const ids = context.programming.programming
    ? [
        ...new Set(
          context.programming.programming.requiredServices.map(
            (s) => s.frequencyId,
          ),
        ),
      ]
    : context.sheet.status === "PUBLISHED"
      ? (saved?.frequencies ?? []).map((f) => f.frequencyId)
      : [];
  return {
    policy: Object.fromEntries(
      POLICY.map((key) => [
        key,
        previous
          ? previous.policy[key]
          : saved
            ? displayDecimal(saved.policy[key])
            : "",
      ]),
    ),
    frequencies: ids.map((frequencyId) => {
      const routePoints = pointsOf(frequencyOf(context, frequencyId));
      const old =
        previous?.frequencies.find((f) => f.frequencyId === frequencyId) ??
        saved?.frequencies.find((f) => f.frequencyId === frequencyId);
      const same =
        old && JSON.stringify(old.routePoints) === JSON.stringify(routePoints);
      const prices = [];
      for (
        let fromPosition = 0;
        fromPosition < routePoints.length - 1;
        fromPosition++
      )
        for (
          let toPosition = fromPosition + 1;
          toPosition < routePoints.length;
          toPosition++
        ) {
          const found =
            same &&
            old.prices.find(
              (p) =>
                p.fromPosition === fromPosition && p.toPosition === toPosition,
            );
          prices.push({
            fromPosition,
            toPosition,
            amount: found
              ? (found.amount ?? displayDecimal(found.amountCents))
              : "",
          });
        }
      return { frequencyId, routePoints, prices };
    }),
  };
}
export function programmingBody(model, context) {
  if (model.cycleStartDate !== context.sheet.routeDate)
    fail("El inicio debe coincidir con la fecha de la hoja.");
  const requiredServices = model.requiredServices.map((s) => ({
    id: id(s.id),
    frequencyId: id(s.frequencyId),
    departureAt: serviceDeparture(s, context),
  }));
  if (!requiredServices.length || !model.agendas.length)
    fail("Añade servicios requeridos y al menos una agenda de bus.");
  const agendas = model.agendas.map((a) => {
    if (!context.buses.some((bus) => bus.id === a.busId))
      fail("Selecciona un bus del grupo de la hoja.");
    return {
      busId: id(a.busId),
      initialAvailability: {
        availableAt: instant(a.initialAvailability.availableAt),
        locationKey: text(a.initialAvailability.locationKey),
      },
      activities: a.activities.map((item) => {
        const base = {
          id: id(item.id),
          kind: item.kind,
          departureAt: instant(item.departureAt),
          arrivalAt: instant(item.arrivalAt),
          preparationMinutes: whole(item.preparationMinutes),
        };
        if (item.kind === "TRANSFER")
          return {
            ...base,
            originKey: text(item.originKey),
            destinationKey: text(item.destinationKey),
          };
        if (item.kind !== "SERVICE") fail("Tipo de actividad no válido.");
        const service = requiredServices.find(
          (s) => s.id === item.requiredServiceId,
        );
        if (
          !service ||
          service.frequencyId !== item.frequencyId ||
          service.departureAt !== base.departureAt
        )
          fail("Asignación de servicio no verificable.");
        if (
          item.points.length !==
          pointsOf(frequencyOf(context, service.frequencyId)).length
        )
          fail("Completa todos los puntos del recorrido.");
        if (
          instant(item.points[0].departureAt) !== base.departureAt ||
          instant(item.points.at(-1).arrivalAt) !== base.arrivalAt
        )
          fail("Los extremos del recorrido deben coincidir con la actividad.");
        return {
          ...base,
          frequencyId: service.frequencyId,
          requiredServiceId: service.id,
          points: item.points.map((p, index, all) => {
            if (p.position !== index)
              fail("Posiciones de parada no verificables.");
            return {
              position: index,
              ...(index > 0 ? { arrivalAt: instant(p.arrivalAt) } : {}),
              ...(index < all.length - 1
                ? { departureAt: instant(p.departureAt) }
                : {}),
            };
          }),
        };
      }),
      blocks: a.blocks.map((b) => {
        if (!["REST", "MAINTENANCE"].includes(b.kind))
          fail("Tipo de bloqueo no válido.");
        return {
          id: id(b.id),
          kind: b.kind,
          startAt: instant(b.startAt),
          endAt: instant(b.endAt),
          reason: text(b.reason),
        };
      }),
    };
  });
  assertUnique(agendas, "busId");
  const ids = [
    ...requiredServices,
    ...agendas.flatMap((a) => [...a.activities, ...a.blocks]),
  ];
  assertUnique(ids);
  return {
    expectedRevision: context.programming.revision,
    programming: {
      cycleStartDate: model.cycleStartDate,
      cycleLengthDays: whole(model.cycleLengthDays, 1),
      requiredServices,
      agendas,
    },
  };
}
export function tariffBody(model, context) {
  if (!model.frequencies.length)
    fail("Guarda primero una programación con servicios.");
  return {
    expectedRevision: context.tariff.revision,
    policy: Object.fromEntries(
      POLICY.map((key) => [key, decimal(model.policy[key], 10000, true)]),
    ),
    frequencies: model.frequencies.map((f) => ({
      frequencyId: id(f.frequencyId),
      prices: f.prices.map((p) => ({
        fromPosition: p.fromPosition,
        toPosition: p.toPosition,
        amountCents: decimal(p.amount, 9_999_999_999),
      })),
    })),
  };
}
export function canonical(body) {
  function sort(value) {
    if (Array.isArray(value)) {
      const rows = value.map(sort);
      if (
        rows.every(
          (r) =>
            r && typeof r === "object" && (r.id || r.busId || r.frequencyId),
        )
      )
        rows.sort((a, b) =>
          String(a.id || a.busId || a.frequencyId).localeCompare(
            String(b.id || b.busId || b.frequencyId),
          ),
        );
      else if (rows.every((r) => r && Number.isInteger(r.fromPosition)))
        rows.sort(
          (a, b) =>
            a.fromPosition - b.fromPosition || a.toPosition - b.toPosition,
        );
      return rows;
    }
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .filter((key) => key !== "expectedRevision")
          .map((key) => [key, sort(value[key])]),
      );
    return value;
  }
  return JSON.stringify(sort(body));
}
export function addRequired(model, context, frequencyId, newId) {
  const frequency = frequencyOf(context, frequencyId);
  if (frequency.status !== "ACTIVE") fail("Selecciona una frecuencia activa.");
  model.requiredServices.push({
    id: newId(),
    frequencyId,
    date: context.sheet.routeDate,
    locked: false,
  });
}
export function removeRequired(model, serviceId) {
  if (
    model.agendas.some((a) =>
      a.activities.some((v) => v.requiredServiceId === serviceId),
    )
  )
    fail("Retira primero sus asignaciones de las agendas.");
  model.requiredServices = model.requiredServices.filter(
    (s) => s.id !== serviceId,
  );
}
export function addActivity(
  model,
  context,
  agendaIndex,
  kind,
  serviceId,
  newId,
) {
  const agenda = model.agendas[agendaIndex];
  if (kind === "TRANSFER") {
    agenda.activities.push({
      id: newId(),
      kind,
      departureAt: "",
      arrivalAt: "",
      preparationMinutes: "",
      originKey: "",
      destinationKey: "",
    });
    return;
  }
  const service = model.requiredServices.find((s) => s.id === serviceId);
  if (!service) fail("Selecciona un servicio requerido.");
  if (
    model.agendas.some((a) =>
      a.activities.some((v) => v.requiredServiceId === serviceId),
    )
  )
    fail("Ese servicio ya está asignado a un bus.");
  const departureAt = localTime(serviceDeparture(service, context));
  const points = pointsOf(frequencyOf(context, service.frequencyId)).map(
    (_place, index, all) => ({
      position: index,
      ...(index > 0 ? { arrivalAt: "" } : {}),
      ...(index < all.length - 1
        ? { departureAt: index === 0 ? departureAt : "" }
        : {}),
    }),
  );
  agenda.activities.push({
    id: newId(),
    kind: "SERVICE",
    requiredServiceId: service.id,
    frequencyId: service.frequencyId,
    departureAt,
    arrivalAt: "",
    preparationMinutes: "",
    points,
  });
}
