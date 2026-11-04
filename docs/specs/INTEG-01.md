# INTEG-01: Reconectar capacidades integradas en develop

- **ID local:** INTEG-01; libre en las specs accesibles al comprobarlo el 4 de noviembre de 2026.
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulos:** catálogo de migraciones (`backend/scripts`), `bookings`, `payments` y composición del servidor
- **Responsable:** Edwin, por acuerdo del equipo de que cualquier integrante puede resolver los bloqueos comunes
- **Revisor propuesto:** pendiente; la revisión de IA no sustituye revisión humana
- **Estado:** T1 en `feature/INTEG-01-catalogo-migraciones` (commits `cf285b3` y `183d95b`), pendiente de PR. T2 en `feature/INTEG-01-T2-historial-reservas` (`44cd95b`), creada sobre T1. T3 en `feature/INTEG-01-T3-rechazo-comprobantes` (`3d3261f`), creada sobre T2. T4 en `feature/INTEG-01-T4-confirmador-venta`, creada sobre T3. T5–T6 sin empezar.
- **Base comprobada:** `origin/develop` en `64f39cd`, sin PR abiertas.

## 1. Objetivo

Las integraciones del 3 y 4 de noviembre dejaron en develop los archivos de Fleet, frecuencias, hojas de ruta, Reservas y Pagos, pero algunas conexiones se perdieron al resolver conflictos. Esta spec las restaura una por una, sin cambiar reglas de negocio y conservando las comprobaciones existentes.

## 2. Situación comprobada en develop (`64f39cd`)

| Prioridad | Tarea | Síntoma |
| --- | --- | --- |
| Urgente | T1. Restaurar en el catálogo las migraciones de procedencia de comprobantes, renovación y totales comerciales | `MIGRATION_CATALOG_INVALID` impide preparar la base; integración 22 aprobadas y 613 fallidas |
| Urgente | T2. Inyectar `getBookingHistory` en el router de Reservas | El historial responde 500 |
| Urgente | T3. Pasar `rejectPaymentProof` al controlador | El rechazo de comprobantes responde 500 |
| Urgente | T4. Componer y conectar el confirmador real de venta | Pagos conserva un confirmador simulado |
| Alta | T5. Conectar el acceso de invitado | El servicio existe, pero Reservas no entrega `guestRouter` |
| Alta | T6. Implementar o conectar la acreditación de beneficios | La compra comercial sigue en 503, según el límite documentado |

Cada tarea va en su propia rama `feature/INTEG-01-*` desde develop, con commit atómico y PR hacia develop.

## 3. T1: catálogo de migraciones

**Causa:** el merge `fcf3ed9` conservó la versión del catálogo de la rama de Reservas (25 nombres). Quedaron fuera tres migraciones presentes en `backend/migrations`: `1794086400000-payment-proof-upload-provenance`, `1794160000000-route-sheet-renewals` y `1794250000000-booking-commercial-totals`. `validateCatalog` exige que los archivos coincidan exactamente con `activeNames`.

**Cambio:** registrar las tres en su posición por fecha (28 nombres ordenados). No se modifica ninguna migración, ni `validateCatalog`/`validateHistory`.

**Historial:** el catálogo exige un prefijo ordenado. Una base local que aplicó las ramas por separado (Reservas sin procedencia, o procedencia sin ciclo de venta) no es un prefijo del nuevo orden y se rechazará con `MIGRATION_HISTORY_UNEXPECTED`, sin cambios. Al no existir producción, se recrea la base de desarrollo. Una base preparada con develop anterior a esta corrección no pudo migrar, porque el catálogo ya fallaba.

**Criterios de aceptación:**

- [x] Una base vacía aplica las 28 migraciones en orden.
- [x] Las pruebas del catálogo exigen los 28 nombres y su posición, sin quitar comprobaciones.
- [x] Unitarias, lint e integración completa con PostgreSQL aislado reportadas con resultados reales.

## 4. Evidencia

### T1, 4 de noviembre de 2026 (Windows, Node 24, PostgreSQL aislado de `docker-compose.test.yml`, sin leer `.env`)

