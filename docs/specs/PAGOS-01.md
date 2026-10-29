# PAGOS-01: Subir comprobante de depósito o transferencia

- **ID local:** PAGOS-01
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `payments`
- **Alcance de commit:** `pagos`
- **Responsable:** Shirley
- **Revisor:** Pablo
- **Estado:** Borrador; T4 implementada en la rama de trabajo actualizada y pendiente de verificación de integración. Esta especificación no registra aprobaciones.

> Propuesta pendiente de revisión. Las decisiones pendientes de confirmación deben resolverse antes de implementar los puntos que afectan.

## 1. Objetivo

Permitir que un cliente envíe el comprobante de depósito o transferencia de su reserva dentro del plazo configurable. `payments` persiste el archivo y un aviso durable; solo la aceptación transaccional de `bookings` cuenta como recepción. Si la expiración gana la coordinación por reserva, `bookings` libera los asientos y rechaza definitivamente el aviso; `payments` compensa únicamente ante ese rechazo definitivo.

## 2. Reglas de negocio involucradas

- **RN-02:** los datos de cada cooperativa permanecen aislados. Para este flujo, `cooperative_id` se obtiene de la reserva consultada mediante el puerto de `payments`; nunca se toma del token ni del cuerpo HTTP.
- **RN-50:** el plazo configurable para subir el comprobante es de 180 a 300 segundos. BOOK-06 §2 y §4 concretan la unidad/rango, el cálculo a partir de un instante de inicio explícito y que no hay valor por defecto oculto.
- **RN-51:** vencido el plazo sin comprobante, la reserva expira y sus asientos vuelven a estar disponibles. La transición de reserva y liberación de asientos se coordina con `bookings`.

Las tres reglas citadas existen en `docs/business-rules.md` (RN-02, §2; RN-50 y RN-51, §7). BOOK-06 §2 aclara que un comprobante aceptado y en revisión no equivale a ausencia; `docs/reservas-decisiones.md`, “Reserva y pago”, especifica que los asientos se mantienen reservados mientras se revisa. Leslie y Shirley acordaron que la aceptación del comprobante y la expiración se serializan transaccionalmente por reserva; persistir un archivo en `payments` no constituye aceptación. Las firmas, parámetros y contexto autorizado del contrato quedan pendientes. Ver [BOOK-06](BOOK-06.md), [BOOK-07](BOOK-07.md) y la verificación de contrato de `docs/reservas-contratos.md`. PAGOS-01 no cubre bandeja, aprobación/rechazo ni emisión de boleto.

## 3. Alcance

**Incluye:** carga de un archivo de comprobante asociado a una reserva; validación de que la reserva pertenece al cliente autenticado, está vigente y admite el envío; persistencia de metadatos y ubicación del archivo; lectura del plazo y total mantenidos por `bookings`; estado `EXPIRED` tras aviso del coordinador de reservas.

**No incluye:** pago con tarjeta; revisión, aprobación o rechazo del comprobante; emisión de boleto/QR; venta en caja; ni gestión de bandeja. El aviso de aprobación de pago a `bookings` y la confirmación de venta pertenecen a PAGOS-02, coordinado con BOOK-07; PAGOS-01 solo cubre recepción del archivo. La compra como invitado está definida en `docs/reservas-decisiones.md`, “Pasajeros e invitados”; si PAGOS-01 se limita a `CUSTOMER`, eso es una propuesta de acceso que debe confirmarse y no una decisión pendiente sobre los datos/recuperación de invitado.

### Autenticación y autorización

La ruta protegida compone los middlewares existentes exportados por `backend/src/modules/auth/index.js`: `authenticate`, `authorize('CUSTOMER')` y `csrfProtection` para la operación de carga. `CUSTOMER` es el valor de rol definido en `auth/domain/identity.js` y usado por la sesión según `docs/autenticacion-ejecucion.md`. No se introduce autenticación, token, middleware ni mecanismo CSRF propio. La identidad del cliente viene del contexto autenticado. La autorización sobre la reserva se comprueba con el puerto definido en `payments/domain`; no se confía en identificadores o cooperativa enviados por el cliente.

## 4. Tareas

La spec puede dividirse después en specs independientes para carga y expiración. En esta propuesta ambos flujos quedan descritos para mantener explícita su coordinación.

### T1. Subir comprobante

