# BOOK-06-L04-T2: recepción inicial y expiración coordinadas

- **Estado:** Incremento B implementado y publicado en 4233811, combinado y probado con develop 5a40702 para preparar PR. Revisión humana del incremento pendiente; conexión productiva C y planificador D separados.
- **Responsable:** Leslie. Coordinación Shirley para consumidor/outbox y Pablo para contexto interno de operación durable.
- **Origen:** Leslie pide continuar después de BOOK-07-L05-T1 y avisar cuándo guardar un commit.
- **Base actual:** feature/BOOK-06-recepcion-expiracion desde 4233811, incorporando develop 5a40702 tras integrar PR #51. La validación anterior corresponde a f0a9c2f; la combinación nueva se verifica en §13. Los registros inferiores del 2 de noviembre conservan su alcance histórico.
- **Specs:** [BOOK-06-L04](BOOK-06-L04.md), [BOOK-07-L05](BOOK-07-L05.md), [lector implementado](BOOK-07-L05-T1.md).
- **Revisión humana:** pendiente, sin atribuir aprobación por preparar este documento.
- **Entrega anterior:** PR #51 integrada por Leslie en develop mediante 5a40702 el 3 de noviembre de 2026 a las 17:48:31Z, comprobado por GitHub. Su último HEAD fue d56ae01. No implica aprobación de los comandos de esta spec.

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


## 10. Preparación de la siguiente funcionalidad — 3 de noviembre de 2026

Leslie indica que Pablo ya revisó y pide continuar. Verificación por GitHub: PR #51 abierta, fuera de borrador, sin conflictos y con APPROVED de Pablo el 3 de noviembre; no hay nueva aprobación de escritura. Su rama publicada queda intacta. Preparación local en feature/BOOK-06-recepcion-expiracion desde f0a9c2f; sin commit/push de este borrador ni PR nueva documental.

Se revisan PR #55/#56 de Shirley, aún abiertas: aportan consumidor y prueba conjunta de lectura, no recepción/venta/liberación. No duplicarlas ni presentarlas integradas. Develop 517473d añade solo documentación Fleet respecto a la base ya incorporada; PR #59 de inmutabilidad de Fleet sigue abierta y no sustituye el contrato de recepción.

[Propuesta concreta y matriz de conciliación](../contratos/recepcion-reservas-pagos-propuesta.md) reúne los tres puntos necesarios antes de código: autorización durable por puerto ligado a hechos persistidos, outcomes/mapeo de compensación y compatibilidad de EXPIRED. Esa propuesta sustituirá la firma con operationContext sin definir únicamente si las partes la aceptan; por ahora ambas son antecedentes/propuestas, ninguna API disponible.

Brecha comprobada en el consumidor: notifyBooking ignora el resultado y marca entregado tras cualquier resolución sin error; además, ciertas excepciones genéricas disparan borrado. El adaptador debe verificar ACCEPTED y reservar la compensación para el rechazo de plazo realmente confirmado y vinculado. Fallo de fuente, vínculo incoherente o timeout no autorizan borrar evidencia. Son criterios a cerrar con Shirley, sin editar su módulo en esta preparación.

Orden pequeño propuesto: A, cerrar esos tres puntos con ejemplos y matriz; B, implementar únicamente persistencia y decisiones transaccionales; C, conectar consumidor y prueba conjunta; D, planificador en alcance posterior. La regla exacta del primer aviso tardío y su compensación requieren ratificación antes de usar resultados definitivos. No inferirla del hecho de que el archivo ya se hubiera guardado.

Preparación solo documental: no cambios productivos, migraciones, dependencias o pruebas ejecutables; no ejecución de lint/PostgreSQL para atribuir resultados a un producto no implementado. Se validan enlaces y diff; revisión/aceptación del contrato y autorización del siguiente incremento pendientes.


## 11. Selección por delegación y alcance ejecutable — 3 de noviembre de 2026

Leslie responde: «ve tu lo que es mejor ellos estan de acuerdo en todo». Se registra como autorización y delegación transmitida por Leslie para elegir el diseño técnico y continuar; no se atribuye una aprobación individual nueva a Pablo o Shirley ni revisión anticipada del código.

