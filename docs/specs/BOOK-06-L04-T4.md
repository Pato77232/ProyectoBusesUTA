# BOOK-06-L04-T4: carga autorizada de comprobantes con Reservas reales

- ID local de planificación, continuación C2/C3 de [BOOK-06-L04-T3](BOOK-06-L04-T3.md); no ID externo.
- Estado: contrato de carga en borrador, regla histórica confirmada por Leslie; incremento I de compatibilidad implementado y probado localmente. Última validación global: 1729 unitarias y 537 integraciones aprobadas; revisión humana pendiente. El timeout previo de Fleet se conserva como antecedente, sin cambios a su límite. Conexión de carga y registro de autorización a cargo de Shirley según reparto de §10; código local de ella no verificado aquí.
- Base comprobada: origin/develop feb7f75; PR #62 integrada el 3 de noviembre a las 20:25:30Z. Rama local feature/BOOK-06-carga-autorizada; checkpoint c3e9450, sin push.
- Responsable de referencia: Leslie (Bookings), coordinación con Shirley (Payments) y Pablo (Auth). Reparto comunicado y aceptado por Leslie en §10; no sustituye revisión humana de código.
- Relacionadas: [PAGOS-01](PAGOS-01.md), [PAGOS-02](PAGOS-02.md), [lectura](BOOK-07-L05-T1.md), [recepción](BOOK-06-L04-T2.md).

## 1. Estado real antes de implementar

createPaymentReceiptModule y paymentProofQueries.findForBookingReceipt ya existen en develop, igual que el puente unificado y la fábrica compatible de PR #62. No rehacerlos.

createPaymentsModule usado en server.js conserva lector, notificador y confirmador de venta simulados. La carga actual recibe customerId proyectado desde Auth, pero llama findForPayment(bookingId) sin contexto. No acredita la consulta autorizada UPLOAD_PROOF sobre Bookings real. La tabla de comprobantes no registra al comprador que obtuvo esa autorización.

PR #55 abierta en 7448e1a y #56 abierta en 15218ae: consulta REVIEW_PAYMENT y prueba de lectura, sin activar server.js. No incorporar ni duplicar ese consumidor. Las ramas accesibles no muestran una entrega posterior de carga autenticada; no demuestra ausencia de trabajo privado.

Fallo conocido independiente: timeout de fotografías de Fleet reproducido en la conciliación de PR #62. Conservar su evidencia, aserciones y límite; no declararlo resuelto por integrar la PR.

## 2. Acuerdos ya confirmados

- Auth autentica y verifica sesión/rol antes de permitir carga; CUSTOMER propietario de la reserva.
- Consulta Bookings por findForPayment({ bookingId, purpose: UPLOAD_PROOF }, authContext), sin firma alternativa que omita contexto.
- Identidad/cooperativa/importe/plazo vienen de Auth y Bookings, nunca como autoridad del body.
- PDF/JPEG/PNG y máximo 5 MiB; conservar la validación existente, sin presentar comprobación de cabecera como validación exhaustiva de documentos.
- Guardar archivo y comprobante/outbox antes del aviso. Solo resultado definitivo confirmado puede compensar; incertidumbre conserva evidencia.
- Recepción/expiración y reintento idempotente según T2/T3. No guardar una sesión/JWT para trabajadores.
- Carga, aprobación y rechazo son operaciones distintas. No inventar venta confirmada o habilitar simulador como alternativa de la conexión real.

## 3. Historia de comprobantes: regla confirmada y detalle pendiente

No se consultan bases persistentes. El esquema permite registros sin evidencia persistida de quién autorizó su carga contra una reserva real; no pueden atribuirse a un propietario solo por existir su bookingId.

**Confirmado por Leslie en este chat:** conservar comprobantes antiguos UPLOADED sin esa procedencia, sin borrarlos, notificarlos automáticamente, aprobarlos ni adoptar el archivo durante un reintento nuevo. Responder un error seguro que requiera conciliación separada. No liberar sus asientos ni modificar su recepción por esta decisión. No afirmar que el dinero fue devuelto.

