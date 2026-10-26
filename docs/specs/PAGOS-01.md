# PAGOS-01: Subir comprobante de depósito o transferencia

- **ID local:** PAGOS-01
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `payments`
- **Alcance de commit:** `pagos`
- **Responsable:** Shirley
- **Revisor:** Pablo
- **Estado:** Borrador

> Propuesta pendiente de revisión. Las decisiones pendientes de confirmación deben resolverse antes de implementar los puntos que afectan.

## 1. Objetivo

Permitir que un cliente envíe el comprobante de depósito o transferencia de su reserva dentro del plazo configurable. Si vence sin comprobante, el coordinador de `bookings` expira la reserva y libera los asientos; `payments` registra `EXPIRED` cuando recibe el aviso de reservas.

## 2. Reglas de negocio involucradas

- **RN-02:** los datos de cada cooperativa permanecen aislados. Para este flujo, `cooperative_id` se obtiene de la reserva consultada mediante el puerto de `payments`; nunca se toma del token ni del cuerpo HTTP.
- **RN-50:** el plazo configurable para subir el comprobante es de 180 a 300 segundos. BOOK-06 §2 y §4 concretan la unidad/rango, el cálculo a partir de un instante de inicio explícito y que no hay valor por defecto oculto.
- **RN-51:** vencido el plazo sin comprobante, la reserva expira y sus asientos vuelven a estar disponibles. La transición de reserva y liberación de asientos se coordina con `bookings`.

Las tres reglas citadas existen en `docs/business-rules.md` (RN-02, §2; RN-50 y RN-51, §7). BOOK-06 §2 aclara que un comprobante en revisión no equivale a ausencia; `docs/reservas-decisiones.md`, “Reserva y pago”, especifica que los asientos se mantienen reservados mientras se revisa. La carrera entre recepción del comprobante y expiración debe comprobarse con la verificación de contrato de `docs/reservas-contratos.md`. PAGOS-01 no cubre bandeja, aprobación/rechazo ni emisión de boleto.

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
4. Si la reserva sigue dentro del plazo, el caso de uso guarda el archivo mediante el puerto de almacenamiento sustituible, actualiza metadatos y cambia el comprobante a `UPLOADED` (archivo recibido, a la espera de PAGOS-02).
5. Payments envía el **aviso de comprobante recibido (`hasPaymentProof`)** a `bookings` mediante `markPaymentProofReceived`. La operación es idempotente y valida el contexto autorizado y la cooperativa de la reserva. BOOK-06 §2 exige que un comprobante en revisión no se interprete como ausencia.
6. `findForPayment` obtiene el vencimiento `expiresAt` calculado por reservas a partir del inicio explícito y el plazo en segundos. Payments compara ese valor con la hora del servidor; se admite la carga solo si `now < expiresAt`, pues al llegar al límite ya venció (BOOK-06 §4).

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
- [ ] **Dado** un comprobante cargado correctamente dentro del plazo, **cuando** pasa a `UPLOADED`, **entonces** payments notifica la recepción a reservas por `markPaymentProofReceived`, operación idempotente que valida el contexto autorizado y la cooperativa.
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
- Carrera entre carga y expiración en el instante límite: aceptar solo si `now < expiresAt` leído de la reserva; al llegar exactamente al límite ya venció (BOOK-06 §4). La resolución atómica corresponde al coordinador de `bookings`; BOOK-06 §10 y BOOK-07 §10 dejan el protocolo intermodular por acordar.
- Reserva ya cancelada, expirada o en estado que no admita pago: rechazar sin guardar archivo. Estados y códigos concretos dependen del contrato con Leslie.
- Reserva no encontrada y reserva de otro cliente: respuesta indistinguible según propuesta 404.
- Reserva sin instante de inicio, plazo explícito o `expiresAt`, o con plazo fuera de 180–300 segundos: fallo de contrato explícito; payments no aplica un valor por defecto.
- Fallo de almacenamiento local, de base de datos o de notificación entre módulos: limpiar archivo temporal si no se confirmó la operación; reintentar el aviso idempotente sin ejecutar expiración desde `payments`.
- El archivo no puede servirse públicamente ni ejecutarse desde el servidor; nombre original, extensión o MIME enviados por el cliente no se consideran confiables.
- Si la reserva expiró pero su aviso a `payments` aún no llegó, una carga posterior no debe revivirla; payments consulta el estado con `findForPayment` y acepta el aviso idempotente de `bookings`.
- Si `bookings` rechaza `markPaymentProofReceived` porque venció el plazo, `payments` compensa la carga: borra el archivo guardado y revierte/no persiste el cambio de estado, de modo que el comprobante no queda en `UPLOADED`.
- `findForPayment`, `markPaymentProofReceived`, `confirmSale` y `releaseBooking` validan el contexto autorizado y la cooperativa correspondiente antes de consultar o modificar la reserva.
- `releaseBooking` no libera una reserva si tiene un comprobante en revisión ni si la venta ya fue confirmada.

