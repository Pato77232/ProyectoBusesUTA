# BOOK-03 T4 A: API protegida de reservas

- Responsable: Leslie Coello. Revisor propuesto: PabloToapanta.
- Fecha: 29 de octubre de 2026. Spec previa al código; continuación autorizada por Leslie.
- Rama: feature/BOOK-03-resumen-creacion-dominio. Base actualizada desde origin/develop f26415d en 8df558a; sin fusionar hacia develop.
- Conflicto resuelto conservando la prueba de reversibilidad de flota revisada en develop, con sus comprobaciones y restauración. No se suprimen aserciones.
- Referencias: BOOK-03 T1/T2/T3/T3-R, RN-02/40/42/43/50, arquitectura y calidad.

## Composición y alcance

createBookingsModule({pool, auth, env, tripCatalog, passengerVerifier, clock, calendarDateAt, newId}) en index.js compone casos existentes y PgBookingRepository. Montar en app.js/server.js preservando pagos. Solo CUSTOMER registrado: auth.authenticate, auth.authorize('CUSTOMER'), auth.csrfProtection de la API pública de auth. Identidad desde req.auth verificado, nunca desde body. El adaptador exige sesión/id y rol CUSTOMER sin cooperativa interna. La cooperativa del viaje procede del catálogo de servidor; no se habilitan operaciones CLERK ni invitados.

Configurar una sola BOOKING_PROOF_WINDOW_SECONDS: inicial 300, entero entre 180 y 300, validado al componer. Reloj real, fecha local America/Guayaquil y UUID del servidor por defecto. Proveedores inyectables solo por composición, nunca por HTTP.

Las APIs revisadas aún no ofrecen viajes fechados ni plantillas. Si faltan tripCatalog/passengerVerifier, sus adaptadores lanzan 503 explícito; no usar datos simulados, inventario ficticio ni acreditaciones falsas. La recuperación de una reserva existente sigue funcionando sin esos proveedores, con autorización válida. No declarar compra operativa por tener rutas.

## Transporte

Todas las respuestas bajo /api/v1/bookings, incluidos errores de autorización, llevan Cache-Control: no-store.

- GET /availability: sesión CUSTOMER. Solo query tripId/fromPosition/toPosition; posiciones decimales no negativas, sin coerción de arrays. 200 {seats}, solo ID/estado; consulta informativa sin bloqueo ni ocupantes. No requiere CSRF por ser lectura.
- POST /summary: sesión CUSTOMER, CSRF y application/json. Body exacto de cinco campos de T1. 200 {summary, summaryRevision}, privado, sin ID/plazo.
- POST /: sesión CUSTOMER, CSRF y JSON. Body de T3 sin requestKey. Cabecera Idempotency-Key obligatoria, UUID v4 canónico de T3-R. Rechazar requestKey en body, no sobrescribirlo silenciosamente. Traducir la cabecera al caso de uso. 201 {booking} en creación y recuperación; mismo ID/total/plazo. Cambio de contenido requiere nueva aceptación y clave.
- 400 BOOKING_VALIDATION_ERROR para entrada/clave inválida; 401 UNAUTHENTICATED; 403 FORBIDDEN/CSRF_TOKEN_INVALID; 404 BOOKING_TRIP_UNAVAILABLE.
- 409 BOOKING_SEAT_CONFLICT/BOOKING_ALREADY_EXISTS/BOOKING_SUMMARY_CHANGED/BOOKING_REQUEST_KEY_REUSED/BOOKING_BENEFIT_REVIEW_REQUIRED.
- 415 UNSUPPORTED_MEDIA_TYPE sin JSON; 503 BOOKING_TRIP_SERVICE_UNAVAILABLE/BOOKING_BENEFIT_SERVICE_UNAVAILABLE sin proveedor compuesto. Errores desconocidos van al manejador central, 500 genérico sin SQL, stack o datos personales.

Controlador solo traduce HTTP; mapeo de errores verifica clases propias, no cualquier code. Interfaces importa errores reexportados por application y shared, sin infraestructura. index.js es composición única.

