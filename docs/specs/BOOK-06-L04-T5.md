# BOOK-06-L04-T5: planificador de expiración persistida

- ID local de incremento D de [BOOK-06-L04-T2](BOOK-06-L04-T2.md), RN-40/50/51.
- Estado: implementación autorizada por Leslie al aceptar avanzar con el planificador mientras responde Shirley. Revisión humana del resultado pendiente.
- Base actual: origin/develop 4bb6861, rama feature/BOOK-06-planificador-expiracion. Incluye PR #64 (IDs de texto y conservación exacta del identificador). El desarrollo anterior sobre feb7f75 se conserva como evidencia histórica; no se vuelven a incluir sus cambios como propios de este incremento.
- Comprobación previa: no hay planificador en el servidor/API actual ni rama remota accesible equivalente. La rama local BOOK-06-T1-plazo-reserva (9da112f) contiene plazo configurable, sin coordinador periódico. No rehacer plazo/recepción ni decidir contratos de Payments.

## 1. Resultado y reglas conservadas

Buscar reservas vencidas al arrancar y periódicamente, invocando maintenance.expireBooking por reserva. La selección no decide la transición: se conserva bloqueo viaje → reserva → ocupaciones y reloj confiable bajo bloqueo. Recibidas a tiempo conservan asientos; UNKNOWN no se supone ausencia. Nunca liberar SOLD, cambiar expiresAt ni aplicar consecuencias a los 15 minutos de corrección.

Selección interna sin HTTP ni contexto del comprador, de solo lectura: PENDING_PAYMENT, NOT_RECEIVED conocido y expires_at <= cutoff. Orden estable expires_at/id, lotes limitados, cursor exclusivo por trabajador. El scope/cooperativa y asientos siempre se revalidan en la operación existente desde persistencia. Fallo de base se propaga como indisponibilidad, no como lista vacía.

## 2. Decisiones operativas seleccionadas

Leslie delegó las decisiones técnicas y acepta este trabajo; los valores siguientes configuran operación, sin cambiar el plazo de negocio de 180–300 segundos:

- BOOKING_EXPIRATION_ENABLED: true por defecto, false permite desactivar únicamente el trabajador automático; sin rol/flag enviado por cliente.
- BOOKING_EXPIRATION_INTERVAL_MS: 5000 por defecto, entero entre 100 y 60000.
- BOOKING_EXPIRATION_BATCH_SIZE: 50 por defecto, entero entre 1 y 500.
- Configuración inválida se rechaza antes de escuchar HTTP; sin dependencia nueva o migración.

Un pase fija cutoff del reloj de servidor al empezar. Cada ciclo procesa un lote y espera el intervalo después de finalizar; no solapar lotes del mismo trabajador. Si el lote está lleno, continuar desde la última pareja expiresAt/id con el mismo cutoff en el ciclo siguiente; al terminar el pase, reiniciar desde las vencidas conocidas con nuevo cutoff. Un lote lleno puede requerir una consulta vacía final.

Error de una reserva se registra sin datos personales y permite seguir con las demás; el cursor avanza para no bloquear las posteriores. El registro fallido se reintenta en el pase siguiente. Error al seleccionar conserva la posición y se reintenta. La cola persistida es la autoridad: al reiniciar se comienza por lo más antiguo, sin guardar temporizadores/plazos nuevos ni requerir un cursor durable.

Varias instancias pueden observar la misma reserva; la transición existente es atómica e idempotente. No se promete una sola ejecución del intento: se garantiza ausencia de doble liberación y de efectos parciales. Los contadores expresan resultados observados, no nuevas ventas/transiciones únicas.

## 3. Capas y composición

Repositorio de Bookings: consulta limitada de candidatos por cutoff/cursor y propagación segura de fallo. Aplicación: coordinador por lotes que llama al caso de uso expireBooking ya probado, con cursor privado y errores por fila. Infraestructura: temporizador con primer ciclo inmediato, espera tras cada ciclo, stop idempotente que cancela futuras llamadas y espera el lote en curso. Dominio: DTO seguro de fallo, sin mensajes SQL o bookingId en logs.

API pública de Bookings amplía maintenance con runExpirationBatch y startExpirationWorker; no repositorios/SQL ni ruta de expiración pública. La configuración viene de bootstrap. server.js inicia el trabajador al escuchar y detiene la programación al cerrar, drena el lote antes de terminar el pool en SIGTERM/SIGINT y retira listeners propios. Fallo de arranque debe cerrar servidor/pool y trabajador si existe.

