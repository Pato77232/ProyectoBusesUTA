# PAGOS-01: Subir comprobante de depósito o transferencia

- **ID local:** PAGOS-01
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `payments`
- **Alcance de commit:** `pagos`
- **Responsable:** Shirley
- **Revisor:** Pablo
- **Estado:** Borrador

> Propuesta pendiente de revisión. Las decisiones marcadas como preguntas abiertas deben acordarse antes de implementar los puntos que afectan.

## 1. Objetivo

Permitir que un cliente envíe el comprobante de depósito o transferencia de su reserva dentro del plazo configurable. Si el plazo vence sin comprobante, registrar el estado `Expirado` y coordinar con `bookings` la expiración de la reserva y liberación de sus asientos.

## 2. Reglas de negocio involucradas

- **RN-02:** los datos de cada cooperativa permanecen aislados. Para este flujo, `cooperative_id` se obtiene de la reserva consultada mediante el puerto de `payments`; nunca se toma del token ni del cuerpo HTTP.
- **RN-50:** el cliente dispone de un plazo configurable de 3 a 5 minutos para subir el comprobante de depósito o transferencia. La duración no se fija en código.
- **RN-51:** vencido el plazo sin comprobante, la reserva expira y sus asientos vuelven a estar disponibles. La transición de reserva y liberación de asientos se coordina con `bookings`.

Las tres reglas citadas existen en `docs/business-rules.md` (RN-02, §2; RN-50 y RN-51, §7). No se cita RN-52, RN-53 ni RN-54 porque la bandeja, aprobación/rechazo y emisión de boleto quedan fuera de esta spec.

## 3. Alcance

**Incluye:** carga de un archivo de comprobante asociado a una reserva; validación de que la reserva pertenece al cliente autenticado, está vigente y admite el envío; persistencia de metadatos y ubicación del archivo; lectura del plazo único mantenido por `bookings`; estado `EXPIRED` y coordinación con `bookings` para expirar la reserva y liberar asientos.

**No incluye:** pago con tarjeta; revisión, aprobación o rechazo del comprobante; emisión de boleto/QR; venta en caja; compra como invitado mientras no se resuelva la pregunta 8 del negocio; gestión de la bandeja del oficinista. Estas funcionalidades corresponden a PAGOS-02, PAGOS-03, BOLETOS-01/02 y una spec aparte para venta física.

### Autenticación y autorización

La ruta protegida compone los middlewares existentes exportados por `backend/src/modules/auth/index.js`: `authenticate`, `authorize('CUSTOMER')` y `csrfProtection` para la operación de carga. `CUSTOMER` es el valor de rol definido en `auth/domain/identity.js` y usado por la sesión según `docs/autenticacion-ejecucion.md`. No se introduce autenticación, token, middleware ni mecanismo CSRF propio. La identidad del cliente viene del contexto autenticado. La autorización sobre la reserva se comprueba con el puerto definido en `payments/domain`; no se confía en identificadores o cooperativa enviados por el cliente.

## 4. Tareas

La spec puede dividirse después en specs independientes para carga y expiración. En esta propuesta ambos flujos quedan descritos para mantener explícita su coordinación.

### T1. Subir comprobante

1. Al abrir la ventana de pago de una reserva, `payments` mantiene un comprobante en estado `AWAITING_UPLOAD`, sin archivo asociado. Su plazo y `payment_deadline_at` pertenecen a la reserva y son establecidos por `bookings`.
2. El cliente autenticado solicita la carga enviando el ID de reserva y un único archivo, con CSRF válido.
3. El caso de uso consulta la reserva mediante `BookingReader` (puerto de `payments/domain`) y comprueba propietario, estado vigente, cooperativa derivada de la reserva y fecha límite leída de esa misma reserva.
4. Si la reserva sigue dentro del plazo, el caso de uso guarda el archivo mediante el puerto de almacenamiento sustituible, actualiza metadatos y cambia el comprobante a `UPLOADED` (archivo recibido, a la espera de PAGOS-02).
5. Una carga recibida cuando `now >= payment_deadline_at` se rechaza; no modifica el plazo ni revierte un estado `EXPIRED`.

### T2. Expirar reserva y comprobante

1. El proceso coordinado detecta las reservas con plazo vencido que siguen en `AWAITING_UPLOAD`.
2. Cambia el comprobante a `EXPIRED` y solicita a `bookings` expirar la reserva y liberar sus asientos conforme a RN-51.
3. La operación es idempotente. T2 depende del contrato con Leslie para consultar el plazo y efectuar la transición/liberación en `bookings`.

## 5. Datos

### Entrada y salida

