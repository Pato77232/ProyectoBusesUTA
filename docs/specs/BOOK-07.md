# BOOK-07: Confirmar reserva desde pagos

- **Responsable:** Leslie; coordinación de contrato con Shirley
- **Revisor:** Edwin
- **Módulo:** bookings
- **Estado:** Borrador; contrato con payments acordado el 29 de octubre de 2026; T2/T3 e implementación pendientes.
- **Dependencias:** BOOK-03/06 y módulo payments.

## 1. Objetivo
Convertir ocupaciones reservadas en vendidas al aprobar un pago válido.

## 2. Reglas
RN-02, RN-40, RN-52/53/54. Shirley gestiona comprobante, justificación y boleto; Leslie gestiona reserva y ocupación.

## 3. Tareas
T1 acordar puerto público y atomicidad con payments; T2 confirmar de forma transaccional e idempotente; T3 verificar carreras y errores. No importar infraestructura interna de payments.

## 4. Flujo
`payments` valida el permiso del oficinista y su cooperativa, revisa que el importe mostrado en el comprobante corresponda al total final de la reserva y solicita la confirmación al puerto público de `bookings`. `bookings` valida la relación aceptada entre comprobante, reserva y cooperativa, verifica el estado y confirma la venta. Una recepción aceptada dentro del plazo configurable de 3–5 minutos queda en revisión y no expira por el solo transcurso de ese plazo; puede aprobarse después. Recepción, expiración y confirmación deben coordinarse para que solo una transición incompatible prevalezca. La emisión del boleto es posterior y su recuperación se define por separado.

## 5. Datos
Contrato acordado por Leslie y Shirley el 29 de octubre de 2026: `markPaymentProofReceived({ bookingId, cooperativeId, paymentProofId })` registra idempotentemente el vínculo aceptado de recepción; `confirmSale({ bookingId, cooperativeId, paymentProofId })` usa `paymentProofId` como clave idempotente y confirma solo con los mismos vínculos. `bookings` es autoridad del total final en centavos/USD; `payments` contrasta ese total con la evidencia revisada, porque `bookings` no puede verificar por sí solo el dinero transferido.

En un reintento, `bookings` consulta primero si la venta ya fue confirmada con la misma clave y los mismos vínculos. Si existe, devuelve el resultado persistido aunque haya pasado el plazo de carga. Timeout o pérdida de respuesta no constituyen rechazo definitivo. La bandera `paid` del navegador nunca acredita un pago.

`payments` persiste la intención de aprobación y su actor en estado pendiente antes de invocar `confirmSale`; registra la aprobación final solo después de la confirmación. La respuesta incierta se recupera repitiendo con el mismo `paymentProofId`. El esquema local de pagos se documenta en PAGOS-02; `bookings` implementa su verificación idempotente en su propio límite.

## 6. Endpoints
No proponer endpoint público de aprobación en bookings. La entrada confiable será la API pública del módulo según contrato aprobado.

## 7. Criterios de aceptación
- [ ] Una aprobación válida vende exactamente los asientos de la reserva.
- [ ] Repetir la aprobación no duplica ventas ni efectos.
- [ ] Cooperativa o comprobante incorrectos no confirman la reserva.
- [ ] Aprobación y expiración concurrentes no producen asiento vendido y disponible a la vez.
- [ ] El rechazo sigue el acuerdo escrito sin liberar automáticamente por una regla inventada.
- [ ] Una recepción aceptada a tiempo puede aprobarse después del plazo y no expira mientras está en revisión.
- [ ] Un reintento con la misma clave y vínculos devuelve la venta previamente confirmada, incluso después del plazo.
- [ ] La intención de aprobación y su actor quedan persistidos como pendientes antes de invocar a `bookings`; la aprobación final se registra tras confirmación.

## 8. Casos borde
Reserva vencida, ya confirmada, pago duplicado, importe distinto y fallo de emisión del boleto.

## 9. Pruebas
Contrato entre módulos, integración PostgreSQL y carreras aprobación/expiración. Verificar el flujo con Shirley y conservar evidencia.

## 10. Preguntas abiertas
El diseño de persistencia de la intención pendiente; la implementación y pruebas productivas de la API; y la entrega del boleto y su recuperación ante fallo. El rechazo y liberación quedan para PAGOS-03.

## 11. Defecto inducido
No aplica.

## 12. Coordinación del contrato

- **Respuesta recibida:** Leslie respondió a la consulta de Shirley el 29 de octubre de 2026; Shirley aceptó sus precisiones. El contrato queda acordado entre ambos módulos.
- **Estado:** Acordada para T1; la implementación T2 y las pruebas T3 siguen pendientes.
- **Cambio de pagos registrado:** la spec PAGOS-01 y el código de pagos de la rama PAGOS-02 usan `markPaymentProofReceived({ bookingId, cooperativeId, paymentProofId })`; validar la integración de esta rama antes de integrarla.
- **Trabajo de Leslie:** implementar la API pública de `bookings` y las transiciones concurrentes de recepción, expiración y confirmación.
- **Trabajo de Shirley:** enviar los tres identificadores con `markPaymentProofReceived`, mostrar el total autoritativo al revisar y persistir la intención/actor antes de `confirmSale`; probar idempotencia, respuesta incierta y recuperación.

## Aclaración para revisión documental
Las decisiones de producto de `docs/reservas-decisiones.md` fueron seleccionadas por autorización de Leslie y cierran las preguntas correspondientes de este borrador. El contrato con Shirley está acordado, pero BOOK-07 todavía no implementa su API pública, persistencia ni pruebas de integración; el código del módulo payments se mantiene en su rama de tarea. No se atribuye aprobación al revisor ni a otros integrantes.
