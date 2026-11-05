# BOOK-CAJA-02: Venta presencial del oficinista sin cuenta del comprador

- **ID local:** BOOK-CAJA-02. Sin ticket externo.
- **Solicitante:** Edwin (pato77232), 11 de noviembre de 2026, a partir de las pruebas de Pablo (OF-02 a OF-13).
- **Responsables propuestos, sin aceptación inferida:** Leslie (Reservas), Shirley (Pagos y caja), Pablo (identidad y privacidad).
- **Estado:** Implementación autorizada por Edwin el 11 de noviembre de 2026 («Sí creo que sería mejor sin el autocompletado, podemos implementarlo, con las pantallas de frontend correspondientes»), con la **opción A** de §5. La revisión de Leslie, Shirley y Pablo sigue pendiente; su silencio no es aprobación.
- **Base comprobada:** `feature/FRONT-02-cierre-flujo-web`, desde `origin/develop` `162c80b`.
- **Relación:** amplía [BOOK-CAJA-01](BOOK-CAJA-01.md), el efectivo sobre una reserva de un cliente registrado, y se coordina con PAGOS-CAJA-01, el borrador local de Shirley. No sustituye esos documentos hasta que se apruebe.

## 1. Objetivo

En la boletería de su cooperativa, el oficinista vende uno o varios boletos a una persona que **no tiene cuenta** en transViaje. Cobra en efectivo y entrega el boleto con su QR. Si el pasajero ya viajó antes con esa cooperativa, el oficinista puede recuperar sus datos para no volver a escribirlos, con las restricciones de §5.

## 2. Decisiones vigentes que esta spec cambia

| Documento | Dice hoy | Cambio propuesto |
|---|---|---|
| BOOK-CAJA-01, decisión 1 | «No crear CUSTOMER ficticios ni permitir al oficinista elegir propietario… La venta totalmente presencial sin cuenta es otro alcance». | Este es ese otro alcance. La reserva pertenece a la **cooperativa** como venta de boletería, no a un cliente. No se crean cuentas ficticias. |
| Reglas de negocio, RN-41/42 | «Historial por cédula requiere titularidad verificada, nunca acceso/autocompletado de terceros por conocer un número». | Ver §5. Si no hay acuerdo explícito, se aplica la opción A: sin autocompletado. |

Participantes que deben responder: Leslie, Shirley y Pablo; el solicitante es Edwin. El silencio no es aprobación.

## 3. Alcance

**Incluye:**
- Consultar los viajes de **su** cooperativa por origen, destino y fecha. Reutiliza la búsqueda pública, filtrada por la cooperativa de la sesión.
- Ver el mapa de asientos y elegir uno o varios asientos libres. Reutiliza `seat-map` y la disponibilidad actuales.
- Registrar los datos de cada pasajero y acreditar en el mismo paso los beneficios contra el documento físico presentado. El oficinista ya es quien acredita.
- Resumen con el total calculado por el servidor, cobro en efectivo por el importe exacto, emisión de boletos y presentación para imprimir.
- Correo del boleto opcional, solo si el pasajero lo da, y sujeto a que exista el envío de BOLETOS-02.

**No incluye:**
- Crear cuentas de cliente.
- Pagos parciales, vueltos, cierre de caja o contabilidad.
- Anular o reembolsar ventas.
- Vender boletos de otra cooperativa.
- Funciones de Chofer o Controlador.
- Tarjeta o transferencia en boletería.

## 4. Reglas propuestas

1. **Multi-tenant:** el `cooperative_id` sale de la sesión CLERK verificada. El viaje debe pertenecer a esa cooperativa; si no, 404, igual que si no existiera.
2. **Propietario:** se agrega un tipo de comprador `COUNTER`. La venta queda a nombre de la cooperativa, con el oficinista como actor auditado. Ningún cliente la ve en «Mis reservas».
3. **Asientos:** se usa la misma concurrencia que la compra en línea (RN-40). Si otro comprador toma el asiento, se rechaza sin duplicar.
4. **Plazo:** la reserva de boletería usa el mismo plazo configurable de 3 a 5 minutos para confirmar el cobro; si vence, libera los asientos (RN-50/51). No se reinicia.
5. **Cobro:** importe exacto del resumen congelado, en USD. Se identifica con un recibo de caja idempotente, como en BOOK-CAJA-01 §6. Sin comprobante de depósito.
6. **Emisión:** al confirmar el cobro, la reserva pasa a `SOLD` y se emiten los boletos de BOLETOS-01, uno por asiento, con el mismo QR.
7. **Descuentos (RN-43):** el oficinista marca lo que comprobó en el documento físico; el servidor calcula el beneficio. Sin descuentos manuales.
8. **Cédula:** 10 dígitos con dígito verificador, como hoy. Validar la estructura no prueba la identidad.

