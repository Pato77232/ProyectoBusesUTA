# BOOK-11: compra como invitado de punta a punta

- **Estado:** contrato de integración cerrado por instrucción del solicitante para Auth, Reservas y Pagos; implementación por incrementos, revisión humana independiente pendiente.
- **Responsables de referencia:** Leslie (Reservas), Pablo (Auth y correo); Shirley revisa el contrato de Pagos. No se infiere aceptación individual de este reparto.
- **Base y rama:** `origin/develop` `c9d14bf`, 4 de noviembre de 2026; `feature/BOOK-11-compra-invitado`.
- **Reglas:** RN-41/42, RN-40 y RN-50–54. Referencias: [reglas](../business-rules.md), [AUTH-INVITADO-01](AUTH-INVITADO-01.md), [BOOK-09-L07](BOOK-09-L07.md), [CORREO-01](CORREO-01.md), [arquitectura](../architecture.md), [calidad](../calidad.md) y `frontend/DESIGN.md`.

## Objetivo

Permitir que una persona compre y consulte sus pasajes sin crear una cuenta CUSTOMER, con correo de contacto verificado y acceso limitado a su compra. Conocer un identificador, cédula o correo no debe conceder acceso. El flujo incluye reserva, comprobante y boleto mediante los módulos dueños de esas operaciones; una falla de correo no confirma falsamente entrega ni duplica ventas.

## Evidencia de la base

- `POST /api/v1/bookings/summary` y `POST /api/v1/bookings` requieren sesión `CUSTOMER`; `verified-customer-identity.js` rechaza cualquier otro contexto.
- `bookings.owner_id` es texto obligatorio y el índice de idempotencia usa `(owner_id, creation_request_key)`. No representa por sí solo una concesión de invitado.
- `GET /api/v1/guest/bookings/:token` consume una sola vez un token con hash y devuelve un resumen mínimo. No crea una sesión limitada ni autoriza carga de comprobante o consulta de boleto. `guestAccess.issue` acepta un callback `send` opcional y devuelve el token; no hay emisión de enlace integrada al flujo de compra.
- `AUTH-INVITADO-01` es un borrador con duración, reenvío, transporte, CSRF y contrato Auth–Bookings–Pagos pendientes. BOLETOS-01 está en una rama remota fuera de esta base. BOLETOS-02 publicado solo amplía el adaptador SMTP para un PNG; no envía enlaces ni compone un trabajador de entrega.

## Decisiones confirmadas por el solicitante

1. Verificar el correo **antes** de bloquear asientos.
2. Tras el enlace, dar al invitado una **sesión limitada** para consultar su compra, subir comprobante y ver boletos. El canje de un solo resumen no basta.
3. Preparar el primer incremento de Auth y Reservas con SMTP simulado en pruebas, **sin habilitar el flujo público** hasta que el envío de enlaces esté operativo.
4. Enlace de verificación de correo válido **15 minutos** y de un solo uso; sesión limitada válida **30 minutos**. Ambas duraciones serán configurables.

El solicitante indicó que el equipo está de acuerdo en encargar a Codex el cierre técnico de este contrato; no se atribuye una respuesta individual a Leslie o Shirley. El canje público futuro será por `POST` con token en el cuerpo y sesión limitada en cookie del mismo origen. El secreto viajará en fragmento de URL, se borrará de la barra antes del POST y no se registrará en logs; un prefetch no debe consumirlo. El `GET` actual seguirá con su contrato existente hasta una migración expresa. No se habilita endpoint público sin reenvío, límites de tasa, CSRF y entrega de correo.

## Contrato entre módulos

- **Auth → Reservas:** solo Auth verifica el secreto de sesión y entrega internamente `{ principalType: 'GUEST_BUYER', guestBuyerId, email }`. El correo normalizado identifica de manera estable al comprador invitado; otro enlace para el mismo correo conserva el `guestBuyerId`. La sesión dura 30 minutos y su revocación impide nuevas operaciones. El cliente nunca envía `guestBuyerId`, `ownerId` ni correo de contacto para autorizar una operación.
- **Reserva y contacto:** Reservas transforma el comprador verificado en `owner_id = guest:<uuid>`. Una reserva corresponde a una compra y a una sola cooperativa, derivada del viaje publicado. La creación guarda `guest_contact_email` como copia inmutable del correo verificado en la misma transacción que ocupa los asientos; no se acepta correo del body. La clave de idempotencia sigue ligada a `owner_id` y a la huella del resumen aceptado. Un segundo enlace al mismo correo recupera el mismo propietario para consultar esa compra. La sesión permite operar únicamente sobre reservas de ese comprador; una compra de otro comprador devuelve ausencia sin revelar datos.
- **Reservas → Pagos:** la API interna `guestPurchase.findForPayment({ bookingId, purpose: 'UPLOAD_PROOF' }, { guestSessionToken })` vuelve a verificar la sesión y consulta por `bookingId` y `owner_id`. Devuelve `null` si la reserva es ajena. El resultado existente incluye estado, cooperativa derivada, monto y plazo de comprobante; no amplía el plazo ni admite `REVIEW_PAYMENT` para invitados. La consulta pública ordinaria de Pagos no acepta un rol invitado inventado. La carga/corrección pública futura deberá usar esta API antes de leer o guardar archivos, aplicar CSRF y conservar sus reglas de estado y plazo.
- **Correo y boletos:** la entrega del enlace será durable y no expondrá su secreto en logs ni en respuestas públicas. Boletos recibirá solo la reserva autorizada mediante la API pública de Reservas y aplicará RN-41/42 por pasajero. El adaptador SMTP para PNG no equivale al envío del enlace. Estas conexiones siguen como incrementos separados y no se declaran implementadas.

