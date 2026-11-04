# BOOK-02-L02: disponibilidad conectada a viajes reales

3 de noviembre de 2026, America/Guayaquil. Base origin/develop 65957a9, PR #65 integrada (2026-11-04T01:58:43Z). Rama feature/BOOK-02-disponibilidad-viajes-reales. Leslie solicita continuar tras integración; se concreta disponibilidad por tramo, sin atribuir aprobación colectiva ni cerrar los demás incrementos. Trabajo asistido por Codex; revisión humana pendiente.

## Verificación previa y alcance

TripQueries.findBookableForSegment ya existe en Route Sheets/composition y valida publicación, ciclo/embarque, frecuencia/bus, tarifa e inventario congelado. No se rehace ese módulo ni se sustituye su inventario por el actual de Fleet. Las referencias de L-02 que lo describían como pendiente son históricas; §15 recoge el estado actual.

Búsqueda de PR por disponibilidad: #15 corresponde al dominio/consulta históricos; #48/#45/#46 describen otras entregas. No se identificó otro consumidor conectado equivalente en ramas/PR accesibles. El trabajo privado de David/Shirley no se considera ausente o integrado por inferencia.

Se añade adaptador de Bookings, validación pura del snapshot comercial y error de integridad. El caso de uso recibe el nuevo puerto por tramo; el servidor conecta únicamente la consulta pública real y falla composición si falta. El puerto anterior permanece para consumidores internos existentes, sin fallback tras fallo del nuevo. Se mantienen Auth CUSTOMER/no-store, salida mínima y lector de ocupaciones.

## Pruebas propias y entorno

Node 24.21.0, PostgreSQL 16.13 en Compose exclusivo leslie-disponibilidad-real, tmpfs y puerto local 55433. Guard NODE_ENV=test y base busesuta_test, sin .env ni bases persistentes. Sin migraciones/dependencias nuevas y sin cambios a código de Route Sheets/Fleet/Payments.

Primeras unitarias dirigidas: 26 aprobadas; se añaden después dos regresiones de calendario inválido y copia del snapshot. La validación completa actual las incluye. Comprueban contrato por tramo, errores antes de ocupaciones, identidad/recorrido, revisiones, inventario, medianoche y lugares repetidos por posición; RESERVED/SOLD con superposición/adyacencia; null/fallo sin libres; rechazo de campos del navegador; ausencia del proveedor al arrancar.

Integración nueva: 4/4 aprobadas. Se inicia el servidor real con Auth y se publica por HTTP una hoja con programación/tarifas, usando Fleet y frecuencias reales. Se consulta como CUSTOMER una salida futura con parada intermedia. Las ocupaciones son fixtures PostgreSQL explícitas, no prueba de creación/venta/recepción de comprobantes por sus APIs. Su lectura demuestra RESERVED/SOLD/revisión, tramos adyacentes, ocupación inactiva y otro viaje, respuesta sin propietario/datos privados y sin escrituras de reservas.

Prueba de permisos HTTP: 401 sin sesión, 403 para administrador en la ruta CUSTOMER; viaje ausente 404, posición fuera de recorrido/campo ajeno 400, Cache-Control no-store. Arranque/cierre reales mediante start/stop, no un montaje de app con inventario simulado.

La primera integración detectó una FK faltante en la preparación de ocupaciones: debía existir booking_trip_locks. Se corrigió la fixture insertando su relación antes de la reserva; no se alteraron FK ni validadores. La repetición pasó las cuatro comprobaciones.

Lint aprobado. Formato global mantiene los 17 archivos ajenos. npm test completo ejecutado: 1795/1795 unitarias en 92 suites; integración 566/568, 43/45 suites, 607,854 s, salida 1. Dos fallos: timeout original de 20000 ms en fotografías de Fleet y prueba histórica de arranque que esperaba catálogo ausente (503). Sin cambios al timeout de fotografías ni aserciones debilitadas.

## Límites

Este incremento habilita disponibilidad, no cotización ni creación comercial de reservas: siguen necesitando L-01/L-03 y acreditación. No abre acceso anónimo/invitado, no implementa sustituciones/reubicaciones ni pantallas; DESIGN.md no aplica en este alcance. La salida no garantiza asiento: la futura creación revalida dentro de la transacción.

No commit/push ni PR nueva solicitados para este incremento. La revisión de IA no sustituye revisión humana. Spec, puertos y estado se actualizan con resultados de esta rama, sin declarar cierre o integración.


## Resolución de la expectativa histórica y comprobación final