1. Al abrir la ventana de pago de una reserva, `payments` mantiene un comprobante en estado `AWAITING_UPLOAD`, sin archivo asociado. El plazo pertenece a `bookings` y `payments` lo obtiene mediante `findForPayment`.
2. El cliente autenticado solicita la carga enviando el ID de reserva y un único archivo, con CSRF válido.
3. El caso de uso consulta la reserva mediante `findForPayment` (API pública de `bookings`) y comprueba propietario, estado vigente, cooperativa derivada de la reserva y fecha límite leída de esa misma reserva.
4. Si `now < expiresAt`, `payments` guarda primero el archivo y sus metadatos como `UPLOADED`, junto con un aviso pendiente persistente en un outbox, dentro de una transacción local. Si falla la persistencia, no notifica a `bookings` y limpia cualquier archivo temporal.
5. Después de confirmar esa persistencia, un proceso reintentable entrega el aviso mediante la operación pública que se acuerde con `bookings` (nombre propuesto: `markPaymentProofReceived`). La repetición usa la misma identidad idempotente. Los nombres de parámetros y el contexto autorizado siguen pendientes del contrato técnico.
6. `bookings` serializa por reserva la recepción y la expiración en su coordinación transaccional. Si acepta antes del vencimiento, conserva los asientos durante la revisión. Si la reserva ya expiró o el plazo venció antes de aceptar, responde con rechazo definitivo.
7. Ante timeout o resultado incierto, `payments` conserva el comprobante y el outbox, y reintenta la misma operación; no compensa. Si la primera llamada ya fue aceptada, el reintento devuelve ese resultado aceptado aunque llegue después del vencimiento.
8. Solo ante rechazo definitivo `payments` compensa el archivo y el estado persistido. La decisión de compensar no se deriva de un timeout.
9. `findForPayment` obtiene `expiresAt` calculado por reservas a partir del inicio explícito y el plazo en segundos. La carga solo se inicia antes del límite; en `now >= expiresAt` no se acepta una nueva recepción (BOOK-06 §4).

### T2. Registrar expiración del comprobante

1. El coordinador único de expiración de `bookings` (BOOK-06 §3, T2/T3) detecta y expira las reservas cuyo plazo venció sin comprobante, y libera sus asientos conforme a RN-51.
2. Cuando `bookings` notifica a `payments` que esa reserva expiró, `payments` actualiza el comprobante de `AWAITING_UPLOAD` a `EXPIRED`.
3. `payments` no ejecuta, programa ni duplica la expiración de reservas. T2 depende del aviso de reservas; BOOK-06/07 todavía no define el nombre ni firma del aviso de expiración a `payments`.

## 5. Datos

### Entrada y salida

| Dato | Tipo | Validación / origen |
|---|---|---|
| `bookingId` | UUID | Obligatorio en el multipart; identifica una reserva del cliente autenticado. El tipo/representación se confirma al cerrar el contrato. |
| `file` | binario multipart | Obligatorio en la carga; propuesta: PDF, JPEG o PNG, máximo 5 MiB, validando contenido además del `Content-Type`. |
| `customerId` | UUID | Solo del principal autenticado (`authenticate`); no se acepta en el cuerpo. |
| `cooperative_id` | UUID | Se deriva de la reserva devuelta por `findForPayment`; no se acepta del token ni del cuerpo. |
| Respuesta | JSON | Identificador del comprobante, estado y vencimiento `expiresAt` leído desde la reserva; el total validado también proviene de reservas cuando PAGOS-02 lo necesite. No devuelve ruta física ni URL interna del archivo. |

### Puerto de dominio

Definir en `payments/domain` un puerto de lectura llamado `findForPayment`, que consulte una reserva por `bookingId`. Devuelve solo los datos necesarios: identificador de reserva, comprador, cooperativa, estado, instante de inicio explícito, plazo en segundos, `expiresAt` y total guardados/calculados por `bookings`; el total se expresa en centavos enteros. La operación valida el contexto autorizado y la cooperativa de la reserva. El dominio de reservas aplica BOOK-06 §4: plazo entero entre 180 y 300 segundos, inicio explícito, reloj inyectado y cálculo de vencimiento sin valor por defecto oculto. `payments` consulta esos valores y no los recalcula ni mantiene copias en `payment_proofs`. El puerto no expone capas internas de `bookings`.