## Incrementos pequeños propuestos

1. **Auth interno autorizado ahora:** generar un secreto aleatorio de 256 bits para verificar correo, guardar solo hash y vigencia de 15 minutos; canjearlo una vez en transacción por una sesión limitada de 30 minutos. El correo acreditado conserva el mismo `guestBuyerId` opaco al reingresar con otro enlace; guardar solo hash del secreto de cada sesión, permitir verificar/revocar y usar errores genéricos. Sin ruta HTTP, cookie ni envío real en este incremento. Migración nueva, pruebas unitarias y PostgreSQL aislado. La composición pública se hará tras resolver reenvío, límites y correo.
2. Agregar a Reservas la identidad de comprador invitado verificada y la creación idempotente, con PostgreSQL aislado y sin `CUSTOMER` ficticio. Primer paso interno: adaptar la identidad de Auth al `owner_id` con prefijo `guest:` y componer los casos de resumen y creación sin rutas públicas; el resto del incremento exige acuerdo de contacto congelado y vínculo de la reserva.
3. Conectar Pagos mediante APIs públicas y comprobar pertenencia, plazos, comprobantes y fallos.
4. Emitir y enviar enlace de manera durable; verificar no entrega/aceptación SMTP y reintentos con transporte de prueba.
5. Exponer boleto al invitado autorizado y completar las pantallas con estados de espera, error, vencimiento y recuperación; aplicar `frontend/DESIGN.md`.

Cada incremento registra pruebas propias, `npm run lint`, `npm run format:check`, `npm test` con PostgreSQL aislado y arranque real si cambia la composición. No se introducen dependencias ni migraciones hasta cerrar el esquema correspondiente; las migraciones existentes no se editan.

## Criterios de aceptación del recorrido final

- Invitado sin cuenta solicita acceso, acredita su correo, consulta oferta y resumen, reserva, sube comprobante y recibe resultado de venta y boleto sin iniciar sesión CUSTOMER.
- Enlace usado, vencido, revocado, de compra ajena o alterado no autoriza ninguna lectura o mutación; el error no revela existencia de la compra.
- Repeticiones o pérdidas de respuesta no duplican reservas, pagos, enlaces ni boletos; SMTP fallido no altera venta ni asientos.
- Sesión limitada no permite operaciones de administración ni acceso a otras compras. Las mutaciones exigen CSRF y revalidación de estado y plazo.
- El comprador accede a todos los boletos de su compra; cada pasajero adulto o responsable de menor recibe solo el correspondiente conforme RN-41/42.

Revisión humana independiente pendiente. Sin defectos inducidos autorizados para esta tarea.

## Primer incremento implementado en la rama

Auth expone solo una fábrica interna `createGuestEmailAccess` (sin rutas HTTP ni composición en `server.js`). Genera un token de 256 bits para verificar correo, guarda su hash SHA-256 con vencimiento configurable de 15 minutos y canjea una sola vez bajo bloqueo PostgreSQL por una sesión de 30 minutos. La sesión usa otro secreto de 256 bits cuyo hash queda en base. El correo acreditado se asocia a un comprador invitado estable, por lo que otro enlace para ese correo recupera el mismo `guestBuyerId`. Permite verificar y revocar. No crea usuario ni rol CUSTOMER, no envía correos ni habilita compra pública. Se agregó la migración nueva `1794330000000-auth-guest-email-access` (renumerada a `1794350000000` por [INTEG-02](INTEG-02.md)) y su entrada al catálogo; no se editaron migraciones anteriores.

Reservas expone opcionalmente `guestPurchase` como API interna para resumen, creación y lectura autorizada de una reserva para Pagos. Su adaptador comprueba en Auth la sesión limitada y transforma el `guestBuyerId` verificado en un `owner_id` estable con prefijo `guest:`. Las rutas existentes siguen reservadas a CUSTOMER. Faltan la carga pública del comprobante, la conexión con Boletos y el envío durable del enlace; no hay ruta pública de compra invitada.

El segundo incremento fija `guest_contact_email` en la reserva al ocupar asientos y agrega la consulta interna de Pagos con la sesión verificada. La migración `1794340000000-booking-guest-contact` (renumerada a `1794360000000` por [INTEG-02](INTEG-02.md)) impide correo invitado en reservas CUSTOMER y exige correo normalizado en reservas `guest:`. Su reversión rechaza reservas invitadas existentes para no perder el correo acreditado. El catálogo y sus dos pruebas con expectativas fijas se actualizaron para las migraciones, tablas y nueva columna por autorización excepcional del solicitante; no se eliminó ninguna comprobación.

Pruebas nuevas: unitarias de Auth y Reservas e integraciones dirigidas con PostgreSQL aislado; canjes concurrentes dejan una sola sesión, el vencimiento impide canje, la revocación impide verificación, los secretos no quedan en claro y otro enlace recupera el mismo comprador. La integración de reserva comprueba correo congelado, acceso propio y rechazo de acceso ajeno; la prueba de reversión protege datos existentes. `npm run lint` y `npm run format:check` aprobaron.

La suite unitaria global aprobó 2034/2034; el catálogo dirigido aprobó 19/19 y la integración de reserva invitada aprobó 1/1 tras corregir su ejecución de migración. La ejecución global anterior aprobó 691/692 integraciones: falló únicamente esa prueba antes de corregirla. Se detuvo la repetición global en otra base nueva por petición del solicitante para publicar la rama sin más pruebas. Revisión humana e integración de BOOK-11 pendientes.
