# BOOK-06 / L-04: expiración persistida y recuperable

> Decisión humana del 2 de noviembre: Leslie confirma que al vencer los 15 minutos de corrección se cierra edición y se mantienen reserva/asientos en revisión, sin rechazo ni liberación automáticos. Solo este pendiente queda resuelto; inicio técnico, rondas, correo y concurrencia conservan sus pendientes. Ver [conciliación actual](../reservas-pagos-conciliacion-20261102.md).

- **Planificación:** L-04; no es una spec aprobada ni un ID externo.
- **Spec existente:** [BOOK-06](BOOK-06.md).
- **Responsable:** Leslie Coello.
- **Revisor propuesto:** Pablo, conforme a la preferencia previa de Leslie; aceptación de este incremento pendiente. Coordinar contratos con los responsables indicados.
- **Estado:** Borrador; implementación de los nuevos incrementos no autorizada.
- **Base:** rama `feature/BOOK-03-resumen-creacion-dominio`, `c7ceed9`; remoto `origin/develop b60201e`, consultado el 1 de noviembre de 2026, sin integrar.
- **Autorización:** el usuario pidió preparar specs antes de implementar; no se infiere aprobación de este borrador.
- **Referencias:** [plan y evidencia](../reservas-plan-primera-entrega.md), [acuerdos vigentes](https://github.com/Pato77232/ProyectoBusesUTA/blob/b60201e/docs/acuerdos-primera-entrega.md), arquitectura y calidad del proyecto.

## 1. Objetivo

Expirar y liberar atómicamente reservas sin recepción aceptada a tiempo, con ejecución recuperable tras reinicio.

## 2. Reglas

RN-40/50/51. Plazo inicial configurable de 180 a 300 segundos desde aceptación/creación; revisión con recepción aceptada conserva ocupaciones aunque venza ese plazo. Al vencer los 15 minutos de corrección se cierra edición y se conserva revisión/asientos, sin rechazo o liberación automáticos (confirmado por Leslie el 2 de noviembre).

## 3. Alcance

Transición persistida, coordinación con recepción de comprobante y tarea periódica en incrementos separados. No implementar rechazo automático ni liberar por vencimiento de corrección.

## 4. Flujo propuesto

Leer candidatos persistidos → transacción y bloqueo acordado → releer estado/recepción/hora del servidor → expirar solo elegibles → desactivar todas sus ocupaciones → commit. Repetir no cambia resultado ni toca SOLD. La selección previa de candidatos no decide el estado final.

## 5. Datos y contratos

Nueva migración para estados/recepción/expiración cuando se apruebe el modelo; el esquema actual solo admite PENDING_PAYMENT. Mantener expiresAt original. Recepción aceptada debe quedar durable e identificada junto con comprobante/opción de versión que acuerde Shirley.

Propuesta de coordinador: consultar vencidas de la base en lotes al arrancar y periódicamente; transiciones idempotentes, varias instancias seguras, recuperación tras fallo y cierre ordenado. Cadencia, tamaño de lote y orden de bloqueos por fijar antes del incremento 3. No temporizadores individuales solo en memoria.

## 6. Endpoints

Sin endpoint público de expiración; el navegador solo muestra expiresAt. La operación interna compartida se define en L-05.

## 7. Criterios de aceptación pendientes

- [ ] 180/300 válidos; fuera de rango o fracción rechazados.
- [ ] Antes del límite no expira; en el límite sin recepción aceptada expira.
- [ ] Recepción aceptada primero conserva reserva/asientos; expiración primero produce rechazo definitivo de recepción.
- [ ] Repetición o dos trabajadores no duplican liberación; SOLD nunca se libera.
- [ ] Reinicio recupera candidatos durables sin extender plazos.
- [ ] Timeout del aviso no se interpreta como ausencia definitiva de comprobante.

## 8. Casos borde

Comprobante guardado en Payments con aviso pendiente; respuesta de recepción perdida tras commit; llegada en el límite, bloqueo demorado, reinicio durante lote y comprobante reemplazado. Acordar cuándo se decide recepción oportuna: ni el timestamp del navegador ni un archivo guardado por sí solos sustituyen la operación coordinada.

## 9. Pruebas previstas

Conservar T1. PostgreSQL aislado: barreras reales recepción/expiración en ambos órdenes, doble trabajador, rollback tras primera ocupación, límite exacto, revisión más allá del plazo, respuesta perdida e inicio posterior con candidatos persistidos. Reloj inyectado para límites, sin sleeps frágiles como única prueba.

## 10. Decisiones necesarias

Leslie/Shirley: firma, identidad/versionado del comprobante, autoridad temporal y resultado definitivo frente a incierto. Recuperar el contrato de PR #17 cerrado como antecedente, no como código implementado. Confirmar mecanismo con bloqueo compatible con inventario/L-05 para evitar interbloqueos y doble decisión. El aviso persistente de Payments no garantiza por sí solo que Reservas conozca el comprobante antes de expirar.

La consecuencia del vencimiento de los 15 minutos quedó confirmada: cerrar edición y mantener revisión/asientos. Inicio técnico, rondas y correo conservan sus pendientes.

## 11. Defecto inducido

No aplica. No introducir ni corregir incidentalmente defectos académicos; seguir errores-inducidos.md.

## 12. Diseño y usabilidad

Caso de uso de expiración separado del planificador; repositorio único controla atomicidad, composición administra ciclo de vida. Sin UI nueva; L-06 muestra estado real, nunca expira por reloj del cliente.

## 13. Incrementos y archivos previstos

1. Contrato de estados/recepción y orden de bloqueos en BOOK-06/07.
2. Nueva migración y casos de uso/repositorio, con carreras PostgreSQL.
3. Coordinador/arranque/cierre y prueba de recuperación tras reinicio.

Autorizar individualmente. Lint, format:check y npm test desde backend con PostgreSQL aislado; arranque real y retirada de recursos al cambiar composición.
## 14. Revisión y cierre

Revisión humana, autorización de incremento e integración pendientes. Ningún criterio futuro se marca aprobado por la existencia de este borrador. Evidencia documental de esta sesión en el plan; resultados de producto pendientes.
### Adjuntos de Shirley recibidos — 2 de noviembre de 2026

Se revisaron mensaje y PAGOS-01/02/CORR-01/CAJA-01 recibidos de Leslie. [Conciliación y propuestas pendientes](../reservas-contrato-pagos-revision.md). La rama de Shirley y sus cambios posteriores a 4e6bbf7 son locales según su reporte; no se verificó código ni se repitieron pruebas. No presentar versiones, contexto autorizado o APIs de Bookings como implementados. Acreditación previa al total aceptado y consecuencias de corrección son propuestas pendientes de respuesta humana; las ventanas 3/15 minutos y efectivo sin archivo ya constan en PR #35. No autoriza implementación.
## Versión compartida con Shirley — 2 de noviembre de 2026

Shirley solicita estos archivos completos porque los borradores posteriores a c7ceed9 no están publicados. Mensaje recibido por Leslie en este chat; no prueba acceso a la rama privada de Shirley ni aprobación del código.

Confirmación actual que corrige el pendiente histórico anterior: Leslie confirmó y Shirley reconoce acreditar antes del total aceptado y pago. Quién verifica, documentos, registro y acceso privado siguen pendientes. Se conservan las reglas ya documentadas de recepción–expiración, venta idempotente y rechazo justificado; su API productiva sigue sin implementar.

Shirley propone cerrar primero findForPayment: entradas, propósito/contexto autorizado, DTO y errores; después recepción, confirmación y liberación con resultados/reintentos. Registrar ese orden como propuesta de conciliación, no como autorización de implementación ni contrato final aceptado.

Pendientes expresos conservados: protocolo de versiones/bloqueo durante aprobación pendiente o incierta; validación del importe y diferencias; eventos técnicos de inicio, máximo de solicitudes, correo y consecuencia de vencer corrección; plazo/abandono/cancelación de caja; invitado con Auth. Los plazos 3/15 minutos constan en PR #35, pero no se deduce de ellos una consecuencia de vencimiento. La propuesta de cerrar edición y mantener revisión/asientos al vencer 15 minutos no está aprobada por Leslie.

Esta versión incluye los cambios locales posteriores a c7ceed9. No es archivo obtenido de ese commit ni nueva spec aprobada. Preparación documental para envío manual por Leslie, sin mensaje externo enviado por herramientas, sin código, pruebas funcionales, commits o publicación.
## Siguiente incremento preparado — 2 de noviembre de 2026

[BOOK-06-L04-T2](BOOK-06-L04-T2.md) detalla recepción/expiración, idempotencia durable, bloqueos y escenarios reales. Borrador, sin código: faltan contexto autorizado durable con Pablo/Shirley, resultados exactos y compatibilidad del consumidor con expiración. El lector previo está verificado y listo para commit; se avisó a Leslie y no se ejecutó commit/publicación. No reutilizar contexto de lectura como permiso de escritura.