## Validación y criterios

- Unidad: límites/configuración inválida, fecha local cerca de medianoche e identidad (sesión ausente/roles internos/cooperativa impropia).
- HTTP real con PostgreSQL, JWT y sesión reales de prueba, y CSRF del módulo auth. Solo catálogo/acreditación usan fixtures identificadas.
- Tres rutas; persistencia sin doble reserva; clave obligatoria; reintento; datos manipulados; cambio de resumen; roles; sesión revocada; CSRF inválido. Disponibilidad no expone datos personales. Fallos no escriben asientos/reservas.
- Error desconocido no expone su mensaje. Proveedores ausentes dan 503 sin escrituras; reserva previamente creada se puede recuperar con identidad válida.
- Arranque real con server.start, base temporal propia, secreto ficticio y puerto temporal: health funciona y rutas están montadas sin catálogo simulado. Cerrar servidor/pool y retirar solo recursos temporales propios.
- Ejecutar lint, formato y npm test del conjunto actualizado. No cambiar migraciones previas/dependencias ni debilitar pruebas.
- Usabilidad de backend: errores en español/códigos útiles para corregir datos, renovar sesión/CSRF, aceptar resumen o reintentar misma clave. Pantalla, teclado y adaptación pendientes en T4 B.

Un commit lógico de API con spec/código/pruebas, además de actualización de base. Un único PR funcional futuro hacia develop. Pantalla y proveedores reales siguen pendientes. Pagos/expiración y PR #17 no se integran por este paso.


## Resultado verificado — 29 de octubre de 2026

A implementada localmente. API pública del módulo por index.js, disponibilidad/resumen/creación bajo /api/v1/bookings, adaptación de CUSTOMER desde contexto de auth verificado, CSRF en POST, JSON obligatorio, Idempotency-Key obligatorio en creación y errores específicos. Cache-Control no-store se establece también antes del parser JSON para proteger errores previos al router. El servidor monta reservas y conserva pagos.

27 pruebas unitarias nuevas de configuración, fecha local e identidad y 25 HTTP con PostgreSQL/JWT/sesiones/CSRF reales. Solo viajes/acreditación son fixtures explícitas de prueba. Se verifica persistencia, reintento con mismo ID/fechas, conflicto entre claves, cabecera obligatoria, campos inyectados, sesión revocada, rol no CUSTOMER, CSRF inválido, JSON malformado, 415, cambios de resumen, revisión de beneficio, proveedores ausentes, recuperación sin proveedores y error desconocido sin detalles.

Arranque real comprobado con server.start, puerto temporal y base exclusiva: health 200, módulo de reservas montado y 503 al consultar viajes sin catálogo real. No se agregaron simuladores a server.js. La recuperación de reserva existente funciona con composición sin catálogo/verificador; nueva compra no. Documentación consumible por frontend en ../reservas-api.md.

Validación completa sobre la actualización con develop: npm test aprobado con 766 unitarias + 185 integración = 951 pruebas, 65 suites. npm run lint aprobado. Formato de todos los archivos propios de A aprobado. format:check global reporta 24 archivos preexistentes ajenos (antes 27; cambios ya integrados y los archivos de composición ahora formateados). No se editaron migraciones ni dependencias ni se debilitaron pruebas. La resolución de conflicto de flota conserva exactamente la versión revisada de origin/develop y quedó verificada en la suite.

Base temporal busesuta_test/test_user nueva, con cero tablas antes de migrar, en busesuta-leslie-book03-http. Al terminar se retiraron solo su contenedor/red. Sin leer .env ni usar datos existentes. Se cerraron los servidores y pools de prueba.

A comprobada localmente; revisión humana y publicación pendientes. T4 B (pantalla) y los proveedores reales de viajes/plantillas/acreditación/revisión asistida siguen pendientes antes de ofrecer compra funcional. No se abre un PR por este commit ni se implementa todavía el ciclo pagos/expiración de BOOK-06/07.
