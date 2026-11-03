# BOOK-06-L04-T2: recepción inicial y expiración coordinadas

- **Estado:** Borrador para cerrar contrato de escritura; implementación no autorizada por esta preparación.
- **Responsable:** Leslie. Coordinación Shirley para consumidor/outbox y Pablo para contexto interno de operación durable.
- **Origen:** Leslie pide continuar después de BOOK-07-L05-T1 y avisar cuándo guardar un commit.
- **Base:** feature/BOOK-03-resumen-creacion-dominio, HEAD c7ceed9 con lector/persistencia locales sin commit; origin/develop 1daa3c4 consultado el 2 de noviembre de 2026, sin integrar.
- **Specs:** [BOOK-06-L04](BOOK-06-L04.md), [BOOK-07-L05](BOOK-07-L05.md), [lector implementado](BOOK-07-L05-T1.md).
- **Revisión humana:** pendiente, sin atribuir aprobación por preparar este documento.
- **Resultado previo listo para commit:** lector/persistencia probados; sugerencia feat(reservas): agrega lectura autorizada para pagos. No se ejecuta commit/push.

## 1. Resultado acotado

Aceptar una primera recepción guardada previamente por Payments o expirar una reserva pendiente, serializando ambas decisiones con el inventario. Persistir resultado recuperable para reintentos. No corregir/versionar archivos, aprobar venta o liberar por rechazo.

## 2. Reglas ya confirmadas

- Guardado del archivo/outbox no equivale a aceptación de Bookings.
- Nueva recepción elegible solo si el reloj confiable evaluado dentro de coordinación es estrictamente menor que expiresAt.
- En igualdad o después no aceptar una recepción inicial nueva.
- Recepción previamente aceptada se recupera por misma identidad/vínculos aun después del límite.
- Recepción aceptada conserva ocupaciones; revisión no expira por el plazo inicial.
- Expiración sin recepción libera todas las ocupaciones de la reserva atómicamente y una sola vez.
- UNKNOWN no es ausencia de recepción ni permiso de compensación.
- Timeout conserva evidencia/outbox; solo resultado definitivo autoriza la compensación acordada de Payments.
- Vencimiento de corrección de 15 minutos cierra edición y mantiene revisión/asientos, por confirmación de Leslie; no interviene en expiración inicial.

## 3. Contratos propuestos para acordar

### Aviso inicial de Payments

```js
bookings.paymentCommands.markPaymentProofReceived(
  { bookingId, cooperativeId, paymentProofId },
  operationContext,
)
```

Los tres identificadores conservan el puerto actual de Shirley como base de datos, con contexto separado de escritura pendiente. IDs de reserva opacos, sin tenant/propietario/tiempo elegidos por comprador. paymentProofId identifica de forma estable el comprobante/outbox persistido. Esta operación se limita a la primera recepción; no reemplaza archivo ni cambia su versión.

operationContext **no está definido ni aprobado**. Pablo/Shirley/Leslie deben precisar cómo una llamada de composición interna acredita propósito de aviso durable, origen de datos persistidos, alcance de reserva/tenant y recuperación tras reinicio. No copiar el principal de una solicitud ni guardar JWT/sesión en outbox; rol SERVICE o una bandera de body no acreditan autoridad.

Debe existir una prueba de que el intento y los tres vínculos vienen de Payments autorizado, no una ruta HTTP que invoque el comando con datos arbitrarios. No consultar tablas privadas de Payments. La API pública/puerto que permita verificar origen o capacidad de composición debe acordarse antes de código.

### Expiración interna

Propuesta: caso de uso interno expireBooking(bookingId), invocado por coordinador de Bookings con dependencias internas, sin endpoint público ni tenant del cliente. Consulta y valida el contexto persistido de reserva antes de bloquear/revalidar. El planificador periódico se delimita en incremento posterior; aquí se prueban ambos casos de uso con varias instancias.

No habilitar al consumidor Payments una operación genérica de expiración o escritura directa.

## 4. Modelo de coordinación propuesto

Orden único compatible con creación:
1. Leer identificación de reserva para localizar scope; si no existe, resultado acordado sin datos ajenos.
2. Adquirir bloqueo de booking_trip_locks por cooperativa/viaje, como reserveTrip actual.
3. Bloquear la fila de reserva y releer scope/estado/metadatos; si cambió el scope, fallar sin operar sobre otro inventario.
4. Comprobar resultado/vínculo de recepción anterior antes de usar el reloj para una recepción nueva.
5. Evaluar reloj confiable tras adquirir bloqueos; validar estado y conocimiento de recepción.
6. Persistir estado/recepción o expiración, ocupaciones y resultado de operación en una transacción.
7. Commit y respuesta. Error antes de commit revierte; pérdida de respuesta posterior exige recuperar resultado persistido.

No adquirir fila de reserva y luego trip lock en otra operación: ese orden inverso puede bloquear futuros flujos. Lectura previa de candidatos no decide la transición.

## 5. Persistencia y estados por revisar

Reutilizar proof_window_started_at, proof_window_seconds, proof_reception_state, accepted_proof_id y proof_received_at de BOOK-07-L05-T1. La primera recepción escribe NOT_RECEIVED→RECEIVED y vínculo/instante una sola vez; la protección actual impide cambiarlos después.

Propuesta de workflow mínimo: recepción conserva status PENDING_PAYMENT y representa el hecho RECEIVED por sus campos, sin inventar venta. Si se necesita status específico de revisión, acordar su nombre y adaptación del consumidor antes de añadirlo.