La carga nueva debe registrar la procedencia verificada en la misma transacción que comprobante/outbox. No backfill ni authorized=true enviado por navegador. Para registros AWAITING_UPLOAD sin archivo, una primera carga nueva con autorización real podría registrar procedencia; precisar ese caso al confirmar el contrato, sin inventar que ya hubo una carga autorizada.

Alternativa: un procedimiento humano separado de conciliación de historia previa. No existe todavía ni se ejecutará automáticamente en esta tarea. La decisión afecta a Payments, Bookings y Auth; Leslie confirmó «Sí, conservarlos y aplicar autorización nueva». La coordinación de implementación con Shirley sigue consultada, sin respuesta registrada.

## 4. Contrato técnico propuesto

Nueva composición explícita de carga autenticada, nombre/firma por cerrar con Shirley; no activar todavía server.js.

1. Auth/CSRF reales antes de consumir o escribir el archivo, conservando límites del parser.
2. Proyectar y copiar { userId, role, cooperativeId } de request.auth.user verificado, antes de await. Rechazar actor/cooperativa/precio/contexto escogidos por body.
3. Consultar propósito UPLOAD_PROOF con el adaptador estricto existente. Reserva inexistente/ajena indistinguible; conservar 401/403/400 y distinguir integridad de indisponibilidad.
4. Crear comprobante con identidad/vínculos de servidor; registrar comprador autorizado e instante original de autorización junto a archivo/outbox, sin credenciales serializadas. Nombres/estructura persistida y migración nueva por concretar tras confirmar §3. No editar migraciones existentes.
5. Fuente persistida existente: reutilizar su consulta/puerto con procedencia verificable para esta composición. No usar una consulta que solo prueba persistencia como si probara autorización. Mantener separados los contratos preparados/legacy hasta conciliar sus pruebas y consumidores.
6. Invocar receptor real y traducción unificada. Repetición de una carga nueva ya autorizada debe conservar el mismo comprobante/archivo/resultado y exigir sesión actual para la ruta del comprador. No crear una versión nueva de comprobante.

## 5. Incrementos verificables propuestos

A. Cerrar §3 y coordinación con Shirley; definir firma/composición, persistencia de procedencia y errores. Solo contrato, sin cambios productivos dependientes.

B. Primera carga autenticada como funcionalidad completa: casos de uso, nueva persistencia atómica y router opcional por API pública. Comprobar Auth/CSRF, Bookings, archivo/outbox y aviso reales con PostgreSQL aislado. No duplicar la bandeja de PR #55 ni aprobar ventas.

C. Activación revisada en servidor y prueba de arranque real. Precisar convivencia de rutas: una sola ruta de carga y ningún confirmador simulado habilitado como venta real. Este punto no autoriza inventar confirmSale/rechazo/QR; dependen de sus contratos.

Cada incremento debe terminar con spec/evidencia/estado reales; no PR nueva exclusivamente documental por automatismo. Commit/push solo cuando Leslie los pida. Revisión humana separada de pruebas locales.

## 6. Matriz de pruebas prevista, no ejecutada

- Carga propia autenticada completa y aislamiento entre cooperativas.
- Otra reserva/ausente indistinguibles; 401, sesión revocada, 403, CSRF y cuerpo/contexto falsificados sin escribir archivos/comprobantes.
- Datos de autorización copiados antes de await, importe/plazo persistidos sin aceptar valores del body.
- Primera carga, reintento con sesión nueva y respuesta perdida; una evidencia y un resultado.
- Dos solicitudes simultáneas: no duplicar comprobante/outbox, archivo o aviso aceptado.
- Historia UPLOADED sin procedencia: resultado confirmado en §3, sin adopción o borrado implícitos.
- Fallos de archivo/persistencia/COMMIT/aviso/marcado entregado y carrera con expiración: conservar o compensar solo según resultado definitivo.
- Migración nueva sobre base vacía y develop con datos, sin inventar procedencia ni modificar historia.

Para B/C: backend lint, format:check y npm test; PostgreSQL aislado, arranque real al modificar composición. Sin .env, bases persistentes, dependencias sin anunciar, pruebas debilitadas ni timeout de Fleet modificado. Sin UI en este alcance; DESIGN.md no aplica salvo que se autorice una tarea de pantalla separada.