Se elige el puerto ligado de la propuesta: createPaymentProofReceiver({ receiptSource }) devuelve únicamente markPaymentProofReceived({ bookingId, cooperativeId, paymentProofId }). receiptSource es una función inyectada en composición confiable, nunca un campo HTTP o un principal serializado. Debe leer comprobante/outbox persistidos y devolver { bookingId, cooperativeId, paymentProofId, status: UPLOADED, notificationStatus: PENDING, uploadedAt: ISO UTC }. Una primera recepción exige PENDING; DELIVERED solo es compatible con recuperar un resultado que Bookings ya conserve. No se inventa una API Auth ni un rol de trabajador. Ausencia/fallo de fuente conserva evidencia y no autoriza compensación.

El incremento B implementa Bookings y sus casos de uso contra PostgreSQL real; la fuente externa obligatoria se representa explícitamente con fixtures de QA en esas pruebas. No se presenta como integración productiva con Payments. C deberá aportar la consulta pública real de Payments y conectar la carga a findForPayment con UPLOAD_PROOF y contexto Auth real antes de atribuir procedencia autorizada a su outbox: las PR #55/#56 son lectura, no esa conexión. Identidad de cargador puede conservarse como auditoría, nunca como credencial para el reintento.

Resultados estables: ACCEPTED con los tres IDs y acceptedAt; REJECTED_EXPIRED con IDs y rejectedAt. Mismo comprobante/vínculos recupera su registro antes de fuente/reloj nuevos. Reutilización con otros vínculos falla sin datos ajenos. Primera recepción requiere reloj de Bookings bajo bloqueo estrictamente anterior a expiresAt; si llega tarde, expiración y rechazo se confirman en la misma transacción. Guardado anterior del archivo no retrocede ese reloj. Timeout/commit incierto conserva comprobante y exige reintentar identidad; nunca equivale a resultado definitivo.

Expiración se expone solo como capacidad de mantenimiento interna expireBooking({ bookingId }), sin endpoint ni planificador. Usa el mismo bloqueo de viaje y fila; mantiene RECEIVED, libera solo RESERVED activas y nunca SOLD. Estado EXPIRED y expired_at, con ausencia NOT_RECEIVED conocida; UNKNOWN o conjuntos de asientos incoherentes fallan sin efectos. Resultado EXPIRED estable o NOT_DUE/PROOF_RECEIVED sin cambios.

Nueva migración 1793910000000-booking-proof-receipts y catálogo activo correspondiente; tabla durable de resultados con identidad única de comprobante y vínculos FK al scope de reserva; aceptación única por reserva. Down rechaza datos de resultados/expiración para no destruir evidencia. Los originales y migraciones existentes permanecen intactos. Preparaciones de tests incluirán la tabla nueva al limpiar; no se rebajan aserciones ni timeouts.

El lector de Bookings y su adaptador preparado de Payments admitirán EXPIRED únicamente con canUploadProof=false y hechos consistentes; se agregan pruebas. Esto es compatibilidad de lectura, no conexión de rutas ni modificación de las ramas #55/#56 de Shirley. El adaptador de notificación que interpreta outcomes y limita compensación forma parte de C; no se conecta directamente el retorno estructurado al consumidor actual que ignora resultados.

Criterios: límites y reloj tras bloqueo; recepción/expiración ganadoras; duplicados concurrentes y reutilización cruzada; fallo en segundo asiento revierte todo; respuesta perdida tras COMMIT real y recuperación desde otra instancia; origen inválido/UNKNOWN/SOLD sin efectos; aislamiento de cooperativa; persistencia de resultados y down protegido. Verificar lint, formato y npm test con PostgreSQL aislado, y arranque real al extender la composición pública.


## 12. Resultado verificable del incremento B

Implementados dominio, casos de uso, repositorio PostgreSQL, nueva migración y capacidades en index.js. El reloj se obtiene bajo bloqueo; todos los cambios de inventario y la decisión se confirman juntos. Repetición tras reinicio de instancia recupera el resultado guardado por comprobante/vínculos, sin consultar nuevamente la fuente ni reiniciar fechas.

Errores públicos de la capacidad interna (sin traducción HTTP nueva): BOOKING_VALIDATION_ERROR para entrada inválida; BOOKING_NOT_FOUND para ausencia; BOOKING_RECEIPT_SOURCE_MISMATCH para hechos no elegibles; BOOKING_RECEIPT_LINK_MISMATCH para reutilización/vínculos incompatibles; BOOKING_DATA_INTEGRITY_ERROR para datos incoherentes; BOOKING_LIFECYCLE_UNAVAILABLE para fallo técnico o resultado incierto. Ninguno autoriza compensación. Solo REJECTED_EXPIRED resuelto después del commit es el rechazo definitivo por plazo de este contrato. No se expone SQL ni el vínculo anterior.