**Contrato según las specs de reservas:** BOOK-03 nombra la tabla `bookings` y una tabla/relación de ocupaciones sin definir su nombre ni esquema; indica que columnas y FKs con módulos ajenos están por definir. BOOK-06/07 describen plazo, expiración y confirmación; el mensaje de Leslie del 25 de octubre de 2026 acuerda los nombres `findForPayment`, `markPaymentProofReceived`, `confirmSale` y `releaseBooking`, pero no fija firmas, columnas, IDs o FKs. La tabla `payment_proofs`, sus columnas y su FK a `bookings` son propuestas de PAGOS-01, no identificadores fijados por Leslie. La integración usará la API pública de `bookings`.

### Migración propuesta

Tabla nueva `payment_proofs` (nombre propuesto por PAGOS-01, sujeto a convenciones y revisión), plural y `snake_case`. BOOK-03 sí nombra la tabla `bookings`, pero no define sus columnas, IDs ni FKs con pagos; esos elementos del vínculo se deben precisar en el contrato técnico. No se propone alterar migraciones existentes.

| Campo | Tipo propuesto | Restricción / propósito |
|---|---|---|
| `id` | UUID | PK, generado por la base |
| `booking_id` | UUID | NOT NULL; referencia propuesta a `bookings` (tabla nombrada por BOOK-03); BOOK-03 no especifica la columna ID, FK ni cardinalidad |
| `cooperative_id` | UUID | NOT NULL; valor copiado de la reserva; columna/FK/tabla destino no especificadas en BOOK-03 |
| `status` | TEXT | NOT NULL; CHECK en `AWAITING_UPLOAD` (ventana abierta sin archivo), `UPLOADED` (archivo subido, a la espera de PAGOS-02), `EXPIRED` (Expirado) |
| `file_key` | TEXT | NULL mientras no se haya cargado; clave opaca del almacenamiento, nunca ruta recibida del cliente |
| `original_file_name` | TEXT | NULL antes de carga; nombre saneado solo como metadato |
| `media_type` | TEXT | NULL antes de carga; tipo determinado/validado por servidor |
| `file_size_bytes` | BIGINT | NULL antes de carga; tamaño comprobado por servidor |
| `uploaded_at` | TIMESTAMPTZ | NULL hasta carga correcta |
| `expired_at` | TIMESTAMPTZ | NULL hasta expiración |
| `created_at` / `updated_at` | TIMESTAMPTZ | NOT NULL |

Índice propuesto para encontrar comprobantes que esperan carga: `(status, booking_id)`. Plazo y total viven únicamente en la reserva y se obtienen a través de `findForPayment`; no se duplican en `payment_proofs`. La retención y el borrado del archivo son decisiones abiertas. **Propuesta de almacenamiento:** disco local privado, fuera del directorio público; en BD solo `file_key` y metadatos. Definir un puerto de almacenamiento en payments y un adaptador local sustituible. No guardar bytes en PostgreSQL ni aceptar una URL/ruta suministrada por el cliente.

### Aviso durable a reservas

El aviso de comprobante recibido debe guardarse en un outbox persistente junto con el cambio a `UPLOADED`, dentro de la misma transacción local de payments. El outbox permite reintentar después de reinicios y conserva una identidad estable para repetir la misma operación idempotente. El detalle de tabla, columnas, proceso de reintento y estados terminales se define en la tarea de persistencia del outbox; no se guarda el aviso solo en memoria. El outbox no convierte el archivo en una recepción aceptada por `bookings`.

## 6. Endpoints

| Método | Ruta | Roles | Respuestas |
|---|---|---|---|
| POST | `/api/v1/payment-proofs` | `CUSTOMER`; `authenticate`, `authorize('CUSTOMER')`, `csrfProtection` | 201, 400, 401, 403, 404, 409, 413, 415, 422, 500 |

La solicitud usa `multipart/form-data` con `bookingId` y `file`. Respuesta `201` propuesta: `{ "paymentProof": { "id": "…", "status": "UPLOADED", "expiresAt": "…" } }`; `expiresAt` se lee de la reserva. El total se obtiene de la reserva cuando lo requiera el flujo posterior. Para reserva inexistente o que no pertenece al cliente, propuesta: misma respuesta 404 para no revelar existencia de reservas ajenas. `403` incluye `CSRF_TOKEN_INVALID` cuando el CSRF falta o no coincide. Códigos de error funcionales restantes se definirán en el diseño de implementación conforme al formato único de arquitectura (`{ "error": { "code", "message" } }`). No se crea endpoint de aprobación/rechazo ni de boletos. La ruta, el nombre multipart `bookingId` y la operación notificada a bookings son propuestas de PAGOS-01: BOOK-01/03/06/07 no las define.

## 7. Criterios de aceptación

