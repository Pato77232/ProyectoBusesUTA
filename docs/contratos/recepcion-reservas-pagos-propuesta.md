# Recepción de comprobante y expiración: propuesta para cerrar BOOK-06-L04-T2

- Fecha: 3 de noviembre de 2026, America/Guayaquil.
- Estado: diseño técnico seleccionado por delegación de Leslie para el incremento B, según BOOK-06-L04-T2 §11; no es una API ya implementada ni conexión productiva de Pagos. Revisión humana del código pendiente.
- Preparación: Leslie con asistencia de Codex. Decisión compartida pendiente de Leslie, Shirley y Pablo para las partes indicadas.
- Base local: f0a9c2f, rama feature/BOOK-06-recepcion-expiracion, creada desde el commit publicado de PR #51. PR #51 sigue abierta y Pablo figura APPROVED; Shirley sigue solicitada. No se integra ni modifica su rama publicada.
- Fuentes comprobadas: BOOK-06-L04-T2; contrato de lectura de PR #46; Payments index.js, UploadPaymentProof y outbox publicados. PR #55/#56 preparan lectura/contrato real, no recepción. Develop 517473d añade documentación de Fleet respecto a 04868b2, sin nuevo código de recepción.

## 1. Resultado acotado

Una primera recepción aceptada y persistida conserva los asientos; una expiración válida sin recepción los libera una sola vez. Ambas decisiones comparten bloqueo y transacción de Bookings. No incluye aprobación, rechazo del oficinista, correcciones/versiones, caja, invitado, correo ni planificador periódico.

Acuerdos conservados: guardar archivo/outbox antes del aviso; eso no equivale a aceptación. Repetir una recepción aceptada recupera su resultado, sin renovar plazo. Timeout no permite borrar archivo. UNKNOWN no equivale a ausencia. Vencimiento de corrección de 15 minutos mantiene revisión/asientos y pertenece a otro incremento.

## 2. Autorización durable: propuesta para Pablo y Shirley

Recomiendo un puerto interno ligado en la composición del servidor a una consulta pública de Payments sobre el comprobante y su outbox persistidos. No introducir un rol SERVICE ni guardar JWT/sesión en un trabajo durable. No aceptar un objeto de identidad enviado por navegador como credencial.

Esquema orientativo, pendiente de aceptación de nombres/firma:

```js
const receiptReceiver = bookings.createPaymentProofReceiver({
  receiptSource: payments.paymentProofQueries.findForBookingReceipt,
});
await receiptReceiver.markPaymentProofReceived({
  bookingId, cooperativeId, paymentProofId,
});
```

Ninguna de esas dos APIs existe hoy. La creación del puerto ocurre solo en bootstrap confiable; no se expone un factory ni un comando HTTP al comprador. Una función ligada es una capacidad interna de proceso, no una credencial serializable ni una protección frente a código arbitrario dentro del servidor.

Payments tendría que entregar por su API pública, desde su propia persistencia, los tres vínculos, estado UPLOADED y conocimiento de que el archivo y outbox fueron guardados conjuntamente. La consulta debe distinguir ausencia real de fallo técnico; no entrega ruta física, bytes, cookies ni repositorio/cliente pg. Bookings no consulta tablas privadas de Payments. La prueba de procedencia debe comprobar el flujo autenticado de carga y los hechos persistidos, no limitarse a fabricar un objeto con campos correctos.

Los IDs de comprobante/outbox y sus vínculos iniciales permanecen estables mientras el aviso esté pendiente o incierto. El estado DELIVERED del outbox no invalida recuperar una recepción ya aceptada. Una reejecución tras reinicio vuelve a ligar el puerto a la consulta real; no reutiliza una sesión vencida del comprador. Esto no autoriza reemplazos de archivos/versiones.

Alternativa: un contexto verificable de operación emitido por una API de Auth. Requiere cerrar y construir ese proveedor con Pablo; no existe hoy. No recomiendo simularlo mediante role='SERVICE' o authorized=true. La propuesta de puerto ligado sustituiría el operationContext sin definir del borrador anterior únicamente si se acepta expresamente.

