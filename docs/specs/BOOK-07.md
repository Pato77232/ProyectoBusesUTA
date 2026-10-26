# BOOK-07: Confirmar reserva desde pagos

- **Responsable:** Leslie; coordinación de contrato con Shirley
- **Revisor propuesto por Leslie:** PabloToapanta; revisión conjunta del contrato con Shirley pendiente.
- **Módulo:** bookings
- **Estado:** T1 documentada con acuerdo base comunicado por Shirley; firmas y redacción técnica pendientes de revisión conjunta. T2/T3 no implementadas.
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
Recepción/expiración, reintentos y rechazo se precisan en reservas-contratos.md. Quedan firmas, esquema, autorización, implementación transaccional y recuperación del boleto por cerrar; no confundir contrato documentado con código integrado.

## 11. Defecto inducido
No aplica.

## Aclaración para revisión documental
Las decisiones de producto de `docs/reservas-decisiones.md` fueron seleccionadas por autorización de Leslie y cierran las preguntas correspondientes de este borrador. No se atribuye aprobación a otros integrantes. Los contratos reales pendientes están en `docs/reservas-contratos.md`; esta rama no implementa código, endpoints, tablas ni pantallas. Los avances de dominio existentes se conservan en sus ramas de tarea separadas.

## 12. T1 — contrato coordinado con payments
Actualización del 26 de octubre de 2026. [Contrato y matriz de pruebas](../reservas-contratos.md#coordinación-de-reservas-y-comprobantes--26-de-octubre-de-2026). Esta sección precisa el borrador inicial; el registro de decisión distingue los mensajes humanos de las propuestas técnicas pendientes.

### Alcance de esta tarea documental
Registrar findForPayment, markPaymentProofReceived, confirmSale y releaseBooking, su contexto autorizado, orden de persistencia/aviso, resultados definitivos frente a desconocidos y límites de cada módulo. No crear todavía index.js, endpoints, repositorios, migraciones ni pruebas de concurrencia ficticias. No modificar el código de payments ni su spec sin coordinación.

### Reglas para recepción y reintentos
Payments guarda comprobante/aviso pendiente de forma durable antes de notificar. Bookings coordina recepción y expiración por reserva y registra el resultado aceptado con la transición. Un resultado incierto se reintenta con la misma identidad; nunca se compensa por timeout. El primer aviso tardío se rechaza aunque el archivo se guardara antes. Un reintento de una recepción ya aceptada devuelve su aceptación sin repetir efectos.

### Rechazo y confirmación
Una revisión pendiente conserva asientos sin un plazo automático de rechazo. releaseBooking debe distinguir esa demora de un rechazo autorizado y justificado, que sí libera atómicamente; nunca libera una venta confirmada. PAGOS-03 documentará la parte de Shirley. confirmSale debe vender idempotentemente solo mediante aprobación confiable y coordinar la recuperación del boleto en su tarea posterior.

### Criterios de aceptación de T1 documental
- [x] Las dos specs de reservas enlazan una sola definición de la carrera y sus límites temporales.
- [x] La matriz incluye fallo al guardar, aviso pendiente durable, timeout tras commit, rechazo definitivo, límite exacto y carreras reales.
- [x] Ningún texto presenta las funciones, esquema o pruebas de integración como implementados.
- [x] Se identifica responsable, evidencia humana, revisor propuesto y decisiones técnicas todavía pendientes.

### Calidad y siguiente paso
Aplican S/I/D a la frontera y L a los futuros dobles/adaptadores; no se crean abstracciones de producto en esta tarea. Sin interfaz: la futura respuesta distinguirá resultado definitivo e incierto y evitará filtrar otra cooperativa. La matriz se ejecutará al implementar BOOK-03/06/07 y los adaptadores de payments. El siguiente paso es revisión conjunta de firmas y persistencia, seguido de una tarea acotada de reserva; esta documentación no desbloquea por sí sola viajes o plantillas todavía inexistentes.

### Verificación de esta tarea documental
26 de octubre de 2026, base c8bb5d3: enlaces locales y git diff --check aprobados; sin cambios en backend, frontend, migraciones o pruebas. Lint aprobado. npm test: 266 unitarias y 4 de integración aprobadas, 103 de integración fallidas por ausencia de URL/base de pruebas; Docker no está operativo en esta sesión. Formato global fallido en 27 archivos preexistentes de esta base, ninguno modificado por la tarea. Estos resultados no certifican concurrencia ni conexión entre módulos. Los cuatro criterios documentales están completos; revisión conjunta y aprobación humana pendientes. Trabajo asistido por Codex.