- [ ] **Dado** un cliente autenticado dueño de una reserva vigente y una ventana de pago abierta, **cuando** envía un archivo permitido con CSRF válido, **entonces** se guarda el archivo en almacenamiento privado, queda asociado a la reserva y responde 201 con estado `UPLOADED`.
- [ ] **Dado** un `cooperative_id` distinto en el cuerpo o token, **cuando** se procesa la carga, **entonces** se ignora ese valor y se persiste únicamente el `cooperative_id` obtenido de la reserva mediante `findForPayment`.
- [ ] **Dado** un cliente que no es propietario de la reserva, **cuando** intenta cargar un archivo, **entonces** la operación no revela ni modifica la reserva ajena y responde 404 según la propuesta.
- [ ] **Dado** una solicitud sin sesión válida, **cuando** intenta cargar un comprobante, **entonces** `authenticate` la rechaza según el contrato existente de auth.
- [ ] **Dado** un `CUSTOMER` autenticado sin CSRF válido, **cuando** envía la carga, **entonces** `csrfProtection` responde 403 `CSRF_TOKEN_INVALID` y no se persiste archivo ni metadatos.
- [ ] **Dado** un archivo persistido, **cuando** payments registra `UPLOADED`, **entonces** persiste también el aviso pendiente en el outbox en la misma transacción local; un reinicio no lo pierde.
- [ ] **Dado** un aviso pendiente, **cuando** se reintenta, **entonces** payments repite la misma operación idempotente contra reservas.
- [ ] **Dado** que reservas acepta la recepción antes del límite, **cuando** el coordinador intenta expirar la reserva, **entonces** conserva los asientos durante la revisión.
- [ ] **Dado** que expiración gana la coordinación antes de aceptar la recepción, **cuando** payments reintenta el aviso, **entonces** reservas devuelve rechazo definitivo y payments compensa el archivo y su estado persistido.
- [ ] **Dado** que el aviso termina en timeout, **cuando** payments lo procesa, **entonces** conserva el comprobante y el outbox, reintenta idempotentemente y no compensa por incertidumbre.
- [ ] **Dado** que reservas aceptó el aviso pero se perdió la respuesta, **cuando** el reintento llega después del vencimiento, **entonces** recibe el resultado aceptado y la reserva no se expira.
- [ ] **Dado** un precio total asociado a la reserva, **cuando** payments recibe y guarda el comprobante, **entonces** conserva el total en centavos enteros devuelto por `findForPayment`, sin recalcularlo ni persistir una copia en `payment_proofs`.
- [ ] **Dada** una reserva con plazo configurable de 180 a 300 segundos y un inicio explícito, **cuando** `payments` consulta `findForPayment`, **entonces** usa el `expiresAt` de reservas, no calcula ni persiste vencimiento propio y no recurre a valores por defecto ocultos.
- [ ] **Dado** un comprobante recibido dentro del plazo y en revisión, **cuando** el coordinador de reservas evalúa la ausencia de comprobante, **entonces** no expira la reserva: un comprobante en revisión no equivale a ausencia (BOOK-06 §2).
- [ ] **Dada** una reserva con ventana vencida sin archivo, **cuando** el coordinador de `bookings` aplica RN-51 y avisa a payments, **entonces** payments cambia el comprobante de `AWAITING_UPLOAD` a `EXPIRED` sin expirar de nuevo la reserva.
- [ ] **Dada** una notificación de expiración ya aplicada, **cuando** bookings la reintenta, **entonces** la actualización en payments es idempotente y no altera otra reserva ni un comprobante `UPLOADED`.
- [ ] **Dada** una solicitud de carga a la hora límite o después, **cuando** se evalúa usando la hora del servidor, **entonces** no se acepta como `UPLOADED`, no extiende el plazo y la reserva sigue el flujo de expiración.
- [ ] **Dado** un archivo ausente, vacío, demasiado grande o de tipo/contenido no permitido, **cuando** se valida la solicitud, **entonces** se rechaza con el error HTTP acordado sin dejar archivo huérfano ni registro parcialmente actualizado.
- [ ] **Dado** un comprobante en estado `UPLOADED`, **cuando** el coordinador de reservas evalúa qué reservas expirar, **entonces** no expira esa reserva; la revisión corresponde a PAGOS-02.

## 8. Casos borde y errores

