# BOOK-07: Confirmar reserva desde pagos

> Conciliación del 2 de noviembre de 2026: Leslie confirmó cerrar la edición al vencer los 15 minutos conservando revisión y asientos, sin rechazo ni liberación automáticos. Las notas anteriores que lo indican pendiente son históricas; implementación y demás contratos conservan sus pendientes en BOOK-06-L04 y BOOK-07-L05.

> Replanificación del 1 de noviembre de 2026: [BOOK-07-L05](BOOK-07-L05.md) complementa esta spec con un borrador bajo los nuevos acuerdos. La evidencia inferior conserva su fecha/alcance histórico; no acredita adaptación a tarifas configurables congeladas ni proveedores reales. La política histórica incompatible no autoriza el nuevo comportamiento. Ningún incremento nuevo se considera aprobado por esta nota.

> Actualización documental del 1 de noviembre de 2026: aplicar las [reglas vigentes](../business-rules.md) y los [acuerdos de primera entrega](../acuerdos-primera-entrega.md), bajo [ACUERDOS-01](ACUERDOS-01.md). Los contratos anteriores incompatibles son evidencia histórica, no autorización para implementar la regla reemplazada. Esta actualización no modifica código ni acredita adaptación funcional. Las propuestas técnicas y pendientes conservan ese estado.
> Política vigente: edición 3 minutos desde primera carga salvo aprobación previa; solicitud de corrección permite 15 minutos con correo. Reemplaza archivo no reemplazable. Vencimiento de corrección pendiente; no equivale a rechazo definitivo.

- **Responsable:** Leslie; coordinación de contrato con Shirley
- **Revisor:** Edwin
- **Módulo:** bookings
- **Estado:** validación versionada y persistencia interna de venta verificadas localmente (§§15–16); caso de uso/API pública y conexión real a Payments pendientes. Revisión humana e integración pendientes.
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
Contrato acordado por Leslie y Shirley: `markPaymentProofReceived({ bookingId, cooperativeId, paymentProofId })` registra idempotentemente el vínculo aceptado de recepción; `confirmSale({ bookingId, cooperativeId, paymentProofId })` conserva esta firma y valida los mismos vínculos. La identidad de venta incluye el `paymentProofId` y el `proofVersion` obtenido de la consulta pública de intención de Payments; una versión distinta no se trata como el mismo intento. `bookings` es autoridad del total final en centavos/USD; `payments` contrasta ese total con la evidencia revisada, porque `bookings` no puede verificar por sí solo el dinero transferido.

En un reintento, `bookings` consulta primero si la venta ya fue confirmada con el mismo `paymentProofId`, `proofVersion` y vínculos. Si existe, devuelve el resultado persistido aunque haya pasado el plazo de carga. Timeout o pérdida de respuesta no constituyen rechazo definitivo. La bandera `paid` del navegador nunca acredita un pago.

`payments` persiste la intención de aprobación y su actor en estado pendiente antes de invocar `confirmSale`; registra la aprobación final solo después de la confirmación. La respuesta incierta se recupera repitiendo con el mismo `paymentProofId` y `proofVersion`. El esquema local de pagos se documenta en PAGOS-02; `bookings` implementa su verificación idempotente en su propio límite.

**Acuerdo adicional Leslie–Shirley, 4 de noviembre de 2026:** Payments persiste `proofVersion` entero (1 al crear, +1 por cada reemplazo completado correctamente). Al registrar la intención bloquea el comprobante y guarda versión, oficinista y fecha en la misma transacción; conserva el bloqueo si el resultado es incierto. Su API pública de consulta recibe los tres identificadores y devuelve vínculos, versión, oficinista y fecha, garantizando que la versión corresponda al contenido bloqueado. Bookings conserva esa versión con la venta. El adaptador de Payments devuelve `true` solo tras venta persistida; expresa rechazo definitivo con `BookingSaleRejectedError` e incertidumbre con `BookingSaleUncertainError`. El tratamiento de comprobantes preexistentes antes de asignar versiones sigue pendiente y no se presupone asignación automática.