**Cambios:**

- `scripts/migration-catalog.js`: 28 nombres en orden de fecha.
- Edwin autorizó adaptar las pruebas afectadas, sin quitar comprobaciones:
  - `tests/unit/migration-catalog.test.js`: exige 28 nombres y la posición de las tres restauradas.
  - `tests/integration/migration-catalog.test.js`: las reversiones localizan por nombre la migración que prueban (`downTo`) en lugar de contar pasos; las comparaciones de filas omiten solo las columnas nuevas con su valor por defecto comprobado (importes comerciales en 0, procedencia en nulo), y la copia de develop añade también `route_sheet_renewals` vacía.
  - `tests/integration/payments/pg-payment-proof.repository.test.js`: añade las columnas de rechazo, que ahora se crean después de las de procedencia.
  - 14 archivos de integración vaciaban las tablas de Reservas con `TRUNCATE` sin `booking_guest_access_tokens`, creada por la migración de acceso de invitado con FK a `bookings`; PostgreSQL rechazaba el `TRUNCATE`. Se añadió esa tabla a la lista (16 sentencias). Este fallo ya existía en develop, oculto porque el catálogo fallaba antes.

**Resultados:**

- Lint aprobado; **1925/1925 unitarias**.
- Integración completa: **613 aprobadas y 22 fallidas de 635** (antes, 22 aprobadas y 613 fallidas).
- Los 22 fallos restantes no dependen del catálogo:
  - 12 en `payment-proof-review.http.test.js`: esperan `payments.bookingSaleConfirmer`, que ya no se expone; corresponde a T4.
  - 6 en `commercial-purchase.test.js`: la integración preparada con verificador responde 503 `BOOKING_TRIP_SERVICE_UNAVAILABLE` al crear la reserva; la creación no usa el catálogo comercial. Corresponde a la compra comercial (T6).
  - 4 en `authorized-payment-upload.http.test.js`: la carga autorizada responde 404 `BOOKING_NOT_FOUND`. Nueva conexión pendiente entre Pagos y Reservas, no listada en la tabla de la sección 2.

### T2: historial de reservas, 4 de noviembre de 2026

**Causa:** `createBookingsModule` no pasaba `getBookingHistory` a `createBookingRouter`; `GET /api/v1/bookings` y `GET /api/v1/bookings/:bookingId` fallaban con 500 al llamar `getBookingHistory.list` o `.get` sobre `undefined`. El caso de uso, el repositorio y la ruta ya existían (`0a8223e`).

**Cambio:** `src/modules/bookings/index.js` compone `getBookingHistory({ repository })` y lo entrega al router. Sin cambios de dominio, repositorio ni rutas.

**Pruebas nuevas** en `tests/integration/bookings/booking-http.test.js`, con servidor y PostgreSQL reales; antes del cambio fallaban con 500:

- El comprador lista su reserva y abre su detalle con `no-store`, sin su identificador de usuario en la respuesta. Otro comprador ve un historial vacío, y su consulta del detalle ajeno es indistinguible de una reserva inexistente (404).
- Sin sesión responde 401; `ownerId` o `limit` inválidos por query responden 400, sin escribir reservas.

**Resultados** (rama basada en T1, PostgreSQL aislado, sin leer `.env`): lint y formato de los archivos tocados aprobados; **1925/1925 unitarias**; integración **615/637**. Los 22 fallos son los mismos conocidos de T1 (T4, T6 y carga autorizada).

### T3: rechazo de comprobantes, 4 de noviembre de 2026

**Causa:** `createPaymentProofRouter` recibía `rejectPaymentProof`, pero no lo pasaba a `createPaymentProofController`. `POST /api/v1/payment-proofs/:id/reject` llamaba `.execute` sobre `undefined` y respondía 500, incluso con datos inválidos o con un comprobante ajeno.

**Cambio:** `payment-proof.routes.js` entrega `rejectPaymentProof` al controlador. Sin cambios en el caso de uso, el dominio ni la ruta.