- Dos cargas concurrentes para la misma reserva: solo una puede completar; BOOK-03 nombra `bookings` y ocupaciones, pero no define tabla de ocupaciones, esquema, cardinalidad ni bloqueo.
- Carrera entre recepción y expiración: ambas operaciones se serializan transaccionalmente por reserva. La que se confirma primero determina el resultado: recepción aceptada conserva asientos; expiración ganadora produce rechazo definitivo. Persistir `UPLOADED` sin aceptación de reservas no impide la expiración.
- Límite exacto: una recepción nueva solo puede aceptarse si la operación de reservas la confirma antes de `expiresAt`; en `now >= expiresAt` la expiración puede ganar (BOOK-06 §4). Un reintento de una aceptación ya confirmada devuelve aceptación incluso después del plazo.
- Reserva ya cancelada, expirada o en estado que no admita pago: rechazar sin guardar archivo. Estados y códigos concretos dependen del contrato con Leslie.
- Reserva no encontrada y reserva de otro cliente: respuesta indistinguible según propuesta 404.
- Reserva sin instante de inicio, plazo explícito o `expiresAt`, o con plazo fuera de 180–300 segundos: fallo de contrato explícito; payments no aplica un valor por defecto.
- Fallo al guardar el archivo o al persistir comprobante/outbox: no enviar aviso; limpiar cualquier archivo temporal o huérfano.
- Timeout del aviso: resultado incierto, conservar estado/outbox y reintentar la misma operación idempotente; nunca borrar el comprobante por timeout.
- El archivo no puede servirse públicamente ni ejecutarse desde el servidor; nombre original, extensión o MIME enviados por el cliente no se consideran confiables.
- Si la reserva expiró pero su aviso a `payments` aún no llegó, una carga posterior no debe revivirla; payments consulta el estado con `findForPayment` y acepta el aviso idempotente de `bookings`.
- Si `bookings` devuelve rechazo definitivo porque expiró la reserva o venció el plazo antes de aceptar, `payments` compensa el archivo y revierte/no persiste el cambio a `UPLOADED`; nunca compensa por timeout o respuesta incierta.
- `findForPayment`, `markPaymentProofReceived`, `confirmSale` y `releaseBooking` validan el contexto autorizado y la cooperativa correspondiente antes de consultar o modificar la reserva.
- `releaseBooking` no libera una reserva si tiene un comprobante en revisión ni si la venta ya fue confirmada.

## 9. Pruebas esperadas

- **Unitarias (`backend/tests/unit/payments/`):** carga válida; propietario correcto/incorrecto; cooperativa, plazo, `expiresAt` y total en centavos enteros derivados de reserva mediante `findForPayment`; reloj del servidor; límites 180/300 y valores fuera de rango; persistencia del outbox junto con `UPLOADED`; reintento idempotente; timeout sin compensación; rechazo definitivo con compensación; tipos/tamaño; puertos simulados.
- **Integración (`backend/tests/integration/payments/`):** persistencia transaccional del comprobante y outbox; outbox recuperable tras reinicio; parámetros y aislamiento cuando se cierre el contrato; límite exacto; rechazo definitivo tras expiración; timeout y reintento; respuesta perdida después de aceptación; sin compensación por resultado incierto. La coordinación de concurrencia real se verifica junto con BOOK-06 en PostgreSQL.
- **Concurrencia/flujo:** competir recepción y expiración por la misma reserva y verificar una sola transición; probar límite exacto y reintento idempotente tras perder respuesta; confirmar que payments no expira reservas por sí mismo.

## 10. Decisiones

### Acordado con Leslie

