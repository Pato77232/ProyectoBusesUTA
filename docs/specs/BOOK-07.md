# BOOK-07: Confirmar reserva desde pagos

- **Responsable:** Leslie; coordinación de contrato con Shirley
- **Revisor:** Edwin
- **Módulo:** bookings
- **Estado:** Borrador; coordinación transaccional por reserva para recepción/expiración acordada con payments; contrato de aprobación, parámetros y contexto autorizado pendiente.
- **Dependencias:** BOOK-03/06 y módulo payments.

## 1. Objetivo
Convertir ocupaciones reservadas en vendidas al aprobar un pago válido.

## 2. Reglas
RN-02, RN-40, RN-52/53/54. Shirley gestiona comprobante, justificación y boleto; Leslie gestiona reserva y ocupación.

## 3. Tareas
T1 acordar el puerto público y su contexto con payments; T2 confirmar de forma transaccional e idempotente; T3 verificar carreras y errores. La recepción del comprobante y la expiración siguen la coordinación por reserva acordada en BOOK-06. No importar infraestructura interna de payments.

## 4. Flujo
Recibir aprobación confiable del servidor, verificar relación comprobante/reserva/cooperativa e importe, verificar estado, marcar venta y coordinar emisión. La confirmación de venta y la expiración deben producir un único resultado transaccional por reserva. Acordar consistencia y recuperación si falla el boleto.

## 5. Datos
Contrato por acordar: identidad de reserva/pago, importe validado, correlación de reintentos y estado persistido. Una bandera paid del navegador nunca acredita un pago.

## 6. Endpoints
No proponer endpoint público de aprobación en bookings. La entrada confiable será la API pública del módulo según contrato aprobado.

## 7. Criterios de aceptación
- [ ] Una aprobación válida vende exactamente los asientos de la reserva.
- [ ] Repetir la aprobación no duplica ventas ni efectos.
- [ ] Cooperativa o comprobante incorrectos no confirman la reserva.
- [ ] Aprobación y expiración concurrentes no producen asiento vendido y disponible a la vez.
- [ ] La coordinación por reserva no permite que una expiración venza una recepción de comprobante ya aceptada ni que un reintento tras perder la respuesta la convierta en rechazo.
- [ ] El rechazo sigue el acuerdo escrito sin liberar automáticamente por una regla inventada.

## 8. Casos borde
Reserva vencida, ya confirmada, pago duplicado, importe distinto y fallo de emisión del boleto.

## 9. Pruebas
Contrato entre módulos, integración PostgreSQL y carreras de recepción/expiración y aprobación/expiración. Verificar el flujo con Shirley y conservar evidencia. La carrera de recepción incluye el límite exacto y el reintento idempotente tras perder la respuesta.

## 10. Preguntas abiertas
Rechazo, cargas tardías, revisión, parámetros y contexto autorizado de los puertos, entrega del boleto y recuperación ante fallo. El principio de coordinación transaccional por reserva entre recepción y expiración ya está acordado; la firma del contrato público aún no.

## 11. Defecto inducido
No aplica.

## Aclaración para revisión documental
Las decisiones de producto de `docs/reservas-decisiones.md` fueron seleccionadas por autorización de Leslie y cierran las preguntas correspondientes de este borrador. No se atribuye aprobación a otros integrantes. Los contratos técnicos pendientes están en `docs/reservas-contratos.md`; esta actualización no implementa el contrato público de `bookings`. El trabajo de pagos se documenta por separado en [PAGOS-01](PAGOS-01.md) y [PAGOS-03](PAGOS-03.md).

## Acuerdo compartido con payments
- Estado: coordinación de recepción y expiración acordada por Leslie y Shirley el 26 de octubre de 2026; firmas, parámetros y contexto autorizado todavía pendientes.
- Una recepción aceptada dentro del plazo conserva asientos durante la revisión; una reserva expirada o cuyo plazo venció antes de aceptar produce rechazo definitivo.
- Reintentar la misma operación tras un timeout debe devolver el resultado aceptado si la primera llamada ya se había confirmado; payments no compensa ante timeout.
- Ver [BOOK-06](BOOK-06.md) y [PAGOS-01](PAGOS-01.md).