## 7. Incremento I seleccionado: identificadores opacos compatibles

Inspección de 1793123000000-payment-proofs-and-outbox confirma booking_id UUID en payment_proofs y payment_proof_notification_outbox. El contrato de lectura publicado ya exige bookingId opaco no vacío, sin imponer UUID. Esta incompatibilidad impide cargar una reserva real con ID de texto antes incluso del aviso.

Corregir de forma independiente, sin construir el consumidor autenticado de Shirley: migración nueva 1794000000000-payment-booking-identifiers que convierta ambos booking_id a text, conservando UUID existentes exactamente como texto canónico. IDs de comprobante/outbox y cooperative_id conservan sus tipos. Catálogo explícito de 21 entradas, exclusión de ocultos y validación estricta intactas; no editar migraciones originales ni historia.

Down solo si todos los IDs son UUID en su representación canónica minúscula, sin normalizar identidad/case ni perder datos. Si hay IDs opacos o no canónicos, rechazar antes del DDL; exigir plan separado. No borrar registros para permitir reversión.

Pruebas: base vacía; copia aislada de las 20 migraciones de develop con comprobante/outbox/datos representativos; conservación exacta de filas; reintento; down/up con UUID canónicos; rechazo de down con ID opaco o UUID con mayúsculas sin cambios; fallo DDL en la segunda tabla revierte ambas columnas e historial. Ejercitar el puente real con reserva de ID no UUID y fuente persistida, identificando contexto QA, sin afirmar Auth HTTP.

Ajustar preparación de pruebas que suponían recepción como última migración para seguir probando su down protegido; mantener aserciones, añadir control de la migración nueva y restaurar esquema. Verificar lint, format:check y npm test con PostgreSQL aislado. Sin nuevas dependencias, .env, bases persistentes, cambios a fotografías, rutas o server.js.

Este incremento no aplica ni inventa procedencia autorizada a los comprobantes antiguos; esa regla humana ya confirmada se implementará en el flujo autenticado posterior. La respuesta sobre trabajo concurrente de Shirley no se presume; I evita tocar su consumidor y su fuente SQL.


## 8. Resultado local del incremento I

[Evidencia](../evidence/BOOK-06-L04-T4/2026-11-03-identificadores-opacos.md). Migración nueva y catálogo de 21 entradas implementados, con cinco casos nuevos de conservación, reversión/rollback y puente con ID opaco. 66 comprobaciones dirigidas aprobadas. Preparación de pruebas históricas ajustada conservando sus aserciones.

Backend: lint y formato propio aprobados; npm test 1724 unitarias y 534/535 integraciones, falla por el timeout de fotografías de Fleet sin modificar su código o límite. Formato global conserva 17 archivos ajenos. Arranque real aprobado. PostgreSQL y red exclusivos retirados; bases temporales de catálogo pendientes: cero.

Carga autenticada y activación siguen sin implementar; regla histórica confirmada y coordinación de implementación con Shirley consultada. El nuevo consumidor debe preservar también el ID exacto, sin el trim aplicado por la carga legada. Ningún comprobante antiguo se adopta o acredita por esta migración.

Estos resultados son previos al checkpoint local registrado en §9; sin push ni PR nueva. No declarar cierre/integración ni activación productiva por estos resultados.

## 9. Checkpoint local autorizado

Leslie acepta continuar el plan propuesto: guardar primero este avance en un commit local y desarrollar el planificador en otra rama. Se guarda solo el incremento I y su evidencia, sin push ni PR nueva. La implementación de carga autenticada conserva sus pendientes.


## 10. Reparto comunicado y preparación de entrega — 3 de noviembre de 2026

Leslie aporta respuesta de Shirley: rama feature/PAGOS-WEB-01-bandeja, commit local c1d638f con cambios posteriores sin commit. Shirley propone encargarse de conectar UPLOAD_PROOF/contexto Auth/receptor real y registrar autorización de carga, con sus pruebas. Leslie acepta avanzar con ese reparto. Leslie conserva incremento I: migración del identificador y compatibilidad con outbox. Los archivos locales de Shirley no están disponibles aquí y no se atribuyen a GitHub. La conservación de comprobantes antiguos sin procesar ni borrar sigue confirmada.

