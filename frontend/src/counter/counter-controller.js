import { combineSeatMap } from "../bookings/seat-map.js";
import { ecuadorDate, shiftDate } from "../search/upcoming.js";
import {
  counterMessage,
  ownTrips,
  passengerProblem,
  saleRequest,
  tripContext,
} from "./counter-model.js";

/**
 * BOOK-CAJA-02: pasos de la venta en boletería. La vista solo dibuja; el controlador
 * conserva la clave de la reserva y el recibo para reintentar sin duplicar.
 */
export function createCounterController({
  api,
  view,
  newId,
  now = () => Date.now(),
}) {
  let state = {
    cooperativeId: null,
    day: null,
    listMode: "day",
    trips: [],
    trip: null,
    seats: [],
    selected: [],
    review: null,
    booking: null,
    requestKey: null,
    receiptId: null,
    sheet: null,
    busy: false,
  };
  const set = (patch) => {
    state = { ...state, ...patch };
    view.render(state);
  };

  async function run(work, loading) {
    if (state.busy) return;
    set({ busy: true });
    view.notice(loading, "info");
    try {
      await work();
    } catch (error) {
      view.notice(counterMessage(error), "error");
    } finally {
      set({ busy: false });
    }
  }

  async function loadSeats() {
    const context = tripContext(state.trip);
    const [map, availability] = await Promise.all([
      api.seatMap(context),
      api.availability(context),
    ]);
    const seats = combineSeatMap(map, availability?.seats);
    set({
      seats,
      selected: state.selected.filter((id) =>
        seats.some((s) => s.seatId === id && s.status === "AVAILABLE"),
      ),
    });
  }

  return {
    get state() {
      return state;
    },
    async start() {
      try {
        const { user } = (await api.session()) ?? {};
        if (user?.role !== "CLERK" || !user.cooperative_id) {
          view.signedOut(
            "La boletería es solo para oficinistas. Inicia sesión con tu cuenta de oficinista.",
          );
          return;
        }
        set({ cooperativeId: user.cooperative_id });
        await this.showDay(ecuadorDate(now()));
      } catch (error) {
        if (error?.status === 401)
          view.signedOut("Tu sesión terminó. Inicia sesión otra vez.");
        else view.notice(counterMessage(error), "error");
      }
    },
    /** SEARCH-02: tabla con los viajes de un día de la cooperativa. */
    showDay(date) {
      const today = ecuadorDate(now());
      const day = !date || date < today ? today : date;
      set({ day, listMode: "day", trip: null, seats: [], selected: [], review: null });
      return run(async () => {
        const result = await api.upcoming({
          date: day,
          cooperativeId: state.cooperativeId,
        });
        const trips = ownTrips(result?.trips, state.cooperativeId);
        set({ trips });
        view.notice(
          trips.length
            ? "Elige el viaje y pulsa «Vender»."
            : "Tu cooperativa no tiene viajes a la venta ese día. Prueba otro día.",
          trips.length ? "info" : "empty",
        );
      }, "Cargando los viajes del día…");
    },
    previousDay() {
      return this.showDay(shiftDate(state.day, -1));
    },
    nextDay() {
      return this.showDay(shiftDate(state.day, 1));
    },
    search(input) {
      return run(async () => {
        const result = await api.searchTrips({
          origin: input.origin.trim(),
          destination: input.destination.trim(),
          date: input.date,
        });
        const trips = ownTrips(result?.trips, state.cooperativeId);
        set({
          trips,
          listMode: "search",
          trip: null,
          seats: [],
          selected: [],
          review: null,
        });
        view.notice(
          trips.length
            ? "Elige el viaje para ver sus asientos."
            : "Tu cooperativa no tiene viajes publicados para esa búsqueda.",
          trips.length ? "info" : "empty",
        );
      }, "Buscando viajes de tu cooperativa…");
    },
    chooseTrip(index) {
      const trip = state.trips[index];
      if (!trip) return;
      set({ trip, seats: [], selected: [], review: null });
      return run(async () => {
        await loadSeats();
        view.notice(
          "Elige uno o varios asientos libres y completa cada pasajero.",
          "info",
        );
      }, "Cargando los asientos…");
    },
    refreshSeats() {
      if (!state.trip) return;
      return run(loadSeats, "Actualizando los asientos…");
    },
    toggleSeat(seatId) {
      if (state.busy || state.booking || state.review) return;
      const seat = state.seats.find((s) => s.seatId === seatId);
      if (!seat || seat.status !== "AVAILABLE") return;
      const selected = state.selected.includes(seatId)
        ? state.selected.filter((id) => id !== seatId)
        : [...state.selected, seatId];
      set({ selected });
    },
    review(passengers) {
      if (!state.trip || !state.selected.length) return;
      if (passengers.length !== state.selected.length) return;
      const problem = passengers.map(passengerProblem).find(Boolean);
      if (problem) {
        view.notice(problem, "error");
        return;
      }
      return run(async () => {
        const body = saleRequest(tripContext(state.trip), passengers);
        const quoted = await api.summary(body);
        set({ review: { body, ...quoted }, requestKey: newId() });
        view.notice(
          "Revisa el total con el pasajero y confirma para reservar los asientos.",
          "info",
        );
      }, "Calculando el total…");
    },
    edit() {
      if (state.booking) return;
      set({ review: null, requestKey: null });
    },
    confirm() {
      if (!state.review || state.booking) return;
      return run(async () => {
        const { booking } = await api.create(
          {
            ...state.review.body,
            summaryAccepted: true,
            acceptedSummaryRevision: state.review.summaryRevision,
          },
          state.requestKey,
        );
        set({ booking, receiptId: newId() });
        view.notice(
          "Asientos reservados. Cobra el total en efectivo y registra el cobro antes del vencimiento.",
          "info",
        );
      }, "Reservando los asientos…");
    },
    pay() {
      if (!state.booking || state.sheet) return;
      return run(async () => {
        await api.cash(state.booking.bookingId, {
          cashReceiptId: state.receiptId,
          amountCents: state.review.summary.totals.totalPriceCents,
        });
        const sheet = await api.tickets(state.booking.bookingId);
        set({ sheet });
        view.notice("Venta registrada. Imprime los boletos.", "success");
      }, "Registrando el cobro…");
    },
    reset() {
      set({
        trip: null,
        seats: [],
        selected: [],
        review: null,
        booking: null,
        requestKey: null,
        receiptId: null,
        sheet: null,
      });
      view.notice("Lista para una venta nueva.", "info");
    },
  };
}
