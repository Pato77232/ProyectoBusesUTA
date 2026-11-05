# BOOK-09 — evidencia de lectura para boletos, 4 de noviembre de 2026

## Contexto y alcance

Base 5ff50d9, rama feature/BOOK-09-lectura-venta-boletos en carpeta original. Leslie autoriza continuar después del contrato preparado; se aplica guia-proyecto. Cambios previos de ocupaciones conservados en stash respaldo-leslie-ocupaciones-antes-de-boletos-2026-11-04, sin reintroducirlos ni borrarlos. Este incremento implementa exclusivamente lectura interna de venta y proyección privada para emisión. Sin dependencias, migraciones, rutas, frontend ni cambios de server.js. Sin commit/push/merge/tags.

## Verificación dirigida

- Primera ejecución unitaria: 44/44 aprobadas.
- Primera integración: 10/11 aprobadas. El fixture de expiración intentaba cambiar una recepción ya aceptada y PostgreSQL lo rechazó: «La primera recepción aceptada es inmutable». Se prepara ahora una reserva expirada independiente sin recepción aceptada; no se modifica el trigger, producto o expectativa de expiración.
- Repetición dirigida final: 55/55 aprobadas, dos suites (44 unitarias y 11 integraciones), 3.505 s.
- La integración confirma y rechaza mediante PgBookingSaleConfirmer real, sin simular su resultado; usa snapshot comercial QA preparado explícitamente, no acredita compra por navegador, revisión real de documentos ni integración de emisión de Tickets. Verifica tenant, fechas, precio persistido, ausencia de efectos, asignaciones inconsistentes y lectura bajo un cambio transaccional aún no confirmado.
- PostgreSQL 16.13 temporal, contenedor exclusivo leslie-book09-boletos-pg, tmpfs, 127.0.0.1:55439, busesuta_test y credenciales QA. El puerto habitual 55433 estaba ocupado: no se reutilizó ni modificó esa base. No se consultaron .env ni bases persistentes.

## Verificación global

- Node 24.21.0. npm test: salida 1, 109 suites unitarias aprobadas y tres fallidas al cargar server.js; 1974 pruebas aprobadas de las que llegaron a ejecutarse. Duración 16.024 s. Fallan smtp-mailer.test.js, payments/server-review-composition.test.js y server.test.js por Identifier 'payments' has already been declared en server.js:92. El encadenamiento de npm test no alcanzó integración.
- Se ejecutó npm run test:integration por separado: salida 1; 40 suites aprobadas y 20 fallidas; 450 pruebas aprobadas y 29 fallidas; 265.17 s. Se observaron tanto errores de carga del servidor duplicado como fallos de scripts migrate.js down (entre otros user-cooperative-integrity, cooperative-admin y fleet/bus.migration). No se atribuyen todos los fallos a una sola causa ni se declara corregida la regresión. La suite nueva de booking-ticket-queries no aparece entre las fallidas. No se repite para ocultar el resultado global.
- npm run lint: salida 1, único error de parseo en server.js:92 por declaración duplicada. ESLint explícito de los nueve archivos JavaScript nuevos/modificados: aprobado.
- npm run format:check: salida 0, formato global aprobado. Los nueve JS propios (incluidos helper y tests) se comprobaron/formatearon con Prettier, sin reformatear archivos ajenos.
- git diff --check aprobado. Revisión completa de código, archivos nuevos, contrato y pruebas; el único JS existente modificado es index.js, para exportar la fábrica. No cambios en server.js, migraciones, catálogo, dependencias, configuración Jest ni pruebas existentes. Arranque global afectado por el fallo de la base; no se presenta como verificado ni se aplica el hotfix de forma incidental.
- Logs locales conservados en la carpeta de trabajo del chat: book09-ticket-npm-test.log, book09-ticket-integrations.log, book09-ticket-lint.log y book09-ticket-format.log. Las ejecuciones finales fallidas conservan código 1; formato conserva código 0.

## Límites

[Contrato público interno](../../contratos/bookings-lectura-boletos.md). Revisión humana y consumidor real de Shirley pendientes. No hay QR, envío, acceso HTTP público ni idempotencia de emisión implementados por esta tarea. Datos históricos sin snapshot comercial suficiente requieren conciliación separada. El hotfix de server.js no se aplica incidentalmente a esta rama; si afecta los checks se reporta.