Checkpoint existente: c3e9450 en feature/BOOK-06-carga-autorizada, sin publicar. Origin/develop comprobado c08ce6c; conserva exactamente las 20 migraciones activas previas y sus archivos. La nueva migración permanece intacta. Este contraste de esquema no afirma que la rama haya incorporado los nuevos commits de Pagos/frontend.

Hallazgo dentro de la compatibilidad: toPaymentProof reconstruye el modelo con createPaymentProof, que normaliza booking_id con trim; saveWithPendingNotification usa luego ese dato al insertar outbox. Para un ID con espacios al inicio/final, comprobante y outbox pueden divergir aunque ambas columnas sean text. La corrección dentro del alcance vigente consiste en conservar exactamente booking_id en el modelo y probar escritura/lectura/aviso/reintento; no cambiar IDs UUID, archivo, autorización o la firma de carga. Entradas sin contenido siguen rechazadas. El consumidor de carga legado aún recorta su entrada y su sustitución corresponde a Shirley; no activar ese flujo como compatible con todos los IDs opacos.

Pruebas adicionales: modelo con ID opaco exacto y rechazo de vacíos; dos identidades que solo difieren en espacios/case deben conservarse distintas; repositorio/outbox/fuente persistida y receptor deben conservar ID con espacios externos y recuperar el mismo resultado tras el plazo. No se considera autorización Auth la fixture QA. Repetir lint/formato y npm test aislado, manteniendo evidencia histórica y fallo de fotografías sin modificar su timeout. Sin cambios de composición/migraciones existentes ni dependencias nuevas.

El planificador verificado queda preservado en un stash de su rama feature/BOOK-06-planificador-expiracion, sin incorporar ni perder sus cambios. No publicar ni crear nuevos commits de este incremento hasta la petición correspondiente de Leslie.


Nota de preparación: la PR #55 se comprobó integrada (75ee7a0, 2026-11-03T21:30:58Z); #56 sigue abierta en borrador (15218ae). Sus estados anteriores en §§1/8 son observaciones históricas, no el estado actual. El catálogo y las 20 migraciones de origin/develop c08ce6c coinciden exactamente con feb7f75 (diff sin cambios); la migración de esta rama añade la entrada 21. No se ejecutó merge/rebase ni se afirma validación de una combinación de commits no incorporada.

La nueva regresión del receptor usa una identidad persistida de QA con espacios externos; el generador de altas actual produce UUID y su helper recorta IDs inyectados. No se modifica ese generador ni se presenta la fixture como alta HTTP. Las dos nuevas pruebas PostgreSQL eliminan sus propios IDs opacos en finally: conservarlos indebidamente entre suites bloqueaba correctamente el down a UUID. La protección no se debilita.


## 11. Resultado final de preparación

npm test sobre PostgreSQL temporal recién creado: 1729/1729 unitarias (89 suites) y 537/537 integraciones (41 suites), salida 0; 2266 pruebas aprobadas. Duración de integración 341,19 s. Incluye base vacía, actualización con datos desde las 20 migraciones equivalentes a develop actual, conservación de filas, rechazo de historias inesperadas, rollback, down protegido y arranque real existente. Las nuevas regresiones de identidad también pasaron. No se modificó composición.

Lint y formato propio (9 JS de la entrega) aprobados. format:check global continúa fallido en 17 archivos ajenos. Fotografías pasó en esta ejecución sin modificar código/límite; el antecedente de timeout no se presenta como corregido de forma determinista. Diff revisado y evidencia actualizada. Sin nuevo commit/push ni PR creada; descripción preparada en la evidencia. El siguiente checkpoint propuesto es fix(pagos): preserva la identidad de reserva en el outbox.


Publicación autorizada por Leslie tras revisar los resultados: guardar los ajustes en un commit atómico y publicar únicamente feature/BOOK-06-carga-autorizada. La autorización no integra la rama ni aprueba su PR; no incluye el planificador preservado aparte.