## 6. Endpoints
No proponer endpoint público de aprobación en bookings. La entrada confiable será la API pública del módulo según contrato aprobado.

## 7. Criterios de aceptación
- [ ] Una aprobación válida vende exactamente los asientos de la reserva.
- [ ] Repetir la aprobación no duplica ventas ni efectos.
- [ ] Cooperativa o comprobante incorrectos no confirman la reserva.
- [ ] Aprobación y expiración concurrentes no producen asiento vendido y disponible a la vez.
- [ ] El rechazo sigue el acuerdo escrito sin liberar automáticamente por una regla inventada.
- [ ] Una recepción aceptada a tiempo puede aprobarse después del plazo y no expira mientras está en revisión.
- [ ] Un reintento con el mismo `paymentProofId`, `proofVersion` y vínculos devuelve la venta previamente confirmada, incluso después del plazo.
- [ ] La intención de aprobación y su actor quedan persistidos como pendientes antes de invocar a `bookings`; la aprobación final se registra tras confirmación.

## 8. Casos borde
Reserva vencida, ya confirmada, pago duplicado, importe distinto y fallo de emisión del boleto.

## 9. Pruebas
Contrato entre módulos, integración PostgreSQL y carreras aprobación/expiración. Verificar el flujo con Shirley y conservar evidencia.

## 10. Preguntas abiertas
El tratamiento de comprobantes preexistentes antes de asignar versiones; la implementación y pruebas productivas de la consulta de intención y API de venta; y la entrega del boleto y su recuperación ante fallo. El diseño de intención/versionado y la traducción de resultados entre módulos quedaron acordados el 4 de noviembre de 2026. El rechazo y liberación quedan para PAGOS-03.

## 11. Defecto inducido
No aplica.

## 12. Coordinación del contrato

- **Respuesta recibida:** Leslie respondió a la consulta de Shirley el 29 de octubre de 2026; Shirley aceptó sus precisiones. El contrato queda acordado entre ambos módulos.
- **Estado:** validación versionada y persistencia interna de venta verificadas localmente (§§15–16); caso de uso/API pública y conexión real a Payments pendientes. Revisión humana e integración pendientes.
- **Cambio de pagos registrado:** la spec PAGOS-01 y el código de pagos de la rama PAGOS-02 usan `markPaymentProofReceived({ bookingId, cooperativeId, paymentProofId })`; validar la integración de esta rama antes de integrarla.
- **Trabajo de Leslie:** implementar la API pública de `bookings` y las transiciones concurrentes de recepción, expiración y confirmación.
- **Trabajo de Shirley:** enviar los tres identificadores con `markPaymentProofReceived`, mostrar el total autoritativo al revisar y persistir la intención/actor antes de `confirmSale`; probar idempotencia, respuesta incierta y recuperación.
- **Acuerdo adicional recibido el 4 de noviembre de 2026:** Leslie confirmó el versionado `proofVersion`, la consulta pública de intención, el bloqueo transaccional con oficinista y fecha, la versión persistida con la venta y el mapeo de resultados `true`/`BookingSaleRejectedError`/`BookingSaleUncertainError`. La política para comprobantes existentes queda abierta; implementación e integración siguen pendientes.

## Aclaración para revisión documental
Las decisiones de producto de `docs/reservas-decisiones.md` fueron seleccionadas por autorización de Leslie y cierran las preguntas correspondientes de este borrador. El contrato con Shirley está acordado, pero BOOK-07 todavía no implementa su API pública, persistencia ni pruebas de integración; el código del módulo payments se mantiene en su rama de tarea. No se atribuye aprobación al revisor ni a otros integrantes.

## 13. Siguiente incremento: confirmación real solicitada por Pagos — 4 de noviembre de 2026

### Estado y objetivo

