# PAGOS-03: Rechazar comprobante con justificación

- **ID local:** PAGOS-03
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `payments`
- **Responsable:** Shirley
- **Revisor propuesto:** Pablo
- **Estado:** Borrador; la regla de liberación fue acordada con Leslie, falta cerrar el contrato técnico.
- **Prioridad y dependencias:** PAGOS-01, BOOK-03 y BOOK-07; revisar el contrato autorizado de `bookings` antes de conectar módulos.
- **Rama / PR / base comprobada:** pendiente de crear al iniciar implementación.
- **Autorización de alcance:** Shirley solicitó documentar la regla confirmada por Leslie el 26 de octubre de 2026; esto no autoriza a dar por cerrados los parámetros del contrato ni la revisión técnica.

## 1. Objetivo

Permitir que una persona oficinista autorizada rechace un comprobante con justificación y que `bookings` libere los asientos de esa reserva de forma coordinada.

## 2. Reglas de negocio involucradas

- **RN-02:** comprobar la cooperativa de la reserva desde el contexto confiable; no tomarla del cuerpo de la solicitud.
- **RN-52:** el oficinista revisa el comprobante.
- **RN-53:** el rechazo requiere justificación.
- La política de “Reserva y pago” en `docs/reservas-decisiones.md` establece que el rechazo finaliza la reserva, libera asientos atómicamente y requiere una reserva nueva para reintentar.

## 3. Alcance

**Incluye:** rechazar un comprobante `UPLOADED` con justificación, registrar la decisión y solicitar a `bookings` la liberación autorizada de la reserva.

**No incluye:** aprobar comprobantes, emitir boletos, venta en caja, reintentos de carga, ni liberar reservas por expiración. La expiración pertenece a BOOK-06 y la aprobación/venta a PAGOS-02/BOOK-07.

## 4. Flujo principal

1. Una persona con la autorización que defina el contrato consulta un comprobante asociado a una reserva de su cooperativa.
2. Solicita rechazarlo con una justificación obligatoria y no vacía.
3. `payments` verifica que el comprobante siga `UPLOADED` y que la decisión no esté ya aplicada.
4. `payments` coordina la decisión con la operación pública acordada de `bookings` (nombre propuesto: `releaseBooking`).
5. `bookings` aplica una única transición transaccional: si autoriza el rechazo, marca la reserva como rechazada y libera sus asientos; si la reserva sigue en revisión sin rechazo aceptado, conserva los asientos; si la venta ya fue confirmada, no los libera.
6. `payments` registra el comprobante como rechazado y la justificación conforme al resultado definitivo del contrato.
7. Un rechazo termina esa reserva; un nuevo intento requiere crear otra reserva y revalidar disponibilidad y precio.

## 5. Datos

La solicitud contiene el identificador del comprobante y una justificación. El identificador de cooperativa, la identidad de la persona y el contexto autorizado proceden de fuentes verificadas por el servidor. No se acepta una justificación vacía ni compuesta solo por espacios.

El registro debe conservar la justificación y el instante de rechazo. La representación de estado y los campos/migraciones concretos se definirán en la tarea de persistencia, sin editar migraciones existentes.

## 6. Endpoints

Ruta propuesta: `POST /api/v1/payment-proofs/{id}/reject`. Método, payload, rol, CSRF, códigos de error y forma de respuesta se confirman con el contrato de `auth` y `bookings` antes de implementar. No se publica un endpoint de liberación directa de reservas desde pagos.

## 7. Criterios de aceptación

- [ ] Una justificación ausente, vacía o compuesta solo por espacios impide el rechazo y no modifica la reserva.
- [ ] Una persona no autorizada o de otra cooperativa no puede rechazar el comprobante ni liberar asientos.
- [ ] Un rechazo autorizado y aceptado por `bookings` finaliza la reserva como rechazada y libera sus asientos transaccionalmente.
- [ ] Que un comprobante esté en revisión, sin que exista un rechazo autorizado y aceptado, conserva los asientos.
- [ ] Una reserva con venta confirmada no se libera mediante `releaseBooking` ni mediante el flujo de rechazo.
- [ ] Un reintento no duplica el rechazo ni libera una reserva distinta; el contrato debe definir el comportamiento de timeout antes de implementar.
- [ ] Un nuevo intento de compra requiere una reserva nueva y revalidación de disponibilidad/precio.

## 8. Casos borde y errores

- Comprobante inexistente, de otra cooperativa, ya expirado o en estado incompatible.
- Rechazo concurrente con aprobación/confirmación de venta: solo una transición puede ganar bajo la coordinación transaccional por reserva definida en BOOK-07.
- Timeout o respuesta incierta de `releaseBooking`: no asumir que fue rechazado ni repetir con una identidad distinta; falta cerrar la recuperación idempotente.
- Error al guardar la decisión de pagos después de que `bookings` liberó los asientos: definir recuperación durable en el contrato antes de conectar.
- Rechazo autorizado: conservar la justificación para auditoría; no exponer datos de otra cooperativa.

## 9. Pruebas esperadas

- **Unitarias:** validación de justificación, autorización, cooperativa, estado del comprobante y manejo de respuestas de `bookings`.
- **Integración:** persistencia de rechazo y justificación; aislamiento multi-tenant; no liberar al dejar una reserva en revisión; liberar al aceptar rechazo; conservar una venta confirmada; concurrencia entre rechazo y confirmación; recuperación de timeout conforme al contrato.
- **Flujo:** comprobar que el rechazo libera asientos mediante la API pública de `bookings`, sin importar sus capas internas.

## 10. Preguntas abiertas

- ¿Qué rol exacto de `auth` puede rechazar y con qué middleware/contexto?
- ¿Cuál será la firma de `releaseBooking`, cómo recibe la justificación autorizada y qué resultado definitivo devuelve?
- ¿Cómo se correlacionan reintentos y se recupera un timeout después de que `bookings` aplicó la liberación?
- ¿Qué columnas/estados de comprobante persistirán el rechazo y la auditoría?

## 11. Defecto inducido

No aplica.

## 12. Diseño SOLID y usabilidad

El caso de uso coordina puertos de comprobante y reservas; la decisión de estado y la liberación pertenecen a sus respectivos dominios. La validación HTTP solo traduce la solicitud. No hay interfaz visual en este alcance; no se marca usabilidad de pantalla como verificada.

## 13. Plan y evidencias

1. Cerrar el contrato compartido con `bookings` y autorización de `auth`.
2. Definir persistencia del estado/justificación y recuperación idempotente.
3. Implementar el caso de uso y sus pruebas.
4. Implementar el adaptador público de reservas solo cuando BOOK-07 cierre su contrato.

Registrar aquí los comandos ejecutados y resultados reales al implementar; por ahora no hay ejecución ni evidencia de comportamiento.

## 14. Revisión y cierre

Revisor humano, decisión, fecha, commit, PR y verificación de integración quedan pendientes. Esta spec no declara integración ni cierre.
