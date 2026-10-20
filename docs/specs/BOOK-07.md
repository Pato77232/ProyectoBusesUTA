# BOOK-07: Confirmar reserva desde pagos

- **Responsable:** Leslie; coordinación de contrato con Shirley
- **Revisor:** Edwin
- **Módulo:** bookings
- **Estado:** Borrador; pendiente de contrato de pagos.
- **Dependencias:** BOOK-03/06 y módulo payments.

## 1. Objetivo
Convertir ocupaciones reservadas en vendidas al aprobar un pago válido.

## 2. Reglas
RN-02, RN-40, RN-52/53/54. Shirley gestiona comprobante, justificación y boleto; Leslie gestiona reserva y ocupación.

## 3. Tareas
T1 acordar puerto público y atomicidad con payments; T2 confirmar de forma transaccional e idempotente; T3 verificar carreras y errores. No importar infraestructura interna de payments.

## 4. Flujo
Recibir aprobación confiable del servidor, verificar relación comprobante/reserva/cooperativa e importe, verificar estado, marcar venta y coordinar emisión. Acordar consistencia y recuperación si falla el boleto.

## 5. Datos
Contrato por acordar: identidad de reserva/pago, importe validado, correlación de reintentos y estado persistido. Una bandera paid del navegador nunca acredita un pago.

## 6. Endpoints
No proponer endpoint público de aprobación en bookings. La entrada confiable será la API pública del módulo según contrato aprobado.

## 7. Criterios de aceptación
- [ ] Una aprobación válida vende exactamente los asientos de la reserva.
- [ ] Repetir la aprobación no duplica ventas ni efectos.
- [ ] Cooperativa o comprobante incorrectos no confirman la reserva.
- [ ] Aprobación y expiración concurrentes no producen asiento vendido y disponible a la vez.
- [ ] El rechazo sigue el acuerdo escrito sin liberar automáticamente por una regla inventada.

## 8. Casos borde
Reserva vencida, ya confirmada, pago duplicado, importe distinto y fallo de emisión del boleto.

## 9. Pruebas
Contrato entre módulos, integración PostgreSQL y carreras aprobación/expiración. Verificar el flujo con Shirley y conservar evidencia.

## 10. Preguntas abiertas
Rechazo, cargas tardías, revisión, reintentos, atomicidad entre módulos, entrega del boleto y recuperación ante fallo.

## 11. Defecto inducido
No aplica.