Leslie comparte la petición de Shirley de publicar confirmSale({ bookingId, cooperativeId, paymentProofId }) y pregunta cómo continuar. Se prepara T2/T3 ya previstos por esta spec, sin inventar un ID nuevo ni dar por aprobadas ampliaciones pendientes. Base comprobada origin/develop ae88e0c, con PR #70 integrada; no hay PR abiertas accesibles en la consulta. Rama feature/BOOK-07-confirmacion-venta. La cotización permanece publicada aparte en feature/BOOK-05-cotizacion-configurable, commit 32afe9d, sin perder ni incorporar su trabajo en esta entrega.

### Código comprobado y diferencias de contrato

- Bookings expone paymentQueries, createPaymentProofReceiver y mantenimiento, pero no confirmSale.
- Pagos conserva SimulatedBookingSaleConfirmer; ApprovePaymentProof guarda la intención antes de llamar y acepta únicamente true como confirmación. Cualquier error ajeno a sus clases locales se considera incierto. La integración necesita traducir explícitamente el resultado y errores de Bookings; no basta cambiar el nombre del proveedor.
- La recepción real deja accepted_proof_id y prueba persistida de recepción. La confirmación debe vincularse a esa recepción y no a tres identificadores declarados por navegador.
- Las validaciones actuales del ciclo de vida esperan ocupaciones RESERVED y estados previos a venta. Añadir SOLD exige que expiración, recepción repetida y lectura reconozcan venta confirmada sin tratarla como corrupción ni liberar sus asientos. Revisar esquema y restricciones antes de crear cualquier migración posterior, sin editar originales.

### Reglas ya acordadas que se conservan

Firma de tres identificadores, paymentProofId estable como clave idempotente, cooperativa y reserva confiables, total persistido de Bookings como autoridad, revisión del importe transferido por Pagos/oficinista. Una recepción aceptada a tiempo puede aprobarse después del plazo inicial. Repetir una venta confirmada con el mismo vínculo recupera el resultado aunque venza el plazo; un comprobante distinto no confirma otra vez la reserva. Timeout no es rechazo definitivo. Rechazo/liberación pertenecen a otro incremento.

### Propuesta técnica para conciliar antes de conectar

Conservar confirmSale(input) como operación invocada por Payments. Siguiendo el patrón de recepción, proponer una fábrica de Bookings que reciba un puerto de lectura autorizada de intención de aprobación de Payments y entregue el confirmador. El puerto/firma de la fábrica todavía no están acordados: no se añaden como API disponible. No exponer repositorios, clientes SQL ni credenciales de sesión del comprador para reintentos durables.

La lectura propuesta debe acreditar la intención persistida, comprobante/reserva/cooperativa, actor autorizado y versión revisada bloqueada. Precisar con Shirley cómo queda fijada la evidencia y la validación del total USD durante aprobación pendiente o incierta; no inferirlas de un status UPLOADED ni de que exista un archivo. Tampoco exigir que Payments ya esté APPROVED antes de vender: la aprobación final se guarda después de la venta.

Resultado propuesto de Bookings: DTO persistido de venta confirmada, idéntico en reintento. Adaptador de Payments convierte solo ese resultado verificado a true y traduce rechazo definitivo/resultado incierto a sus errores locales. Alternativa de devolver true directamente debe acordarse; no cambiar unilateralmente el consumidor ni dar por aprobado un DTO nuevo.

### Incrementos pequeños y criterios verificables

1. Conciliar con Shirley autorización/intención, versión y validación del importe, DTO y traducción de errores; registrar respuesta humana real. Resultado de esta preparación: brechas y propuesta escritas.
2. Implementar persistencia de venta e idempotencia en Bookings, con validación del vínculo de recepción y todas las ocupaciones dentro de una transacción; creación de nueva migración solo si el esquema lo requiere. Orden de bloqueos compatible con viaje/reserva, recepción y expiración. Rollback completo ante cualquier asiento inconsistente.
3. Exponer API pública, adaptar consumidores del ciclo de vida y entregar a Shirley rama/commit/spec probados. Conectar el consumidor de Payments en alcance coordinado con su responsable, sin duplicar su trabajo local.