stop espera el trabajo activo; no cancela una transacción a mitad ni promete un tiempo máximo de drenaje ante bloqueo externo. Tras una terminación abrupta, PostgreSQL y el resultado persistido permiten reintentar al arrancar. El cierre HTTP externo detiene la programación; el propietario del pool debe cerrarlo después de detener su uso.

## 4. Pruebas significativas

- Configuración, primer ciclo y periodicidad sin lotes solapados; stop antes/durante ciclo, error de consulta y de callback de observación sin detener recuperación.
- PostgreSQL: antes/en/después del plazo; conservación de RECEIVED/UNKNOWN/SOLD; trabajo en distintas cooperativas sin aceptar scope del cliente.
- Cursor: fallo de una reserva no impide procesar otras; repetir/reiniciar recupera pendientes, sin extender plazos ni ocultar error de lectura.
- Dos trabajadores y carrera con recepción mediante transacciones/barreras reales: recepción aceptada antes de commit pero no visible a la selección se protege al releer bajo bloqueo; expiración ganadora no se reactiva.
- Arranque real con reserva persistida anterior al proceso y salud HTTP; cierre ordenado y drenaje comprobados.

Backend lint, format:check, npm test con PostgreSQL aislado. Mantener timeout/aserciones de fotografías; reportar fallo conocido real. Sin .env ni bases persistentes. Sin UI: no cambia DESIGN.md, ni se hacen nuevas afirmaciones de verificación visual. Actualizar spec, evidencia y estado; no integrar, publicar o cerrar por pasar pruebas locales. El commit local previo fue autorizado; commit/push de este planificador requieren petición posterior de Leslie.

Detalle de ciclo de vida: start conserva server/pool y añade stop() idempotente para cierre HTTP, drenaje del lote y fin del pool. El cierre externo de server detiene la programación; stop es la API recomendada para esperar también el drenaje. Ajustar el contrato de la prueba de arranque a esta capacidad adicional conservando sus aserciones previas.


## 5. Contraste remoto, operación y revisión — registro anterior

El 3 de noviembre se actualizó origin/develop de feb7f75 a c08ce6c: se integraron lectura de Pagos con contexto y formulario VIP. El diff remoto no cambia Bookings, server.js ni catálogo/migraciones. Este incremento sigue basado en feb7f75; no se incorporan commits ajenos ni se declara actualizado o integrado con c08ce6c. No se encontró otro trabajador de expiración en los archivos/ramas accesibles revisados.

SOLID proporcional: un coordinador depende de dos puertos pequeños (seleccionar e intentar expirar), el repositorio solo selecciona candidatos y el temporizador controla el ciclo. Se conserva el caso de uso transaccional como autoridad. La revisión de IA y las pruebas no sustituyen aprobación humana.

Configuración de despliegue: las tres variables descritas en §2 proceden del entorno del servidor. No se requieren secretos nuevos ni editar .env. Desactivar el trabajador no desactiva el caso de uso manual interno; no existe endpoint público de mantenimiento. Los fallos registrados solo exponen código seguro y fase batch/booking. Sin credenciales durables de un comprador.

La prueba de arranque existente conserva todas sus aserciones y usa stop() para limpiar; la prueba unitaria de composición conserva server/pool y exige también la capacidad de cierre añadida. No se cambia el timeout, aserciones ni código de fotografías. Los datos UNKNOWN se construyen mediante INSERT histórico de QA, sin saltarse los triggers que hacen inmutable el plazo.

Evidencia de esta implementación local: [registro de pruebas](../evidence/BOOK-06-L04-T5/2026-11-03-planificador.md). No se certifica autorización HTTP de carga, ventas/rechazos ni finalización de Reservas. Shirley asume la conexión de carga y su autorización según el reparto registrado en BOOK-06-L04-T4 §10; su implementación pendiente no se duplica aquí.


## 6. Resultado local del 3 de noviembre — ejecución anterior

Implementación y revisión del diff completas localmente; revisión humana pendiente. Dirigidas: 26 unitarias y 59 integraciones aprobadas, incluido arranque real. Global: 1748 unitarias aprobadas y 538/539 integraciones; único fallo conocido de fotografías por timeout original de 20000 ms. Lint y formato propio aprobados; formato global falla en los 17 archivos ajenos previos. No se declara suite completa aprobada ni integración. Conteos/entorno/límites en la evidencia enlazada.


