# Puertos de renovación — ROUTE-SHEETS-08, secciones 1–2

Contrato interno definido en sección 1 e implementado en sección 2 por PgRouteSheetRenewalRepository, prepare-route-sheet-renewal y POST /:id/renewals. Domain no importa pg, Express ni APIs de otros módulos. Aplicación verifica COOPERATIVE_ADMIN y contexto autenticado; ninguna clave opaca sustituye la autorización.

## Entrada y plan puro

`readRenewalRequest` acepta exclusivamente `sourceRouteSheetId`, `expectedProgrammingRevision`, `expectedTariffRevision` y `requestKey`. Los IDs y la clave son UUID normalizados a minúsculas; revisiones positivas hasta 2147483646. Ruta aporta origen, body las revisiones y clave; el controlador prepare-renewal.controller aplica este DTO en sección 2. Se rechazan tenant, serie, precio, fecha y destino elegidos por el navegador.

`planRouteSheetRenewal({ request, context, source, series, commitments, now, newId })` devuelve un plan DRAFT congelado, sin guardar ni generar viajes. `context` es `{ cooperativeId, modifiedBy }` verificado por aplicación; `now` es ISO con zona obtenido del reloj de servidor, `newId` es una función UUID suministrada en composición. No usa Date.now ni genera aleatoriedad dentro del dominio.

Snapshot `source`: routeSheetId, cooperativeId, busGroupId, status PUBLISHED, programmingRevision, tariffRevision, seriesId, programming y tariff. `programming` tiene la forma canónica de `parseProgrammingRequest(...).programming`; el adaptador proyecta el registro de programación, eliminando solo metadatos calculados y conservando servicios, puntos, traslados, disponibilidad y bloqueos con motivo. Antes de proyectar comprobará que los nombres/orden de puntos persistidos coinciden con el recorrido de la tarifa congelada; no sustituirá datos corruptos por nombres actuales. `tariff` es el snapshot congelado validable por `restoreTariffSnapshot`, no el tarifario actual de otra hoja.

`series`: id, cooperativeId, busGroupId, baseStartAt, cycleLengthDays y cycles ordenados por cycleNumber. Cada ciclo incluye routeSheetId, cycleNumber, status PUBLISHED, startAt/endExclusive ISO UTC normalizados. El último debe coincidir exactamente con el origen y su período. El plan reutiliza `plan-commercial-cycle` y `validate-programming-commitments`; no sustituye su autoridad.

`commitments` debe ser una lectura exitosa y completa `{ programs, hasLegacyConflicts, hasLegacyCycles }`. Incluye los borradores/publicados pertinentes del grupo y las agendas previas/posteriores de los buses implicados en otras hojas/grupos de la misma cooperativa. No limitar la consulta a actividades cuyo inicio cae dentro del destino. Cada elemento de programs tiene la forma validada de programación que consume el validador existente. Proveedor ausente o lectura fallida no se proyectan como `programs: []`; una lectura completa sin compromisos sí puede devolver esa lista.

El dominio comprueba estructura/cobertura/repetibilidad del patrón, todos los instantes y el cupo observado. En sección 2 aplicación debe volver a contrastar buses/grupos, frecuencias activas/hora/recorrido y continuidad reales usando sus puertos vigentes; el plan por sí solo no acredita el estado actual de Fleet/Frecuencias ni garantiza exclusión concurrente.

## Sesión transaccional de preparación

Sección 2 implementa un puerto pequeño `withLockedRenewal(context, work)` propio de Route Sheets. Inicia una transacción y toma el advisory lock de ADR 0006 antes de consultar/bloquear filas, igual que programación y publicación; mantiene ese orden hasta commit/rollback. No prestar repositorios ni el cliente SQL a Bookings/Fleet.

La sesión permite leer solicitud previa por tenant/clave, origen/serie, compromisos y destino previamente preparado, y guardar el plan íntegro. La persistencia de cabecera, programación, tarifa editable, procedencia, clave y auditoría debe ocurrir con el mismo cliente/transacción. No encadenar casos de uso públicos que abran transacciones independientes. No persistir el plan antes de terminar las validaciones actuales de proveedores.

## Idempotencia y publicación

1. Autorizar cada petición y buscar la solicitud durable por `(cooperativeId, requestKey)` antes de recalcular fecha/cupo. Para una coincidencia válida, `assertSameRenewalRequest(request, previous.request)` exige mismos origen, revisiones y clave; devolver el destino/actor/fecha originales aun si el origen ya no es último o el reloj avanzó. No volver a asignar IDs ni recapturar precios en ese camino.
2. Sin repetición, leer el snapshot bajo lock y contrastar que no exista otro destino para `(cooperativeId, seriesId, startAt)` en el registro de renovaciones. Otra clave para ese destino produce 409, nunca otro borrador ni modificación del anterior. La sección 2 incorpora restricciones durables para ambas unicidades mediante migración nueva y catálogo activo cuando corresponda.
3. Reutilizar clave con revisiones/origen distintos produce `ROUTE_RENEWAL_REQUEST_CONFLICT`/409. Datos persistidos inválidos deben clasificarse como fuente no verificable, no como un reintento nuevo. Clave ajena no se recupera ni revela por búsquedas globales.
4. Guardar el vínculo origen/destino/serie junto con el plan. Publicar el destino posteriormente debe derivar/contrastar la serie registrada y repetir cupo/continuidad/revisiones/proveedores dentro del flujo existente de publicación. Una petición concurrente no puede separar la validación de la escritura ni publicar en otra serie.

El plan usa revisiones propias iniciales 1; su tarifa DRAFT puede editarse por el flujo vigente aunque el objeto de intercambio sea inmutable. No transporta tripId, asignaciones anteriores, reservas, inventario comercial ni un horizonte nuevo. Códigos de petición inválida 400, origen ausente/ajeno 404, origen no publicado/no último/revisiones/intervalo pasado 409 y fuente no verificable 503 están definidos en `route-renewal-errors.js`. Conflictos de agenda/ciclos conservan sus errores existentes. El protocolo de sustitución con Reservas queda fuera.
