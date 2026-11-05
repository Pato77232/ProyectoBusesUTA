# CORREO-02: avisos por correo al comprador

- **ID local:** CORREO-02
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `notifications` (nuevo), con cambios acotados en `payments`, `bookings` y `auth`
- **Responsable:** Edwin
- **Revisor propuesto / confirmado:** Pablo (correo y Auth), Shirley (Pagos) y Leslie (Reservas); sin confirmar
- **Estado:** Borrador
- **Prioridad y dependencias:** depende de [BOLETOS-01](BOLETOS-01.md) (PR #103, sin integrar) por la página `boletos.html` y la lectura de venta con tramo; reutiliza `smtp-mailer.js` de [CORREO-01](CORREO-01.md).
- **Rama / PR / base comprobada:** `feature/CORREO-02-avisos-correo` desde `feature/BOLETOS-01-emision-qr` `2dac0c0` (incluye `origin/develop` `292bb1f`), 4 de noviembre de 2026. Sin PR.
- **Autorización de alcance:** Edwin, 4 de noviembre de 2026: avisos de boletos listos, comprobante rechazado y reserva vencida; el correo de boletos lleva un enlace a «Mis boletos», sin QR adjunto; Pagos (y Reservas al vencer) encolan el aviso en la misma transacción que el cambio de estado. No es revisión técnica.

La recuperación de contraseña ya está integrada en `develop` por [AUTH-CORREO-01](AUTH-CORREO-01.md), con su propio trabajador; esta spec no la cambia.

## 1. Objetivo

Avisar por correo al comprador cuando su compra cambia de estado, para que no dependa de volver a la web: boletos listos al aprobarse el pago, comprobante rechazado con su justificación y reserva vencida sin comprobante.

## 2. Reglas de negocio involucradas

- **RN-54:** al aprobar, se emite el boleto; el aviso lleva al cliente a sus boletos.
- **RN-41/42:** el comprador accede a todos los boletos de su compra. La reserva no guarda correos por pasajero, así que en esta tarea solo se avisa al correo de la cuenta del comprador.
- **Rechazo con justificación:** la justificación que escribió el CLERK se incluye en el aviso.
- **Plazo configurable del comprobante:** el aviso de vencimiento no repite números fijos; usa los datos de la reserva.

## 3. Alcance

**Incluye:**

- Tabla `email_notifications` (outbox) y módulo `notifications` con `enqueueWith(client, aviso)` para encolar dentro de la transacción de quien cambia el estado.
- Encolado en la aprobación y el rechazo de Pagos, y en el vencimiento de Reservas, de forma atómica con el cambio de estado.
- Trabajador que reclama avisos pendientes, arma el texto, resuelve el correo del comprador y envía con `smtp-mailer.js`, con reintentos y estados de entrega.
- Lecturas públicas nuevas: contexto de aviso de una reserva (Reservas) y correo de un cliente (Auth).

**No incluye:**

- Correos por pasajero o al responsable de un menor (no hay datos de contacto por pasajero).
- Avisos a invitados: su canje y contacto siguen fuera de esta fase.
- QR adjunto, HTML o PDF: el mailer actual solo envía texto y el boleto se ve tras iniciar sesión.
- Cambios en la recuperación de contraseña.

## 4. Flujo principal

1. El CLERK aprueba un comprobante. En la misma transacción que marca la aprobación, Pagos llama `enqueueWith(client, { kind: 'TICKETS_READY', bookingId, cooperativeId })`. Si la transacción se revierte, no queda aviso.
2. Igual al rechazar (`PROOF_REJECTED`, con la justificación) y al vencer una reserva sin comprobante en Reservas (`BOOKING_EXPIRED`).
3. Un aviso por tipo y reserva: `UNIQUE (kind, booking_id)`. Repetir la aprobación o el vencimiento no duplica correos.
4. El trabajador reclama avisos `PENDING` vencidos con `FOR UPDATE SKIP LOCKED`, los marca `SENDING` con hora de reclamo y, por cada uno:
   - lee el contexto de la reserva (propietario, tramo, fecha y pasajeros) con la lectura de Reservas;
   - obtiene el correo del propietario con la lectura de Auth; si no hay cliente con correo, marca `SKIPPED`;
   - arma el texto y envía con `notificationId = id` (Message-ID estable).
5. Resultado del envío:
   - aceptado por SMTP: `ACCEPTED` (aceptado no significa entregado);
   - fallo temporal o resultado incierto: vuelve a `PENDING` con espera creciente, hasta el máximo de intentos; luego `FAILED`;
   - fallo permanente o mensaje inválido: `FAILED` sin reintento.
6. Un `SENDING` con reclamo vencido (proceso caído) vuelve a reclamarse.

## 5. Datos

### Tabla `email_notifications` (migración nueva)

| Columna                                        | Tipo          | Reglas                                                                                     |
| ---------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------ |
| `id`                                           | uuid PK       | también es el `notificationId` del correo                                                  |
| `kind`                                         | text          | `TICKETS_READY`, `PROOF_REJECTED` o `BOOKING_EXPIRED`                                      |
| `booking_id`, `cooperative_id`                 | text no vacío | de la operación que encola                                                                 |
| `payload`                                      | jsonb objeto  | solo lo que no se puede volver a leer: la justificación del rechazo (máx. 1000 caracteres) |
| `state`                                        | text          | `PENDING`, `SENDING`, `ACCEPTED`, `FAILED`, `SKIPPED`                                      |
| `attempts`                                     | integer ≥ 0   |                                                                                            |
| `next_attempt_at`, `claimed_at`, `finished_at` | timestamptz   |                                                                                            |
| `last_error_code`                              | text          | código del mailer, sin mensajes ni datos SMTP                                              |
| `created_at`                                   | timestamptz   |                                                                                            |

`UNIQUE (kind, booking_id)` e índice `(state, next_attempt_at)`. El `down` se bloquea si hay avisos.

No se guarda el correo del destinatario ni el texto: se resuelven al enviar. Así un cambio de correo de la cuenta antes del envío se respeta y la tabla no acumula datos personales.

### Lecturas nuevas

- **Reservas:** `findNotificationContext({ bookingId, cooperativeId })` → `{ ownerId, status, trip, passengers: [{ fullName }], totalPriceCents, currency }` o `null`. Sin cédulas.
- **Auth:** `findCustomerEmail(userId)` → correo de un usuario `CUSTOMER` activo o `null`.

### Configuración (sin números fijos en el código)

- `NOTIFICATIONS_WORKER_ENABLED` (`false` por defecto). Si es `true`, exige SMTP completo y `PUBLIC_WEB_ORIGIN` válido, igual que el trabajador de recuperación.
- `NOTIFICATIONS_POLL_MS` (5000), `NOTIFICATIONS_CLAIM_MS` (120000), `NOTIFICATIONS_MAX_ATTEMPTS` (5), `NOTIFICATIONS_RETRY_DELAYS_MINUTES` (`1,5,15,60`).

### Contenido de los avisos (texto plano)

- **Boletos listos.** Asunto: «Tus boletos de transViaje están listos». Tramo, fecha y hora de salida, número de pasajeros (nombres sin cédula), total y el enlace `${PUBLIC_WEB_ORIGIN}/pages/boletos.html?reserva=<id>`. Indica que el QR se ve al iniciar sesión.
- **Comprobante rechazado.** Asunto: «Tu comprobante de pago fue rechazado». Referencia de la reserva, justificación del CLERK y aviso de que los asientos se liberaron.
- **Reserva vencida.** Asunto: «Tu reserva venció». Referencia, tramo y aviso de que se liberaron los asientos por no recibir el comprobante dentro del plazo.

## 6. Endpoints

Ninguno nuevo. El trabajador corre dentro del proceso del servidor, como el de recuperación.

## 7. Criterios de aceptación

- [ ] Dado un comprobante aprobado, entonces existe un único aviso `TICKETS_READY` creado en la misma transacción; si la aprobación falla, no existe.
- [ ] Dado un rechazo, el aviso incluye la justificación; dado un vencimiento sin comprobante, se encola `BOOKING_EXPIRED`.
- [ ] Repetir la aprobación, el rechazo o el vencimiento no crea avisos duplicados.
- [ ] Con SMTP aceptando, el aviso queda `ACCEPTED`; con fallo temporal se reintenta según la configuración; con fallo permanente queda `FAILED`.
- [ ] El correo de boletos lleva el enlace con `PUBLIC_WEB_ORIGIN` y no incluye cédulas ni el código del QR.
- [ ] Con el trabajador apagado o sin SMTP, aprobar, rechazar y vencer funcionan igual y los avisos quedan `PENDING`.

## 8. Casos borde y errores

- Reserva de invitado o propietario sin correo de cliente: `SKIPPED`, sin reintentos.
- Reserva que ya no coincide con el aviso (por ejemplo, `TICKETS_READY` de una reserva no vendida): `FAILED` con código de integridad, sin enviar.
- Dos trabajadores a la vez: `SKIP LOCKED` garantiza que cada aviso se reclama una sola vez por ronda.
- Un fallo del trabajador nunca revierte la venta, el rechazo ni el vencimiento.

## 9. Pruebas esperadas

- **Unitarias:** textos de cada aviso, decisión de estado según el error del mailer, configuración y reclamo.
- **Integración (PostgreSQL aislado):** encolado atómico en aprobación, rechazo y vencimiento (incluida la reversión); unicidad; reclamo concurrente; reintentos y reclamo vencido; lecturas de Reservas y Auth.
- **Arranque real** con el trabajador apagado, y prueba manual con un buzón SMTP real usando `scripts/check-smtp.js` cuando haya credenciales.

## 10. Preguntas abiertas

- **Credenciales SMTP reales y buzón de prueba:** las configura quien administre el correo (Pablo, por CORREO-01).
- **Correos por pasajero o responsable:** requieren una spec de Reservas para pedir y guardar esos contactos.
- **Revisión de Pagos y Reservas:** Shirley y Leslie deben aceptar el encolado dentro de sus transacciones.

## 11. Defecto inducido

No aplica: por decisión de Edwin del 4 de noviembre de 2026, la entrega no incluye errores inducidos.

## 12. Diseño SOLID y usabilidad

- **Responsabilidades:** `notifications` es dueño de la tabla, del texto y del envío. Pagos y Reservas solo llaman `enqueueWith` con el cliente de su transacción; no escriben SQL de otro módulo. El mailer y las lecturas de Reservas y Auth entran como puertos.
- **Usabilidad:** asuntos claros, texto corto en español, referencia de la reserva y un único enlace de acción. Sin interfaz web nueva en esta tarea.

## 13. Plan y evidencias

| Incremento | Contenido                                                                    | Estado    |
| ---------- | ---------------------------------------------------------------------------- | --------- |
| T1         | Migración `email_notifications`, `enqueueWith` y lecturas de Reservas y Auth | Pendiente |
| T2         | Trabajador: reclamo, textos, envío, reintentos y configuración               | Pendiente |
| T3         | Encolado en la aprobación y el rechazo de Pagos                              | Pendiente |
| T4         | Encolado en el vencimiento de Reservas                                       | Pendiente |
| T5         | Composición en `server.js`, `.env.example` y arranque real                   | Pendiente |

Cada incremento se cierra con lint, formato y `npm test` (integración con PostgreSQL aislado y base nueva).
