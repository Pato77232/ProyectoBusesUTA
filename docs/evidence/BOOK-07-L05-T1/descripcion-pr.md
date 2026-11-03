## Cambios

Persiste reservas con bloqueo por tramo y recuperación idempotente; incluye API protegida, pantalla de compra y lectura autorizada findForPayment conforme a PR #46.

Desbloquea la instalación sobre una base vacía y sobre las 18 migraciones de develop incorporado en 04868b2, incluida VIP:

- Conserva intactos los tres archivos originales de Reservas; quedan fuera del catálogo activo.
- Añade 1793820000000-install-bookings, que aplica realmente su esquema, idempotencia y contexto de lectura en una única entrada posterior.
- Valida catálogo e historial antes del DDL bajo el mismo bloqueo del migrador. Conserva checkOrder:true y exclusión de ocultos.
- Rechaza historiales originales de Reservas, desconocidos o inconsistentes sin convertirlos ni escribir historial a mano.
- Incluye creación del historial en la transacción para revertir completamente un fallo inicial.

## Verificación del 3 de noviembre

- Backend lint aprobado; formato propio de la conciliación aprobado.
- npm test final: 1614 unitarias + 493 integraciones = 2107 aprobadas, 122 suites. Incluye arranque real.
- Catálogo dirigido: 16 unitarias y 13 integraciones, 29/29 aprobadas, incluidas en el total. Conservación de asiento VIP y actualización desde bases de 17/18 migraciones comprobadas.
- PostgreSQL 16.13 aislado: base vacía, copia de develop con datos de varios módulos, conservación de filas/definiciones, reintento, down/up, rechazo sin cambios, rollback de DDL y bloqueo entre conexiones.
- Primera regresión del validador tras down completo corregida con prueba de reaplicación. Timeout de fotografía ocurrido en intento anterior; pasó finalmente sin cambiar código ni límite de 20000 ms.
- format:check global sigue fallido en 17 archivos ajenos; no se corrigen incidentalmente.
- Sin .env, bases persistentes, dependencias nuevas, modificaciones a migraciones originales ni ampliación de timeouts.

## Alcance y revisión

Las bases persistentes con originales de Reservas aplicados necesitan un plan separado con Pablo; no se inspeccionaron ni se afirma que ninguna exista. El migrador las rechaza de forma explícita.

Develop 04868b2 incorporado con Auth y Fleet/VIP. Conflicto de estado-proyecto.md resuelto conservando ambas evidencias; catálogo actualizado a 19 entradas. Los resultados corresponden a esta combinación. Frontend lint y 181 pruebas aprobados. Revisión humana e integración pendientes; PR en borrador.

Recepción/expiración, confirmación/liberación, conexión productiva de Payments y adaptación de tarifas/proveedores de compra conservan sus incrementos separados. No se presenta como compra comercial completa.

Evidencia de catálogo: docs/evidence/BOOK-07-L05-T1/2026-11-03-catalogo-migraciones.md.
Evidencia de conciliación: docs/evidence/BOOK-07-L05-T1/2026-11-03-conciliacion-vip.md.
Refs: docs/specs/BOOK-03.md y docs/specs/BOOK-07-L05-T1.md.

Asistencia de Codex en implementación, pruebas y revisión del diff; no sustituye la revisión humana.
