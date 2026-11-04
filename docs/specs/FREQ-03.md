# FREQ-03 — desactivación segura de frecuencias (bloque 1.2)

- Responsable: David; solicitud directa de implementación el 4 de noviembre de 2026.
- Base: `7deedc3`, árbol limpio en `feature/ROUTE-SHEETS-10-consulta-ocupaciones`; se reutiliza el checkout solicitado, sin commit ni integración.
- Estado: implementada y verificada localmente con fallos globales documentados; revisión humana pendiente, no integrada/cerrada.
- Fuentes: [reglas](../business-rules.md) RN-02/20–23/40, [arquitectura](../architecture.md), [convenciones](../conventions.md), [calidad](../calidad.md), [protocolo académico](../errores-inducidos.md), [ADR 0005](../adr/0005-lecturas-publicas-en-transaccion.md), [ADR 0006](../adr/0006-serializacion-de-programacion.md) y ROUTE-SHEETS-04/07/10.

## 1. Alcance y contrato

Conservar PATCH /api/v1/frequencies/:id/status y autorización COOPERATIVE_ADMIN/CSRF/tenant de sesión. ACTIVE conserva su contrato; INACTIVE requiere transacción con consulta pública de compromisos de Hojas de Ruta. No cambia origen, destino, hora, búsquedas ni programación. No hay baja diferida automática: rechazar con 409 hasta terminar obligaciones; la persona vuelve a solicitarla después.

No desactivar mientras una hoja PUBLISHED que usa la frecuencia tenga ciclo/programación con fin exclusivo mayor que el instante comprobado por PostgreSQL después de adquirir locks. En el fin exacto deja de bloquear ese ciclo; comprobar también todos los demás ciclos/hojas, incluida renovación. Un viaje publicado con llegada posterior al instante comprobado sigue siendo servicio pendiente, aunque ya haya salido o la programación haya terminado. DRAFT no bloquea la baja: volver a programarlo/publicarlo debe revalidar ACTIVE mediante las guardas existentes.

Consultar ocupaciones active RESERVED/SOLD de viajes cuyo servicio aún no terminó, incluida revisión de comprobante. Viajes completamente terminados son historia: cambiar la oferta futura de la frecuencia no modifica sus reservas, ventas ni snapshots. No liberar reservas por reloj. Fuente publicada legada sin programación verificable se considera no verificable (503), sin fabricar fechas a partir de conteos/semanas. Falta/fallo de proveedor nunca implica ausencia de compromisos.

Resultados: 200 cambio confirmado; 409 FREQUENCY_HAS_COMMITMENTS con mensaje explicativo; 503 FREQUENCY_COMMITMENTS_UNAVAILABLE si falta contrato o la fuente es no verificable; fallos técnicos conservan el tratamiento común (sin actualización); 404 inexistente/ajena; 400/401/403 actuales. Sin confirmación forzada ni cancelación/reubicación de pasajeros.

## 2. Dependencias y concurrencia

API pública `createFrequencyCommitmentQueries({ occupancyQueries }).forTransaction(executor)` de Hojas de Ruta, solo composición/infraestructura según ADR 0005. Sesión pequeña: lock de escrituras ADR 0006 y lectura `find({ frequencyId, cooperativeId })` con booleanos estrictos hasUnfinishedCycles, hasFutureServices, hasPassengers, verifiable. Solo Hojas de Ruta consulta sus tablas; solo Reservas consulta ocupaciones mediante `occupancyQueries.forTransaction(executor)` (extensión mínima de ROUTE-SHEETS-10).

Orden obligatorio: BEGIN READ COMMITTED → lock global de programación → frecuencia FOR UPDATE propia → tomar reloj PostgreSQL y consultar compromisos → validar en aplicación → UPDATE de la misma frecuencia → COMMIT. Rollback y release ante cualquier error. Se comparte el lock con publicación/renovación/guardas legadas; si desactivación gana, publicación posterior ve INACTIVE; si publicación gana, desactivación ve el compromiso. No añadir SQL de otro módulo ni pasar pg a aplicación/dominio.

