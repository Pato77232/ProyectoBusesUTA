# BOOK-08 — evidencia del incremento B, 4 de noviembre de 2026

## Alcance y autorización

Leslie autoriza continuar con solicitudes y pruebas tras el borrador. Base 46a96a2, rama feature/BOOK-08-acreditacion-web. Se aplica guia-proyecto. Sin commits/push/merge ni integración. Se consultaron specs/reglas/arquitectura y DESIGN.md; frontend no cambia en este incremento.

Implementados POST de solicitud propia, GET de bandeja CLERK y GET de detalle con proyección según rol. Catálogo real, cooperativa/propietario verificados, reintento idempotente y solicitud privada persistida sin crear reserva/ocupación/acreditación. Migración aditiva 1794280000000-booking-benefit-requests; no se modifican anteriores. El POST de decisiones y la pantalla quedan pendientes de C/D.

## Pruebas dirigidas y correcciones

- Unitarias nuevas de solicitudes junto a catálogo: 47/47, dos suites; 31 corresponden al lector/creador nuevo y 16 al catálogo histórico conservado.
- Primera HTTP: 3 aprobadas/7 fallidas. La adaptación nueva esperaba place para las etiquetas del viaje, pero el proveedor real define locationKey. Se corrigió producto y el DTO del doble unitario al contrato real, conservando expectativas de HTTP 201, permisos y privacidad; no se ocultaron fallos ni se rebajaron aserciones.
- Repetición de nuevas unitarias y HTTP: 41/41, dos suites, 6.206 s (31 unitarias y 10 HTTP).
- Migración nueva + catálogo de integración: 22/22, dos suites, 75.287 s. Incluye 3 nuevas de upgrade, reversión vacía y rechazo íntegro de down con datos; además 19 de catálogo real existentes. Base vacía, prefijos válidos, rechazo de historia incorrecta y rollback siguen comprobados por el catálogo, sin escribir historial manualmente.
- Las dos adaptaciones de expectativas previas agregan la migración 31 y su tabla a la lista exacta de esquema nuevo; preservan todas las entradas/garantías anteriores, orden, ocultos y conservación de filas. Sin cambios de timeouts ni pruebas eliminadas/saltadas.

## Entorno

Node 24.21.0, PostgreSQL 16.13 efímero, contenedor leslie-book08-solicitudes-pg, tmpfs y puerto local exclusivo 55439. Todas las URLs son QA, base con sufijo _test. Las pruebas de migración crean/eliminan bases aleatorias propias con guard de nombre. No .env, secretos o bases persistentes del equipo. No dependencias nuevas.

HTTP utiliza servidor real, sesiones/CSRF de Auth, Fleet/Frequencies/Route Sheets con publicación real y catálogo comercial persistido. No hay simulador de viajes en HTTP. Fuente de compra QA con doble explícito solo en unitarias. Se verifica concurrencia de dos reintentos: 201/200 con una sola fila; cambio de contexto con la misma clave no reemplaza filas; otros compradores usan su propia identidad. Se verifica que el detalle no se filtre entre tenants/propietarios y que solicitudes no creen reservas, ocupaciones o decisiones.

## Verificación global

- npm test: salida 0. Unitarias 113/113 suites y 2021/2021 pruebas (14.293 s); integraciones 62/62 suites y 675/675 pruebas (469.187 s). Total 2696 pruebas/175 suites aprobadas. Node 24.21.0 y PostgreSQL efímero.
- npm run lint y npm run format:check global: salida 0. Formato aplicado únicamente a JS del incremento; sin reformatear archivos ajenos. Las únicas expectativas antiguas adaptadas son las dos del catálogo descritas arriba, añadiendo el nuevo contrato de esquema sin retirar comprobaciones.
- Arranque real posterior al test completo: HEALTH=200, REQUESTS_UNAUTHENTICATED=401, CACHE_CONTROL=no-store y STOP=OK, salida 0. Worker de expiración deshabilitado solo en este smoke, no en su cobertura de integración correspondiente.
- Diff completo y archivos nuevos revisados; git diff --check aprobado. app.js y bookings/index.js componen el nuevo router; server.js, dependencias, timeout de fotografías y migraciones previas intactos. Sin claims de acreditación aprobada, reserva exitosa o frontend implementado.
- Logs locales del chat: book08-requests-npm-test.log, book08-requests-migrations.log, book08-requests-directed.log (este último conserva la primera ejecución HTTP fallida); smoke local book08-requests-smoke.cjs. Los resultados finales se registran arriba con su alcance, sin reescribir fallos anteriores como aprobados.

## Uso y límites

[Contrato de B](../../contratos/solicitudes-acreditacion.md). Revisión humana pendiente. No hay interfaz, evidencia documental adjunta ni aprobación/revisión nueva implementadas en B. No cerrar BOOK-08 ni afirmar acreditación completa por tener solicitudes. La API anterior de revisión permanece compatible.

Limpieza: docker stop y docker rm de leslie-book08-solicitudes-pg completados con código 0; almacenamiento tmpfs descartado. No se modificaron ni detuvieron los servicios del equipo.
