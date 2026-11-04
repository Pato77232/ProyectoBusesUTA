# BOOK-09 / L-07: cierre de reserva y acceso posterior

- **Responsable:** Leslie Coello.
- **Revisor propuesto:** Edwin, conforme al reparto del proyecto.
- **Estado:** Decisión del equipo registrada el 4 de noviembre de 2026; implementación incremental autorizada en la rama `feature/BOOK-06-L04-T5-leslie`.
- **Alcance:** contratos de ciclo de vida posterior a la recepción del comprobante, historial autenticado y acceso de invitado.

## 1. Decisión del equipo

El equipo delegó en el asistente la selección de los contratos pendientes de
Reservas y autorizó su implementación. Esta spec registra esa decisión para que
el código y las pruebas tengan una fuente local verificable; no atribuye una
aprobación individual a un integrante que no haya dejado una respuesta separada.

## 2. Contrato de aprobación y venta

Payments llama al puerto interno `bookingSaleConfirmer.confirmSale` con
`bookingId`, `cooperativeId` y `paymentProofId`. Reservas valida la identidad
compuesta, bloquea el viaje y la reserva en una transacción, y solo acepta una
reserva `PENDING_PAYMENT` cuyo comprobante ya fue recibido.

La operación es idempotente por `paymentProofId`: repetir la misma solicitud
devuelve éxito si la misma venta ya quedó confirmada; una combinación distinta
de reserva, cooperativa o comprobante devuelve rechazo. La confirmación marca
la reserva `SOLD`, cambia sus asignaciones activas a `SOLD` y conserva la
trazabilidad del comprobante. No libera asientos vendidos.

Errores públicos del puerto: `BOOKING_SALE_REJECTED` para estado, identidad o
vínculos incompatibles; `BOOKING_SALE_UNCERTAIN` para fallos cuya confirmación
no pueda conocerse. No se informa SQL ni datos personales.

## 3. Contrato de rechazo

El rechazo requiere `justification` no vacía y actor autenticado de Payments.
Se ejecuta en una transacción con los mismos bloqueos, marca la reserva
`REJECTED`, desactiva asignaciones `RESERVED` y conserva el motivo y el actor.
Una reserva vendida no puede rechazarse por esta operación.

## 4. Historial autenticado

`GET /api/v1/bookings` requiere sesión `CUSTOMER`, no acepta `ownerId` ni
`cooperativeId` en query, y pagina por cursor opaco. Devuelve únicamente
reservas del `owner_id` verificado, con estado, viaje, tramo, total, moneda y
fechas; nunca cédulas, archivos, tokens ni datos de otros propietarios.

`GET /api/v1/bookings/:id` aplica la misma propiedad y devuelve 404 tanto para
ausencia como para reserva ajena.

## 5. Acceso de invitado

El invitado recibe un enlace enviado por el puerto de correo. La URL contiene
un token aleatorio de alta entropía; la base guarda únicamente su hash,
vencimiento y uso. El token no se sustituye por UUID, cédula o correo. El
primer consumo válido crea una sesión de acceso limitada y el token queda
invalidado; los vencidos, usados o inexistentes responden igual.

La respuesta de invitado excluye cédulas, comprobantes, rutas internas y datos
de otros pasajeros. El envío de correo no se simula como entrega exitosa: si el
puerto no está compuesto, la solicitud falla sin revelar si la reserva existe.

## 6. Pruebas obligatorias

- venta nueva, repetición idéntica y conflicto de vínculos;
- venta con comprobante ausente, reserva expirada y reserva rechazada;
- rechazo justificado, rechazo repetido y rechazo de venta;
- historial propio, ajeno, paginación y aislamiento de tenant;
- token de invitado válido, vencido, usado, aleatorio y sin correo compuesto;
- concurrencia entre expiración, rechazo y venta.

La migración de estados será nueva y no modificará migraciones existentes.

## 7. Resultado de los incrementos implementados

Implementados localmente los contratos de confirmación y rechazo: migraciones
`1794090000000-booking-sale-lifecycle`, `PgBookingSaleConfirmer`, composición
de Payments con Reservas, migración `1794100000000-payment-proof-rejection`,
caso de uso y endpoint `POST /api/v1/payment-proofs/:paymentProofId/reject`.
El rechazo es idempotente por comprobante y conserva actor y justificación.
Historial autenticado y acceso de invitado quedan como incrementos siguientes.

Verificación PostgreSQL temporal: 22/22 pruebas de migraciones y ciclo de
venta/rechazo aprobadas; unitarias dirigidas: 259/259.