| Dato | Tipo | Validación / origen |
|---|---|---|
| `bookingId` | UUID | Identificador de ruta; debe corresponder a una reserva del cliente autenticado. Nombre/tipo final sujeto al contrato de `bookings` con Leslie. |
| Archivo | binario multipart | Obligatorio en la carga; un archivo por solicitud. Tipos MIME y tamaño máximo están pendientes de decisión; propuesta inicial: PDF, JPEG o PNG, máximo 5 MiB, validando contenido además del `Content-Type`. |
| `customerId` | UUID | Solo del principal autenticado (`authenticate`); no se acepta en el cuerpo. |
| `cooperative_id` | UUID | Se deriva de la reserva devuelta por `BookingReader`; no se acepta del token ni del cuerpo. |
| Respuesta | JSON | Identificador del comprobante, estado y fecha límite leída desde la reserva; nunca devuelve ruta física ni URL interna del archivo. |

### Puerto de dominio

Definir en `payments/domain` un puerto de lectura, propuesto como `BookingReader`, con una operación equivalente a `findForPayment(bookingId)`. Devuelve solo los datos necesarios: identificador de reserva, identificador del cliente/propietario, `cooperative_id`, estado y `payment_deadline_at` de la reserva. El plazo tiene una sola fuente: la reserva. `payments` lo lee con `BookingReader` y no lo recalcula ni mantiene una copia en `payment_proofs`. El puerto no expone tablas ni importa código interno de `bookings`. La implementación/adaptador se conecta mediante la API pública de `bookings` o el punto de composición.

**Contrato de bookings pendiente de contrato con Leslie:** nombre real de tabla, columnas, clave primaria, columna de cliente/propietario, columna `cooperative_id`, estado y fecha de expiración; cardinalidad y FK desde pagos; cómo se inicia/consulta/cambia el plazo; operación pública e idempotente para expirar la reserva y liberar asientos; y garantías transaccionales/concurrencia. Esta spec no fija ni presupone esos nombres o FKs.

### Migración propuesta

Tabla nueva `payment_proofs` (nombre propuesto sujeto a convenciones y revisión), plural y `snake_case`. Los campos de vínculo a `bookings` y sus FKs quedan **pendientes de contrato con Leslie**. No se propone alterar migraciones existentes.

| Campo | Tipo propuesto | Restricción / propósito |
|---|---|---|
| `id` | UUID | PK, generado por la base |
| `booking_id` | UUID | NOT NULL; FK/columna **pendiente de contrato con Leslie**; unicidad/cardinalidad con reserva por acordar |
| `cooperative_id` | UUID | NOT NULL; valor copiado de la reserva por el caso de uso; FK/tabla de cooperativas **pendiente de contrato con Leslie** |
| `status` | TEXT | NOT NULL; CHECK en `AWAITING_UPLOAD` (ventana abierta sin archivo), `UPLOADED` (archivo subido, a la espera de PAGOS-02), `EXPIRED` (Expirado) |
| `file_key` | TEXT | NULL mientras no se haya cargado; clave opaca del almacenamiento, nunca ruta recibida del cliente |
| `original_file_name` | TEXT | NULL antes de carga; nombre saneado solo como metadato |
| `media_type` | TEXT | NULL antes de carga; tipo determinado/validado por servidor |
| `file_size_bytes` | BIGINT | NULL antes de carga; tamaño comprobado por servidor |
| `uploaded_at` | TIMESTAMPTZ | NULL hasta carga correcta |
| `expired_at` | TIMESTAMPTZ | NULL hasta expiración |
| `created_at` / `updated_at` | TIMESTAMPTZ | NOT NULL |

Índice propuesto para encontrar comprobantes que esperan carga: `(status, booking_id)`. La fecha límite vive únicamente en la reserva y se obtiene a través de `BookingReader`. La retención y el borrado del archivo son decisiones abiertas. **Propuesta de almacenamiento:** disco local privado, fuera del directorio público; en BD solo `file_key` y metadatos. Definir un puerto de almacenamiento en payments y un adaptador local sustituible. No guardar bytes en PostgreSQL ni aceptar una URL/ruta suministrada por el cliente.

## 6. Endpoints

| Método | Ruta | Roles | Respuestas |
|---|---|---|---|
| POST | `/api/v1/bookings/{bookingId}/payment-proof` | `CUSTOMER`; `authenticate`, `authorize('CUSTOMER')`, `csrfProtection` | 201, 400, 401, 403, 404, 409, 413, 415, 422, 500 |

La solicitud usa `multipart/form-data`, campo de archivo propuesto `file`. Respuesta `201`: `{ "paymentProof": { "id": "…", "status": "UPLOADED", "paymentDeadlineAt": "…" } }`; la fecha se obtiene de la reserva. Para reserva inexistente o que no pertenece al cliente, propuesta: misma respuesta 404 para no revelar existencia de reservas ajenas. `403` incluye `CSRF_TOKEN_INVALID` cuando el CSRF falta o no coincide. Códigos de error funcionales restantes se definirán en el diseño de implementación conforme al formato único de arquitectura (`{ "error": { "code", "message" } }`). No se crea endpoint de aprobación/rechazo ni de boletos.

