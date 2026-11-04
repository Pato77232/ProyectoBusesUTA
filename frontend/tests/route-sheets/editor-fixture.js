export const ids = Object.fromEntries(
  [
    "sheet",
    "coop",
    "group",
    "bus",
    "frequency",
    "required",
    "service",
    "transfer",
    "block",
    "user",
  ].map((key, i) => [
    key,
    `${String(i + 1).padStart(8, "0")}-0000-4000-8000-000000000001`,
  ]),
);
export const clone = (value) => globalThis.structuredClone(value);
export function context() {
  const instant = (time) => `2030-01-01T${time}:00-05:00`;
  return {
    sheet: {
      id: ids.sheet,
      cooperativeId: ids.coop,
      busGroupId: ids.group,
      busGroupName: "Grupo QA",
      routeDate: "2030-01-01",
      status: "DRAFT",
      hasLegacyAssignments: false,
    },
    buses: [
      {
        id: ids.bus,
        cooperativeId: ids.coop,
        busGroupId: ids.group,
        plate: "TBM-0901",
        unitNumber: 1,
      },
    ],
    frequencies: [
      {
        id: ids.frequency,
        cooperativeId: ids.coop,
        origin: "Ambato",
        destination: "Quito",
        stops: ["Latacunga"],
        departureTime: "07:00",
        antResolutionNumber: "ANT-QA",
        status: "ACTIVE",
      },
    ],
    programming: {
      routeSheetId: ids.sheet,
      cooperativeId: ids.coop,
      revision: 1,
      programming: {
        cooperativeId: ids.coop,
        busGroupId: ids.group,
        cycleStartDate: "2030-01-01",
        cycleLengthDays: 1,
        requiredServices: [
          {
            id: ids.required,
            frequencyId: ids.frequency,
            departureAt: instant("07:00"),
          },
        ],
        agendas: [
          {
            busId: ids.bus,
            initialAvailability: {
              availableAt: instant("00:00"),
              locationKey: "Ambato",
            },
            activities: [
              {
                id: ids.service,
                kind: "SERVICE",
                frequencyId: ids.frequency,
                requiredServiceId: ids.required,
                departureAt: instant("07:00"),
                arrivalAt: instant("08:00"),
                preparationMinutes: 15,
                readyAt: instant("08:15"),
                points: [
                  {
                    position: 0,
                    locationKey: "Ambato",
                    departureAt: instant("07:00"),
                  },
                  {
                    position: 1,
                    locationKey: "Latacunga",
                    arrivalAt: instant("07:25"),
                    departureAt: instant("07:30"),
                  },
                  {
                    position: 2,
                    locationKey: "Quito",
                    arrivalAt: instant("08:00"),
                  },
                ],
              },
              {
                id: ids.transfer,
                kind: "TRANSFER",
                originKey: "Quito",
                destinationKey: "Ambato",
                departureAt: instant("08:15"),
                arrivalAt: instant("10:00"),
                preparationMinutes: 0,
              },
            ],
            blocks: [
              {
                id: ids.block,
                kind: "REST",
                startAt: instant("10:00"),
                endAt: instant("23:00"),
                reason: "Descanso declarado",
              },
            ],
          },
        ],
      },
    },
    tariff: {
      routeSheetId: ids.sheet,
      cooperativeId: ids.coop,
      revision: 1,
      tariff: {
        schemaVersion: 1,
        currency: "USD",
        policy: {
          discountStrategy: "MAX_ELIGIBLE",
          vipSurchargeBps: 2500,
          minorDiscountBps: 5000,
          seniorDiscountBps: 4000,
          disabilityDiscountBps: 6000,
        },
        frequencies: [
          {
            frequencyId: ids.frequency,
            routePoints: ["Ambato", "Latacunga", "Quito"],
            prices: [
              { fromPosition: 0, toPosition: 1, amountCents: 200 },
              { fromPosition: 0, toPosition: 2, amountCents: 450 },
              { fromPosition: 1, toPosition: 2, amountCents: 300 },
            ],
          },
        ],
      },
    },
  };
}
export function applyProgramming(source, body) {
  source.programming = {
    routeSheetId: ids.sheet,
    cooperativeId: ids.coop,
    revision: source.programming.revision + 1,
    programming: {
      ...clone(body.programming),
      cooperativeId: ids.coop,
      busGroupId: ids.group,
    },
  };
  return clone(source.programming);
}
export function applyTariff(source, body) {
  source.tariff = {
    routeSheetId: ids.sheet,
    cooperativeId: ids.coop,
    revision: source.tariff.revision + 1,
    tariff: {
      schemaVersion: 1,
      currency: "USD",
      policy: { ...body.policy, discountStrategy: "MAX_ELIGIBLE" },
      frequencies: body.frequencies.map((f) => ({
        ...clone(f),
        routePoints: ["Ambato", "Latacunga", "Quito"],
      })),
    },
  };
  return { tariff: clone(source.tariff) };
}