| Tema | Decisión documentada | Fuente |
|---|---|---|
| Plazo | Reservas es dueña del plazo: configuración explícita en segundos entre 180 y 300; el caso de uso determina el instante inicial y el dominio calcula `expiresAt` con reloj explícito, sin valor por defecto oculto. | [BOOK-06 §2–5](BOOK-06.md); [reservas-decisiones.md, “Reserva y pago”](../reservas-decisiones.md) |
| Total | El cálculo se determina en servidor; el resumen de reserva registra base, descuento y total. Los nombres de las columnas no constan en estas specs. | [BOOK-03 §4–7](BOOK-03.md); [reservas-decisiones.md, “Tarifas y acreditación”](../reservas-decisiones.md) |
| Comprobante en revisión | La regla de reserva es que un comprobante recibido a tiempo mantiene los asientos reservados durante la revisión y no es ausencia de comprobante. | [BOOK-06 §2, §7](BOOK-06.md); [reservas-decisiones.md, “Reserva y pago”](../reservas-decisiones.md) |
| Expiración y liberación | BOOK-06 asigna a reservas T2 (expiración atómica e idempotente) y T3 (ejecución periódica); la expiración por RN-51 libera asientos transaccionalmente. | [BOOK-06 §3, §7](BOOK-06.md); [reservas-decisiones.md, “Reserva y pago”](../reservas-decisiones.md) |
| Coordinación de recepción y expiración | Ambas operaciones se serializan transaccionalmente por reserva. Si `bookings` acepta la recepción antes del vencimiento, conserva los asientos durante la revisión; si la reserva expiró o venció el plazo antes de aceptar, responde rechazo definitivo. Un reintento idempotente de una recepción aceptada devuelve aceptación aunque llegue después del plazo. Ante timeout, payments conserva el comprobante y reintenta; solo compensa por rechazo definitivo. Las firmas, parámetros y contexto autorizado siguen pendientes. | Respuesta de Leslie compartida por Shirley, 26 de octubre de 2026; [BOOK-06](BOOK-06.md) y [BOOK-07](BOOK-07.md). |
| Persistencia del aviso | El aviso pendiente se guarda en un outbox durable junto con `UPLOADED`, en la misma transacción local, para sobrevivir reinicios y reintentarse con identidad estable. | Respuesta de Leslie compartida por Shirley, 26 de octubre de 2026. |
| Operaciones públicas de reservas para pagos | Nombres propuestos: `findForPayment`, `markPaymentProofReceived`, `confirmSale` y `releaseBooking`; las operaciones deben validar contexto autorizado y cooperativa. `findForPayment` devuelve el total en centavos enteros. Los parámetros y contexto se cierran en el contrato entre módulos. | Mensaje de Leslie, 25 de octubre de 2026, y coordinación posterior del 26 de octubre de 2026. |
| Confirmación de venta | La conversión a vendido por `confirmSale` es transaccional e idempotente. | [BOOK-07 §1, §3, §7](BOOK-07.md); mensaje de Leslie, 25 de octubre de 2026. |

### Supuestos de implementación T4

- **Idempotencia local:** se permite un solo comprobante por reserva, acorde con la restricción única propuesta sobre `booking_id`; los reintentos reutilizan la identidad de reserva/comprobante existente y nunca reemplazan el archivo ya persistido.
- **Outbox local:** `payment_proof_notification_outbox` guarda `payment_proof_id` como vínculo lógico único a `payment_proofs`, sin FK física. Ambas filas se crean en una transacción y la compensación las elimina explícitamente en una transacción. Así, los módulos que limpian sus tablas de prueba no quedan acoplados a la tabla interna del outbox. Sus estados son `PENDING` y `DELIVERED`; los reintentos conservan el mismo `bookingId`.
- **Relación con cooperativas:** `cooperative_id` se persiste como dato derivado de la reserva autorizada y no tendrá FK física a `cooperatives`. La propiedad y el aislamiento se validan antes de persistir mediante el puerto de lectura de reservas. Supuesto técnico para que el esquema de payments no imponga dependencias de truncado o reversión a las pruebas y migraciones de otros módulos.
- **Migración de pagos:** las dos tablas de PAGOS-01 se crean y revierten en una sola migración nueva, con identificador posterior a las migraciones ya existentes. No se retrofechan migraciones para acomodar pruebas globales. Supuesto técnico para preservar el orden de despliegue y el historial de `node-pg-migrate`.
- **Resultado incierto:** un timeout o error de transporte después de persistir deja `UPLOADED` y el aviso pendiente para reintento; no se borra el archivo ni el comprobante.
- **Commit incierto:** si se pierde la respuesta al confirmar la transacción local, se conserva el archivo. El siguiente intento consulta el comprobante persistido y continúa desde ese registro; solo se elimina el archivo cuando se confirma que la persistencia falló antes del commit.
- **Rechazo definitivo:** el adaptador de reservas representa explícitamente este resultado como rechazo tipado. Solo ese resultado permite compensar la persistencia local y borrar el archivo.
- **Contrato simulado:** hasta que BOOKINGS publique las firmas y el contexto autorizado, T4 prueba `BookingReader` y `BookingPaymentProofNotifier` con adaptadores simulados de `payments`, sin cambiar `bookings` ni afirmar una integración real.

Estos son supuestos técnicos para completar PAGOS-01; no cambian BOOK-06/07 ni constituyen aprobación de la spec.

### Propuesto, pendiente de confirmación