## 7. Recuperación sobre develop integrado — 3 de noviembre de 2026

Leslie autoriza retomar y adaptar el planificador al develop actual. PR #64 comprobada integrada en c95cc73; catálogo actual de 21 migraciones. No hay commits exclusivos en la rama antigua del planificador: se avanzó su referencia de forma fast-forward desde feb7f75 a c95cc73, sin merge/rebase, ni cambios a main/develop. Se aplicó el stash 38fd1d8 conservándolo como respaldo; único conflicto en estado-proyecto.md, resuelto con el registro completo de HEAD más la sección propia, sin perder evidencias del equipo.

Los archivos productivos de Bookings/server no habían cambiado desde el desarrollo anterior; las nuevas migraciones, corrección de IDs y pruebas de la PR #64 se conservan. La prueba histórica de down de recepción sigue usando la preparación ya integrada para la migración 21. No alterar el catálogo ni debilitar su rechazo de IDs opacos.

Revalidación: controles de configuración y trabajador desactivado sin iniciar intentos; lotes sin solapamiento; errores seguros/reintentos; PostgreSQL con catálogo 21 para recuperación, carreras reales y arranque/cierre del servidor. Se conserva el timeout original de fotografías y se reportará el resultado real de la nueva combinación. Commit/push/PR de este planificador todavía requieren petición de Leslie.


## 8. Resultado final sobre la base integrada

Base c95cc73, con PR #64. Dirigidas: 27/27 unitarias y 59/59 integraciones aprobadas, incluido arranque/cierre real y carreras con recepción. npm test global: 1772/1772 unitarias (91 suites) y 553/554 integraciones (42/43 suites); único fallo de Fleet en bus-photo-storage.test.js, «prepara y promueve todos los bytes sin conservar nombres ni rutas del cliente», timeout original de 20000 ms. Duración de integración 339,48 s. Salida global 1, no suite completa aprobada. No se modifica ni repite el timeout para ocultar el resultado.

Lint y formato propio (11 JS) aprobados. format:check global conserva 17 archivos ajenos. Diff completo revisado, sin conflictos ni cambios a migraciones/catálogo, Payments, dependencias o frontend. Spec, estado y evidencia actualizados. [Descripción de PR preparada](../evidence/BOOK-06-L04-T5/descripcion-pr-planificador.md); revisión humana/commit/publicación pendientes, sin declarar integración. El stash de respaldo se conserva.


## 9. Preparación de publicación con catálogo 22

Leslie solicita guardar/publicar el incremento y preparar su PR. Antes del commit se actualizó origin/develop y se detectó FLEET-09 integrada en 4bb6861 (nueva migración 1794080000000-protect-bus-seats), además de la prueba contractual de Pagos. Se avanzó la rama sin commits exclusivos por fast-forward desde c95cc73, recuperando el respaldo 85bc73e69e6a8f8037c5b9960c09c415064df287 sin borrarlo. No se ejecutó merge/rebase ni se tocaron main/develop.

La prueba histórica de down de recepción ya viene adaptada en develop mediante rollbackBefore; se conserva, sin editar ni excluir la nueva migración. Código del planificador recuperado sin conflictos. Repetir lint, format:check, npm test y arranque real sobre las 22 migraciones antes de publicar; los resultados de §8 siguen siendo evidencia anterior, no validación de esta nueva combinación.

Autorización actual: commit atómico feat(reservas): programa la expiración de reservas vencidas y push solo de feature/BOOK-06-planificador-expiracion; preparar PR hacia develop. Sin integración de la PR ni aprobación humana atribuida. No incluye cambios a los consumidores de David/Shirley.


Resultado final para publicación sobre 4bb6861: npm test aprobado, 1772/1772 unitarias (91 suites) y 564/564 integraciones (44 suites), salida 0; 2336 pruebas, 135 suites. Integración: 423,541 s. Incluye arranque real, recuperación, carreras y la migración 22. Fotografías pasó sin cambiar código/aserciones/timeout; el antecedente intermitente se conserva en la evidencia, sin atribuir su corrección al planificador.

Lint y formato propio (11 JS) aprobados; formato global conserva los 17 archivos ajenos. Diff completo revisado y sin cambios de producto ajenos a T5. La publicación y PR quedan autorizadas; revisión humana e integración siguen pendientes.