La prueba de arranque de booking-http.test.js esperaba 503 por falta de proveedor. La composición real ahora produce 400 para ID no UUID y 404 para un UUID desconocido. Se exigen ambos códigos, conservando health 200, cero reservas/ocupaciones y stop. Se añade POST summary -> 503 para comprobar que no se activa la compra con inventario ficticio. El cambio corresponde al comportamiento especificado antes de implementar; no se elimina ni se reduce una garantía para obtener verde.

Repetición dirigida final: booking-http y real-availability, 32/32 aprobadas; real-availability/server unitarias, 28/28 aprobadas, incluidas calendario inexistente y captura del snapshot antes del await de ocupaciones. No cambió código productivo después del npm test completo; solo la prueba de arranque se actualizó y se volvió a ejecutar junto con la integración nueva. No se repitió la suite global ni se extrapola un agregado corregido. La ejecución global registrada sigue fallida, con el timeout de fotografías sin modificar ni repetir para buscar verde.

Lint final aprobado; Prettier propio en los 12 JS aprobado; format:check global falla en los 17 archivos previos ajenos. git diff --check aprobado. Diff completo revisado: adaptador/validación/caso de uso/composición/errores de Bookings, pruebas y documentación. Sin cambios a módulos proveedores, migraciones, dependencias o frontend. Revisión humana y decisión de publicación pendientes; no se declara cierre o integración.

Log completo preservado en el espacio local del chat: book-l02-real-npm-test.log. Los errores esperados del middleware en pruebas no se presentan como defectos adicionales: los fallos reales de Jest están descritos arriba.


Limpieza final comprobada: cero bases catalog_*_test pendientes; Compose down retiró contenedor/red exclusivos leslie-disponibilidad-real y descartó tmpfs. No se detuvieron servicios ajenos. Rama sin staging/commit/push de este incremento; revisión humana pendiente.


## Revisión y guardado: renovación integrada

Leslie acepta continuar con el siguiente paso de revisión y guardado. Fetch previo comprueba develop 9920792, ROUTE-SHEETS-08/PR #68 y catálogo 23. La API findBookableForSegment y su DTO no cambiaron; no se rehace la renovación ni se modifican sus archivos. Antes del commit se conserva todo en stash 7cf67dc3de02420093087d68e65a41ae1ec7e4fb y se avanza la rama sin commits exclusivos por fast-forward. Sin merge/rebase ni cambios a main/develop.

Conflicto documental en BOOK-02-L02: se conservan la respuesta de Leslie transmitida por David y §§15–16. No se interpreta el registro de David como autorización de implementación; las solicitudes posteriores de Leslie delimitan disponibilidad y el checkpoint local. Registro completo del equipo conservado en estado-proyecto. Código recuperado sin conflictos y sin cambios productivos nuevos.

Revalidación actual en PostgreSQL 16.13 aislado, Compose exclusivo leslie-disponibilidad-renovacion, tmpfs/puerto 55433; NODE_ENV=test y base busesuta_test. Node 24.21.0. Sin .env ni bases persistentes. Lint aprobado; formato global mantiene los mismos 17 ajenos. La ejecución final de la base nueva pasó: 1838/1838 unitarias (95 suites) y 581/581 integraciones (46 suites), 337,724 s, salida 0. Total 2419 pruebas y 141 suites, incluido arranque real y disponibilidad sobre la renovación integrada. Los resultados anteriores se conservan como historia y no se atribuyen a la combinación actual.

Autorizado guardar un commit local con Conventional Commits en español. Push/PR de esta rama siguen pendientes de petición; no hay aprobación humana de código ni integración atribuida.


### Resultado del checkpoint

npm test completo sobre 9920792 aprobado, con las expectativas nuevas de arranque verificadas en la ejecución completa. Fotografías pasó sin modificar código, aserciones ni timeout. El registro anterior sobre 65957a9 se conserva y no se reescribe su fallo como si hubiera pasado.

Lint y Prettier propio (12 JS) aprobados; formato global aún falla en los 17 archivos previos ajenos. Diff completo revisado y git diff --check aprobado. No hay cambios a migraciones, catálogo, Route Sheets, Fleet, Payments o frontend como parte de este incremento. Respaldo 7cf67dc conservado. Log completo actual en el espacio local del chat: book-l02-renovacion-npm-test.log.

Leslie autoriza el guardado local al aceptar el paso recomendado de revisar/guardar. Mensaje Conventional Commit: feat(reservas): conecta la disponibilidad con viajes publicados; Refs BOOK-02-L02 §15/17. No se publica ni se solicita revisión a terceros automáticamente. La revisión humana y la conexión de cotización/creación permanecen pendientes.


Limpieza del checkpoint comprobada: cero bases catalog_*_test pendientes; contenedor/red exclusivos leslie-disponibilidad-renovacion retirados, tmpfs descartado y sin detener servicios ajenos.
