# PAGOS-02: Revisar y aprobar comprobantes

- **ID local:** PAGOS-02
- **Módulo:** `payments`
- **Alcance de commit:** `pagos`
- **Responsable:** Shirley
- **Revisor:** Pablo
- **Estado:** Borrador; no registra aprobaciones.
- **Dependencias:** PAGOS-01; coordinación técnica con BOOK-07 y `bookings`.

> Esta spec describe una propuesta de pagos. BOOK-07 conserva su contenido y estado; la firma productiva de `confirmSale` requiere coordinación entre Leslie y Shirley.

## 1. Objetivo

Permitir que un oficinista consulte comprobantes `UPLOADED` de su cooperativa, examine el archivo de forma privada y apruebe un comprobante válido. La aprobación invoca `confirmSale` mediante un puerto de `payments`; pagos registra la decisión solo después de una confirmación aceptada.

## 2. Reglas de negocio involucradas

- **RN-02:** todo acceso interno queda filtrado por el `cooperative_id` de la identidad autenticada; nunca se toma del query, ruta o cuerpo.
- **RN-40:** aprobar no crea una segunda venta ni cambia directamente ocupaciones/asientos; la operación autorizada de `bookings` confirma la venta.
- **RN-52:** el Oficinista revisa comprobantes recibidos.
- **RN-54:** al aprobar un pago válido se confirma la venta y queda disponible el flujo posterior de boleto.

La bandeja muestra exclusivamente comprobantes `UPLOADED` aún no aprobados. No expone la ruta del almacenamiento ni permite leer comprobantes de otra cooperativa. El rechazo con justificación corresponde a PAGOS-03.

## 3. Alcance

**Incluye:** consulta paginada de comprobantes pendientes por cooperativa; lectura privada del archivo para revisión; aprobación autenticada por `CLERK`; invocación idempotente del puerto `confirmSale`; y registro local de quién y cuándo aprobó.

**No incluye:** interfaz web, rechazo, liberación de reservas, emisión de boleto/QR, implementación interna de `bookings`, modificación de BOOK-07 ni confirmación basada en datos del navegador.

## 4. Supuestos

- **Supuesto de acceso:** solo el rol `CLERK` puede listar, leer y aprobar. `COOPERATIVE_ADMIN` no obtiene permisos de aprobación en esta tarea.
- **Supuesto de aislamiento:** `cooperative_id` se obtiene de `request.auth.user.cooperative_id`, emitido por la autenticación existente; no se acepta del cliente.
- **Supuesto de consulta:** `GET /api/v1/payment-proofs` devuelve únicamente comprobantes `UPLOADED` pendientes, con paginación técnica de 50 elementos por página y cursor opaco.
- **Supuesto de lectura del archivo:** se añade `GET /api/v1/payment-proofs/:paymentProofId/file`, protegido por autenticación y el mismo filtro de cooperativa; el contenido se transmite en línea con su tipo validado, sin revelar `file_key` ni rutas locales.
- **Supuesto de idempotencia:** el puerto propuesto `confirmSale` recibe `bookingId`, `cooperativeId` y `paymentProofId`; `paymentProofId` actúa como clave estable de idempotencia. `bookings` resuelve y valida el importe desde su propia reserva. La forma productiva del contrato queda pendiente de acuerdo con Leslie y se registra aquí, no cambiando BOOK-07.
- **Supuesto de persistencia:** pagos guarda `approved_at` y `approved_by` después de la respuesta aceptada de `confirmSale`. Estos campos son metadatos de revisión; `bookings` conserva la autoridad sobre la venta. `approved_by` es una relación lógica sin FK física a `users`, para mantener los límites de módulo.
- **Supuesto ante incertidumbre:** timeout o resultado incierto no marca el comprobante aprobado; una repetición usa la misma clave. Un rechazo definitivo tampoco se transforma en aprobación; el comprobante queda disponible para el flujo de PAGOS-03.
- **Supuesto de implementación:** mientras BOOK-07 no tenga contrato público aprobado, se conecta un adaptador simulado del puerto en la composición de pagos. No se importa ninguna capa interna de `bookings`.

## 5. Datos

### Entrada y salida

| Operación | Entrada | Salida |
|---|---|---|
| Listar | cursor opcional; cooperativa desde identidad autenticada | comprobantes pendientes de esa cooperativa, metadatos seguros, `nextCursor` |
| Leer archivo | `paymentProofId` UUID; cooperativa desde identidad | bytes del archivo validado y tipo de contenido; sin ruta ni clave interna |
| Aprobar | `paymentProofId` UUID; identidad de oficinista autenticada | identificador, decisión `APPROVED` y fecha de decisión |

El listado no incluye datos personales innecesarios. Puede incluir `bookingId`, fecha de carga, nombre original saneado, tipo y tamaño. El `file_key` nunca se devuelve.

### Persistencia propuesta

Crear una nueva migración; no editar migraciones existentes. Agregar a `payment_proofs` `approved_at TIMESTAMPTZ NULL` y `approved_by UUID NULL`, con una restricción que exija ambos valores juntos o ninguno. No se crea FK física a `users`; `approved_by` procede de la identidad verificada. Los registros existentes quedan sin decisión.

El repositorio debe filtrar por `cooperative_id`, `status = 'UPLOADED'` y `approved_at IS NULL`; aprobar requiere una actualización condicional para no sobrescribir una decisión concurrente.

### Puerto de dominio

Definir en `payments/domain` un puerto `BookingSaleConfirmer.confirmSale({ bookingId, cooperativeId, paymentProofId })`. El caso de uso no importa Express, `pg` ni clases concretas. El adaptador real se deja pendiente del contrato acordado con `bookings`; la implementación de esta tarea usa un adaptador simulado idempotente.

## 6. Endpoints

