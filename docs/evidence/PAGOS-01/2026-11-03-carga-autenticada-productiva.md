# PAGOS-01 — carga autenticada y recepción productiva

**Fecha:** 3 de noviembre de 2026<br>
**Rama final:** `feature/PAGOS-02-develop-actualizado`<br>
**Base inicial:** `origin/develop` en `2f194b7`; revalidada y conciliada sobre `65957a9`<br>
**Alcance:** sección 17 de [PAGOS-01](../../specs/PAGOS-01.md#17-carga-autenticada-y-recepción-productiva--3-de-noviembre-de-2026)

## Cambios

- Se conectó la carga HTTP con la identidad de Auth y la consulta pública de
  Bookings `findForPayment(..., 'UPLOAD_PROOF')`. El servidor autoriza la reserva
  antes de guardar archivo o comprobante.
- Se preserva el identificador opaco sin coerción a UUID ni recorte de espacios.
- La migración nueva `1794086400000-payment-proof-upload-provenance.js` registra
  en transacción el actor y hora de autorización. No modifica migraciones
  anteriores ni atribuye autorización a filas históricas.
- Comprobantes `UPLOADED` antiguos sin procedencia completa o con actor distinto
  requieren conciliación (409) y no se leen, sobrescriben, notifican ni borran.
  Una fila `AWAITING_UPLOAD` puede recibir su primera carga tras nueva
  autorización real.
- Se compuso el receptor de recibos de Bookings en `server.js`; la aceptación
  real conserva el comprobante, outbox, archivo y asiento. El resultado incierto
  mantiene evidencia; el rechazo definitivo sigue su compensación ya definida.

## Verificación ejecutada

- `npm test`: 91 suites/1751 unitarias y 43 suites/552 integraciones, salida 0
  en la base inicial; después de conciliar con develop actualizado, 92
  suites/1776 unitarias y 45 suites/571 integraciones, salida 0.
- `npm run lint`: aprobado.
- `npm run format:check`: falla por 17 archivos previos ajenos a Pagos. Prettier
  de todos los JS modificados: aprobado; no se reformateó código ajeno.
- Arranque real desde `src/server.js`: `/api/v1/health` 200, GET de comprobantes
  sin sesión 401 y POST de carga sin sesión 401.
- Pruebas HTTP de carga con Auth, Payments, Bookings, PostgreSQL temporal y
  almacenamiento local aislado verifican autorización, aislamiento del dueño,
  persistencia de procedencia, recepción idempotente e historia previa.
- `git diff --check`: aprobado. `package.json`, `package-lock.json` y
  dependencias no cambiaron.
- `npm ci` instaló en el worktree aislado desde el lockfile; npm reportó 26
  avisos de vulnerabilidad (3 bajos, 22 moderados y 1 alto). No se ejecutó
  `npm audit fix` ni se cambiaron versiones.

## Estado y límites

La verificación final usó el contenedor PostgreSQL temporal de esta tarea en
`127.0.0.1:55435`, retirado al terminar. La conciliación manual con develop
preservó la migración de Fleet, el servidor del trabajador y las pruebas de
ambos. El checkout original `feature/PAGOS-WEB-01-bandeja` conservó sus cambios
locales. La rama final no se commitió ni publicó. Lectura y carga/recepción ya
usan Bookings real; aprobación/venta (`confirmSale`), rechazo de oficina y
liberación requieren capacidades públicas de Bookings aún pendientes. Revisión
humana, CI e integración remota no se atribuyen a esta comprobación.
