# BOOK-06-L04-T5: planificador de expiración

Actualización: recuperado sobre origin/develop c95cc73, PR #64 integrada. El registro siguiente conserva la verificación anterior; la validación de la combinación actual está al final.

## Registro histórico sobre feb7f75

Fecha: 3 de noviembre de 2026, America/Guayaquil. Trabajo asistido por Codex. Rama local feature/BOOK-06-planificador-expiracion, base feb7f75. Autorizado por Leslie para avanzar mientras responde Shirley. Pendiente de revisión humana, commit y publicación.

## Alcance comprobado

Selección de candidatos persistidos y lotes con cursor/corte estable; primer ciclo inmediato y recuperación al arrancar; sin temporizadores solapados. La liberación sigue siendo responsabilidad de la transacción existente. UNKNOWN y recepción aceptada no se seleccionan; SOLD inconsistente produce error sin liberar. Fallos de consulta se propagan y reintentan, nunca equivalen a todos libres. Se detiene la programación y se drena el trabajo antes de cerrar el pool.

Archivos: API de Bookings, repositorio de ciclo de vida, nuevo coordinador, configuración/temporizador/DTO seguro; composición server.js. Pruebas nuevas de planificador y ajustes proporcionales al contrato de cierre en dos pruebas existentes. Sin cambios de migraciones, dependencias, Payments, precios o frontend.

## Entorno y procedimiento

Node 24.21.0; PostgreSQL 16.13-alpine en proyecto Compose exclusivo leslie-expiry-t5, puerto local 55433 y almacenamiento tmpfs. Guard NODE_ENV=test y base busesuta_test. Sin .env ni bases persistentes. Las fixtures son sintéticas; la fuente QA de comprobante no certifica autorización HTTP ni conexión productiva de Payments.

Desde backend: npm run lint, npm run format:check, npm test. Dirigidas: suites unitarias expiration-scheduler/server y suites de integración expiration-scheduler/receipt-expiration/booking-http. Las carreras usan conexiones reales y barrera antes de COMMIT; se comprueba pg_blocking_pids antes de soltarla. No dependen únicamente de un retraso arbitrario.

## Resultados

- 26/26 unitarias dirigidas finales aprobadas: configuración estricta, cursor/reintento sin bloqueo por fila errónea, rechazo de datos inválidos, exclusión de lotes simultáneos, observación segura, temporización y cierre incluso ante fallo HTTP.
- 59/59 integraciones dirigidas aprobadas: límite exacto, protección de recepción e históricos, cursor tras error SOLD, distintas cooperativas, recuperación tras reinicio, error de lectura recuperable, dos trabajadores, recepción ganadora invisible al selector y expiración ganadora.
- Arranque real aprobado dentro de esa suite: reserva anterior al proceso expira, salud HTTP 200, cierre ordenado y retirada de listeners propios.
- Lint aprobado tras corregir acceso explícito a temporizadores; no se modifica ESLint.
- Formato propio final aprobado en los 11 archivos JS de código/pruebas del incremento. Formato global falla en los 17 archivos ajenos ya conocidos (Route Sheets y dos migraciones originales); no se reformatean.
- npm test global final: 90/90 suites unitarias, 1748/1748 pruebas aprobadas. Integración: 41/42 suites aprobadas, 538/539 pruebas aprobadas; único fallo en tests/integration/fleet/bus-photo-storage.test.js, «prepara y promueve todos los bytes sin conservar nombres ni rutas del cliente», timeout original de 20000 ms. Duración de integración 330,842 s. Salida global 1: la suite completa NO está aprobada. No se cambia ni repite ese timeout para ocultar el resultado.
- git diff --check aprobado. Las tres migraciones originales y el catálogo permanecen intactos; no hay cambios en dependencias o fotografías.

La primera ejecución de las pruebas nuevas detectó dos fallos de fixture: un UPDATE intentaba alterar un plazo inmutable y se consultaba /health en vez de /api/v1/health. Se corrigió la preparación mediante INSERT histórico y la URL conservando las expectativas; la repetición dirigida pasó.

## Límites y pendientes

No se garantiza tiempo máximo de drenaje si un tercero mantiene bloqueos indefinidamente. El cursor es privado y no durable: reiniciar vuelve a consultar desde lo más antiguo. Fallo por fila avanza y se reintenta en el pase siguiente. Los contadores EXPIRED incluyen replay idempotente, no necesariamente nuevas transiciones.