**Pruebas nuevas** en `tests/integration/payments/payment-proof-rejection.http.test.js`, con sesión real y PostgreSQL. Antes del cambio, las tres fallaban con 500.

- Un CLERK rechaza con motivo: responde 200 y avisa a Reservas una sola vez (`rejectSale`) con la reserva, la cooperativa y el actor de la sesión. Se guardan el actor y el motivo sin espacios, y no se llama a `confirmSale`.
- Sin justificación, o con solo espacios, responde 400 `PAYMENT_PROOF_VALIDATION_ERROR`, sin avisar a Reservas ni modificar el comprobante (RN: rechazar exige justificación).
- Un comprobante de otra cooperativa responde 404; sin CSRF, 403; sin sesión, 401. En los tres casos no hay aviso ni cambios.

La prueba sustituye el confirmador por un doble porque el confirmador simulado actual no implementa `rejectSale`. Con el confirmador por defecto, el rechazo termina en `BOOKING_SALE_UNCERTAIN`; conectar el confirmador real de Reservas corresponde a T4.

**Resultados** (rama basada en T2, PostgreSQL aislado, sin leer `.env`): lint y formato aprobados; **1925/1925 unitarias**; integración **618/640**. Los 22 fallos son los ya conocidos.

### T4: confirmador real de venta, 4 de noviembre de 2026

**Causa:** `696e15d` (Leslie) creaba `PgBookingSaleConfirmer` en Reservas, lo exponía como `saleConfirmer` y el servidor lo pasaba a Pagos. El merge `fcf3ed9` perdió dos conexiones:

- Reservas ya no creaba ni exponía `saleConfirmer`.
- La rama productiva de `server.js` llamaba a `createPaymentsModule` sin `bookingSaleConfirmer`, así que Pagos usaba `SimulatedBookingSaleConfirmer`: aprobar no vendía la reserva y rechazar terminaba en `BOOKING_SALE_UNCERTAIN`, porque el simulado no implementa `rejectSale`.

Además, desde `696e15d` Pagos devolvía el parámetro recibido en lugar del confirmador y notificador efectivos, y quedaba `undefined` cuando se usaban los predeterminados. Eso rompía las 12 pruebas de `payment-proof-review.http.test.js`.

**Cambios:**

- `bookings/index.js`: compone `PgBookingSaleConfirmer({ pool, clock })` y lo expone como `saleConfirmer`.
- `server.js`: la rama productiva pasa `bookingSaleConfirmer: bookings.saleConfirmer`.
- `payments/index.js`: devuelve el notificador y el confirmador efectivos, como antes de `696e15d`.
- `tests/unit/payments/server-review-composition.test.js`: la composición del servidor exige además el confirmador de Reservas.

**Pruebas nuevas** en `tests/integration/payments/real-sale-confirmation.http.test.js`, con sesión real, Reservas y Pagos compuestos y PostgreSQL:

- Pagos no usa el confirmador simulado.
- Aprobar por HTTP vende la reserva y su asiento (`SOLD`), y repetir no duplica efectos.
- Rechazar por HTTP libera el asiento y guarda el actor y el motivo en Reservas y en Pagos.
- Si Reservas aceptó otro comprobante, aprobar responde 409 `BOOKING_SALE_REJECTED`, sin vender ni aprobar.

**Resultados** (rama basada en T3, PostgreSQL aislado, sin leer `.env`):

- Lint aprobado; formato aprobado en los archivos del cambio, salvo `server.js`, cuyo aviso proviene de líneas ya mal formateadas en develop que no se tocaron.
- **1925/1925 unitarias**; integración **634/644**. Vuelven a pasar las 12 de revisión de comprobantes.
- Quedan 10 fallos: compra comercial (T6, 6) y carga autorizada 404 (4).

**Hallazgo para revisión:** `server.js` decide la composición según `createBookingsModule?._isMockFunction` y `createPaymentsModule?._isMockFunction` (introducido en `fcf3ed9`). El código de producción depende de si una prueba lo simula. No se modificó en T4, para no mezclar cambios; conviene retirarlo en una tarea propia, ajustando `tests/unit/server.test.js`.
