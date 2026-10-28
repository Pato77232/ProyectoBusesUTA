# BOOK-03 T2: persistencia y concurrencia de reservas

- Responsable: Leslie. Revisor propuesto: PabloToapanta.
- Fecha: 28 de octubre de 2026. Estado: especificada antes de implementación, autorizada por Leslie.
- Rama: feature/BOOK-03-resumen-creacion-dominio; continuación de T1 para una revisión conjunta.
- Reglas: RN-02, RN-40/42/43/50. Sin defecto inducido ni interfaz en este incremento.

## Autorización y contratos de proveedores
Leslie informó que David y Edwin delegaron en ella la elección del acuerdo y autorizó al asistente a elegir la implementación. Se documenta esta evidencia transmitida; no se atribuye revisión del código ni una API ya implementada a esos integrantes.

Contrato elegido: TripCatalog.findBookableById(tripId) entrega null o el snapshot de BOOK-03 T1: tripId estable de viaje fechado y bus asignado, cooperativeId, routePointCount, seatIds, departureDate local y segmentPricesCents de todos los tramos consecutivos. Para consultar por fecha, el proveedor podrá resolver previamente los IDs de viajes; reservas escribe solo contra un tripId real, no contra una frecuencia. Flota ofrece el inventario real del bus a ese catálogo mediante su API pública; los identificadores de asiento son texto estable y único dentro de la plantilla. Tarifas en centavos enteros, ordenadas por tramo; un cambio de bus/plantilla con reservas requiere una operación coordinada futura, no un cambio silencioso del snapshot.

Elegir este contrato no crea los adaptadores. Ningún catálogo simulado se compone en producción y no se exponen endpoints de reserva aún. El futuro caso de uso deberá resolver autorización, acreditación y resumen aceptado con el proveedor real.

## Repositorio privado de bookings
reserve({tripId, cooperativeId}, prepare) inicia una transacción y obtiene un bloqueo por cooperativa/viaje. Ejecuta prepare solo después del bloqueo; ese colaborador del futuro caso de uso devuelve {input, context} para createPendingBooking, con reloj y contexto del servidor recién resueltos. El repositorio vuelve a validar dominio, pertenencia al contexto y disponibilidad de todos los asientos antes de insertar. Si falla algo, revierte toda la transacción.

listEffectiveByTrip({tripId, cooperativeId}) entrega solo las ocupaciones efectivas de ese contexto; findByOwner({bookingId, cooperativeId, ownerId}) devuelve una reserva privada o null. Todas exigen contexto explícito. El repositorio no es autorización pública y no se exporta como API a pagos en esta tarea.

## Esquema nuevo y coordinación
Nueva migración, sin editar las anteriores: bookings guarda identificadores opacos, tramo, resumen privado JSONB con pasajeros/cotizaciones, importes enteros y fechas; booking_seat_allocations contiene ocupaciones por asiento; booking_trip_locks contiene una fila por cooperativa/viaje para SELECT FOR UPDATE. La integridad entre ocupación y reserva se protege con FK compuesta de tablas propias.

No se inventan tablas ni FK de viajes/plantillas inexistentes. Los IDs públicos de cooperativa/propietario son referencias lógicas de texto: el caso de uso deberá verificarlos mediante proveedores autorizados; no se promete integridad referencial con módulos ajenos en esta etapa ni soporte operativo de invitados. La decisión y sus límites se registran en ADR 0005.

El bloqueo serializa escrituras de inventario de un mismo viaje; todos los escritores futuros deberán usarlo. No se instala extensión PostgreSQL ni dependencia Node. La consulta informativa no bloquea. Las ocupaciones siguen efectivas hasta liberación explícita; no se hace expiración implícita ni se libera por tiempo sin coordinar comprobantes. La coordinación de recepción/expiración por reserva de BOOK-06/07 es otra tarea, no implementada aquí.

Estado inicial PENDING_PAYMENT. Asignaciones RESERVED/SOLD y bandera active para su posterior liberación; esta tarea solo crea RESERVED activas. Las transiciones posteriores requieren sus propias specs y transacciones. No existe SQL de aprobación, rechazo o expiración por este incremento.

## Aceptación y verificación
- Guardar todos los pasajeros, desglose, fechas y ocupaciones y recuperar solo por contexto y propietario.
- Dos solicitudes superpuestas concurrentes con conexiones reales: una reserva y un conflicto BOOKING_SEAT_CONFLICT. Usar una barrera y comprobar en PostgreSQL que la segunda transacción espera; no probarlo solo con memoria.
- Tramos adyacentes y viajes/cooperativas distintos no colisionan.
- Si falla la segunda inserción de ocupación, no persiste reserva ni primer asiento; probar rollback con PostgreSQL y fallo inyectado en su cliente.
- ID repetido no duplica reservas. El reintento idempotente de creación aún no está definido: responder BOOKING_ALREADY_EXISTS, sin sustituirlo por éxito.
- Migración reversible y reintegrable. Adaptar solo el recorrido de la prueba de flota que suponía ser la última migración, conservando todas sus aserciones.
- Ejecutar lint, formato y npm test con base PostgreSQL nueva y aislada; conservar fallos preexistentes visibles.

SOLID: el dominio calcula; el repositorio implementa almacenamiento/atomicidad; prepare pertenece al futuro caso de uso, no al controlador ni a datos elegidos por el navegador. Las pruebas verifican el contrato real de PostgreSQL; no se añaden abstracciones sin consumidor.

## Resultado verificado — 28 de octubre de 2026
Implementación local completada con nueva migración 1793145600000-create-bookings y PgBookingRepository. Las 16 pruebas nuevas de PostgreSQL pasaron, incluida espera de la segunda transacción observada en pg_stat_activity, conflicto por solapamiento, adyacencia, aislamiento, rollback tras fallo de segunda escritura, consulta por propietario y reversibilidad.

Después pasó npm test completo: 631 unitarias y 123 de integración, 754 en total. Lint y formato de los archivos nuevos/adaptados aprobados. El formato global sigue fallido en 27 archivos preexistentes no modificados. Se conservan todas las aserciones del test de flota; solo se añadieron ocho líneas para localizar su migración antes de revertir.

La ejecución previa sin base falló (631 unitarias y 4 HTTP aprobadas, 119 de integración fallidas); es evidencia del entorno, no se oculta ni se presenta como éxito. Docker dejó de responder al primer intento y el acceso a su ventana expiró; tras confirmación de Leslie se inició una base nueva busesuta_test en el proyecto Compose busesuta-leslie-book03, con cero tablas al verificarla antes de pruebas. No se leyó .env ni se usaron bases de otros proyectos. El contenedor temporal se retira al terminar.

No se implementaron aún caso de uso público de creación, adaptadores reales de TripCatalog/flota/acreditación, index.js de reservas, endpoint HTTP, invitados ni transiciones de pagos/expiración. No hay comprobación de arranque porque no cambia la composición. T3/T4 quedan pendientes, igual que revisión humana y publicación. Este commit se conserva con T1 A/B dentro de la misma entrega.