La prueba de actualización concurrente utiliza una escritura QA para comprobar MVCC; no añade ni autoriza una operación para editar ventas en producción.

Limpieza verificada: docker stop y docker rm de leslie-book09-boletos-pg terminaron con código 0; el almacenamiento era tmpfs. No se detuvieron los contenedores del equipo ni la base que ocupaba 55433.

## Comprobación de dependencia del hotfix

Tras solicitar Leslie actualizar la base y repetir checks, fetch mantiene origin/develop en 5ff50d9. GitHub get_pr_info verifica PR #93 (hacia main) y #94 (hacia develop) abiertas, merged=false; cabeza hotfix/0.1.1 1eb0210. El commit corrector a03fcc4 elimina el bloque duplicado de server.js; no está integrado en develop. merge_commit_sha del servicio no se interpreta como prueba de integración cuando merged=false.

No se modifica server.js ni se integra la PR desde esta tarea, ni se mezclan sus cambios de release con el lector. La actualización a develop corregido y repetición de la suite global quedan pendientes de revisión humana e integración de #94. El árbol funcional del lector no cambió después de las 55 dirigidas aprobadas y de las comprobaciones globales fallidas registradas arriba; no se repiten sin cambio de base para intentar obtener verde. Sin commit/push/merge/rebase/tags. Cambios propios y respaldo anterior conservados.

## Actualización a hotfix integrado

GitHub confirma #94 merged=true, merge 5c48d22, integrado el 4 de noviembre de 2026 a las 19:55 (America/Guayaquil). Fetch actualiza origin/develop a ese commit. La rama feature/BOOK-09-lectura-venta-boletos se avanzó por fast-forward desde 5ff50d9, sin crear commit de merge ni tocar main/develop; cambios propios preservados y reaplicados desde stash respaldo-book09-antes-hotfix-integrado-2026-11-04, sin conflictos. Se conservan ambos respaldos.

node --check server.js, lint y format:check global aprobaron sobre esta base. Primera repetición de npm test: 1981 unitarias ejecutadas aprobadas, 111 suites aprobadas/una fallida por nodemailer ausente en node_modules, aunque ya figura en package.json/lockfile. Se sincronizan dependencias mediante npm ci sin añadir versiones o dependencias nuevas. Pruebas finales y arranque real pendientes de completar; resultados anteriores se conservan como historia.

## Resultado vigente sobre 5c48d22

Después de npm ci (salida 0, sin cambios en package.json/package-lock.json), npm test completo aprobó: 112/112 suites y 1990/1990 unitarias (10.884 s); 60/60 suites y 662/662 integraciones (470.824 s); salida 0. Total 2652 pruebas/172 suites. Se mantuvieron intactos tests, timeouts, migraciones y catálogo; el código propio del lector no cambió para obtener este resultado. Los fallos anteriores conservan su contexto y no se presentan como la verificación de la base nueva.

Lint y format:check global aprobados. Arranque real posterior, con puerto efímero y PostgreSQL temporal: HEALTH=200 y STOP=OK, salida 0. Worker de expiración deshabilitado para este smoke; las suites completas verifican sus escenarios propios. git diff --check aprobado. Revisión del diff: único JS existente modificado por el lector es bookings/index.js; server.js y versión 0.1.1 proceden del hotfix integrado y no son cambios nuevos de esta funcionalidad.

Los logs actuales son book09-hotfix-test-final.log y el smoke local book09-hotfix-smoke.cjs de la carpeta de trabajo del chat. Listo para preparar commit y publicación para revisión humana; no se crearon commits nuevos ni push/PR/merge de integración. API de Shirley todavía debe consumir y validar el contrato de emisión; pruebas del lector no acreditan emisión QR ni envío de boleto.

## Autorización de guardado y publicación

Leslie solicita explícitamente commit y push de feature/BOOK-09-lectura-venta-boletos. Se conserva el alcance del lector y la validación final de 2652 pruebas; no se autoriza integrar en main/develop ni emitir boletos desde esta tarea. Publicación se verifica contra la referencia remota después del push. Los registros anteriores de trabajo sin commit corresponden a sus etapas históricas.