SOLID: aplicación decide con DTO de compromisos; infraestructura conserva transacción; proveedor público encapsula relaciones de viajes/ciclos. Sin UI nueva; mensajes distinguen esperar fin de ciclo de servicio no verificable. No requiere dependencias ni migraciones. No introduce ni corrige defectos académicos.

## 3. Verificación y evidencia

Añadir unitarias de decisión/contrato, integración PostgreSQL aislada para ciclo abierto/cerrado, límite exacto, otros tenants, proveedor ausente, rollback y serialización. Comprobar HTTP y arranque real. Ejecutar lint, format:check y npm test; si unitarias interrumpen npm test, ejecutar integración por separado. Conservar pruebas existentes y reportar incompatibilidades como solicitó David; no modificar expectativas ni timeouts. Actualizar esta sección con resultados reales antes de cerrar la sesión.

### Evidencia local

- Node 24.22.1 del runtime local; PostgreSQL 16.13 en `docker-compose.test.yml`, proyecto aislado `busesuta-freq03`. Sin leer `.env`, instalar dependencias ni modificar migraciones.
- 10/10 unitarias nuevas aprobadas y 7/7 integraciones nuevas aprobadas. Servidor `start/stop` real, Auth y PostgreSQL; programación/tarifa/publicación reales de tres servicios antes de pedir desactivación. Sin proveedor ficticio en producción.
- Integraciones: HTTP 409 conserva frecuencia íntegra con ciclo futuro; consulta pública detecta ocupación en revisión y aísla otro tenant; límite exclusivo exacto permite desactivación y conserva SOLD histórico sin modificar filas; proveedor ausente hace rollback; frecuencia sin compromisos admite baja/reintento/reactivación; 401/403/404 y CSRF; espera observable en pg_locks al retener el lock de publicación, luego relectura y 409. Solo el caso de límite sustituye el reloj de PostgreSQL mediante un wrapper de consulta de pruebas; SQL de compromisos y contratos reales. Ocupaciones sintéticas no certifican creación ni venta productiva.
- `npm run lint` aprobado. `npm run format:check` falla en 36 archivos anteriores; el índice público de Hojas de Ruta ahora tiene formato válido al modificar su exportación. No se formatean otros archivos ajenos.
- `npm test`: 1868 unitarias aprobadas/8 fallidas, 97 suites aprobadas/3 fallidas, 9,647 s. No alcanza integración por el encadenamiento del script. Siete fallos en dobles de composición antiguos de `server.test.js` y `payments/server-review-composition.test.js`; uno en `frequencies/change-frequency-status.use-case.test.js`, cuyo doble solo permite escritura directa sin sesión de compromisos. No se añade fallback para ocultarlos. Se conservan esas pruebas conforme a la decisión expresa de David en 1.1.
- Integración global por separado: 617 aprobadas/4 fallidas, 49 suites aprobadas/3 fallidas, 343,8 s. Fallos: timeout de 20 s de `fleet/bus-photo-storage.test.js`; dos expectativas de 503 en `route-sheets/modification-audit-server.test.js` ya incompatibles desde ROUTE-SHEETS-10; `frequencies/http.test.js` espera 200 pero monta Frecuencias sin proveedor de compromisos y recibe 503. No se cambia ninguna prueba anterior ni timeout, ni se declara la regresión global aprobada.
- Formato de los once JS modificados/nuevos aprobado y diff completo revisado (incluidos archivos nuevos); `git diff --check` aprobado. Base y red temporales retiradas al terminar.

No equivale a aprobación de Leslie ni a revisión humana. Sin commit, publicación ni integración ejecutados. Asistencia de Codex en planificación, implementación y pruebas. La propuesta de adaptar pruebas históricas se mantiene pendiente de autorización, sin reabrir la pregunta ya respondida por David.
