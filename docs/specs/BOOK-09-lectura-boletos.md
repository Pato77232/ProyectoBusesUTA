# BOOK-09 — lectura de reservas vendidas para boletos

Fecha: 4 de noviembre de 2026. Responsable: Leslie. Base actual: origin/develop 5c48d22 (hotfix #94 integrado); base inicial 5ff50d9.
Rama: feature/BOOK-09-lectura-venta-boletos. Complementa BOOK-09-L07.

## Autorización y estado

Leslie solicita empezar con la API de reservas vendidas después de recibir el plan. Se prepara este contrato concreto bajo su delegación previa de decisiones. La revisión del consumidor de boletos y la revisión humana del código no se presumen. Estado: lector y pruebas dirigidas implementados localmente bajo la solicitud posterior «listo sigamos»; checks globales ejecutados con fallos detallados en evidencia; revisión humana pendiente. No se afirma que BOLETOS-01 exista en develop consultado.

## Objetivo

Permitir al emisor interno obtener los datos mínimos de una venta ya persistida, sin leer tablas privadas de Reservas y sin transformar una reserva pendiente en boleto. No emitir QR ni enviar correos desde Bookings.

## Contrato

Fábrica pública createBookingTicketQueries({pool}); método findSoldForTicket({bookingId,cooperativeId}). No necesita crear routers ni Auth, ni expone pool/repositorios en el resultado. Es una capacidad interna entregada por composición al emisor autorizado, nunca un endpoint anónimo. El emisor obtiene ambos identificadores de datos verificados; el navegador no determina tenant, propietario o precio.

Entrada cerrada: exactamente bookingId y cooperativeId como texto no vacío. bookingId opaco conservado sin imponer UUID nuevo; cooperativa verificada por el consumidor según contrato multi-tenant vigente. No contexto sintético construido a partir del body.

Ausente, ajena o no vendida devuelve null indistinguible. SOLD con datos inválidos lanza error de integridad: no devuelve null ni omite pasajeros. CONFIRMED de ramas históricas no se equipara a SOLD de esta base.

Salida propuesta cerrada e inmutable:
- bookingId, cooperativeId, tripId, fromPosition, toPosition;
- soldAt ISO UTC persistido, currency USD, totalPriceCents entero seguro;
- passengers: seatId, fullName, identificationNumber, totalPriceCents individual del snapshot comercial aceptado.

No se expone ownerId, birthDate, acreditaciones, comprobantes, tokens, correos no persistidos ni summary completo. Nombre y documento son datos privados para generar el boleto, no una respuesta de búsqueda pública ni un payload completo para codificar en el QR. El QR y su contenido verificable pertenecen al contrato de Tickets.

Para este primer incremento, se acepta el snapshot comercial schemaVersion 2 con quote por pasajero y totals. Datos históricos sin los campos necesarios requieren conciliación explícita; no se inventan importes individuales ni se recalcula una tarifa histórica con porcentajes actuales.

## Coherencia persistida

Leer reserva y todas sus asignaciones mediante una sola sentencia SQL o snapshot transaccional coherente. Filtro explícito por id/cooperative_id. Verificar scope, tramo válido, soldAt, moneda y total contra summary; correspondencia exacta de pasajeros/asientos con asignaciones activas SOLD y sus posiciones. Sin asientos adicionales, duplicados, pasajeros ausentes o asignaciones activas RESERVED. La suma de importes individuales coincide con total persistido. No acceder a Route Sheets/Fleet/Payments por SQL privado.

La consulta no vende, libera, expira ni marca boleto emitido. Múltiples lecturas de una venta conservan el mismo resultado comercial. El consumidor mantiene su idempotencia de emisión por venta/pasajero; Bookings no promete que leer equivalga a haber emitido.

## Errores y privacidad

BOOKING_TICKET_QUERY_INVALID (400): entrada inválida sin I/O.
BOOKING_TICKET_QUERY_UNAVAILABLE (503): fallo temporal clasificado.
BOOKING_TICKET_DATA_INTEGRITY_ERROR (500): datos incoherentes o fallo no temporal no clasificado. Mensajes seguros sin SQL ni datos de otros pasajeros. No convertir cualquier fallo en 503 ni en venta ausente.

## Incrementos verificables

1. Preparación de base y contrato: esta spec, respaldo de trabajo previo, registro de estado. Sin cambios funcionales.
2. Lector público, validación pura de snapshot y pruebas unitarias: datos mínimos, null indistinguible, integridad, errores, copia profunda e idempotencia de lectura.
3. PostgreSQL aislado: venta persistida, estados no vendidos, tenant cruzado, conservación de filas e incoherencias. Conservar pruebas previas y timeout conocido de fotografías.
4. lint, format:check, npm test y revisión completa del diff. Actualizar evidencia real. Si se cambia composición del servidor, verificar arranque real; este lector no requiere tocar server.js ni aplicar incidentalmente el hotfix.

## Límites y revisión

Sin migraciones, dependencias nuevas, frontend, QR, correo o endpoint de descarga en esta tarea. Sin commits, publicación, merge o tags hasta petición específica. No declarar integración por pasar pruebas. Compartir contrato y commit verificado con Shirley cuando estén publicados; prueba con consumidor real pendiente mientras no esté disponible.

## Preparación comprobada

Cambios locales interrumpidos preservados en stash con nombre respaldo-leslie-ocupaciones-antes-de-boletos-2026-11-04. Se mantiene la carpeta original, sin copia ni worktree. Rama nueva desde 5ff50d9; no checkout de main/develop, merge ni rebase. El hotfix remoto sigue siendo trabajo separado y no se presume integrado.

## Implementación autorizada y calidad

Leslie respondió «listo sigamos» tras prepararse el contrato y autoriza implementar este incremento. No equivale a revisión del código de terceros ni a integración. Implementados lector PostgreSQL propio, validación pura y API pública createBookingTicketQueries; el pool permanece dentro de Bookings. Application solo depende de domain, por lector inyectado; no imports internos de otro módulo, no dependencias de Express o pg en dominio/aplicación. SRP: repositorio lee, dominio verifica y proyecta, caso de uso clasifica fallos. Sin interfaz visual: no aplica DESIGN.md; errores seguros y diferencia entre ausencia e incoherencia permiten retroalimentación correcta del consumidor.

[Uso del contrato](../contratos/bookings-lectura-boletos.md) y [evidencia](../evidence/BOOK-09/2026-11-04-lectura-boletos.md). Pruebas dirigidas finales 55/55 aprobadas. Checks globales ejecutados: formato aprobado; lint global y tres suites unitarias bloqueados por servidor duplicado de la base; integraciones separadas 450 aprobadas/29 fallidas. Ver evidencia completa; no se declara suite verde. Sin cambios de migraciones, composición de server.js, frontend o dependencias. Revisión e integración pendientes.

Dependencia verificada al intentar actualizar: PR #94 hacia develop y #93 hacia main siguen abiertas, merged=false; develop permanece 5ff50d9. Pendiente integrar #94 mediante revisión humana antes de actualizar la base y repetir la verificación global. No se mezcla el hotfix o su versión dentro de la funcionalidad del lector.

Actualización autorizada al integrarse #94: fast-forward a 5c48d22 conservando cambios propios mediante stash, sin conflictos ni commit nuevo. node --check, lint y formato global aprobados. npm ci sincroniza dependencias existentes sin cambios de package.json/lockfile. Segunda repetición: 1990/1990 unitarias aprobadas (112 suites); integraciones y arranque real en curso. La evidencia anterior se conserva como historial, no como resultado vigente de esta base.

## Verificación final vigente

Base 5c48d22, hotfix #94 integrado. npm ci completado sin cambiar manifiestos ni lockfile. npm test salida 0: 1990 unitarias y 662 integraciones aprobadas (2652 pruebas, 172 suites). Lint, format:check y diff --check aprobados. Arranque real posterior: salud HTTP 200 y cierre ordenado. Las secciones anteriores conservan la historia de fallos previos; no describen el resultado actual. Código local listo para revisión/guardado; sin commit/push/PR/integración nuevos ni cambios de timeout. Conexión al emisor de Shirley pendiente.