## 5. Recuperar datos de un pasajero anterior (decisión pendiente)

**Pedido:** si la persona ya compró, que se llenen sus datos; si no, que los escriba el oficinista.

**Riesgo:** con solo escribir una cédula, cualquiera con acceso de oficinista vería el nombre, la fecha de nacimiento y el correo de una persona. RN-41/42 lo prohíbe expresamente.

| Opción | Cómo funciona | Privacidad | Esfuerzo |
|---|---|---|---|
| **A. Sin autocompletado** | El oficinista escribe todo, siempre. | Cumple RN-41/42 sin cambios. | Bajo |
| **B. Autocompletado con documento presente** | El oficinista marca «Tengo la cédula física del pasajero» antes de buscar. La búsqueda se limita a ventas de **su cooperativa** y devuelve solo nombre y fecha de nacimiento, nunca correo ni historial. Cada consulta queda auditada (quién, cuándo, qué cédula). Con límite de consultas por oficinista. | Requiere cambiar RN-41/42 por escrito. | Medio |
| **C. Autocompletado con la cuenta del pasajero** | Solo si el pasajero tiene cuenta: da su correo y recibe un código que dicta en boletería. | Cumple la regla, pero no sirve para quien no tiene cuenta. | Alto, depende de Auth |

**Decisión de Edwin (11 de noviembre de 2026): opción A.** Recomendación original: **A** para la primera versión, porque se puede entregar sin cambiar reglas, y **B** como mejora si el equipo cambia RN-41/42 por escrito. Nunca autocompletar el correo ni mostrar viajes anteriores.

## 6. Contrato propuesto (a confirmar con Leslie y Shirley)

| Método | Ruta | Rol | Uso |
|---|---|---|---|
| GET | `/api/v1/counter/trips?origin&destination&date` | CLERK | Viajes de su cooperativa |
| GET | `/api/v1/counter/seat-map?tripId&fromPosition&toPosition` | CLERK | Mapa y disponibilidad |
| POST | `/api/v1/counter/bookings/summary` | CLERK | Pasajeros, acreditación y total |
| POST | `/api/v1/counter/bookings` | CLERK | Crea la reserva `COUNTER` con su plazo. Idempotente con `Idempotency-Key`. |
| POST | `/api/v1/counter/bookings/:id/cash` | CLERK | Confirma el efectivo con `cashReceiptId` y `amountCents`. Devuelve `SOLD` y los boletos. |
| GET | `/api/v1/counter/bookings/:id/tickets` | CLERK | Reimpresión, solo de su cooperativa |
| GET | `/api/v1/counter/passengers/:cedula` | CLERK | **Solo con la opción B**: nombre y fecha de nacimiento, auditado |

Todas las escrituras con CSRF. Los errores siguen el formato `{ error: { code, message } }` y no revelan datos de otra cooperativa.

## 6 bis. Diseño implementado (difiere de §6 donde se indica)