## 9. Pruebas esperadas

- **Unitarias (`backend/tests/unit/payments/`):** carga válida; propietario correcto/incorrecto; cooperativa, plazo, `expiresAt` y total en centavos enteros derivados de reserva mediante `findForPayment`; reloj del servidor; límites 180/300 y valores fuera de rango; ausencia de valor por defecto; comprobante en revisión impide tratar la reserva como carente de comprobante; transiciones `AWAITING_UPLOAD` → `UPLOADED` y `AWAITING_UPLOAD` → `EXPIRED` tras aviso de reservas; compensación si vence el plazo y bookings rechaza el aviso; tipos/tamaño; puertos de almacenamiento y lectura simulados.
- **Integración (`backend/tests/integration/payments/`):** ruta propuesta protegida con auth; 401 sin sesión, 403 por CSRF inválido y rechazo de rol distinto de `CUSTOMER`; multipart con `bookingId` y `file`; aislamiento de reserva; persistencia sin columnas de plazo ni total en `payment_proofs`; límite/formato; migración/índice; recepción idempotente del aviso de expiración de `bookings`; eliminación del archivo y ausencia de estado `UPLOADED` si `markPaymentProofReceived` rechaza por plazo vencido. La expiración y liberación se verifican mediante el coordinador de reservas y su contrato integrado.
- **Concurrencia/flujo:** carrera entre carga y aviso de expiración, duplicación de avisos y confirmación idempotente de venta a través de la API pública de reservas; verificar que payments no expira ni confirma venta por sí mismo.

## 10. Decisiones

### Acordado con Leslie

| Tema | Decisión documentada | Fuente |
|---|---|---|
| Plazo | Reservas es dueña del plazo: configuración explícita en segundos entre 180 y 300; el caso de uso determina el instante inicial y el dominio calcula `expiresAt` con reloj explícito, sin valor por defecto oculto. | [BOOK-06 §2–5](BOOK-06.md); [reservas-decisiones.md, “Reserva y pago”](../reservas-decisiones.md) |
| Total | El cálculo se determina en servidor; el resumen de reserva registra base, descuento y total. Los nombres de las columnas no constan en estas specs. | [BOOK-03 §4–7](BOOK-03.md); [reservas-decisiones.md, “Tarifas y acreditación”](../reservas-decisiones.md) |
| Comprobante en revisión | La regla de reserva es que un comprobante recibido a tiempo mantiene los asientos reservados durante la revisión y no es ausencia de comprobante. | [BOOK-06 §2, §7](BOOK-06.md); [reservas-decisiones.md, “Reserva y pago”](../reservas-decisiones.md) |
| Expiración y liberación | BOOK-06 asigna a reservas T2 (expiración atómica e idempotente) y T3 (ejecución periódica); la expiración por RN-51 libera asientos transaccionalmente. | [BOOK-06 §3, §7](BOOK-06.md); [reservas-decisiones.md, “Reserva y pago”](../reservas-decisiones.md) |
| Operaciones públicas de reservas para pagos | `findForPayment`, `markPaymentProofReceived`, `confirmSale` y `releaseBooking`; todas validan contexto autorizado y cooperativa. `findForPayment` devuelve el total en centavos enteros. `markPaymentProofReceived` es idempotente y comprueba el plazo con la hora del servidor; si bookings rechaza el aviso porque venció, payments borra el archivo y no deja el comprobante en `UPLOADED`. `releaseBooking` no libera con comprobante en revisión ni venta confirmada. | Mensaje de Leslie, 25 de octubre de 2026. |
| Confirmación de venta | La conversión a vendido por `confirmSale` es transaccional e idempotente. | [BOOK-07 §1, §3, §7](BOOK-07.md); mensaje de Leslie, 25 de octubre de 2026. |

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
| Aviso de comprobante recibido | Payments envía a reservas el aviso de comprobante recibido mediante `markPaymentProofReceived`, idempotente y sujeto a validación de plazo con la hora del servidor. Si bookings lo rechaza por plazo vencido, payments elimina el archivo y evita el estado `UPLOADED`. | Mensaje de Leslie, 25 de octubre de 2026; BOOK-06 §5 usa `hasPaymentProof` como entrada de la política. |
| Aviso de expiración hacia payments | Propuesta: reservas notifica la expiración y payments registra `EXPIRED`; payments no ejecuta ni programa la tarea de expiración. | BOOK-06 §3/6 no define la notificación entrante ni su función/firma; es una coordinación técnica por concretar en BOOK-06/07. |
| Coordinación de aprobación | El aviso de aprobación desde payments a reservas, incluida la llamada a `confirmSale`, pertenece a PAGOS-02; PAGOS-01 solo notifica recepción. `confirmSale` valida contexto autorizado y cooperativa, y es transaccional e idempotente. | Mensaje de Leslie, 25 de octubre de 2026; BOOK-07 §1/3 define la confirmación desde pagos como integración posterior. |
| Liberación de reserva | `releaseBooking` valida contexto autorizado y cooperativa; no libera una reserva con comprobante en revisión ni con venta confirmada. | Mensaje de Leslie, 25 de octubre de 2026. |
| Tablas y referencias | `bookings` es el nombre indicado en BOOK-03; mantener `payment_proofs` como tabla propuesta por PAGOS-01. | BOOK-03 §5 deja las columnas/FKs por definir y solo nombra “ocupaciones” sin nombre de tabla/relación ni esquema. |
| Registro inicial | Crear/localizar `AWAITING_UPLOAD` al abrir la ventana; plazo e importe siguen en la reserva. | BOOK-03/06 no especifica qué módulo crea el registro ni su cardinalidad. |

