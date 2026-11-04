# Preparación de PR: disponibilidad de viajes reales

Estado: preparación de checkpoint local autorizada por Leslie; publicación y revisión humana pendientes. Título propuesto: feat(reservas): conecta la disponibilidad con viajes publicados.

Base actual: develop 9920792, con PR #65 y renovación ROUTE-SHEETS-08/PR #68 integradas, catálogo 23. Rama feature/BOOK-02-disponibilidad-viajes-reales.

## Resultado

GET /api/v1/bookings/availability consulta el viaje y el embarque elegidos por tripQueries.findBookableForSegment, usando el inventario congelado de la hoja publicada. Valida identidad, relaciones, revisiones, recorrido y fechas antes de consultar ocupaciones. Conserva RESERVED/SOLD/revisión y reutilización de asientos en tramos adyacentes.

El servidor exige el proveedor real por tramo. Si falla o devuelve datos incoherentes no se recurre al catálogo anterior ni se muestran todos los asientos libres. La ruta mantiene Auth CUSTOMER, no-store y salida mínima seatId/status.

## Verificación

Base 9920792, catálogo 23, PostgreSQL 16.13 aislado y Node 24.21.0. npm test completo aprobado: 1838 unitarias y 581 integraciones, 2419 pruebas en 141 suites, salida 0. Incluye hoja publicada, Auth/servidor reales, privacidad, revisión/SOLD/adyacencia y la prueba de arranque actualizada al contrato real.

Lint y formato propio (12 JS) aprobados; formato global conserva 17 archivos ajenos. Fotografías pasó sin cambios al timeout; su antecedente intermitente y los resultados previos se mantienen en la evidencia. No se declara CI remoto o revisión humana aprobados.

## Alcance y límites

No conecta cotización o creación con el nuevo catálogo: necesitan sus contratos y revalidación propios. Disponibilidad es informativa, no bloquea asientos. No abre acceso invitado/anónimo ni añade pantallas, sustitución de buses, migraciones o dependencias. No modifica código de Route Sheets/Fleet/Payments. Las ocupaciones de QA no certifican venta o aceptación de comprobantes por APIs.

Revisión humana pendiente, sin aprobación colectiva atribuida. Trabajo asistido por Codex.

Refs: docs/specs/BOOK-02-L02.md §15.
Evidencia: docs/evidence/BOOK-02-L02/2026-11-03-disponibilidad-real.md.