- **Comprador de boletería:** la identidad del oficinista verificada por la sesión (CLERK con `cooperative_id`) produce el propietario `counter:<cooperative_id>`. Sigue el mismo patrón de propietario con prefijo que el invitado (`guest:<id>`). No se crea ningún usuario.
- **Acreditación en el mismo paso:** en boletería, el verificador de pasajeros toma las decisiones que el oficinista envía (`decisions`: `birthDateVerified` y `disabilityVerified` por asiento), en lugar de buscar una solicitud previa. Además, ese verificador exige que el viaje sea de la cooperativa del oficinista; si no, 404.
- **Reutilización:** la cotización, la creación idempotente, el bloqueo de asientos, el plazo y la expiración son los mismos de la compra en línea.
- **Cobro:** `POST /api/v1/counter/bookings/:bookingId/cash` con `cashReceiptId` (UUID que genera la pantalla y se reutiliza al reintentar) y `amountCents`. Bajo bloqueo, exige reserva de boletería de la misma cooperativa, pendiente, sin vencer y con el importe exacto. Repetir el mismo recibo devuelve el resultado; otro recibo o importe da conflicto.
- **Desvío respecto de BOOK-CAJA-01 §6:** el recibo se guarda en Reservas (`cash_receipt_id`, `sold_by`) y no en Pagos, para entregar sin el módulo de caja de Shirley. Revisarlo con Shirley.
- **Boletos:** `GET /api/v1/tickets/counter/bookings/:bookingId` (CLERK) reutiliza la emisión de BOLETOS-01 con el propietario de boletería de su cooperativa.
- **Búsqueda:** la pantalla usa la búsqueda pública y muestra solo los viajes de la cooperativa del oficinista. El servidor vuelve a exigir la cooperativa al cotizar, reservar y cobrar.
- **Rutas reales:** `GET /api/v1/counter/seat-map`, `GET /api/v1/counter/availability`, `POST /api/v1/counter/bookings/summary`, `POST /api/v1/counter/bookings` y `POST /api/v1/counter/bookings/:bookingId/cash`. No hay endpoint de pasajeros por cédula.

## 7. Persistencia

- Una migración **nueva**, sin editar las existentes:
  - Tipo de comprador `COUNTER` y actor que vende.
  - Método `CASH` y vínculo al recibo.
  - Ajuste explícito de las restricciones que hoy exigen un comprobante `RECEIVED` para `SOLD` (BOOK-CAJA-01 §Persistencia).
  - Con la opción B, una tabla de auditoría de consultas por cédula.
- `owner_id` no puede quedar con un usuario inventado. Para `COUNTER`, el dueño lógico es la cooperativa; los detalles se definen con Leslie.

## 8. Pantalla del oficinista (resumen)

Nueva entrada «Vender en boletería» junto a «Comprobantes» y «Acreditar beneficios», en cinco pasos:
1. Buscar el viaje.
2. Elegir los asientos.
3. Llenar los pasajeros y marcar lo acreditado.
4. Revisar el total y cobrar.
5. Imprimir los boletos.

Requisitos: estados de carga y error comprensibles, uso por teclado, contador del plazo visible y aviso si un asiento se ocupó mientras tanto.

## 9. Criterios de aceptación

- [ ] Un CLERK solo ve y vende viajes de su cooperativa; el viaje de otra responde 404 (OF-02, OF-13).
- [ ] Buscar por origen, destino y fecha devuelve los viajes que coinciden (OF-03).
- [ ] El mapa muestra la disponibilidad real (OF-04).
- [ ] Vender uno o varios asientos crea una sola venta sin duplicados (OF-05, OF-06).
- [ ] Un asiento ocupado se rechaza (OF-12).
- [ ] El descuento se aplica solo si el oficinista marcó la verificación (OF-07).
- [ ] Al cobrar el importe exacto se emiten los boletos con QR, y se pueden reimprimir (OF-11).
- [ ] Sin cobro dentro del plazo, la reserva vence y libera los asientos.
- [ ] Repetir el cobro con el mismo recibo no cobra dos veces.
- [ ] Con la opción A, ningún endpoint devuelve datos de un pasajero por su cédula.

## 10. Pruebas esperadas

- **Unitarias:** reglas de tenant, comprador `COUNTER`, cálculo con acreditación e idempotencia del recibo.
- **Integración con PostgreSQL aislado:** concurrencia contra una compra en línea, vencimiento, cobro repetido, otra cooperativa y respuesta perdida.
- **Frontend:** controlador de cada paso.
- **Manual:** recorrido completo en Docker.

## 11. Plan sugerido (tras aprobar §2 y §5)

| Tarea | Módulo | Propuesto |
|---|---|---|
| T1 | Migración y comprador `COUNTER` en Reservas | Leslie |
| T2 | Búsqueda, mapa, resumen y reserva de boletería | Leslie |
| T3 | Recibo de efectivo y confirmación | Shirley |
| T4 | Pantalla «Vender en boletería» | Por asignar |
| T5 | Opción B, si se aprueba | Pablo y Leslie |