Origin/develop comprobado c08ce6c tras fetch: cambios nuevos de Pagos y frontend VIP, sin cambios en los archivos productivos de este incremento ni en migraciones. No se mezcló esa historia. Checkpoint anterior c3e9450 permanece únicamente en feature/BOOK-06-carga-autorizada, sin push; no es dependencia del planificador.

No se toca el timeout conocido de fotografías. No declarar la suite global verde si persiste. Las operaciones de venta, rechazo, autorización de carga y acreditación conservan sus contratos/pendientes. No hay PR nueva ni integración de este trabajo.


Contraste de PR accesibles: búsqueda de «planificador» devuelve #60, #61 y #62. Sus alcances documentan recepción/puente; #60 reserva expresamente el planificador para otro incremento. La búsqueda de «expiración» añade pruebas/contratos históricos (#56, #17, #51, #11, #47), sin otra entrega periódica identificada. La búsqueda se limita a lo accesible, no certifica trabajo local de otros integrantes.


## Próximo paso

Revisión humana del incremento y del fallo global ajeno antes de integrar. Mensaje de commit propuesto, sin ejecutarlo: `feat(reservas): programa la expiración de reservas vencidas`, referencia BOOK-06-L04-T5. No se ha publicado esta rama. Conservar c3e9450 en su rama independiente para retomar la carga tras responder Shirley.


Limpieza final comprobada: docker compose down retiró el contenedor leslie-expiry-t5-db-test-1 y la red leslie-expiry-t5_default; tmpfs descartado. No se detuvieron servicios ajenos. Lint y diff --check repetidos al terminar, aprobados.


## Recuperación y revalidación sobre c95cc73

Leslie autoriza continuar el planificador tras integrar la PR #64. Se comprobó Git y GitHub: merge c95cc73, 2026-11-03T23:35:53Z. La rama anterior no tenía commits exclusivos; avanzó desde feb7f75 por fast-forward, sin merge/rebase ni cambiar a main/develop. Se recuperó el stash 38fd1d801af875898e7cdb39ce6177751ae55efa sin borrarlo. Único conflicto en docs/estado-proyecto.md: conservar todo HEAD y añadir solo la sección del planificador; se retiró del índice la recuperación para dejar el trabajo pendiente de commit solicitado por Leslie.

La base incorpora lectura de Pagos, IDs opacos y formulario/registro de buses. El código de Bookings/server afectado por el planificador seguía igual, por lo que se recuperó sin conflictos de código. La preparación del down de recepción conserva la migración 21 integrada; no se edita ni excluye ninguna migración adicional.

Prueba nueva de trabajador desactivado: no intenta expirar ni crea temporizadores, incluso dejando transcurrir tiempo sin llamar a stop. Junto con las pruebas originales: 27/27 unitarias dirigidas aprobadas; 59/59 integraciones dirigidas aprobadas. Incluyen límites, cursor/reintentos, protección RECEIVED/UNKNOWN/SOLD, dos trabajadores, carreras PostgreSQL reales, recuperación al reiniciar y arranque/cierre real con salud 200.

PostgreSQL 16.13 temporal exclusivo leslie-expiry-t5-actual, tmpfs y puerto 55433. Node 24.21.0. Guard de base _test y NODE_ENV=test, sin .env ni bases persistentes. Lint aprobado. Formato global mantiene los 17 archivos ajenos de Route Sheets/migraciones; no se reformatean. npm test actual completado: 1772/1772 unitarias, 91/91 suites; 553/554 integraciones, 42/43 suites, 339,48 s. Único fallo: timeout original de 20000 ms de tests/integration/fleet/bus-photo-storage.test.js («prepara y promueve todos los bytes sin conservar nombres ni rutas del cliente»). Salida 1: no se declara suite global aprobada. No se cambia código, aserciones ni timeout de fotografías ni se repite para obtener verde.

Búsqueda accesible de PR por «planificador» devuelve #60/#61/#62, contratos/recepción/puente ya existentes; sin otra entrega periódica identificada. Esto no certifica ausencia de trabajo privado. El reparto nuevo con Shirley ya está registrado en T4: ella conecta carga/autorización, no este incremento.


