# PR #51: conciliación con develop

Fecha: 2 de noviembre de 2026, America/Guayaquil. Rama: feature/BOOK-03-resumen-creacion-dominio. Cabeza previa: 67b333b; develop incorporado: 5abc36d. PR en borrador: https://github.com/Pato77232/ProyectoBusesUTA/pull/51. No acredita integración hacia develop ni aprobación humana.

## Autorización y resolución

Leslie autoriza incorporar develop para resolver los conflictos de su PR. Se resuelven once archivos: backend/src/app.js; docs/estado-proyecto.md; BOOK-02/03/05/06/07/08; frontend/eslint.config.js, package.json y src/styles/app.css. Se conservan montaje de buses antes de JSON, respuestas de Reservas sin caché, rutas de todos los módulos, scripts/suites de frontend y documentación de ambos lados. DESIGN.md aplicado conservando tokens y pantallas; sin rediseño.

server.js combina por las APIs públicas Auth, Tenants, Fleet, Frequencies, Route Sheets, Payments y Bookings. Payments conserva su composición anterior: no se activa un contrato de escritura ni se conecta el lector a las rutas por resolver un conflicto. Cotización configurable y proveedores productivos de compra siguen pendientes.

La prueba unitaria de arranque ahora simula también Bookings y exige su montaje, además de seatQueries hacia Route Sheets. Las pruebas de reversión de programación y viajes comerciales localizan por nombre la migración objetivo y comprueban cuál está en cabeza antes de exigir el rechazo. La preparación de datos legados alcanza efectivamente el esquema anterior a programación. Se preservan las expectativas sobre datos y errores. No se modificaron migraciones existentes ni se ampliaron timeouts.

Se instalaron con npm ci las dependencias ya registradas en develop, anunciando busboy 1.6.0 y sharp 0.35.5. El lockfile coincide con develop; no se añadió una biblioteca por esta resolución.

## Verificación ejecutada

Node 24.21.0; PostgreSQL 16.13; Compose exclusivo busesuta-leslie-lector, sin .env ni datos reales. La base busesuta_test estaba vacía antes de las pruebas.

- Backend lint: aprobado. Formato explícito de app.js, server.js y las tres pruebas ajustadas: aprobado.
- Backend format:check global: fallido en 17 archivos preexistentes de Route Sheets y sus migraciones; no corregidos incidentalmente.
- Primera ejecución unitaria: 1571 aprobadas, una fallida por simulación de arranque incompleta. Repetición después del ajuste: 1572/1572, 80 suites.
- Primera integración conjunta: 459 aprobadas, tres fallidas de 462 en 34 suites. Dos por seleccionar migración incorrecta y una por timeout de 20000 ms en bus-photo-storage.test.js (comparación de fotografía de 5 MB). Arranque real ejecutado por booking-http.test.js. Los fallos no se ocultan ni se presentan como suite aprobada.
- Frontend lint y npm test: aprobados; 181 pruebas, ninguna omitida.
- Imagen frontend: docker build y nginx -t aprobados; arranque real, página/módulos/MIME, usuario nginx, exclusiones y 404 aprobados por test:bookings:container. Su contenedor y red se retiran en finally.
- Repetición dirigida conjunta: 39 aprobadas y 20 fallidas de 59. Programación aprobada (30 casos); fotografías conserva un timeout y nueve casos aprobados. Viajes comerciales no pudo lanzar procesos de migración (spawnSync UNKNOWN), por lo que se repitió en un proceso nuevo: 19/19 aprobadas. No se cuentan esos errores de lanzamiento como fallos de negocio ni se oculta la ejecución fallida.
- El timeout de fotografía de 5 MB se reprodujo con el mismo límite de 20000 ms. Archivo de prueba y almacenamiento coinciden con develop. No se alteraron para obtener una aprobación; la suite global NO está aprobada.
- Chrome real: ocho grupos de comprobaciones aprobados, incluidos login/CSRF/cookie/sesión, reflujo 360/1280/200% CSS, nueva aceptación ante cambio de tarifa, COMMIT con respuesta perdida/recarga, revocación y 503 sin catálogo ficticio. Revisión visual de la captura móvil aprobada; zoom nativo y lector de pantalla pendientes.
- Compatibilidad directa del adaptador actual de Payments y proveedor Bookings en PostgreSQL: nueve comprobaciones aprobadas. No conecta las rutas productivas ni implementa recepción.
- Lint backend repetido después de ajustar todas las pruebas: aprobado. format:check repetido: siguen los 17 archivos ajenos.

## Actualización de una base previa: bloqueo reproducido

En una segunda base temporal, busesuta_upgrade_pr51_test, se aplican las 17 migraciones de develop excluyendo las tres propias de esta rama (create-bookings, booking-creation-idempotency y booking-payment-read-context). Se conserva el filtrado de archivos ocultos del cargador. Después se ejecuta el migrador normal de la rama.

Resultado: `Not run migration 1793145600000-create-bookings is preceding already run migration 1793440000000-register-buses`. Historial antes/después: 17/17, idéntico. La comprobación del migrador impide actualizar una base que ya avanzó por develop. Crear correctamente una base vacía no prueba ese recorrido.

### Siguiente incremento propuesto; no implementado

Objetivo: acordar y probar una actualización no destructiva desde develop manteniendo inmutabilidad y validación del historial. Antes de código, revisar con Pablo la estrategia y registrarla en la spec; no renombrar/editar migraciones existentes, no borrar una base con datos ni desactivar globalmente checkOrder. La solución debe demostrar actualización de una copia aislada con datos representativos, rechazo de historiales inesperados, rollback ante fallo y conservación de datos. Es un bloqueo de despliegue documentado, no una autorización implícita para cambiar infraestructura.

## Estado

Conflictos de archivos resueltos; resolución preparada para guardar y publicar en la misma PR #51. El commit resultante se identifica en el historial de la PR, con padres 67b333b y 5abc36d. La PR conserva revisión solicitada a PabloToapanta y shirley6126. No marcar lista/integrada mientras se mantengan los bloqueos indicados. Implementación asistida por Codex; revisión humana pendiente.

Limpieza comprobada: contenedor y red busesuta-leslie-lector retirados; ambas bases de prueba eran temporales dentro de ese contenedor. Sin contenedores/redes propios restantes; servicios ajenos intactos.


## Continuación autorizada — 3 de noviembre de 2026

Leslie autoriza implementar el desbloqueo con catálogo activo y migración nueva, preservando los originales y rechazando bases heredadas. La reproducción anterior conserva su valor histórico; el tratamiento vigente y sus comprobaciones están en [la evidencia del 3 de noviembre](2026-11-03-catalogo-migraciones.md). No se declara una conversión automática de bases existentes con originales aplicados.