### Resuelto en `reservas-decisiones.md`, fuera del alcance de PAGOS-01

- **Invitado:** se definieron nombre, correo de contacto y recuperación por enlace secreto, sin cuenta automática ni acceso solo por cédula/UUID. Fuente: [“Pasajeros e invitados”](../reservas-decisiones.md). La política está resuelta como decisión de producto; autenticación y contrato del endpoint siguen aparte.
- **Rechazo:** exige justificación, finaliza la reserva como rechazada y libera asientos atómicamente; un nuevo intento requiere reserva nueva. Fuente: [“Reserva y pago”](../reservas-decisiones.md). La operación de rechazo pertenece a otra spec de pagos, no a PAGOS-01.
- **Comprobante en revisión:** si llega dentro del plazo, se mantienen los asientos reservados; no se venden antes de aprobación y no vence como ausencia de comprobante. Fuentes: [BOOK-06 §2](BOOK-06.md) y [“Reserva y pago”](../reservas-decisiones.md).

### Pendiente fuera de PAGOS-01

- **Carga tardía:** la política de producto indica no reactivar reservas vencidas, responder conflicto y orientar a atención de personal si hubo transferencia real, sin prometer devolución automática. Fuente: [“Reserva y pago”](../reservas-decisiones.md); BOOK-06 §8 y BOOK-07 §10 dejan por acordar el manejo integrado/reintentos. No se implementa aquí.
- **Tiempo de revisión:** no se define un plazo automático para rechazo o fin de revisión; corresponde al proceso operativo. Fuente: [“Reserva y pago”](../reservas-decisiones.md). No agregar expiración automática de comprobantes `UPLOADED` en PAGOS-01.
- **Atomicidad intermodular:** la regla requiere que aprobación y expiración compitan bajo una condición transaccional común, y que una respuesta repetida de pagos no duplique venta ni libere una reserva confirmada. Fuente: [“Reserva y pago”](../reservas-decisiones.md) y [“Verificación que se necesita para aceptar el contrato”](../reservas-contratos.md). BOOK-07 §3/5/10 deja el puerto, límites transaccionales, reintentos y recuperación por acordar. Corresponde a PAGOS-02/BOOK-07, no a PAGOS-01.
## 11. Verificación de contrato

Comprobaciones de `docs/reservas-contratos.md`, “Verificación que se necesita para aceptar el contrato”, aplicables al flujo de pagos:

- [ ] Una reserva/viaje no comercializable o inexistente se rechaza sin filtrar datos internos; no se cruzan cooperativas ni datos de otra reserva.
- [ ] Un tramo inválido se rechaza antes de consultar ocupaciones; el comprobante no elude la validación del tramo.
- [ ] No se cruzan cooperativas ni datos personales entre reservas.
- [ ] La liberación respeta ocupaciones por tramo: asientos en tramos adyacentes no colisionan; tramos superpuestos sí.
- [ ] La disponibilidad es informativa; BOOK-03 revalida y bloquea los asientos de la reserva en una sola transacción. La carga del comprobante no sustituye esa validación.
- [ ] El comprobante y la expiración compiten por la misma reserva de forma atómica.
- [ ] Una respuesta repetida de pagos no duplica ventas ni libera una reserva confirmada.
- [ ] Solo reservas ejecuta el proceso de expiración/liberación; payments recibe el resultado y registra el estado correspondiente.

## 12. Dependencias

- **Requiere:** AUTH-01/AUTH-02 y la API pública existente de `auth/index.js` para autenticación, autorización y CSRF; INFRA-01 y migraciones/BD disponibles.
- **Requiere coordinación con `bookings`:** contrato público idempotente de consulta, expiración/liberación, confirmación de venta y aviso de comprobante recibido; BOOK-01/03/06/07 todavía no documentan nombres ni firmas.
- **Requiere la tarea de reservas BOOK-06:** un único coordinador de expiración; payments procesa el aviso y no programa su propio proceso.
- **Propone para etapa posterior:** PAGOS-02 consume comprobantes `UPLOADED`; PAGOS-03 y BOLETOS-01/02 dependen de la aprobación que corresponda; la venta en caja necesita una spec separada.

## 13. Defecto inducido

**No aplica.**