## 3. Decisión y resultados propuestos

Entrada estricta de tres IDs no vacíos, sin campos de precio/actor/reloj elegidos por el cliente. Autoridad sobre precio y ocupación: Bookings; sobre comprobante/archivo/outbox: Payments. No cambia firma ni permisos de findForPayment.

Antes de una aceptación nueva se verifica origen/vínculos contra la API pública de Payments; no se mantiene una transacción de otro módulo. Después, orden único: identificar reserva → bloqueo de cooperativa/viaje → fila de reserva → relectura de hechos → resultado previo o decisión nueva → commit. Un resultado previo se recupera por la misma identidad y vínculos antes de reevaluar el plazo; no depende de que el comprobante siga en un estado inicial tras una operación posterior. El puerto ligado sigue siendo obligatorio para pedir esa recuperación.

El reloj de Bookings se toma después de esperar bloqueos. Propuesta de límite para confirmar explícitamente con Shirley: una aceptación inicial requiere now < expiresAt. En igualdad o después no se acepta un primer aviso, aunque el archivo se hubiera guardado antes. No se usa uploadedAt para retroceder el reloj ni prolongar la reserva. Si necesitan otro comportamiento, debe acordarse antes de código.

| Situación | Resultado propuesto | Efectos y actuación de Payments |
| --- | --- | --- |
| Primera recepción válida | { outcome: ACCEPTED, bookingId, cooperativeId, paymentProofId, acceptedAt } | Persistir vínculo/instante y resultado; mantener todas las ocupaciones. Payments puede marcar aviso entregado. |
| Reintento de la misma aceptación | Mismo resultado durable y acceptedAt | Sin vender, duplicar ni extender plazo; aunque el reintento llegue tarde. |
| Reserva expirada o vencida sin recepción | { outcome: REJECTED_EXPIRED, bookingId, cooperativeId, paymentProofId, rejectedAt } | Propuesta: completar la expiración y liberar RESERVED de forma atómica antes del rechazo; conservar resultado recuperable. Compensación solo si los vínculos del comprobante real se verificaron y el rechazo quedó confirmado. |
| Vínculo distinto, reutilización de comprobante o fuente incoherente | Error de integridad/vínculo; nombre exacto pendiente | No aceptar, no liberar otra reserva, no borrar un comprobante posiblemente válido. No traducirlo indiscriminadamente a la excepción que dispara compensación. |
| Historia UNKNOWN o asignación SOLD/incoherente | Error de integridad | Ninguna aceptación/liberación parcial ni compensación automática. |
| Fallo técnico o respuesta perdida | Error reintentable o resultado incierto; códigos por acordar | Conservar archivo/outbox y reintentar misma identidad. Nunca tratarlo como vencimiento confirmado. |

Los valores y campos de esta tabla son propuestas, no códigos implementados. No hay resultado REJECTED_EXPIRED si el commit quedó incierto; debe recuperarse primero el resultado persistido. Reserva ausente/ajena y su respuesta mínima se cierran con el mismo control de origen; no usar null como permiso de compensación.

## 4. Compatibilidad concreta que debe adaptar Shirley

UploadPaymentProof.notifyBooking actualmente ignora el valor devuelto y llama markNotificationDelivered después de cualquier resolución sin error. Por eso conectar directamente un comando que devuelva REJECTED_EXPIRED sería incorrecto: se interpretaría como entrega aceptada.

El adaptador de Payments debe inspeccionar el outcome:

- ACCEPTED: resolver al caso de uso y permitir marcar entregado.
- REJECTED_EXPIRED confirmado y vinculado: traducir a su rechazo de plazo definitivo acordado.
- Integridad, vínculo no correspondiente o fuente ausente: conservar evidencia y entregar el error acordado; no activar borrado por una excepción genérica.
- Timeout/transitorio: conservar evidencia y outbox pendiente; reintento con la misma clave.