| Método | Ruta | Roles y protección | Resultado |
|---|---|---|---|
| GET | `/api/v1/payment-proofs` | `authenticate`, `authorize('CLERK')` | página de comprobantes pendientes de la cooperativa autenticada |
| GET | `/api/v1/payment-proofs/:paymentProofId/file` | `authenticate`, `authorize('CLERK')` | archivo privado de la misma cooperativa |
| POST | `/api/v1/payment-proofs/:paymentProofId/approve` | `authenticate`, `authorize('CLERK')`, `csrfProtection` | 200 y decisión aprobada tras `confirmSale` aceptado |

Los endpoints no reciben `cooperative_id`, `booking_id`, `approved_by`, importe ni estado desde el cliente. Un identificador inexistente y uno de otra cooperativa producen el mismo 404.

## 7. Criterios de aceptación

- [ ] **Dado** un `CLERK` autenticado, **cuando** lista la bandeja, **entonces** recibe solo comprobantes `UPLOADED` pendientes de su cooperativa.
- [ ] **Dado** un `CLERK` de otra cooperativa, **cuando** consulta un comprobante ajeno o su archivo, **entonces** recibe 404 y no se exponen metadatos ni bytes.
- [ ] **Dado** un archivo pendiente de su cooperativa, **cuando** lo consulta, **entonces** se entrega el contenido privado validado sin exponer clave o ruta.
- [ ] **Dado** un comprobante `UPLOADED`, **cuando** el oficinista aprueba con CSRF válido, **entonces** se llama `confirmSale` con la identidad del comprobante y cooperativa confiable y se registra la aprobación solo tras aceptación.
- [ ] **Dado** un comprobante ya aprobado, **cuando** se repite la aprobación, **entonces** la respuesta es idempotente y no crea una segunda venta.
- [ ] **Dado** un timeout o resultado incierto de `confirmSale`, **cuando** se procesa la solicitud, **entonces** no se marca aprobado y se puede reintentar con la misma clave estable.
- [ ] **Dado** un comprobante ausente, expirado, ya no pendiente o perteneciente a otra cooperativa, **cuando** se intenta aprobar, **entonces** no se confirma una venta ni se modifica otra cooperativa.
- [ ] **Dado** un rol distinto de `CLERK` o falta de CSRF, **cuando** intenta leer o aprobar, **entonces** auth rechaza la operación antes de acceder al archivo o invocar `confirmSale`.
- [ ] **Dado** una carrera de dos aprobaciones, **cuando** ambas llegan simultáneamente, **entonces** la clave estable y actualización condicional evitan duplicar la venta y la decisión persistida.

## 8. Errores y casos borde

- `401 UNAUTHENTICATED` y `403 FORBIDDEN` conservan el formato de errores del proyecto.
- Comprobante inexistente o ajeno: 404 sin revelar existencia.
- Comprobante no pendiente o rechazo definitivo de `confirmSale`: 409; no se marca aprobado.
- Resultado incierto de `confirmSale`: 503; conservar estado local pendiente y permitir reintentar.
- Falla al leer almacenamiento: error interno controlado; no devolver la ruta ni detalles del sistema de archivos.
- Si `confirmSale` aceptó pero se perdió su respuesta, el reintento con el mismo `paymentProofId` debe devolver el mismo resultado confirmado antes de escribir `approved_at`.

## 9. Pruebas

- Unitarias de listado y aprobación: aislamiento por cooperativa, rol, estados, rechazo, timeout e idempotencia.
- Pruebas del repositorio PostgreSQL: paginación, filtro tenant, actualización condicional y metadatos de aprobación.
- Integración HTTP: bandeja, lectura privada, CSRF y permisos.
- El adaptador simulado acredita el contrato local propuesto; no sustituye aceptación ni pruebas de integración del contrato real con Leslie/BOOK-07.

## 10. Usabilidad y seguridad

El backend no incluye una interfaz en esta tarea. Los errores permiten a una futura bandeja distinguir acceso denegado, comprobante no disponible y resultado incierto; no entregan información de otra cooperativa. El archivo solo se sirve tras comprobar identidad, rol, estado y pertenencia.

## 11. Defecto inducido

**No aplica.**

## 12. Dependencias y coordinación

- **Requiere:** PAGOS-01 para tabla, almacenamiento privado y registros `UPLOADED`; auth para `CLERK`, cooperativa autenticada y CSRF.
- **Coordina con BOOK-07:** Leslie conserva su spec y decide junto con Shirley la firma/semántica de `confirmSale`, idempotencia, aceptación/rechazo y recuperación transaccional. La propuesta técnica de pagos queda documentada solo aquí hasta acordarla.
- **Siguiente tarea:** PAGOS-03 define rechazo con justificación y `releaseBooking`; debe preservar la exclusión mutua con una aprobación ya confirmada.
- **Dependiente:** BOLETOS-01 emite QR tras confirmar la venta, en una spec separada.

## 13. Evidencia de implementación local

- Implementados en la rama dependiente de PAGOS-01: bandeja paginada, lectura privada, aprobación por puerto, adaptador simulado y migración aditiva de metadatos de aprobación.
- `npm run lint`: aprobado.
- Unitarias: 43 suites y 584 pruebas aprobadas al excluir `payment-proof.routes.test.js`, cuyo servidor HTTP no pudo enlazarse por `EACCES` en `127.0.0.1:55554` dentro del entorno actual.
- Integración PostgreSQL: pendiente; Docker no pudo acceder a `dockerDesktopLinuxEngine` (`Access is denied`).
- Formato de los archivos de PAGOS-02: verificación Prettier aprobada.
- No se considera cerrada ni integrada; la firma productiva de `confirmSale` y su validación con Leslie/BOOK-07 siguen pendientes.