Pruebas requeridas: confirmación válida; mismo intento repetido/concurrente; comprobante reutilizado en otra reserva/cooperativa; segundo comprobante para reserva vendida; reserva inexistente/expirada/UNKNOWN o sin recepción aceptada; aprobación después del plazo con recepción válida; carrera con expiración; respuesta perdida y reintento; fallo en un asiento/rollback completo; venta confirmada protegida de expiración y recepción repetida; falta de autorización/intención y diferencias de versión/importe según contrato conciliado. PostgreSQL aislado para carreras reales; lint, format:check, npm test y arranque si cambia composición. Mantener pruebas históricas y timeout de fotografías.

### Límite actual

Preparación documental, sin código funcional, migraciones ni pruebas nuevas ejecutadas; no se afirma disponibilidad de confirmSale. No se fija fecha/hora de entrega sin concretar el alcance dependiente. Sin commit/push, merge o cambios a main/develop. Sin frontend/dependencias nuevas. Revisión humana pendiente. [Evidencia de preparación](../evidence/BOOK-07/2026-11-04-preparacion-venta.md).

## 14. Diseño independiente y respuesta de Shirley — 4 de noviembre de 2026

Leslie solicita completar diseño y escenarios mientras responde Shirley a la propuesta de versionado. Su respuesta anterior confirma adaptador true solo después de venta persistida, BookingSaleRejectedError para rechazo definitivo y BookingSaleUncertainError para incierto; false no equivale a rechazo. Propone fuente pública de intención con actor/fecha y reporta bloqueo de reemplazo tras intención, pero reconoce que no hay versión/huella. Registrar como respuesta humana y estado reportado; no afirmar que sus cambios locales están verificados.

La propuesta proofVersion y su captura atómica siguen pendientes de confirmación. Preparación concreta en [diseño y matriz de venta](../contratos/confirmacion-venta-reservas-pruebas-propuesta.md): orden de bloqueos, rollback, recuperación, adaptación de ciclo de vida y 32 escenarios previstos, diferenciando reglas confirmadas de propuestas. El estado final de reserva y el esquema/DTO no están implementados.

Hallazgo de esquema: el CHECK de bookings solo admite PENDING_PAYMENT/EXPIRED y la restricción de expiración depende de esos estados. SOLD ya existe para ocupaciones. El dominio de ciclo de vida sigue validando RESERVED; debe ampliarse en el futuro incremento sin liberar ni interpretar como corrupción una venta legítima. No alterar migraciones existentes.

Con recepción ACCEPTED, venta después del plazo inicial es válida y expiración no debe competir por liberar asientos. La carrera temporal que decide admisión ocurre entre recepción y expiración; pruebas separadas para cada orden real. No usar solo tiempos de espera arbitrarios como evidencia de concurrencia.

Este avance es documental, sin código, nuevas migraciones o tests funcionales ejecutados. Comprobación estática y diff/enlaces; no trasladar resultados de cotización a confirmSale. Sin commit/push; cierre/implementación/conexión sujetos a los contratos pendientes y revisión humana.

## 15. Acuerdos recibidos y primer incremento independiente — 4 de noviembre de 2026

Fuente humana: Leslie comparte que Shirley registró el acuerdo proofVersion, consulta pública de intención, bloqueo transaccional y traducción de confirmación/rechazo/incertidumbre. Se reconoce el acuerdo comunicado; sus documentos locales actualizados no están publicados en develop ae88e0c ni hay PR abierta accesible. No se afirma haber verificado implementación de Payments.

Leslie confirma expresamente en este chat conservar archivos/decisiones antiguos, no asignarles versión automática ni procesarlos por el confirmador nuevo hasta conciliación documentada, y mantener el bloqueo de reemplazos con intención pendiente/incierta. Sustituye los pendientes documentales anteriores de esta decisión. No equivale a migrar o desbloquear esas filas ni a que exista un procedimiento automático de conciliación.

Bajo la petición de continuar, se ejecuta solo una primera pieza de T2: validación pura de intención versionada y recuperación de resultado persistido, sin escritura/consulta SQL, conexión a Payments, migración, transiciones de asientos ni API HTTP. No implementa confirmSale completa. Esta pieza no depende de la disponibilidad del proveedor: su representación es interna de Bookings y el adaptador futuro traducirá el DTO público que publique Shirley, sin cambiar unilateralmente su API.

