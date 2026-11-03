# PR #51: conciliación con Auth y VIP de develop

Fecha: 3 de noviembre de 2026, America/Guayaquil. HEAD previo publicado 4e252c1; develop incorporado 04868b2. Misma rama feature/BOOK-03-resumen-creacion-dominio. Leslie autoriza incorporar develop, resolver el registro, actualizar catálogo, comprobar y publicar en PR #51; no integrar hacia develop.

## Resolución

Un conflicto textual en docs/estado-proyecto.md. Se conservan completos el bloque histórico de Reservas y la evidencia de AUTH-BOOTSTRAP-01 de Pablo. Los cambios de Auth/Fleet proceden de develop y se compararon sin diferencias contra ese origen; no se reconstruyen ni se atribuye aprobación humana a esta conciliación.

Develop añade 1793740000000-allow-vip-bus-seats. Catálogo activo actualizado a 19 entradas: 18 de develop más 1793820000000-install-bookings. La exclusión exacta del original 1793740000000-booking-payment-read-context no excluye la migración VIP que comparte prefijo. Los tres originales y la migración consolidada de Reservas se mantienen intactos respecto a 4e252c1.

Se actualizan las expectativas al catálogo de 19 y la copia de develop actual de 18. Se conserva cada comprobación de datos/definiciones; esa copia contiene un asiento VIP antes de instalar Reservas y se comprueba su conservación. Un caso adicional verifica actualización desde las 17 migraciones anteriores, manteniendo las filas y acreditando que se añadió la restricción que admite VIP. El migrador conserva validación estricta, bloqueo y rechazo de historia heredada. No se amplía la cotización de Bookings ni se conectan proveedores comerciales por recibir Fleet/VIP.

## Comprobaciones

Node 24.21.0; PostgreSQL 16.13 en Compose exclusivo busesuta-leslie-conciliacion, puerto 55433, base inicialmente sin tablas. Sin .env, bases persistentes, cuentas reales, dependencias nuevas ni cambios a timeouts.

- Catálogo dirigido: 29/29 aprobadas (16 unitarias y 13 integraciones), incluidos historial incompatible, rollback, conservación VIP y bases anteriores/actuales.
- Frontend: lint aprobado y 181/181 pruebas aprobadas. Sin cambios de HTML/CSS; no se repite QA visual por esta conciliación de backend.
- Lint backend y formato global: lint aprobado; formato de los tres JS ajustados aprobado; format:check global mantiene 17 archivos ajenos pendientes.
- Suite completa combinada y arranque real: npm test salida 0: 1614/1614 unitarias (84 suites) + 493/493 integraciones (38 suites) = 2107 aprobadas, 122 suites. Incluye arranque real de server.js, health y límites de Reservas. Fotografía aprobada con su código y timeout originales.

## Límites y publicación

Los conteos previos de la evidencia de 4e252c1 describen esa versión; esta evidencia corresponde a su combinación con 04868b2. Los contratos de recepción, expiración, venta/liberación y compra comercial completa conservan sus pendientes. Las bases persistentes con originales aplicados requieren un plan separado; ninguna se consulta o convierte aquí.

La resolución se guarda y publica en la misma rama mediante commit de conciliación, con padres 4e252c1 y 04868b2; el resultado se consulta en el historial de PR #51. Revisión humana e integración hacia develop pendientes. No nuevos permisos, tags ni cambios a main/develop. El historial de las pruebas anteriores se conserva con su versión/alcance.

Limpieza confirmada: sin bases catalog_<UUID>_test restantes; contenedor y red busesuta-leslie-conciliacion retirados, sin afectar otros servicios.
