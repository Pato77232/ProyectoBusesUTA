# feat(reservas): conecta la disponibilidad con viajes publicados

GET /api/v1/bookings/availability consulta el embarque y el inventario congelado mediante la API pública findBookableForSegment de Hojas de Ruta. Valida identidad, relaciones, recorrido y fechas antes de consultar ocupaciones. Conserva RESERVED/SOLD, incluidas reservas en revisión; los tramos adyacentes permiten reutilizar asiento. Los fallos del proveedor se propagan sin mostrar inventario libre.

La conciliación con develop 9f7ac91 conserva juntas la disponibilidad real, la carga/recepción de comprobantes y la lectura autorizada de Pagos, además del planificador de expiración. No modifica las migraciones ni los contratos integrados de Shirley.

## Verificación

Node 24.21.0 y PostgreSQL 16.13 aislado con catálogo 24. npm test: 1842 unitarias + 588 integraciones aprobadas, 2430 pruebas en 143 suites. Incluye arranque real, hoja publicada y carga autenticada. Fotografías pasó sin cambiar su timeout. Lint y formato propio aprobados; format:check global conserva 17 archivos ajenos. Base temporal eliminada después de las pruebas.

La evidencia anterior sobre 9920792 (2419 pruebas) se conserva como histórica. Estos resultados son locales, sin atribuir aprobación humana ni CI remoto.

## Límites

No conecta cotización ni creación comercial al nuevo catálogo, no bloquea asientos y no añade pantallas ni acceso invitado. Las ocupaciones sintéticas de QA no certifican venta o recepción mediante las APIs.

Límite heredado del catálogo de develop: una copia con las 23 migraciones antiguas, renovación incluida y sin procedencia de carga, se rechaza con MIGRATION_HISTORY_UNEXPECTED sin alterar filas, columnas ni historial. Se comprobó en una base efímera. Si existe una base persistente con esa historia, necesita un plan aparte con Pablo/Shirley; no se inspeccionaron bases del equipo ni se debilitó la validación.

Revisión humana pendiente. Trabajo asistido por Codex.

Refs: docs/specs/BOOK-02-L02.md, secciones 15 y 18.
Evidencia: docs/evidence/BOOK-02-L02/2026-11-04-conciliacion-pr70.md.