## 11 bis. Implementación y evidencias (11 de noviembre de 2026)

**Backend (Reservas y Boletos):**
- Migración nueva `1794370000000-booking-counter-cash-sales`: columnas `sold_by` y `cash_receipt_id`; `SOLD` sin comprobante solo para propietario `counter:<cooperative_id>`; restricción que exige recibo UUID v4 y actor al vender en boletería, prohíbe comprobante en esas reservas y ata el propietario a la cooperativa de la reserva; índice único del recibo. El `down` se niega si existen ventas de boletería. Registrada en el catálogo de migraciones y en sus pruebas.
- `application/counter-sales.js`, `infrastructure/pg-counter-cash-sales.js`, `interfaces/counter-router.js` y `domain/booking-cash-error.js`; rutas montadas en `/api/v1/counter`. En Boletos, `GET /api/v1/tickets/counter/bookings/:bookingId` (CLERK).
- Pruebas: 10 unitarias (`tests/unit/bookings/counter-sales.test.js`) y 9 de integración con PostgreSQL aislado (`tests/integration/bookings/counter-sales.http.test.js`): venta completa con QR, otra cooperativa (404), roles no permitidos (403), verificación de nacimiento obligatoria, descuento de tercera edad, importe distinto y segundo recibo (409), asiento ya reservado (409), plazo vencido y restricciones de la base. Una de ellas detectó que un `CHECK` con NULL dejaba pasar `SOLD` sin recibo; se corrigió antes de aplicar la migración en QA.
- `tests/integration/migration-catalog.test.js` ahora exige que las columnas nuevas lleguen vacías a las reservas existentes, igual que en migraciones anteriores.
- **Pruebas existentes ajustadas, para revisión humana:**
  - `tests/unit/migration-catalog.test.js`: registra la migración nueva (39 activas).
  - `tests/integration/bookings/guest-booking-contact.test.js`: como esta migración quedó después de la de invitado, la prueba primero revierte la de boletería (sin datos, pasa) y luego conserva intacta la comprobación de que la reversión de invitado se niega con datos (`P0001`); al final reaplica todo. Es el mismo tipo de ajuste que hizo el commit `7079589` al cambiar el orden de migraciones.
- La prueba nueva limpia también `tickets`; sin eso dejaba un boleto que impedía revertir migraciones en otras suites.
- Suite completa del backend en PostgreSQL aislado: lint y formato en verde, 2224 unitarias y 748 de integración.

**Frontend:**
- `pages/boleteria.html` («Vender en boletería»), `src/counter/` (modelo, API, controlador y página) y `src/styles/counter.css`. Enlace en la navegación del oficinista (Comprobantes y Acreditar beneficios).
- Seis pasos: buscar, elegir asientos, pasajeros (con «Comprobé la fecha de nacimiento con la cédula física» obligatorio), revisar, cobrar y boletos para imprimir. Reintentar el cobro usa el mismo recibo.
- Pruebas: 10 nuevas (`tests/counter/`); frontend 468 de 468, lint en verde.

**Docker QA y navegador (oficinista `qa.oficinista@example.test`):** migración aplicada con `node scripts/migrate.js up`. Búsqueda Ambato → Quito del 12/11 solo con viajes de la cooperativa, mapa de 42 asientos, venta de dos asientos (adulto y tercera edad: base $11,00, descuento $2,75, total $8,25) y venta de un asiento con cobro registrado, boleto con QR y asiento 3 marcado «Vendido» después. En el primer intento el cobro respondió `CSRF_TOKEN_INVALID`: la creación pedía un token aparte y dejaba vencido el del cliente común; se corrigió y se agregó un mensaje claro. A 375 px el mapa se desplaza dentro de su recuadro sin desbordar la página.

**Observaciones para el equipo:** el servidor acepta la misma cédula en dos asientos de una venta (también en la compra en línea); decidir si se prohíbe. El correo del boleto no se envía en boletería (depende de BOLETOS-02). No hay anulación ni reimpresión desde un listado: la reimpresión es por la ruta del boleto.

## 12. Defecto inducido

No aplica.

## 13. Revisión

Borrador preparado con asistencia de IA el 11 de noviembre de 2026 e implementado el mismo día por pedido de Edwin. Revisión humana de Leslie, Shirley y Pablo pendiente. Sin commits.
