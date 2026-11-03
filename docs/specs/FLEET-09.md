# FLEET-09: Proteger la configuración de bus usada en hojas vigentes

- **ID local:** FLEET-09; libre en las specs y ramas accesibles al comprobarlo el 3 de noviembre de 2026. FLEET-08 está reservado para el borrador local de accesibilidad.
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `fleet`; lo consume `route-sheets` mediante `seatQueries.listByBus`
- **Responsable:** Edwin
- **Revisor propuesto / confirmado:** David; aceptó revisar el 3 de noviembre de 2026, según su mensaje reportado por Edwin
- **Estado:** T1 implementada en `43693bc`, publicada en borrador en [PR #59](https://github.com/Pato77232/ProyectoBusesUTA/pull/59); no se puede integrar sin las adaptaciones de Route Sheets, correcciones de revisión y validación final.
- **Prioridad y dependencias:** FLEET-06, FLEET-07 T1 y ROUTE-SHEETS-07 presentes en develop. La sustitución pertenece a D-05 de ROUTE-SHEETS-04.
- **Rama / PR / base comprobada:** plan integrado por [PR #58](https://github.com/Pato77232/ProyectoBusesUTA/pull/58) en `517473d`; implementación en `feature/FLEET-09-T1-inmutabilidad`, creada desde esa base, [PR #59](https://github.com/Pato77232/ProyectoBusesUTA/pull/59) en borrador hacia develop. Commit funcional `43693bc`.
- **Autorización de alcance:** Edwin autorizó comenzar T1 según la sección 14 y pidió el 3 de noviembre evaluar `43693bc` y publicarlo en una PR en borrador para coordinar con David. El mensaje de David reenviado por Edwin confirma el reparto: Edwin mantiene Fleet; David adapta las pruebas de Route Sheets en commits separados. Esta revisión no autoriza editar código o pruebas de David.

## 1. Objetivo

RN-12 exige que la configuración ordinaria del bus quede congelada para la hoja establecida y que los cambios apliquen a la siguiente. Una edición ordinaria no debe alterar el inventario de viajes ya publicados, y la sustitución excepcional de un bus no debe confundirse con esa edición.

## 2. Situación comprobada en develop (`04868b2`)

- **Route Sheets ya conserva su copia:** durante la publicación, ROUTE-SHEETS-07 consulta la API pública `seatQueries.listByBus` y guarda en su transacción una copia en `route_sheet_commercial_inventories` de los asientos con `offered: true` (`seatId`, `layoutSeatKey`, `label`, `deck`, `row`, `column`, `category`). La lectura pública actual de Fleet usa su pool: no comparte el cliente transaccional de Route Sheets, de ahí el supuesto de inmutabilidad descrito a continuación. No tiene FK ni SQL sobre tablas de Fleet, y el reintento de una publicación ya completada no vuelve a capturar Fleet.
- **Esa copia se apoya en un supuesto de Fleet:** ROUTE-SHEETS-07 §4.2 indica que se captura «bajo la inmutabilidad actual de Fleet» y que cualquier edición futura requiere acordar antes una sesión transaccional pública o una lectura de configuración inmutable por versión.
- **Fleet no edita hoy:** el código no tiene `UPDATE` ni `DELETE` sobre `buses` o `bus_seats`. La inmutabilidad es una convención del código, no una restricción de la base: un `UPDATE` directo la rompe sin aviso, y `bus_seats` se borra en cascada si se borra el bus.
- **Pruebas que actualizan asientos directamente:** `fleet/seat-queries.test.js`, `route-sheets/commercial-trips.test.js` y `route-sheets/trip-queries.test.js` usan `UPDATE bus_seats SET offered = false` para preparar datos, y `fleet/bus.migration.test.js` y `fleet/bus-vip-seats.test.js` para comprobar restricciones.

Conclusión: los viajes ya publicados están protegidos por su copia. Lo que falta es que Fleet garantice el supuesto del que depende esa copia y defina cómo se harán las ediciones futuras.

## 3. Reglas de negocio involucradas

- **RN-12:** configuración ordinaria congelada para la hoja establecida; cambios para la siguiente. La sustitución excepcional requiere un contrato adicional.
- **Acuerdos §3.6:** la sustitución por avería es una excepción auditada con motivo, autor y relación bus anterior/nuevo; comprueba compatibilidad y correspondencia de cada asiento comprometido, sin completar automáticamente.
- **Arquitectura:** Fleet es dueño de las versiones de configuración y los asientos físicos; Route Sheets, de la copia por hoja; Reservas, de la ocupación.

## 4. Alcance

**Incluye, según lo que se decida:**

- Hacer cumplir en la base la inmutabilidad de identidad y atributos de los asientos de un bus registrado.
- Registrar el contrato: `seatId` nunca se reutiliza ni cambia de bus, y una edición futura no modifica asientos en el lugar.
- Dejar definido el modelo de edición ordinaria futura, sin implementarlo.

**No incluye:**

- Editar la configuración de un bus: no hay pantalla ni endpoint de edición en esta entrega.
- Sustitución de bus: corresponde a D-05 de Route Sheets.
- Reservas, ocupaciones o sus tablas internas.
- Cambios en las tablas o el código de Route Sheets.

## 5. Datos

Propuesta sujeta a la sección 10: migración nueva con un trigger que rechace `UPDATE` de identidad y atributos en `bus_seats` (`id`, `bus_id`, `cooperative_id`, `layout_seat_key`, `label`, `deck`, `row_index`, `column_index`, `category`, `offered`) y `DELETE` de asientos de un bus registrado. Las migraciones existentes no se editan.

## 6. Endpoints

No aplica. `seatQueries.listByBus` conserva su contrato.

## 7. Criterios de aceptación

- [ ] Dado un bus registrado, cuando se intenta cambiar un atributo de sus asientos, entonces la base lo rechaza y el asiento no cambia.
- [ ] Dado un bus registrado, cuando se intenta borrar uno de sus asientos, entonces la base lo rechaza.
- [ ] Dada una hoja publicada, cuando se consulta su viaje, entonces su inventario es igual al capturado al publicar.
- [ ] Dado el alta de un bus, cuando se registra, entonces sus asientos se crean igual que hoy.

## 8. Casos borde y errores

| Caso | Comportamiento |
|---|---|
| Cooperativa quiere desactivar un asiento después del alta | No disponible en esta entrega; requiere la edición versionada de la decisión 2 |
| Bus averiado en un viaje vendido | Sustitución de D-05, no edición de Fleet |
| Migración de reversión | Elimina el trigger sin alterar datos |

## 9. Pruebas esperadas

- **Integración con PostgreSQL aislado:** rechazo de `UPDATE` y `DELETE`, alta intacta y reversión de la migración.
- **Contrato con Route Sheets:** el inventario de un viaje publicado no cambia tras intentar editar el bus.

## 10. Preguntas abiertas

David respondió el 3 de noviembre de 2026; Edwin reportó su mensaje. Acordó las tres decisiones con las condiciones registradas en cada una. La aprobación final de la implementación queda para su revisión.

### Decisión 1: ¿cómo garantiza Fleet la inmutabilidad en esta entrega?

- Estado: Decidida
- Fecha y participantes consultados: 3 de noviembre de 2026; Edwin y David
- Reglas, specs y contratos afectados: RN-12, ROUTE-SHEETS-07 §4.2, FLEET-02 y FLEET-06
- Opciones y recomendación: (A) trigger en la base que rechace cambios y borrados de asientos; (B) solo documentar que Fleet no edita. Se recomienda A: convierte en garantía el supuesto del que depende la copia de David. Su costo es que las pruebas que hoy usan `UPDATE bus_seats SET offered = false` deberán preparar datos con `disabledSeatKeys` en el alta, cambio que necesita autorización de cada responsable.
- Respuesta humana y evidencia de confirmación: David aceptó proteger la configuración en la base y adaptar sus pruebas conservando su cobertura
- Decisión y justificación: A, con tres condiciones de David para sus pruebas: (1) los asientos no ofrecidos se preparan con `disabledSeatKeys` en el alta; (2) las pruebas que simulan un cambio después de publicar conservan la comprobación de que la copia comercial no se recaptura, mediante un proveedor de prueba controlado; (3) se mantiene el caso de inventario vacío sin permitir registrar buses inválidos, porque el alta exige al menos un asiento ofrecido
- Responsable de aplicarla y revisor: Edwin en Fleet; David adapta las pruebas de Route Sheets y revisa
- Criterios de aceptación/pruebas que cambian: sección 7 y preparación de pruebas de Fleet y Route Sheets
- Trabajo dependiente e independiente: depende T1
- Decisión anterior que reemplaza, si aplica: ninguna

### Decisión 2: ¿cómo se hará una edición ordinaria futura?

- Estado: Decidida como modelo futuro, fuera de la implementación actual
- Fecha y participantes consultados: 3 de noviembre de 2026; Edwin y David
- Reglas, specs y contratos afectados: RN-12 y ROUTE-SHEETS-07 §4.2
- Opciones y recomendación: (A) versiones inmutables de configuración: editar crea una versión nueva, conserva el `seatId` de cada posición y `listByBus` informa la versión leída; (B) edición en el lugar dentro de una sesión transaccional pública compartida con la publicación. Se recomienda A: no exige coordinar transacciones entre módulos y la próxima publicación captura la versión vigente. Solo se acuerda el modelo; se implementará cuando exista una necesidad de edición.
- Respuesta humana y evidencia de confirmación: David aceptó el versionado inmutable como propuesta futura documentada
- Decisión y justificación: A, sin implementar ahora. Conserva los `seatId` de los mismos asientos del bus, la publicación captura la versión vigente y las copias ya publicadas se conservan
- Responsable de aplicarla y revisor: Edwin; David
- Criterios de aceptación/pruebas que cambian: ninguno en T1
- Trabajo dependiente e independiente: no bloquea T1
- Decisión anterior que reemplaza, si aplica: ninguna

### Decisión 3: ¿qué aporta Fleet a la sustitución excepcional?

- Estado: Decidida entre Edwin y David; falta Leslie para los asientos comprometidos
- Fecha y participantes consultados: 3 de noviembre de 2026; Edwin y David. Leslie, pendiente
- Reglas, specs y contratos afectados: acuerdos §3.6 y D-05 de ROUTE-SHEETS-04
- Opciones y recomendación: Fleet no modifica ningún bus al sustituir. Route Sheets registra la excepción y lee el inventario del bus nuevo con `listByBus` para comprobar compatibilidad por `layoutSeatKey`, `label` y `category`; Reservas aporta los asientos comprometidos por su API pública. Si un asiento no tiene correspondencia, no se completa automáticamente.
- Respuesta humana y evidencia de confirmación: David aceptó la separación para D-05
- Decisión y justificación: Route Sheets registra la sustitución y consulta Fleet por su API pública. La comparación por `layoutSeatKey`, `label` y `category` valida compatibilidad entre ambos buses sin asumir que comparten `seatId`. Si la consulta de asientos comprometidos falta o falla, no se asume que no hay reservas. El contrato de esa consulta sigue pendiente con Leslie
- Responsable de aplicarla y revisor: David; Edwin como consultado
- Criterios de aceptación/pruebas que cambian: ninguno en Fleet
- Trabajo dependiente e independiente: D-05 depende; T1 no
- Decisión anterior que reemplaza, si aplica: ninguna

## 11. Defecto inducido

No aplica.

## 12. Diseño SOLID y usabilidad

- **Responsabilidades:** Fleet garantiza la fuente inmutable; Route Sheets conserva la copia por hoja; Reservas, la ocupación. Ningún módulo lee tablas de otro.
- **Abierto/cerrado:** la edición futura agrega versiones sin cambiar el contrato de `listByBus` para buses sin ediciones.
- **Usabilidad:** sin interfaz en este alcance; no se verifica.

## 13. Plan y evidencias

| Paso | Resultado comprobable | Archivos compartidos |
|---|---|---|
| T1: inmutabilidad en la base | Migración con trigger y pruebas de rechazo | Preparación de pruebas de Fleet y Route Sheets que hoy actualizan `bus_seats`; las de Route Sheets las adapta David con sus condiciones |

**Evidencias:** planificación e implementación registradas por separado en la sección 14; los criterios de integración final siguen pendientes.

Revisión documental del 3 de noviembre: diff limitado a esta spec y su fila en `docs/estado-proyecto.md`; `git diff --check` aprobado. Se contrastaron `seatQueries.listByBus`, la preparación y persistencia del inventario comercial y ROUTE-SHEETS-07. No se ejecutaron lint ni pruebas de producto porque no cambian código, migraciones o pruebas; los criterios funcionales anteriores siguen pendientes. Los acuerdos se registran como mensaje de David reportado por Edwin, no como revisión final del código. Redacción inicial asistida por Claude Code; revisión y preparación de PR asistidas por Codex. El borrador FLEET-08 permanece local y fuera del diff.

## 14. Revisión y cierre

Pendientes. PR #58 publicada para revisión documental de David; no equivale a aceptación de la implementación. Autorizar T1 por separado y confirmar con Leslie el contrato de asientos comprometidos para D-05. No se enviaron mensajes a David o Leslie desde esta revisión.

### T1: inmutabilidad en la base, 3 de noviembre de 2026

Edwin autorizó comenzar T1. Rama `feature/FLEET-09-T1-inmutabilidad`, creada desde `origin/develop` en `517473d`; implementación guardada en `43693bc`.

**Implementación:**

- Migración nueva `1793760000000-protect-bus-seats.js`: trigger `bus_seats_immutable` `AFTER UPDATE OR DELETE` que rechaza con `23001` cualquier cambio o borrado de asientos, incluido el borrado en cascada desde `buses`. Es `AFTER` para que las violaciones de CHECK y unicidad conserven sus códigos. La reversión elimina el trigger sin tocar datos.
- `fleet/bus-seat-immutability.test.js`, nueva: alta intacta, rechazo de cambios de `offered`, `category`, `label`, `layout_seat_key` y `row_index`, de una actualización sin cambios, de borrados directos y en cascada, y reversión con reaplicación.
- `fleet/seat-queries.test.js`: el caso de todos los asientos no ofrecidos desactiva el trigger solo durante su preparación, porque ese estado no puede lograrse por el alta; las comprobaciones no cambian.

**Evidencia con PostgreSQL aislado:**

- Unitarias: 1323 de 1323 aprobadas. Lint sin errores y Prettier correcto en los archivos tocados.
- Integración de Fleet: 167 de 167 aprobadas en 13 suites.
- Integración completa: 392 aprobadas y 7 fallidas de 399, en 33 suites.
  - **4 fallos esperados por la decisión 1**, en pruebas de David que preparan datos con `UPDATE bus_seats`: tres en `route-sheets/commercial-trips.test.js` y uno en `route-sheets/trip-queries.test.js`. David acordó adaptarlas conservando su cobertura; no se modificaron aquí.
  - **3 fallos anteriores a T1:** `database.test.js`, `route-sheets/route-sheet-programming.test.js` («la migración no permite down que destruya programación real») y `route-sheets/commercial-trips.test.js` («down no destruye información comercial»). Fallan igual en `develop` sin la migración de T1: las dos de Route Sheets esperan que el último `down` sea su propia migración. No se atribuye causa a Fleet sin investigarlas.
- La base de pruebas se recreó antes de medir: conservaba el nombre anterior de la migración VIP (`1793640000000`) de una rama previa y bloqueaba las migraciones.

**Antes de integrar:** David debe adaptar sus cuatro pruebas en la misma PR o antes, con las condiciones de la decisión 1; si no, `develop` quedaría con esas pruebas fallando. También conviene resolver las tres pruebas de reversión que ya fallan en `develop`.

### Coordinación y revisión para publicar el borrador

Mensaje de David reenviado por Edwin el 3 de noviembre: confirma las adaptaciones acordadas y propone realizar las cuatro de Route Sheets sobre esta rama, en un commit separado, conservando expectativas y usando `disabledSeatKeys` al alta y proveedor controlado para inventario vacío/cambios de fuente después de publicar. Revisará las dos reversiones de Route Sheets en otro cambio, por nombre de migración y manteniendo la protección de datos. `database.test.js` se investigará conjuntamente sin atribuirle una causa. Solo después se repetirá lint, formato y suite completa con PostgreSQL aislado antes de integrar.

Revisión de Codex del mismo `43693bc`: lint aprobado; **1323/1323 unitarias** en 74 suites; formato de los tres JS del incremento aprobado. Formato global conserva **17 archivos ajenos** pendientes. `git diff --check` aprobado. No se modificó código, migraciones ni pruebas durante esta revisión ni se tocaron archivos de Route Sheets. Las cifras globales 392/399 anteriores se conservan como evidencia registrada, no como una repetición nueva ni como aprobación.

Repetición de integración Fleet por Codex con Node 24.21.0/Linux y PostgreSQL 16.13 exclusivos: **166 aprobadas y una fallida de 167**, 12 suites aprobadas y una fallida de 13. Timeout de 20 000 ms en `fleet/bus-photo-storage.test.js`, caso «prepara y promueve todos los bytes sin conservar nombres ni rutas del cliente». Las pruebas nuevas de inmutabilidad y `seat-queries` aprobaron. El resultado 167/167 previo no anula esta ejecución; no se atribuye causa al timeout ni se amplía el límite. Instalación reproducible con `npm ci` y lock sin cambios en volumen efímero; base `busesuta_test`, sin leer `.env`; contenedor, red y volumen exclusivos eliminados. No se repitió integración de Route Sheets ni global antes de sus adaptaciones: se mantiene para la validación final conjunta.

Pendientes propios de Fleet detectados para resolver antes de integrar: la reversión de `bus-seat-immutability.test.js` aún supone que su migración es la última; debe localizarla por nombre y verificar conservación/restauración. `seat-queries.test.js` prepara todos los asientos no ofrecidos desactivando temporalmente el trigger: revisar esa preparación para conservar el caso de lectura sin convertir la desactivación de la protección en parte del contrato normal. Estos puntos no se ocultan por pasar las pruebas actuales.

La PR se publica en borrador para revisar y coordinar el commit, no para integrar. Sin autorización implícita de edición/versionado/sustitución ni implementación de FLEET-08. Implementación asistida por Claude Code; evaluación y publicación asistidas por Codex. No se enviaron mensajes a otros integrantes desde esta revisión.

### Adaptaciones de David sobre T1 — 3 de noviembre de 2026

David autorizó aplicar las adaptaciones en la rama actual `feature/FLEET-09-T1-inmutabilidad`, base `d5802e7`, inicialmente limpia. Esta ejecución incluye la migración real de T1; reemplaza la preparación anterior sobre la rama documental, que fue deshecha por petición de David. No se modifican producción, migraciones ni pruebas de Fleet.

- Cuatro adaptaciones de Route Sheets: alta válida con `disabledSeatKeys` para filtrar asientos; proveedor público controlado conectado al servidor real para inventario vacío; respuestas controladas para cambios posteriores a publicar y comprobación explícita de que los reintentos/consultas no vuelven a invocar `listByBus`. Se conservan IDs, actor, fecha, copia congelada y rollback con HTTP 409; ningún bus inválido se registra.
- Cambio lógico separado de reversiones: helper `tests/helpers/migration-target.js` identifica la migración aplicada por nombre y retira las posteriores antes del `down` bajo prueba. Programación y viajes conservan el rechazo ante datos reales y restauran el esquema en `finally`; el upgrade legado deja de depender de dos pasos fijos.
- `database.test.js`: la reproducción previa identificó datos comerciales residuales de otras suites que activaban correctamente el guard comercial. Se limpia solo la base exclusiva de pruebas antes de comprobar reversión de esquema vacío y reaplicación sin duplicados. Las pruebas separadas con información real conservan sus expectativas de rechazo. Este ajuste no cambia ningún guard.

Validación conjunta final con PostgreSQL aislado (`docker-compose.test.yml`, proyecto `busesuta-fleet09-t1-david`): `npm test` aprobó **1323/1323 unitarias** y **398/399 integraciones**. Las cuatro suites adaptadas aprobaron sus **48/48 pruebas**, con la migración real de T1 presente; también aprobaron las pruebas de inmutabilidad de Fleet. Único fallo: timeout de 20 segundos en `fleet/bus-photo-storage.test.js`, «prepara y promueve todos los bytes sin conservar nombres ni rutas del cliente», ya registrado antes. No se modifica esa prueba ni su límite ni se declara verde la ejecución global.

Lint, Prettier de los cinco JS cambiados y `git diff --check` aprobados. `format:check` global falla en 40 archivos ajenos a esta adaptación; la cifra corresponde a esta ejecución local y no reemplaza la evidencia anterior de otro entorno. Node local v22.19.0; Node 24 pendiente para estas adaptaciones. Sin lectura de `.env`. PostgreSQL temporal retirado al terminar. Sin commits, publicación ni integración; revisión humana pendiente. Los dos pendientes propios de Fleet de la sección anterior permanecen fuera de esta adaptación.

Separación propuesta al preparar commits: `test(hojas-ruta): adapta las pruebas a los asientos inmutables` para las cuatro adaptaciones; `test(base-datos): verifica las reversiones de migraciones específicas` para helper, dos reversiones de Route Sheets y preparación de `database.test.js`, repartiendo la evidencia documental correspondiente. No se ejecutan commits.