### Contrato interno y archivos

- domain/booking-sale-attempt.js: verificar entrada/vínculos de una intención y reconstruir resultado persistido de un reintento. Depende solo de dominio del mismo módulo.
- domain/booking-sale-error.js: errores de vínculo, versión e integridad; todavía sin traducción a HTTP o clases de Payments.
- tests/unit/bookings/booking-sale-attempt.test.js: entradas incompletas, ausencia explícita, vínculos, versión, fechas, actor persistido y exactitud/inmutabilidad de resultado.

Representación interna de intención: {bookingId, cooperativeId, paymentProofId, proofVersion, requestedBy, requestedAt}. Los tres identificadores opacos conservan su valor exacto; proofVersion entero seguro >=1, actor no vacío, fecha ISO UTC canónica con milisegundos. No hay valor por defecto de versión ni normalización del identificador. El registro persistido agrega {currency, totalPriceCents, confirmedAt}; USD, centavos enteros seguros no negativos y fecha de confirmación >= intención. Validar cero no habilita venta gratuita: esta pieza solo valida un resultado y no crea ventas.

Solo null significa que no existe resultado previo. undefined/malformado no equivale a ausencia. Un vínculo o versión diferente no se considera repetición. Una coincidencia exige también actor/fecha originales inalterados, sin reemplazarlos por el actor/reloj del reintento. Resultado es copia inmutable y serializable. La función no acredita permisos: el caso de uso futuro debe obtener intención por fuente confiable y aplicar controles antes de exponer o crear cualquier resultado.

Los nombres internos no declaran una firma pública nueva de Payments ni cambian confirmSale({bookingId, cooperativeId, paymentProofId}). No se devuelve true ni se simula venta persistida. No se activan escrituras, no se cambia composición ni tratamiento de comprobantes antiguos en base de datos.

### Verificación prevista

Pruebas significativas de ambas funciones y compatibilidad de recepción/expiración. Ejecutar lint, format:check y npm test desde backend con PostgreSQL aislado para la suite global; no editar migraciones, pruebas previas o timeout de fotografías. Como no cambia composición, se conservan las comprobaciones reales de arranque existentes. Sin dependencias ni frontend. Actualizar evidencia/resultados reales; no commit/push en esta petición.

### Resultado del incremento independiente

60 pruebas unitarias nuevas aprobadas. npm test completo ejecutado: 1902/1902 unitarias y 587/588 integraciones aprobadas; salida 1 por timeout original 20000 ms en bus-photo-storage.test.js:23. No se cambió esa prueba ni se repitió para ocultar el fallo. Lint/formato propio aprobados; formato global conserva 17 archivos ajenos. PostgreSQL temporal eliminado; diff/enlaces revisados. [Evidencia](../evidence/BOOK-07/2026-11-04-intencion-versionada.md).

No hay persistencia de venta ni confirmSale pública disponible: se completó solo la validación interna/versionada y reconocimiento de reintentos. Siguiente incremento: transacción de venta, restricciones/estado confirmado y su coherencia con ciclo de vida; conexión a Payments solo con proveedor público real y contratos técnicos conciliados. Sin commit/push en esta sesión; revisión humana pendiente.

## 16. Persistencia de venta autorizada — 4 de noviembre de 2026

Leslie comparte confirmación explícita de Shirley: conservar archivos/datos/decisiones antiguos, sin versionar o confirmar automáticamente, mantener bloqueo con intención pendiente/incierta y comprobar antes posibles ventas, sin rechazo/liberación automática. Conciliación antigua separada; nuevos comprobantes desde versión 1. Leslie solicita implementar el siguiente paso: persistencia atómica de Bookings y coherencia del ciclo de vida.

Alcance: repositorio interno confirmSale(attempt, clock), aún sin exponer operación productiva desde index.js ni conectar fuente simulada. Recibe la representación interna verificada de §15. La autorización de intención y adaptación del proveedor real siguen en el caso de uso futuro; este repositorio no es una API para el navegador ni Payments. No cambia tablas de Payments ni asigna versiones a registros anteriores.