La ruta REST se considera propuesta: confirmar con el equipo si se anida bajo `/bookings` o se expone como recurso `/payment-proofs`; esta decisión no cambia que el acceso al booking sea mediante el puerto de dominio.

## 7. Criterios de aceptación

- [ ] **Dado** un cliente autenticado dueño de una reserva vigente y una ventana de pago abierta, **cuando** envía un archivo permitido con CSRF válido, **entonces** se guarda el archivo en almacenamiento privado, queda asociado a la reserva y responde 201 con estado `UPLOADED`.
- [ ] **Dado** un `cooperative_id` distinto en el cuerpo o token, **cuando** se procesa la carga, **entonces** se ignora ese valor y se persiste únicamente el `cooperative_id` obtenido de la reserva mediante `BookingReader`.
- [ ] **Dado** un cliente que no es propietario de la reserva, **cuando** intenta cargar un archivo, **entonces** la operación no revela ni modifica la reserva ajena y responde 404 según la propuesta.
- [ ] **Dado** una solicitud sin sesión válida, **cuando** intenta cargar un comprobante, **entonces** `authenticate` la rechaza según el contrato existente de auth.
- [ ] **Dado** un `CUSTOMER` autenticado sin CSRF válido, **cuando** envía la carga, **entonces** `csrfProtection` responde 403 `CSRF_TOKEN_INVALID` y no se persiste archivo ni metadatos.
- [ ] **Dada** una reserva con plazo dentro del rango configurable de RN-50, **cuando** `payments` consulta `BookingReader`, **entonces** utiliza el plazo de la reserva como única fuente y no calcula ni persiste una fecha límite propia.
- [ ] **Dada** una reserva con ventana vencida sin archivo, **cuando** corre T2, **entonces** el comprobante pasa de `AWAITING_UPLOAD` a `EXPIRED` y se coordina con `bookings` la expiración de la reserva y liberación de asientos conforme RN-51.
- [ ] **Dada** una expiración ya aplicada, **cuando** se reintenta el proceso, **entonces** el efecto es idempotente y no falla ni libera recursos de otra reserva.
- [ ] **Dada** una solicitud de carga a la hora límite o después, **cuando** se evalúa, **entonces** no se acepta como `UPLOADED`, no extiende el plazo y la reserva sigue el flujo de expiración.
- [ ] **Dado** un archivo ausente, vacío, demasiado grande o de tipo/contenido no permitido, **cuando** se valida la solicitud, **entonces** se rechaza con el error HTTP acordado sin dejar archivo huérfano ni registro parcialmente actualizado.
- [ ] **Dado** un comprobante en estado `UPLOADED`, **cuando** T2 busca comprobantes sin archivo, **entonces** no lo cambia a `EXPIRED`; su revisión corresponde a PAGOS-02.

## 8. Casos borde y errores

- Dos cargas concurrentes para la misma reserva: solo una puede completar; la cardinalidad y estrategia de bloqueo/índice dependen del contrato con Leslie.
- Carrera entre carga y expiración en el instante límite: definir un único criterio temporal (propuesta: aceptar solo si `now < payment_deadline_at` leído de la reserva; al llegar exactamente al límite ya venció) y transacción/orden idempotente coordinado con `bookings`.
- Reserva ya cancelada, expirada o en estado que no admita pago: rechazar sin guardar archivo. Estados y códigos concretos dependen del contrato con Leslie.
- Reserva no encontrada y reserva de otro cliente: respuesta indistinguible según propuesta 404.
- Reserva sin `payment_deadline_at` o con plazo fuera del rango de RN-50: fallo de contrato/configuración explícito; payments no suple el dato con un valor propio.
- Fallo de almacenamiento local, de base de datos o del adaptador `bookings`: limpiar archivo temporal si no se confirmó la operación; reintentar expiración sin duplicar efectos.
- El archivo no puede servirse públicamente ni ejecutarse desde el servidor; nombre original, extensión o MIME enviados por el cliente no se consideran confiables.
- Si la reserva expiró pero T2 no se ejecutó aún, una solicitud posterior debe disparar/permitir su expiración idempotente y no revivirla.

## 9. Pruebas esperadas

