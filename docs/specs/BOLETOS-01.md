# BOLETOS-01: boleto con QR por pasajero de una venta confirmada

- **ID local:** BOLETOS-01
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `tickets` (nuevo), con ampliación del contrato de lectura de `bookings` (BOOK-09)
- **Responsable:** Edwin (asumió la tarea el 4 de noviembre de 2026; el área de Boletos estaba propuesta para Shirley)
- **Revisor propuesto / confirmado:** Shirley (Pagos y Boletos) y Leslie (por la ampliación de BOOK-09); sin confirmar
- **Estado:** Borrador
- **Prioridad y dependencias:** prioridad alta para la demostración. Depende de BOOK-09 (#98, integrada) y de la aprobación de comprobantes (PAGOS-02, integrada).
- **Rama / PR / base comprobada:** `feature/BOLETOS-01-emision-qr` desde `origin/develop` `3695655`, comprobada el 4 de noviembre de 2026. Sin PR.
- **Autorización de alcance:** Edwin, 4 de noviembre de 2026: emitir al consultar, generar el QR en el servidor con `qrcode` 1.5.4 y ampliar BOOK-09 para los datos del viaje. No es revisión técnica.

Sustituye el borrador sin seguimiento del mismo ID, del que conserva las reglas de privacidad, idempotencia y fuera de alcance.

## 1. Objetivo

Que el cliente que compró pasajes vea e imprima un boleto por pasajero, con un código QR, cuando su reserva queda vendida. Hoy el flujo termina en «venta confirmada» sin entregar el pasaje (RN-54).

## 2. Reglas de negocio involucradas

- **RN-54:** al aprobar el comprobante, la reserva queda vendida y se emite el boleto con QR. En esta tarea el boleto se materializa la primera vez que se consulta una reserva vendida (ver 4); para el cliente es indistinguible de emitirlo al aprobar.
- **Flujo 7 (emisión):** el boleto queda en el historial del cliente.
- **RN-41/42:** un boleto por asiento y pasajero, con su cédula; el comprador accede a todos los boletos de su compra.
- **Multi-tenant:** la cooperativa sale de la reserva persistida, nunca del navegador.

## 3. Alcance

**Incluye:**

- Ampliar la lectura de BOOK-09 con una consulta por propietario y con los datos del viaje congelados en la venta.
- Tabla propia de boletos, emisión idempotente y código opaco por boleto.
- Endpoint para que el CUSTOMER propietario consulte los boletos de su reserva, con el QR en SVG.
- Página imprimible de boletos y enlace desde las reservas vendidas.

**No incluye:**

- Envío del boleto por correo (tarea 4 del reparto; usa este módulo después).
- Boletos de invitado: el canje de invitado necesita su propio contrato con Auth.
- Venta en caja y boletos emitidos por el CLERK.
- Escáner o validación del QR: el rol Chofer/Controlador no se implementa en esta fase.
- Apple Wallet y Google Wallet: necesitan cuentas de emisor y certificados externos; quedan para una spec posterior.
- PDF descargable: la página se imprime o se guarda como PDF desde el navegador.

## 4. Flujo principal

1. El CLERK aprueba el comprobante; Reservas marca la reserva como `SOLD` (ya existe).
2. El cliente abre «Mis reservas» y, en una reserva vendida, elige «Ver boletos».
3. El frontend pide `GET /api/v1/tickets/bookings/:bookingId` con la sesión del cliente.
4. Tickets lee la venta con BOOK-09 filtrando por el propietario autenticado. Si no es suya, no existe o no está vendida, responde 404 sin distinguir el motivo.
5. Tickets inserta, si faltan, un boleto por asiento (`ON CONFLICT DO NOTHING` sobre reserva y asiento) y lee los guardados. Repetir la consulta devuelve los mismos boletos y códigos.
6. La respuesta incluye los datos del boleto y el QR en SVG generado a partir del código opaco.
7. La página muestra un boleto por pasajero y permite imprimirlos.

## 5. Datos

### Ampliación de BOOK-09 (Bookings)

Nueva operación `findSoldForOwner({ bookingId, ownerId })` en `createBookingTicketQueries`, con las mismas validaciones y errores que `findSoldForTicket`. Devuelve null indistinguible si la reserva no existe, es de otro propietario o no está vendida.

Solo esta operación nueva agrega el campo `trip`, tomado del resumen comercial congelado (`schemaVersion` 2), sin consultar la tarifa ni el viaje actuales. `findSoldForTicket` conserva su forma para no cambiar el contrato publicado de BOOK-09.

```js
trip: {
  departureDate,                                   // AAAA-MM-DD del resumen
  origin: { position, locationKey, departureAt },  // punto fromPosition
  destination: { position, locationKey, arrivalAt }, // punto toPosition
}
```

Si faltan esos datos, o la llegada no es posterior a la salida, en una venta `SOLD` se lanza `BOOKING_TICKET_DATA_INTEGRITY_ERROR`, como con los demás campos. Una reserva no vendida devuelve null antes de revisar el tramo.

### Tabla `tickets` (migración nueva)

| Columna          | Tipo          | Reglas                                                             |
| ---------------- | ------------- | ------------------------------------------------------------------ |
| `id`             | uuid PK       | generado por el servidor                                           |
| `cooperative_id` | text no vacío | de la venta leída                                                  |
| `booking_id`     | text no vacío | identificador opaco de la venta leída; sin FK a tablas de Bookings |
| `seat_id`        | text no vacío | asiento vendido                                                    |
| `code`           | text UNIQUE   | 128 bits aleatorios en base32, sin datos personales                |
| `issued_at`      | timestamptz   | hora de la primera emisión                                         |

Restricción única `(booking_id, seat_id)`. El `down` se bloquea si hay boletos emitidos.

### Contenido del QR

`TRANSVIAJE:TICKET:<code>`. Solo el código opaco: sin cédula, nombre, correo ni identificadores internos. Conocer el código no da acceso a ningún dato: no hay endpoint público que lo resuelva en esta fase.

## 6. Endpoints

| Método | Ruta                                  | Roles                | Respuestas                                                                                                                          |
| ------ | ------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/tickets/bookings/:bookingId` | CUSTOMER propietario | 200 con boletos; 400 `bookingId` inválido; 401 sin sesión; 403 otro rol; 404 ausente, ajena o no vendida; 503 lectura no disponible |

Respuesta 200, con `Cache-Control: no-store`:

```json
{
  "bookingId": "…",
  "trip": {
    "departureDate": "…",
    "origin": { "locationKey": "Ambato", "departureAt": "…" },
    "destination": { "locationKey": "Quito", "arrivalAt": "…" }
  },
  "currency": "USD",
  "totalPriceCents": 1200,
  "tickets": [
    {
      "ticketId": "…",
      "code": "…",
      "issuedAt": "…",
      "seatId": "…",
      "passenger": { "fullName": "…", "identificationNumber": "…" },
      "totalPriceCents": 600,
      "qrSvg": "<svg …>"
    }
  ]
}
```

## 7. Criterios de aceptación

- [ ] Dado un cliente con una reserva vendida, cuando consulta sus boletos, entonces recibe un boleto por pasajero con su QR.
- [ ] Dado que ya consultó, cuando vuelve a consultar, entonces recibe los mismos `ticketId` y `code`.
- [ ] Dadas dos consultas simultáneas, entonces solo existe un boleto por asiento.
- [ ] Dada una reserva pendiente, expirada, rechazada, ajena o inexistente, entonces la respuesta es el mismo 404.
- [ ] El QR se decodifica a `TRANSVIAJE:TICKET:<code>` y no contiene cédula ni nombre.
- [ ] La página muestra origen, destino, fecha y hora de salida, pasajero, cédula, asiento y precio, y se puede imprimir un boleto por hoja.

## 8. Casos borde y errores

- Venta `SOLD` con resumen incompleto: 500 genérico, sin emitir boletos parciales.
- Fallo al insertar boletos: 503; la venta y los asientos no cambian.
- Un `bookingId` vacío o demasiado largo: 400 sin consultar la base.
- El navegador no envía cooperativa, propietario ni precios; si los envía, se ignoran.

## 9. Pruebas esperadas

- **Unitarias:** dominio del boleto (código, contenido del QR), caso de uso de emisión idempotente con puertos falsos, ampliación de `soldBookingTicket` con `trip`, controlador HTTP y vista del frontend.
- **Integración (PostgreSQL aislado):** `findSoldForOwner` con reservas propias, ajenas y no vendidas; migración arriba y abajo; emisión concurrente sin duplicados; endpoint completo con sesión real.
- **Navegador:** recorrido aprobar → ver boletos → imprimir, en escritorio y en móvil.

## 10. Preguntas abiertas

- **Etiqueta del asiento:** la venta guarda `seatId` (UUID). Mostrar el número visible del asiento requiere leerlo de Flota (Edwin) o congelarlo en la reserva (Leslie). Mientras tanto se muestra el orden del pasajero. Responsables: Edwin y Leslie.
- **Nombre de la cooperativa** en el boleto: requiere una consulta pública de Tenants. Responsable: Pablo.
- **Ampliación de BOOK-09:** avisar a Leslie y registrar su conformidad antes de integrar T1.

## 11. Defecto inducido

No aplica: por decisión de Edwin del 4 de noviembre de 2026, la entrega no incluye errores inducidos.

## 12. Diseño SOLID y usabilidad

- **Responsabilidades:** Bookings sigue siendo dueño de la venta y solo expone una lectura; Tickets es dueño de la emisión y del código. Tickets depende de un puerto `SoldBookingReader` y de un `QrRenderer`, que se inyectan en la composición (inversión de dependencias); la librería `qrcode` queda en `infrastructure`.
- **Usabilidad:** dado un cliente en «Mis reservas», cuando la reserva está vendida, ve el botón «Ver boletos». La página tiene estados de carga, vacío (reserva no disponible), error y éxito; se navega con teclado, el QR tiene texto alternativo con el código y la vista de impresión oculta la navegación. Sigue `frontend/DESIGN.md`.

## 13. Plan y evidencias

| Incremento | Contenido                                                                                                           | Estado            |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | ----------------- |
| T1         | Ampliación de BOOK-09: `findSoldForOwner` y `trip`                                                                  | Local, sin commit |
| T2         | Módulo `tickets`: dominio, migración, repositorio y caso de uso idempotente                                         | Pendiente         |
| T3         | Endpoint HTTP, QR con `qrcode` 1.5.4 (MIT; depende de `pngjs`, `yargs` y `dijkstrajs`) y composición en `server.js` | Pendiente         |
| T4         | Página de boletos imprimible y enlace desde «Mis reservas»                                                          | Pendiente         |

Cada incremento se cierra con `npm run lint`, `npm run format:check` y `npm test` en `backend/` (integración con PostgreSQL aislado según `docs/testing-database.md`), pruebas del frontend y, en T3 y T4, arranque real.