Hoy la compensación borra comprobante/outbox y archivo ante BookingPaymentProofRejectedError o PaymentProofUploadDeadlineExpiredError. Antes de conectar hay que concretar qué resultados pueden traducirse a esas clases. Aprobación/rechazo del oficinista no se implementan por esta adaptación.

## 5. Estados y lectura

Propuesta mínima: aceptación conserva PENDING_PAYMENT y registra RECEIVED en los hechos ya preparados. No inventar PAYMENT_REVIEW como estado disponible.

Expiración propone EXPIRED y expired_at, con desactivación atómica de las ocupaciones RESERVED. Nunca libera SOLD. El lector y el adaptador de Pagos hoy solo aceptan PENDING_PAYMENT: Shirley debe confirmar la ampliación a EXPIRED, con canUploadProof=false por hechos conocidos, sin convertirlo en error de integridad ni ocultar la reserva. La lectura sigue sin ejecutar expiración ni mover asientos.

El planificador periódico y la recuperación de candidatos tras reinicio se delimitan después; los dos casos de uso transaccionales se prueban primero sin habilitar un temporizador productivo ficticio.

## 6. Pruebas y decisiones para iniciar código

| Comprobación conjunta | Resultado exigido |
| --- | --- |
| Guardado falla | No invocar Bookings ni dejar recepción aceptada. |
| Fuente real ausente o con otros vínculos | Sin modificar reservas y sin borrar evidencia válida. |
| Aviso aceptado, respuesta perdida y nuevo proceso | Recuperar mismo acceptedAt; un vínculo, mismos asientos. |
| Aviso aceptado y marcado local como entregado falla | Outbox pendiente y reintento seguro. |
| Antes/en/después de expiresAt | Decisión bajo reloj/bloqueos de Bookings, según regla final acordada. |
| Recepción gana frente a expiración | Conservar ocupaciones, incluso tras el plazo original. |
| Expiración gana | Rechazo confirmado, sin reactivar; resultado incierto no compensa. |
| Fallo al liberar el segundo asiento | Rollback de estado, todas las ocupaciones y resultado. |
| Misma identidad con otro vínculo | Rechazo sin efectos sobre otra reserva y sin borrado automático. |
| Recepción UNKNOWN o SOLD inesperado | Error de integridad, ningún efecto parcial. |
| Outcome no aceptado | No marcar aviso entregado por el simple hecho de resolver una promesa. |
| Contexto de navegador o sesión guardada | No obtiene el puerto interno ni acredita operación durable. |
| Reserva EXPIRED leída por Payments | Clasificación acordada, no dato corrupto por sorpresa. |

Decisiones necesarias y responsables:

1. Pablo y Shirley: aceptar el puerto ligado a una consulta persistida pública de Payments o proponer su alternativa verificable; precisar los hechos de procedencia mínimos y su persistencia.
2. Shirley/Leslie: confirmar outcomes/campos, mapeo exacto de compensación, tratamiento de ausente/ajena y si un primer aviso recibido tarde se rechaza aunque el archivo sea anterior.
3. Shirley/Leslie: aceptar EXPIRED en la lectura y su adaptación antes de exponerlo.

Con esas decisiones registradas, completar paso A de BOOK-06-L04-T2 y autorizar B: persistencia, recepción/expiración y pruebas PostgreSQL reales. La aprobación de PR #51 no confirma por sí sola estas propuestas. No se añaden confirmSale/releaseBooking para acelerar esta entrega.


## Selección posterior de Leslie

Leslie delegó elegir el diseño el 3 de noviembre: «ve tu lo que es mejor ellos estan de acuerdo en todo». La selección vigente está en BOOK-06-L04-T2 §11; las menciones anteriores a confirmación conservan la procedencia de la propuesta y no se atribuyen como respuestas individuales del equipo. Se implementa primero B de Bookings; C conserva fuente real, autorización inicial UPLOAD_PROOF y adaptador seguro de compensación como requisitos de conexión.
