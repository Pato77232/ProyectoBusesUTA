# BOOK-02-L02: conciliación de PR #70

4 de noviembre de 2026, America/Guayaquil. Rama feature/BOOK-02-disponibilidad-viajes-reales. PR #70 abierta en e262428, base develop 9f7ac91; GitHub confirmó conflictos y ninguna conversación de revisión pendiente. Leslie solicita corregirlos y actualizar la PR. Trabajo asistido por Codex; no sustituye revisión humana ni autoriza integración.

## Conflictos y solución

Pagos ya integró lectura y carga con Bookings, además de procedencia de carga. El cambio coincide con la composición de disponibilidad en server.js y su prueba unitaria. Se incorporó origin/develop mediante merge en la rama publicada, sin rebase/force-push ni checkout de main/develop.

Resolución: Bookings se compone una sola vez con availabilityQueries reales. Su createPaymentProofReceiver se entrega a createPaymentReceiptModule. Las paymentQueries y el notificador persistido se entregan a carga; paymentReview usa las mismas consultas y sigue montado en createApp. Se conservan el trabajador de expiración y stop. No se sustituye ninguna conexión real por un adaptador legado.

Se conservaron todas las comprobaciones de server.test de ambos lados y el caso de proveedor de viajes ausente. server-review-composition.test recibe el doble mínimo de tripQueries ahora requerido y exige su entrega a Bookings, manteniendo sus comprobaciones de carga/lectura. No se modifica la migración de procedencia, catálogo, aplicación/contratos de Pagos ni módulos de David/Edwin como parte de la resolución. Los cambios integrados de esos archivos se conservan.

Estado-proyecto se fusionó sin conflicto preservando registros. No se inventan aprobaciones ni estados CI. El diff de PR se evaluará contra develop para distinguir la conciliación de los cambios ya integrados de Shirley.

## Pruebas y entorno

Node 24.21.0; PostgreSQL 16.13 temporal exclusivo leslie-pr70-conciliacion, tmpfs/puerto 55433. Guard NODE_ENV=test y base busesuta_test. Sin .env ni bases persistentes. Catálogo actual 24; ninguna migración editada o marcada manualmente como ejecutada.

29/29 unitarias dirigidas aprobadas: composiciones de servidor/Payments y disponibilidad. Lint aprobado; formato global conserva los 17 archivos ajenos. npm test completo aprobado: 1842 unitarias en 96 suites y 588 integraciones en 47 suites; total 2430 pruebas en 143 suites. Incluye arranque real y carga autenticada, lectura, recepción, expiración y disponibilidad. Fotografías pasó con sus expectativas y timeout originales. Formato de los tres JS de conciliación aprobado. No se declara CI remoto ni revisión humana aprobados. El contenedor y la red exclusivos se eliminaron mediante compose down tras finalizar las pruebas.

## Compatibilidad de historial detectada en la base integrada

Se creó una base efímera separada pr70_history_<UUID>_test, aplicando realmente las 23 migraciones del catálogo anterior (renovación incluida y sin procedencia de carga). Se sembró una fila CUSTOMER sintética y se capturaron filas de todas las tablas y definiciones de columnas, incluido pgmigrations.

Con el catálogo 24 de develop 9f7ac91, que intercala 1794086400000-payment-proof-upload-provenance antes de 1794160000000-route-sheet-renewals, migrate up rechazó con MIGRATION_HISTORY_UNEXPECTED. La comparación posterior confirmó filas/columnas/historial sin cambios. La base efímera se eliminó. No se convirtió ningún historial ni se inspeccionaron bases persistentes.

Procedimiento reproducible: usar el harness tests/helpers/migration-worker.js, raw con activeNames filtrando únicamente payment-proof-upload-provenance para construir la versión anterior, luego migrate/up del catálogo actual y comparar snapshots. Se valida tanto el rechazo como la ausencia de cambios; no se escribe pgmigrations a mano.

Esto es un límite de actualización del catálogo ya integrado en develop, separado de los conflictos de disponibilidad. Una base persistente que haya ejecutado ese catálogo antiguo de 23 entradas necesita un plan de conciliación con Pablo/Shirley antes de actualizarse. No se afirma que exista tal base del equipo. No se cambia ni debilita la validación estricta para aceptar automáticamente esa historia.