| Tema | Propuesta | Diferencia / estado frente a las specs de Leslie |
|---|---|---|
| Consultar reserva | `findForPayment` expone a payments una lectura autorizada de la reserva, con la información mínima necesaria. | Mensaje de Leslie, 25 de octubre de 2026. |
| P3 — tarjeta | Dejar tarjeta fuera de PAGOS-01. | Fuera de alcance de esta spec. |
| P4 — precio | Usar el total guardado en la reserva; payments no lo recalcula. | Basado en el resumen del servidor y total/desglose decidido en BOOK-03 §4 y reservas-decisiones.md, “Tarifas y acreditación”; BOOK-05 no define campo ni contrato con pagos. |
| P7 — venta en caja | Definirla en una spec aparte. | No está dentro de BOOK-03/06/07. |
| Invitado (P8) | La política de invitado definida en reservas-decisiones.md se conserva. Para este endpoint, el acceso solo `CUSTOMER` queda como propuesta hasta confirmar cómo se autoriza al invitado. | El endpoint de reserva BOOK-03 §6 mantiene identidad/propiedad invitada pendiente; la decisión de producto de invitado está en reservas-decisiones.md, “Pasajeros e invitados”. Limitar carga a `CUSTOMER` no está resuelto por esas fuentes. |
| Endpoint de carga | `POST /api/v1/payment-proofs`, multipart con campos `bookingId` y `file`. | BOOK-03 §6 propone `POST /api/v1/bookings` para crear reservas, pero no define endpoint de pagos; esta ruta y sus campos son propuestas de PAGOS-01. |
| Archivo | PDF/JPEG/PNG, máximo 5 MiB, validando contenido; disco local privado fuera del directorio público, con puerto de almacenamiento y adaptador local sustituible. | No definido en BOOK-01/03/06/07. |
| Nombre y firma de la operación de recepción | `markPaymentProofReceived` es nombre propuesto para el puerto; parámetros, contexto autorizado, resultado tipado y correlación exacta se cerrarán en el contrato técnico. | BOOK-06 y BOOK-07; Leslie confirmó el comportamiento transaccional el 26 de octubre de 2026, no la firma. |
| Aviso de expiración hacia payments | Propuesta: reservas notifica la expiración y payments registra `EXPIRED`; payments no ejecuta ni programa la tarea de expiración. | BOOK-06 §3/6 no define la notificación entrante ni su función/firma; es una coordinación técnica por concretar en BOOK-06/07. |
| Coordinación de aprobación | El aviso de aprobación desde payments a reservas, incluida la llamada a `confirmSale`, pertenece a PAGOS-02; PAGOS-01 solo notifica recepción. `confirmSale` valida contexto autorizado y cooperativa, y es transaccional e idempotente. | Mensaje de Leslie, 25 de octubre de 2026; BOOK-07 §1/3 define la confirmación desde pagos como integración posterior. |
| Rechazo justificado y liberación | Un rechazo autorizado con justificación libera la reserva transaccionalmente; una reserva que sigue en revisión conserva sus asientos y una venta confirmada no se libera. La operación, firma y autorización concreta pertenecen a una spec de rechazo separada. | Confirmación de Leslie compartida por Shirley, 26 de octubre de 2026; regla de rechazo en `docs/reservas-decisiones.md`. |
| Tablas y referencias | `bookings` es el nombre indicado en BOOK-03; mantener `payment_proofs` como tabla propuesta por PAGOS-01. | BOOK-03 §5 deja las columnas/FKs por definir y solo nombra “ocupaciones” sin nombre de tabla/relación ni esquema. |
| Registro inicial | Crear/localizar `AWAITING_UPLOAD` al abrir la ventana; plazo e importe siguen en la reserva. | BOOK-03/06 no especifica qué módulo crea el registro ni su cardinalidad. |

### Resuelto en `reservas-decisiones.md`, fuera del alcance de PAGOS-01

- **Invitado:** se definieron nombre, correo de contacto y recuperación por enlace secreto, sin cuenta automática ni acceso solo por cédula/UUID. Fuente: [“Pasajeros e invitados”](../reservas-decisiones.md). La política está resuelta como decisión de producto; autenticación y contrato del endpoint siguen aparte.
- **Rechazo:** exige justificación, finaliza la reserva como rechazada y libera asientos atómicamente; un nuevo intento requiere reserva nueva. Fuente: [“Reserva y pago”](../reservas-decisiones.md). La operación de rechazo pertenece a otra spec de pagos, no a PAGOS-01.
- **Comprobante en revisión:** si llega dentro del plazo, se mantienen los asientos reservados; no se venden antes de aprobación y no vence como ausencia de comprobante. Fuentes: [BOOK-06 §2](BOOK-06.md) y [“Reserva y pago”](../reservas-decisiones.md).

