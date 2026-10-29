import { ApiError } from "../api/api-error.js";

export const ATTEMPT_STORAGE_KEY = "transviaje.bookings.attempt";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DEFINITIVE_ERRORS = new Set([
  "BOOKING_VALIDATION_ERROR",
  "BOOKING_SUMMARY_CHANGED",
  "BOOKING_SEAT_CONFLICT",
  "BOOKING_TRIP_UNAVAILABLE",
  "BOOKING_BENEFIT_REVIEW_REQUIRED",
]);

function storageFailure() {
  return new ApiError(
    "BOOKING_STORAGE_ERROR",
    "Tu navegador no permitió preparar una confirmación recuperable. Inténtalo en una pestaña nueva.",
  );
}
export function createAttemptStore(storage) {
  return {
    read() {
      try {
        const key = storage.getItem(ATTEMPT_STORAGE_KEY);
        if (key !== null && !UUID.test(key)) throw storageFailure();
        return key;
      } catch {
        throw storageFailure();
      }
    },
    save(key) {
      try {
        if (typeof key !== "string" || !UUID.test(key)) throw storageFailure();
        storage.setItem(ATTEMPT_STORAGE_KEY, key);
        if (storage.getItem(ATTEMPT_STORAGE_KEY) !== key)
          throw storageFailure();
      } catch {
        throw storageFailure();
      }
    },
    clear() {
      try {
        storage.removeItem(ATTEMPT_STORAGE_KEY);
      } catch {
        throw storageFailure();
      }
    },
  };
}
function invalidResponse() {
  return new ApiError(
    "RESPONSE_INVALID",
    "No se pudo leer una respuesta válida. Vuelve a consultar.",
  );
}
function validSummary(summary) {
  return (
    summary &&
    summary.currency === "USD" &&
    typeof summary.tripId === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(summary.departureDate) &&
    Array.isArray(summary.passengers) &&
    summary.passengers.length > 0 &&
    summary.passengers.every(
      (passenger) =>
        typeof passenger.seatId === "string" &&
        typeof passenger.fullName === "string" &&
        typeof passenger.identificationNumber === "string" &&
        typeof passenger.birthDate === "string" &&
        Number.isSafeInteger(passenger.quote?.totalPriceCents) &&
        passenger.quote.totalPriceCents > 0,
    ) &&
    ["basePriceCents", "discountCents", "totalPriceCents"].every(
      (field) =>
        Number.isSafeInteger(summary.totals?.[field]) &&
        summary.totals[field] >= 0,
    )
  );
}
function readBooking(result) {
  const booking = result?.booking;
  if (
    !booking ||
    typeof booking.bookingId !== "string" ||
    !booking.bookingId ||
    typeof booking.status !== "string" ||
    !validSummary(booking.summary) ||
    ![booking.createdAt, booking.expiresAt].every(
      (value) =>
        typeof value === "string" && Number.isFinite(Date.parse(value)),
    )
  )
    throw invalidResponse();
  return booking;
}
const copy = (value) => JSON.parse(JSON.stringify(value));

export function createBookingFlow({ api, attemptStore, newKey }) {
  let reference = attemptStore.read();
  let review = null;
  let input = null;
  let request = null;
  let booking = null;
  let busy = false;
  function assertIdle() {
    if (busy)
      throw new ApiError("BOOKING_BUSY", "Espera a que termine la consulta.");
  }
  async function submit() {
    busy = true;
    try {
      booking = readBooking(await api.create(request, reference));
      return booking;
    } catch (error) {
      if (
        error.status >= 400 &&
        error.status < 500 &&
        DEFINITIVE_ERRORS.has(error.code)
      ) {
        attemptStore.clear();
        reference = null;
        request = null;
        review = null;
      }
      throw error;
    } finally {
      busy = false;
    }
  }
  return {
    get state() {
      return Object.freeze({
        reference,
        review,
        booking,
        busy,
        canRetry: !!request,
        locked: busy || !!reference || !!booking,
      });
    },
    invalidate() {
      if (reference || booking || busy) return;
      review = null;
      input = null;
    },
    async review(value) {
      assertIdle();
      if (reference || booking)
        throw new ApiError(
          "BOOKING_PENDING",
          "Primero consulta el intento pendiente.",
        );
      const snapshot = copy(value);
      review = null;
      input = null;
      busy = true;
      try {
        const result = await api.summary(snapshot);
        if (
          !validSummary(result?.summary) ||
          !/^[a-f0-9]{64}$/.test(result.summaryRevision) ||
          result.summary.tripId !== snapshot.tripId ||
          result.summary.fromPosition !== snapshot.fromPosition ||
          result.summary.toPosition !== snapshot.toPosition ||
          result.summary.passengers.length !== snapshot.seatIds.length ||
          new Set(
            result.summary.passengers.map((passenger) => passenger.seatId),
          ).size !== snapshot.seatIds.length ||
          result.summary.passengers.some(
            (passenger) => !snapshot.seatIds.includes(passenger.seatId),
          )
        ) {
          throw invalidResponse();
        }
        input = snapshot;
        review = copy(result);
        return review;
      } finally {
        busy = false;
      }
    },
    async confirm(accepted) {
      assertIdle();
      if (reference || booking || !review || accepted !== true) {
        throw new ApiError(
          "BOOKING_ACCEPTANCE_REQUIRED",
          "Revisa y acepta el resumen antes de confirmar.",
        );
      }
      const key = newKey();
      attemptStore.save(key);
      reference = key;
      request = {
        ...copy(input),
        summaryAccepted: true,
        acceptedSummaryRevision: review.summaryRevision,
      };
      return submit();
    },
    async retry() {
      assertIdle();
      if (!reference || !request || booking) {
        throw new ApiError(
          "BOOKING_PENDING",
          "Consulta primero el resultado de la reserva.",
        );
      }
      return submit();
    },
    async recover() {
      assertIdle();
      if (!reference) return null;
      busy = true;
      try {
        booking = readBooking(await api.attempt(reference));
        return booking;
      } finally {
        busy = false;
      }
    },
    finish() {
      if (!booking)
        throw new ApiError(
          "BOOKING_PENDING",
          "Consulta primero el intento pendiente.",
        );
      attemptStore.clear();
    },
  };
}