Ampliación mínima: migración nueva posterior al catálogo vigente, 1794240000000-booking-sale-confirmations. Añade columnas nullable sale_proof_version, sale_requested_by, sale_requested_at y confirmed_at en bookings, sin rellenarlas para filas existentes. Reserva confirmada se representa por CONFIRMED y sus ocupaciones SOLD/activas. El resultado se reconstruye del mismo registro, con unicidad del comprobante ya garantizada por accepted_proof_id y una única reserva por PK; no tabla nueva ni FK a infraestructura privada de Payments. Check completo para ambos estados previos y confirmado, y protección de datos de venta confirmada contra modificación. Down rechaza si existen ventas, sin borrar historia.

Transacción: copia/verifica intento antes de await; advisory por comprobante compatible con recepción → lock viaje → reserva → asientos en orden seat_id. Exige lock de viaje existente, recepción ACCEPTED persistida y coherente, total USD/summary y conjunto exacto de asientos/tramos. Venta nueva cambia todas las ocupaciones a SOLD conservando active, comprueba filas, guarda versión/actor/fecha/confirmación y confirma solo tras COMMIT. Reintento bajo los mismos locks recupera resultado original, aun después del plazo; mismatches no se convierten en repetición. Pérdida de COMMIT incierta no libera ni compensa; recuperar con mismo intento.

Dominio de ciclo de vida y lectura autorizada reconocerán CONFIRMED con recepción y fecha válidas; expiración lo protege y no lo incluye en candidatos. Recepción repetida conserva resultado ACCEPTED previo. No se recalcula precio ni se modifican reservas históricas. Errores nuevos de no confirmable/indisponible sin SQL expuesto; traducción de Payments sigue separada.

Verificación: PostgreSQL aislado, dos asientos, doble aprobación, pérdida de respuesta COMMIT, versión/vínculos distintos, sin recepción/UNKNOWN/expirada, corrupción de un asiento, fallo durante segunda actualización/rollback, expiración concurrente, recepción repetida, lectura/ocupación de confirmada. Migración up/down vacía y rechazo down con ventas; actualización desde catálogo anterior con filas intactas y nuevos campos null. Actualizar conteos explícitos del catálogo sin eliminar aserciones de seguridad, filtro de ocultos o historial. Ejecutar lint/formato/npm test y conservar timeout de fotos. Sin dependencias/frontend/cambios de composición/commit/push.

Compatibilidad necesaria del DTO nuevo: el lector de Payments reconoce CONFIRMED solo con carga deshabilitada, con pruebas que conservan total y privacidad del propietario. Cambio mínimo del adaptador de lectura existente, sin implementar ni duplicar la aprobación/versionado de Shirley. El formato público de las consultas conserva sus demás campos.

### Resultado de persistencia

Verificación final: npm test salida 0, 1904 unitarias y 608 integraciones aprobadas (2512 pruebas, 145 suites), incluido arranque real. Lint/formato propio (16 JS) aprobados; formato global conserva 17 archivos ajenos. Fotografías pasó con timeout original. Primera global falló dos casos de compatibilidad, corregidos sin debilitar pruebas; evidencia conserva ambas ejecuciones. PostgreSQL exclusivo eliminado. [Evidencia completa](../evidence/BOOK-07/2026-11-04-venta-atomica.md).

La persistencia interna confirma reserva y todos los asientos en una transacción y recupera resultados idempotentes. Aún no se expone confirmSale desde la API pública de Bookings ni se conecta fuente simulada de Payments. Siguiente incremento: caso de uso y composición con fuente pública real de intención versionada. Sin commit/push ni integración en esta sesión.

Guardado autorizado por Leslie el 4 de noviembre de 2026: commit del incremento de persistencia atómica con validación versionada, pruebas, migración y documentación. No se autoriza publicación en esta confirmación. Desde la suite final solo se modificó documentación; API pública e integración siguen pendientes.