### Pendiente fuera de PAGOS-01

- **Carga tardía:** la política de producto indica no reactivar reservas vencidas, responder conflicto y orientar a atención de personal si hubo transferencia real, sin prometer devolución automática. Fuente: [“Reserva y pago”](../reservas-decisiones.md); BOOK-06 §8 y BOOK-07 §10 dejan por acordar el manejo integrado/reintentos. No se implementa aquí.
- **Tiempo de revisión:** no se define un plazo automático para rechazo o fin de revisión; corresponde al proceso operativo. Fuente: [“Reserva y pago”](../reservas-decisiones.md). No agregar expiración automática de comprobantes `UPLOADED` en PAGOS-01.
- **Atomicidad de aprobación y expiración:** confirmar venta y expirar deben competir bajo una condición transaccional común. BOOK-07 aún debe definir su contrato público, límites, reintentos y recuperación. La coordinación de recepción/expiración sí está acordada y se registra arriba. Fuente: [“Reserva y pago”](../reservas-decisiones.md) y [BOOK-07](BOOK-07.md); corresponde a PAGOS-02/BOOK-07, no a la implementación de PAGOS-01.
## 11. Verificación de contrato

Comprobaciones de `docs/reservas-contratos.md`, “Verificación que se necesita para aceptar el contrato”, aplicables al flujo de pagos:

- [ ] Una reserva/viaje no comercializable o inexistente se rechaza sin filtrar datos internos; no se cruzan cooperativas ni datos de otra reserva.
- [ ] Un tramo inválido se rechaza antes de consultar ocupaciones; el comprobante no elude la validación del tramo.
- [ ] No se cruzan cooperativas ni datos personales entre reservas.
- [ ] La liberación respeta ocupaciones por tramo: asientos en tramos adyacentes no colisionan; tramos superpuestos sí.
- [ ] La disponibilidad es informativa; BOOK-03 revalida y bloquea los asientos de la reserva en una sola transacción. La carga del comprobante no sustituye esa validación.
- [ ] La recepción aceptada, la expiración y su reintento compiten por la misma reserva conforme al resultado transaccional acordado en BOOK-06.
- [ ] Una respuesta repetida de pagos no duplica ventas ni libera una reserva confirmada.
- [ ] Solo reservas ejecuta el proceso de expiración/liberación; payments recibe el resultado y registra el estado correspondiente.

## 12. Dependencias

- **Requiere:** AUTH-01/AUTH-02 y la API pública existente de `auth/index.js` para autenticación, autorización y CSRF; INFRA-01 y migraciones/BD disponibles.
- **Requiere coordinación con `bookings`:** contrato público idempotente de consulta, expiración/liberación, confirmación de venta y aviso de comprobante recibido; BOOK-01/03/06/07 todavía no documentan nombres ni firmas.
- **Requiere la tarea de reservas BOOK-06:** un único coordinador de expiración; payments procesa el aviso y no programa su propio proceso.
- **Propone para etapa posterior:** PAGOS-02 consume comprobantes `UPLOADED`; PAGOS-03 y BOLETOS-01/02 dependen de la aprobación que corresponda; la venta en caja necesita una spec separada.

## 13. Defecto inducido

**No aplica.**

## 14. Evidencia local de implementación T4

La rama `feature/PAGOS-01-subir-comprobante-actualizado` parte de `origin/develop` en `e556e59`. La integración de Edwin para la reversión por migración objetivo está presente en esa base. El adaptador de lectura/notificación de `bookings` permanece simulado conforme al alcance T4; las firmas y el contexto autorizado del contrato real siguen pendientes.

- Lint: aprobado en la rama actualizada.
- Pruebas unitarias: 41 suites y 564 pruebas aprobadas.
- Integración: pendiente. `docker compose -f docker-compose.test.yml up -d --wait` no pudo conectar con `dockerDesktopLinuxEngine`; no se ejecutaron pruebas de integración contra esta rama actualizada.
- Las suites y pruebas de otros módulos no se editaron. La prueba de Fleet `a78c750` ya está integrada en la base y se verificó previamente junto con pagos y hojas de ruta sobre la base anterior: 13 suites y 116 pruebas aprobadas. Ese resultado anterior no sustituye la integración pendiente de esta rama.
- No se ha publicado la rama ni abierto PR. Se requiere completar la integración en la base actual y revisión humana.