[Evidencia reproducible y límites](../evidence/BOOK-06-L04-T2/2026-11-03-recepcion-expiracion.md): npm test completo 1657 unitarias + 514 integraciones aprobadas, con arranque real. Posterior caso adicional de dos expiradores y catálogo: 38/38 dirigidas. Lint y formato propio aprobados; formato global pendiente en los mismos 17 archivos ajenos. Frontend lint y 181 pruebas aprobados. Primera barrera QA corregida sin rebajar expectativas; recursos PostgreSQL propios retirados.

Archivos: migración y catálogo; application/receive-payment-proof y expire-booking; domain/booking-lifecycle y su error; infrastructure/pg-booking-lifecycle.repository; API pública de Bookings y compatibilidad de lector/adaptador preparado de Payments. Fixtures de limpieza incluyen la nueva tabla FK. Sin nuevas dependencias ni cambios de pantalla: DESIGN.md no aplica a este incremento backend.

Para comprobar: iniciar PostgreSQL aislado según docs/testing-database.md, ejecutar desde backend npm run lint, npm run format:check y npm test; las suites receipt-expiration y migration-catalog ejercitan los escenarios concretos. Nunca usar bases persistentes. No se habilita planificador ni conexión a los adaptadores simulados de Payments.

Validación local terminada; Leslie autoriza commit y push de este incremento en feature/BOOK-06-recepcion-expiracion. PR nueva, revisión humana y conexión C pendientes; no se declara integrada ni cerrada la funcionalidad. Los apartados 3–10 conservan el antecedente de propuesta; la selección vigente está en §11 y su resultado en este apartado.


## 13. Actualización autorizada para preparar la PR

Leslie solicita actualizar la rama, comprobar y publicar antes de crear su PR hacia develop. Base 4233811; origin/develop 5a40702 incluye PR #51 y la bandeja de Payments. Único conflicto textual en docs/estado-proyecto.md: conservar bloques de evidencia de ambas ramas, con sus fechas/alcances históricos.

No ampliar negocio, conectar adaptadores simulados ni incluir C/D en esta resolución. Conservar la migración nueva de B, las originales intactas, validación estricta y catálogo de 20 entradas. Conservar comandos conjuntos test/lint de frontend y empaquetado de ambas pantallas. DESIGN.md consultado en conciliación anterior: no cambia diseño, HTML/CSS ni flujo visual en esta actualización.

Verificar backend lint, format:check, npm test en PostgreSQL aislado con arranque real; frontend lint, pruebas conjuntas y Nginx real. No dependencias nuevas, .env, bases persistentes ni ampliación de timeouts. Actualizar evidencia, estado y descripción para que la nueva PR muestre solo B contra develop. Publicar solo feature/BOOK-06-recepcion-expiracion; no integrar ninguna PR.

Añadir regresión de actualización desde las 19 entradas de develop/PR #51 con reservas y ocupaciones existentes: conservar datos de negocio y ventanas/recepción, añadir expired_at nulo y tabla durable vacía sin inventar resultados. Verificar también reintento sin cambios.


### Resultado de la combinación con 5a40702

[Evidencia vigente](../evidence/BOOK-06-L04-T2/2026-11-03-actualizacion-develop.md). Conflicto del registro resuelto conservando ambas evidencias. Sin cambios productivos a B; regresión nueva de actualización desde develop con reservas NOT_RECEIVED/RECEIVED/UNKNOWN conserva filas, ventanas y ocupaciones, sin inventar resultados de recepción.

npm test completo: 1658 unitarias + 515 integraciones = 2173 aprobadas, 125 suites, con arranque real. Posterior catálogo ampliado: 14/14 dirigido aprobado. Frontend lint y 205 pruebas, Nginx real y ocho grupos Chrome aprobados. Lint y formato propio aprobados; global conserva 17 archivos ajenos. Recursos QA retirados; sin timeout modificado, migraciones originales editadas ni nuevas dependencias.

Publicar conciliación solo en feature/BOOK-06-recepcion-expiracion. [Descripción preparada](../evidence/BOOK-06-L04-T2/descripcion-pr.md); no se asigna ID de PR ni revisión/integración inexistentes. La aprobación e integración de PR #51 solo acredita la entrega anterior. C/D siguen separados.
