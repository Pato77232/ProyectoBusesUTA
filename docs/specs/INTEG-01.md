# INTEG-01: Reconectar capacidades integradas en develop

- **ID local:** INTEG-01; libre en las specs accesibles al comprobarlo el 4 de noviembre de 2026.
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulos:** catálogo de migraciones (`backend/scripts`), `bookings`, `payments` y composición del servidor
- **Responsable:** Edwin, por acuerdo del equipo de que cualquier integrante puede resolver los bloqueos comunes
- **Revisor propuesto:** pendiente; la revisión de IA no sustituye revisión humana
- **Estado:** T1 implementada en `feature/INTEG-01-catalogo-migraciones`, pendiente de commit y PR. T2–T6 sin empezar.
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