Control propio de la recuperación: Prettier aprobado en los 11 JS de código/pruebas de este incremento. Sin archivos de migraciones, catálogo, Payments, frontend o dependencias en el diff productivo. No quedan rutas con conflicto; el índice se mantiene sin staging hasta el commit solicitado. La combinación actual completa queda registrada arriba: 1772 unitarias y 553/554 integraciones; único fallo conocido de fotografías, sin cambiar su código o límite.


## Entrega preparada y límites

Diff completo revisado en los archivos restaurados, prueba adicional de desactivación y documentación de la base actual. git diff --check aprobado y sin rutas en conflicto. No se modifican las migraciones existentes ni se incorpora el código de carga de Shirley como propio. Los resultados dirigidos y el arranque real corresponden a c95cc73 con este cambio local, no solo a la base antigua.

[Descripción de PR](descripcion-pr-planificador.md) lista para revisión. Mensaje propuesto: feat(reservas): programa la expiración de reservas vencidas, referencia BOOK-06-L04-T5. No se ha ejecutado commit, push ni creación de PR del planificador. El respaldo 38fd1d8 permanece disponible; no representa otra integración.

Log completo de la suite actual guardado en el espacio local del chat: book-t5-actual-npm-test.log. Registros anteriores de feb7f75 se conservan con su alcance original. El fallo de fotografías conserva su carácter intermitente documentado en T4/#64; esta ejecución falló realmente y requiere revisión antes de integrar, sin atribuir su solución al planificador.


Limpieza actual comprobada: cero bases catalog_*_test pendientes y Compose down retiró leslie-expiry-t5-actual-db-test-1 y su red exclusiva. Tmpfs descartado, sin detener servicios ajenos. Sin archivos preparados para commit; el planificador queda local para la petición de guardado/publicación de Leslie.


## Publicación autorizada: base actualizada con FLEET-09

Leslie solicita realizar el paso de commit, push y PR. Fetch previo detecta develop 4bb6861, con migración 1794080000000-protect-bus-seats y catálogo 22, más la prueba contractual de Pagos integrada. Para no publicar sobre la base anterior, se conserva el trabajo en stash 85bc73e69e6a8f8037c5b9960c09c415064df287 y se avanza la rama desde c95cc73 por fast-forward, sin commits exclusivos perdidos, merge/rebase ni cambios a main/develop. Recuperación sin conflictos; ambos respaldos permanecen disponibles.

Se conservan íntegros los cambios integrados de Flota y la preparación rollbackBefore de recepción; no se modifica esa prueba, la migración o el catálogo desde el planificador. No cambió el código del trabajador/coordinador. Lint aprobado; formato global conserva los mismos 17 ajenos. Las 1772 unitarias pasan; la nueva ejecución completa de integración se registrará antes de publicar.

PostgreSQL temporal exclusivo leslie-expiry-publicacion, tmpfs/puerto 55433, Node 24.21.0. Sin .env ni bases persistentes. Los conteos anteriores de c95cc73 conservan su alcance histórico. El log actual se guarda en el espacio local del chat como book-t5-publicacion-npm-test.log.


### Resultado definitivo de publicación sobre 4bb6861

npm test: salida 0. Unitarias 1772/1772, 91/91 suites; integraciones 564/564, 44/44 suites, 423,541 s. Total 2336 pruebas y 135 suites aprobadas. Incluye las pruebas propias del planificador, carreras y arranque real sobre catálogo 22. Fotografías pasó en esta ejecución sin modificar su código, expectativas o límite de 20000 ms. Se conserva el antecedente intermitente; no se declara corregido de forma determinista por este trabajo.

Lint aprobado. Formato propio de los 11 JS aprobado; formato global sigue fallido en 17 archivos ajenos. No se reformatean ni se edita la migración nueva de Flota. git diff --check aprobado. El índice y los archivos de la entrega se revisan antes del commit; código del planificador sin cambios desde las comprobaciones anteriores, base/pruebas integradas actualizadas.

Leslie autoriza commit, push de esta rama y preparación de PR a develop. Mensaje: feat(reservas): programa la expiración de reservas vencidas; Refs BOOK-06-L04-T5. Sin merge ni aprobación humana atribuida. Respaldos 38fd1d8/85bc73e conservados.


Limpieza de publicación comprobada: cero bases catalog_*_test pendientes; contenedor y red exclusivos leslie-expiry-publicacion retirados, tmpfs descartado, sin detener servicios ajenos.