- **Unitarias (`backend/tests/unit/payments/`):** carga válida; propietario correcto/incorrecto; cooperativa siempre derivada de reserva; estados de reserva no elegibles; fecha antes/en/después del plazo leído con `BookingReader`; transición `AWAITING_UPLOAD` → `UPLOADED` y expiración a `EXPIRED`; aceptación de tipos/tamaño acordados; rechazo de archivos; expiración con reserva sin archivo; idempotencia; puertos de almacenamiento y `BookingReader` simulados.
- **Integración (`backend/tests/integration/payments/`):** ruta protegida con auth existente; 401 sin sesión, 403 por CSRF inválido y rechazo de rol distinto de `CUSTOMER`; multipart válido; persistencia y filtrado por cooperativa derivada de reserva; aislamiento de reservas ajenas; errores de tamaño/tipo; migración/índice; T2 que cambia el comprobante y la reserva y libera los asientos a través del contrato público de `bookings`.
- **Concurrencia/flujo:** carrera carga-expiración, duplicado simultáneo y reintento del proceso de expiración. Los dobles de prueba no deben sustituir la prueba de integración del contrato una vez acordado con Leslie.

## 10. Preguntas abiertas

- **P3 de `business-rules.md` (tarjeta):** queda fuera de PAGOS-01. **Propuesta:** mantener tarjeta totalmente fuera del flujo y de su esquema; resolverla en una spec de pagos posterior.
- **P4 (precio por frecuencia o tramo):** fuera de esta carga. **Propuesta:** el comprobante referencia el total ya fijado en la reserva y no recalcula precios; confirmar con negocio antes de PAGOS-02/03.
- **P7 (venta física directa por oficinista):** fuera de alcance. **Propuesta:** especificarla por separado después de la revisión; PAGOS-01 no crea reservas de caja ni permite saltar el flujo de reserva.
- **P8 (datos y recuperación de compra como invitado):** afecta autorización del dueño de la reserva. **Propuesta:** esta primera versión exige usuario autenticado con rol `CUSTOMER`; añadir invitado solo con mecanismo explícito de propiedad/recuperación aprobado en spec, sin tratar el ID de reserva como credencial.
- **Contrato con Leslie (`bookings`):** confirmar tablas, columnas, IDs, FKs, propietario, `cooperative_id`, estados, fecha límite, cardinalidad, creación de la ventana, API pública para expiración/liberación y transacción/concurrencia. **Propuesta:** reservar una fila `payment_proofs` por reserva al iniciar su ventana, con campos de archivo nulos; `BookingReader` solo expone datos mínimos y un puerto de expiración coordina la transición sin importar internals de `bookings`.
- **Inicio de ventana y registro del comprobante:** confirmar si `bookings` notifica la apertura o si `payments` crea/localiza el comprobante en ese momento. **Propuesta:** al abrir la ventana, `payments` crea o localiza una fila `AWAITING_UPLOAD`; `bookings` sigue siendo dueño del plazo.
- **Plazo configurable:** confirmar el nombre de la configuración, unidad y módulo responsable de validarla. **Propuesta:** `bookings` mantiene una única configuración en minutos (entero de 3 a 5), calcula y guarda el plazo en la reserva; `BookingReader` expone `payment_deadline_at` y `payments` solo lo lee, sin duplicarlo en `payment_proofs`.
- **Archivo: tipos, tamaño y almacenamiento:** **Propuesta:** PDF/JPEG/PNG de máximo 5 MiB, inspección del contenido real, una carga por reserva y almacenamiento en disco local privado fuera del directorio público; en PostgreSQL solo guardar `file_key` y metadatos. Usar un puerto de almacenamiento en payments con adaptador local sustituible. Confirmar también política de retención, reemplazo/reintento y borrado tras expiración.
- **Trabajo periódico de expiración:** frecuencia y mecanismo de ejecución. **Propuesta:** tarea periódica idempotente coordinada con el ciclo existente de expiración de `bookings`, evitando un segundo mecanismo competidor; frecuencia objetivo por acordar.
- **Ruta y cardinalidad del recurso:** confirmar ruta anidada y si se admiten reintentos/reemplazo. **Propuesta:** una fila por reserva y un solo archivo final; reintento permitido solo si una falla no llegó a persistir.

## 11. Dependencias

- **Requiere:** AUTH-01/AUTH-02 y la API pública existente de `auth/index.js` para autenticación, autorización y CSRF; INFRA-01 y migraciones/BD disponibles.
- **Requiere coordinación previa con `bookings`:** contrato público para leer una reserva (`BookingReader` definido en `payments/domain`) y contrato idempotente para expirar la reserva/liberar asientos; columnas y FKs quedan pendientes de contrato con Leslie.
- **Requiere configuración compartida:** valor de plazo validado según RN-50 y mecanismo de expiración que no compita con `bookings`.
- **Propone para etapa posterior:** PAGOS-02 consume comprobantes `UPLOADED`; PAGOS-03 y BOLETOS-01/02 dependen de la aprobación que corresponda; la venta en caja necesita una spec separada.

## 12. Defecto inducido

**No aplica.**