Expiración debe registrarse explícitamente (propuesta status EXPIRED + expired_at) y desactivar únicamente allocations RESERVED activas de esa reserva. Exigir coherencia y no liberar SOLD. Caso incoherente genera integridad, no liberación parcial.

**Compatibilidad obligatoria:** el adaptador publicado de Payments solo admite PENDING_PAYMENT. Antes de exponer EXPIRED desde el lector, acordar ampliación de sus estados soportados y pruebas con Shirley; no convertir una expiración legítima en integridad por sorpresa ni ocultar la reserva como inexistente. Este es un ajuste concreto de contrato, no nueva aprobación genérica del lector.

Propuesta de resultado durable de aviso: identidad de operación asociada a paymentProofId con vínculos/fingerprint y resultado. Evitar reutilizar un comprobante con otra reserva/cooperativa mediante restricción/protocolo transaccional; definir el índice y la clasificación de conflicto sin datos ajenos. No agregar escritura genérica de resultados elegidos por cliente.

Nuevas migraciones solamente, posteriores al incremento previo. No completar historia UNKNOWN ni editar migraciones existentes.

## 6. Resultados semánticos propuestos

| Operación/situación | Resultado a concretar | Efecto |
| --- | --- | --- |
| Recepción nueva válida | ACCEPTED con bookingId, cooperativeId, paymentProofId, acceptedAt | Vínculo/instante durables; conserva asientos |
| Misma recepción ya aceptada | Resultado aceptado previo | Sin cambiar instante/plazo/ocupaciones |
| Misma identidad con vínculos distintos | Rechazo de reutilización | No acceder ni modificar otra reserva |
| Nueva recepción después del plazo | Rechazo definitivo por plazo/expiración | Solo tras decisión de estado válida, nunca por timeout |
| Historia UNKNOWN o datos corruptos | Error de integridad | No aceptar, expirar ni habilitar compensación como rechazo funcional |
| Fallo técnico o COMMIT incierto | Error incierto/reintentable según clasificación | Payments conserva evidencia y reintenta misma identidad |
| Expiración antes del límite | No elegible todavía | Sin escrituras ni extender fecha |
| Expiración vencida sin recepción conocida | EXPIRED o repetición previa | Reserva y liberación de todas sus ocupaciones en una transacción |
| Expiración con recepción conocida | No elegible por revisión | No libera ni cambia primera recepción |

Definir con Shirley campos/códigos exactos, tratamiento de reserva ausente/ajena y registro de rechazos definitivos. No confundir el código de error de lectura BOOKING_QUERY_UNAVAILABLE con autorización para compensar. El contexto se valida antes de entregar datos o recuperar resultado de otra identidad.

Una propuesta para recepción tardía es ejecutar la misma transición de expiración dentro de coordinación y devolver rechazo definitivo después de commit; requiere confirmación del contrato. No responder “expirada” y dejar inventario activo sin identificar quién lo resolverá.

## 7. Pruebas necesarias antes de declarar integración

- Límite antes/en/después; reloj adquirido después de esperar bloqueo.
- Recepción gana: expiry posterior conserva asientos y primera recepción.
- Expiración gana: nueva recepción rechazada sin reactivar.
- Dos recepciones iguales simultáneas recuperan un resultado/instante.
- Reutilización cruzada de comprobante o tenant no altera datos ajenos.
- Dos expiradores simultáneos liberan una sola vez.
- Fallo al liberar segundo asiento revierte estado, primera liberación y resultado.
- Respuesta perdida después de commit, nuevo proceso/instancia y reintento con la misma identidad recuperan resultado sin renovar plazo.
- UNKNOWN falla cerrado y no dispara compensación ni liberación.
- SOLD o estado incompatible se protege frente a expiración.
- Lector/adaptador de Payments compatible con estados acordados después de ambas transiciones.
- Autoridad durable comprobada; payload HTTP o sesión guardada no suplanta servicio.
- Sin regresión en concurrencia de creación/solapamiento parcial ni idempotencia previas.

PostgreSQL aislado con barreras reales y detección de espera de bloqueo; no sustituir carreras por memoria o sleeps como única evidencia. Ejecutar lint, format:check y npm test; arranque real al cambiar composición. No dependencias nuevas previstas.

## 8. Incrementos y puertas concretas

A. Cerrar contexto durable, resultado exacto y compatibilidad de EXPIRED con Shirley/Pablo. Solo documentación.
B. Nueva persistencia, comandos coordinados y pruebas reales, una vez autorizado el alcance.
C. Consumidor/outbox y verificación conjunta; no simular integración.
D. Planificador periódico y recuperación de candidatos tras reinicio, en spec posterior.

Recepción/expiración es la siguiente funcionalidad; no mezclar corrección, caja, acreditación, venta, correo e invitado para desbloquearla. Los acuerdos de esas otras tareas conservan su estado.

## 9. Evidencia y situación del commit anterior

2 de noviembre: fetch confirma develop 1daa3c4; se revisan contratos publicados y no se encuentra contrato de autoridad durable en los documentos accesibles. El de PR #46 lo deja separado. Esto no certifica ausencia de trabajo privado.

El incremento anterior ya tiene 1045 pruebas aprobadas y nueve comprobaciones de consumidor real; no se repiten suites por esta preparación Markdown. Su checkpoint de commit es oportuno antes de mezclar esta funcionalidad nueva. No stage, commit, push, merge o tags ejecutados. La autorización actual de Leslie pide avisar, no ejecutar esas operaciones.

Sin implementación ni pruebas nuevas de esta spec. No fallo inducido ni modificación de frontend. Revisión y autorización del contrato pendientes.
