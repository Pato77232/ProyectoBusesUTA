# ROUTE-SHEETS-10 — consulta de ocupaciones para Hojas de Ruta

- Responsable: David. Fecha: 4 de noviembre de 2026.
- Rama: `feature/ROUTE-SHEETS-10-consulta-ocupaciones`.
- Estado: implementación autorizada por David en esta conversación; revisión humana pendiente.
- Autorización: David comunica que Leslie autorizó concretar e implementar con Codex el contrato; no se atribuye revisión técnica ni aprobación de PR a Leslie.
- Fuentes: [reglas](../business-rules.md), RN-02/40, [arquitectura](../architecture.md), [convenciones](../conventions.md), [calidad](../calidad.md), [protocolo académico](../errores-inducidos.md), ROUTE-SHEETS-02 §5.2 y ROUTE-SHEETS-09 §8.

## 1. Contrato y alcance

Conservar `hasPassengersForAssignment(assignmentId, cooperativeId)` y `hasPassengersForBusOnRouteSheet(routeSheetId, busId, cooperativeId)`. Hojas de Ruta resuelve los tripId desde sus tablas; consume la API pública de Reservas `createBookingOccupancyQueries({ pool }).hasActiveOccupations({ tripIds, cooperativeId })`. Esta fábrica independiente evita dependencia circular al componer los módulos. No se consulta SQL de otro módulo.

IDs UUID válidos, cooperativa derivada de identidad verificada por el consumidor HTTP. Hojas de Ruta valida existencia/pertenencia de la entidad antes de consultar; la API interna no acredita identidad por recibir un UUID. Reservas devuelve booleano estricto, true si existe ocupación `active` en estado RESERVED o SOLD para alguno de los viajes y esa cooperativa. Incluye revisión de comprobante y reserva vencida todavía no liberada. No expira ni libera datos; no consulta PII. Lista vacía válidamente resuelta devuelve false; fallo al resolverla nunca se convierte en lista vacía. Entradas inválidas fallan antes de consultar SQL.

Errores técnicos o respuesta inválida detienen el cambio. Proveedor ausente conserva BOOKING_QUERIES_UNAVAILABLE/503 mediante el adaptador existente. No se modifica el formato HTTP ni la política de motivo/advertencia forzada.

## 2. Límites y criterios

Solo lectura y conexión productiva de este contrato. Sin migraciones, dependencias, UI, nuevos endpoints, desactivación de frecuencias, sustitución o cambios en compra. Conserva edición solo DRAFT y guardas de programación. Una lectura no bloquea nuevas reservas: no habilita cambios publicados ni resuelve atomicidad entre consulta, baja y auditoría, límite ya documentado en ROUTE-SHEETS-09. No se introduce ni corrige defecto académico.

SOLID: consulta pequeña de Reservas, resolución propia de Route Sheets y composición por APIs públicas; aplicación/dominio no importan adaptadores ajenos. Sin interfaz visual; errores conservan su contrato para evitar confirmaciones falsas.

Comprobar true para RESERVED/SOLD activos, false para liberados/inactivos y otro tenant/viaje, reloj vencido sin liberación, varios viajes, entrada inválida, errores propagados y booleano estricto. Comprobar firmas de consumidores y conexión del servidor. Integración PostgreSQL aislada y arranque real requeridos para cierre. No modificar pruebas previas para obtener verde: la prueba histórica de bajas sin proveedor del servidor real queda incompatible al conectarlo y se reportará expresamente.

## 3. Evidencia

Base comprobada: `7fb89e6`, rama de trabajo inicialmente limpia. Sin actualización remota nueva. Implementación local terminada; no integrada/cerrada ni revisada por otra persona.

- Node 24.22.1 del runtime local de Codex; PostgreSQL 16.13 aislado con `docker-compose.test.yml`, proyecto exclusivo `busesuta-rs10`. Sin leer `.env`, instalar dependencias ni modificar migraciones.
- 17/17 unitarias nuevas aprobadas; 8/8 integraciones nuevas aprobadas (dos suites), incluido servidor productivo, salud, protección de sesión/tenant, baja real de asignación/parada y log con actor real. Las ocupaciones RESERVED/SOLD/revisión/liberadas se prueban con filas sintéticas: no acreditan creación o venta productivas.
- `npm run lint` aprobado. Prettier de los diez JS modificados/nuevos aprobado. `npm run format:check` global falla en 37 archivos previos, conservados sin cambios.
- `npm test` ejecutado con acceso local y Node 24: 1860 unitarias aprobadas y 6 fallidas, 97 suites aprobadas y 2 fallidas. No alcanza integración por el encadenamiento del script. Los mocks completos de `tests/unit/server.test.js` y `tests/unit/payments/server-review-composition.test.js` no exportan `createBookingOccupancyQueries`; necesitan conciliación explícita del contrato de composición (incluido el argumento nuevo), no fallback de producción. No se modificaron pruebas previas.
- Primera ejecución con restricciones de red local: 1846 aprobadas/20 fallidas (incluye EACCES de HTTP); la repetición con acceso local elimina esos fallos de permisos y deja los seis descritos. No se presenta la primera ejecución como resultado funcional.
- Regresión de integración ejecutada por separado: 611 aprobadas/3 fallidas, 49 suites aprobadas/2 fallidas, 344,763 s. Fallos: timeout de 20 s en `fleet/bus-photo-storage.test.js` y las dos bajas de `route-sheets/modification-audit-server.test.js` que esperan 503 pero reciben 200 con proveedor real. No se modificaron timeouts ni expectativas. El resultado global sigue fallido.

Trabajo pendiente antes de aceptar/integrar: conciliar los dobles de composición y el escenario histórico de servidor sin proveedor de ROUTE-SHEETS-09; preservar la comprobación de fallo cerrado cuando realmente falta el proveedor. Los DELETE ahora devuelven 200 en las pruebas nuevas con consulta real resuelta sin ocupaciones; eso contradice las dos expectativas históricas de 503 al arrancar servidor con el proveedor ya conectado. Se reporta sin cambiar aserciones ni saltar pruebas. La ausencia de proveedor sigue probada en las unitarias nuevas y las suites existentes del adaptador. David confirmó expresamente conservar las pruebas y reportar los fallos durante esta implementación; no se autoriza su adaptación en esta sesión.

Diff completo revisado, incluidos archivos nuevos; `git diff --check` aprobado. No cambia compra, endpoints, esquema ni dependencias. Base aislada retirada al terminar; sin integración ni cierre funcional acreditados.

Sin commit, publicación ni integración ejecutados. Revisión humana pendiente; no se registra aprobación individual de Leslie. Asistencia de Codex en contrato, implementación y verificación.
