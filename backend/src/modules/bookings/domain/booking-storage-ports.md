# Puerto privado de persistencia — BOOK-03 T2

reserve({tripId, cooperativeId}, prepare) adquiere la coordinación de inventario en una transacción. Después llama una vez a prepare, que devuelve {input, context} de BOOK-03 T1. El futuro caso de uso debe resolver las fuentes reales, autorización, acreditación, versión de resumen y hora de servidor dentro de ese paso; prepare no es un callback del navegador. Si el contexto cambia de viaje/cooperativa se rechaza. Una excepción revierte reserva y todas las ocupaciones. Una llamada repetida con ID existente da BOOKING_ALREADY_EXISTS, no éxito idempotente.

listEffectiveByTrip({tripId, cooperativeId}) implementa la lectura de ocupaciones del puerto de disponibilidad. findByOwner({bookingId, cooperativeId, ownerId}) es una consulta privada autorizable por el futuro caso de uso, no findForPayment ni una ruta pública. Un ID sin propietario/cooperativa no basta para leer.

Las ocupaciones activas incluyen las que esperan revisión y no expiran por una lectura. Las transiciones de pago y liberación deben coordinar estado y ocupaciones de forma transaccional conforme a BOOK-06/07; no están implementadas por este repositorio inicial.

La elección de catálogo y asientos delegada por Leslie consta en docs/specs/BOOK-03-T2.md. No hay proveedor ficticio en producción, index.js ni montaje HTTP en esta entrega. La garantía de no superposición exige que todo escritor de inventario use la misma coordinación por viaje; no se autoriza SQL externo que la eluda.

## Consumidores de T3

getBookingSummary y createBooking consumen puertos inyectados, definidos con detalle en docs/specs/BOOK-03-T3.md: buyerIdentity.resolve(authContext), TripCatalog.findBookableById(tripId), passengerVerifier.verify({ownerId, passengers, departureDate}), clock(), calendarDateAt(instant), newId() y proofWindowSeconds de configuración.

La entrada cliente de creación incorpora summaryAccepted true y acceptedSummaryRevision. La revisión SHA-256 del resumen canónico detecta cambios y no autentica, firma, reserva ni permite elegir precios; el servidor siempre recalcula. El caso de uso resuelve el comprador fuera del body y entrega a reserve una preparación propia que relee catálogo, acreditación y reloj tras el bloqueo. La escritura rechaza un resumen distinto y una cooperativa que ya no coincide con el bloqueo inicial. La consulta del resumen no garantiza disponibilidad: solo la transacción decide la ocupación.

Estos casos de uso no convierten un doble de pruebas en proveedor real ni quedan montados públicamente. Reintentar automáticamente tras una respuesta de creación perdida sigue sin contrato idempotente; el conflicto por asiento evita otra ocupación incompatible, pero no equivale a recuperar la primera respuesta.

## Recuperación de creación — BOOK-03 T3 R

reserveOnce({ownerId, requestKey, requestFingerprint}, locate, prepare) serializa por propietario verificado y clave UUID v4 con bloqueo asesor transaccional. Si ya hay una reserva de esa pareja y coincide la huella de solicitud, devuelve su representación privada persistida (estado actual), sin ejecutar locate/prepare ni reiniciar fechas. Otra huella da BOOKING_REQUEST_KEY_REUSED. La clave sola no autoriza lectura; buyerIdentity se valida en cada llamada.

Si no existe, locate obtiene alcance desde catálogo de servidor y se reutiliza la escritura T2 bajo bloqueo de viaje. prepare(scope) recibe ese alcance, relee contexto y entrega propietario coincidente. Clave/huella y reserva se guardan en la misma fila/transacción que las ocupaciones, con unicidad por propietario/clave. Orden de coordinación: intento y después inventario. Fallo antes de confirmar no consume la clave; resultado desconocido de COMMIT exige reintentar con la misma clave, sin afirmar si se guardó o no.

createBooking conserva la ruta privada sin clave para consumidores previos; T4 debe exigir requestKey válido para toda creación pública. Una compra nueva o un resumen distinto usa otra clave, y vuelve a validar disponibilidad/precios. La ruta sin clave no ofrece recuperación idempotente.

La migración inversa conserva reservas/asientos pero elimina metadatos de reintento. Reaplicarla restaura columnas, no claves antiguas; no permite prometer recuperación idempotente de esas compras. No hay limpieza automática ni caducidad independiente de claves en este incremento; quedan mientras exista su reserva. Detalle y evidencia: docs/specs/BOOK-03-T3-R.md.
