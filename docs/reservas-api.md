# API de reservas — BOOK-03 T4 A

Estado local: rutas montadas y protegidas para CUSTOMER registrado. No hay compra de producción habilitada: el servidor aún no tiene catálogo de viajes/plantillas ni verificador/revisión asistida reales. En esa situación responde 503 y no crea inventario ni reservas ficticias. Los fixtures de catálogo/acreditación pertenecen exclusivamente a pruebas.

## Sesión y protección

Usar la sesión de cookie que entrega auth. Antes de POST, obtener un token CSRF vigente desde GET /api/v1/auth/csrf y enviarlo como X-CSRF-Token, junto con las cookies. Renovarlo después de iniciar sesión porque está ligado a la sesión. El body no puede elegir propietario, cooperativa, importe, beneficio acreditado, estado o vencimiento.

Solo CUSTOMER sin cooperativa interna usa estas rutas. Operación de oficinista e invitados siguen pendientes. Las respuestas privadas y errores llevan Cache-Control: no-store.

## Recorrido

1. GET /api/v1/bookings/availability?tripId=...&fromPosition=...&toPosition=... devuelve {seats:[{seatId,status}]}. Posiciones enteras no negativas, IDs reales del catálogo. No revela ocupantes ni garantiza que sigan libres al confirmar.
2. POST /api/v1/bookings/summary con application/json, cookies y CSRF. Body: tripId, fromPosition, toPosition, seatIds, passengers. Cada pasajero contiene seatId, identificationNumber, fullName y birthDate (YYYY-MM-DD). Devuelve {summary,summaryRevision}; no crea reserva ni plazo.
3. Mostrar el resumen devuelto, incluidos pasajeros, USD, desglose y total. Después de aceptación explícita, POST /api/v1/bookings con los mismos cinco campos y summaryAccepted:true, acceptedSummaryRevision. Exigir cabecera Idempotency-Key con UUID v4 en minúsculas, generado una sola vez por intento de compra. No enviar requestKey en body.
4. Respuesta 201 {booking}: bookingId, ownerId, status, summary, createdAt y expiresAt. Mostrar identificador y plazo de esa respuesta. Estado inicial PENDING_PAYMENT. Un reenvío válido devuelve 201 y la misma reserva; no es otra compra ni prolonga el plazo.

El importe siempre se calcula en el servidor; summaryRevision detecta cambios, no autoriza ni permite cobrar lo que indique el navegador. El backend usa la fecha local America/Guayaquil.

## Recuperación y errores

- Ante timeout/error de conexión con resultado desconocido, conservar misma clave y solicitud; reintentar después de recuperar sesión/CSRF si corresponde. No crear otra clave automáticamente ni afirmar que la primera reserva falló.
- Si el servidor ya guardó, recupera la reserva con sus datos/fechas persistidos aunque catálogo/acreditación estén caídos. La identidad se verifica cada vez y otra persona no puede recuperar con la clave.
- 400 BOOKING_VALIDATION_ERROR: revisar entrada y clave. 401 UNAUTHENTICATED: iniciar sesión otra vez. 403 CSRF_TOKEN_INVALID: renovar CSRF. 403 FORBIDDEN: rol no permitido.
- 404 BOOKING_TRIP_UNAVAILABLE: el viaje no está comercializable.
- 409 BOOKING_SUMMARY_CHANGED: obtener/mostrar nuevo resumen y aceptar otro intento con clave nueva; no cambiar el precio silenciosamente.
- 409 BOOKING_REQUEST_KEY_REUSED: esa clave pertenece a otros datos de compra; recuperar el intento original o iniciar otra compra explícita.
- 409 BOOKING_SEAT_CONFLICT: actualizar disponibilidad y corregir selección. BOOKING_BENEFIT_REVIEW_REQUIRED: requiere revisión de acreditación, no declarar pasajero verificado.
- 415 UNSUPPORTED_MEDIA_TYPE: enviar application/json. 503 BOOKING_TRIP_SERVICE_UNAVAILABLE / BOOKING_BENEFIT_SERVICE_UNAVAILABLE: compra temporalmente no disponible; no mostrar éxito.
- 500 INTERNAL_ERROR: mensaje genérico, sin detalles SQL ni de pasajeros. No registrar cuerpos ni comprobantes en logs.

## Configuración y pruebas

BOOKING_PROOF_WINDOW_SECONDS configura el plazo inicial (300 por defecto; 180 a 300). No usar otro temporizador o configuración paralela para pagos. El valor se valida al arrancar.

createBookingsModule permite inyectar tripCatalog y passengerVerifier en composición, conforme a BOOK-03-T2/T3. Los adaptadores reales de esos módulos siguen pendientes; no se pasan por HTTP ni se sustituyen con simuladores en server.js. El montaje de pagos se conserva sin conectar aún su ciclo de comprobantes/expiración.

Prueba de HTTP y arranque: backend/tests/integration/bookings/booking-http.test.js. Usa JWT, sesiones, CSRF y PostgreSQL reales; solo catálogo y acreditación tienen fixtures identificadas. La pantalla y su verificación de teclado/adaptación pertenecen a T4 B.
