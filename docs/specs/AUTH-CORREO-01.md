# AUTH-CORREO-01: recuperar el acceso mediante correo

- **Responsable de preparación:** Pablo. **Revisión de contrato:** Edwin respondió las preguntas por mensaje comunicado por Pablo; revisión del cambio documental y del código pendiente.
- **Estado:** contrato funcional confirmado por Pablo el 4 de noviembre de 2026; implementación pendiente.
- **Base comprobada:** `origin/develop` `5ff50d9`, 4 de noviembre de 2026; rama `feature/AUTH-CORREO-01-recuperacion-cuenta`.
- **Reglas y decisiones:** RN-01/03 en [business-rules](../business-rules.md), [ADR 0004](../adr/0004-autenticacion-sesiones-credenciales.md), [CORREO-01](CORREO-01.md), [calidad](../calidad.md) y `frontend/DESIGN.md`.

## Objetivo y límites

Una persona que olvidó su contraseña solicita desde el login un enlace temporal al correo de su cuenta, establece una nueva contraseña y luego inicia sesión normalmente. Pablo confirmó el 4 de noviembre de 2026: **todos los roles**, vigencia del enlace de **20 minutos** (reemplaza su decisión anterior de 30 minutos) y **revocación de todas las sesiones abiertas** al completar el cambio. La recuperación no crea sesión ni cambia el rol, correo o cooperativa de la cuenta.

La verificación inicial de correo, cambio de correo, MFA y recuperación cuando ya no se controla el buzón necesitan contratos separados. No se usarán preguntas de seguridad ni se enviarán contraseñas por correo. La pantalla de registro de `AUTH-WEB-02` puede integrarse antes o después: esta tarea parte del login ya existente en `develop`; al combinar ramas se revisarán los enlaces de `frontend/pages/login.html`.

El SMTP compartido (`backend/src/shared/mail/smtp-mailer.js`) solo informa aceptación del proveedor, no entrega. `CORREO-01` excluye expresamente la recuperación. La prueba real del buzón y la configuración del operador no están acreditadas por esta spec.

## Contrato confirmado para implementar por incrementos

1. `POST /api/v1/auth/password-reset`, público con CSRF, recibe solo `email` normalizado como en login. Responde **202** y el mismo cuerpo («Si la cuenta existe, enviaremos un enlace») para cuenta existente, inexistente, enfriamiento o límite por correo. No expone rol, existencia, estado de correo ni aceptación SMTP. El límite independiente por IP responde **429 `TOO_MANY_ATTEMPTS`**.
2. En la petición HTTP solo se registra la solicitud elegible en una nueva tabla `auth_email_actions` con estado `PENDING`; el envío no ocurre dentro de esa petición. Por correo se admiten **3 solicitudes cada 15 minutos** y una separación mínima de **60 segundos** entre correos; los excesos reciben el mismo 202 sin nuevo envío. Por IP se admiten **10 solicitudes cada 15 minutos**. Los contadores deben funcionar también para correos inexistentes, sin filtrar su existencia por contenido o diferencias evitables de tiempo.
3. Una nueva solicitud admitida invalida en la misma transacción las acciones y tokens anteriores no usados de esa cuenta y propósito. Solo un enlace puede estar vigente. Un trabajador reclama acciones `PENDING` mediante `FOR UPDATE SKIP LOCKED`, marca `SENDING` y registra la hora de reclamo para recuperar trabajo abandonado. Genera un token criptográfico **al enviar**, guarda solo su `token_hash` y expiración, y construye el correo en memoria: no persiste `encrypted_message` ni una clave adicional para ello. Cada reintento genera un token nuevo y sustituye el hash anterior; el enlace anterior deja de valer.
4. El trabajador reintenta fallos SMTP temporales (4xx o conexión) y resultados inciertos, con espera creciente propuesta de **1, 5 y 15 minutos** y **máximo 5 intentos**; después marca `FAILED`. Un fallo permanente SMTP (5xx o destinatario rechazado) pasa a `FAILED` sin reintento. `ACCEPTED` acredita aceptación SMTP, nunca entrega ni lectura. Los códigos 4xx/5xx se refieren a respuestas SMTP, no a respuestas HTTP. La política exacta de demora para todos los intentos, recuperación de reclamos y retención debe quedar parametrizada y probada en el incremento del trabajador.
5. El enlace es `${PUBLIC_WEB_ORIGIN}/pages/restablecer.html#token=…`. `PUBLIC_WEB_ORIGIN` se valida al arrancar: solo esquema y host, sin ruta; HTTPS obligatorio fuera del desarrollo local. Si falta o es inválido, el trabajador no arranca. Nunca se deriva de `Host`, `Referer` ni del body. El token en el fragmento no viaja en la solicitud de página; la página usa `Referrer-Policy: no-referrer`, no carga recursos externos, lee el fragmento y lo borra de la barra con `history.replaceState` antes de enviar el secreto en el cuerpo del POST. No lo conserva en almacenamiento ni en logs.
6. `POST /api/v1/auth/password-reset/confirm`, público con CSRF, recibe `{ token, password }`. Aplica la política vigente de 15–128 caracteres, espacios permitidos y Argon2id. Una transacción consume el token, cambia `users.password_hash`, invalida las demás acciones pendientes y revoca todas las filas activas de `auth_sessions` del usuario. La concurrencia solo permite un éxito. Token usado, vencido, inválido o mal formado responde **400** con un único mensaje genérico sin modificar cuenta ni sesiones; éxito responde **204**. El token vale 20 minutos desde su emisión.
7. Tras éxito, la interfaz lleva al login; no inicia sesión automáticamente. El enlace desde login, las dos pantallas y los mensajes siguen `frontend/DESIGN.md` D-02/03/04/07: etiquetas persistentes, foco visible, estados de envío, errores comprensibles, teclado y reflujo móvil.

La verificación inicial de correo con enlace de 24 horas mencionada por Edwin queda fuera de AUTH-CORREO-01 y requiere su propia spec. La aceptación funcional de Pablo no acredita que el adaptador SMTP actual implemente aún la clasificación de fallos ni que exista el trabajador.

## Acuerdo y brechas técnicas comprobadas

Edwin respondió por mensaje compartido por Pablo el 4 de noviembre de 2026. Pablo adoptó el diseño de trabajador, reintentos, reemisión, límites y respuestas HTTP, y cambió expresamente la vigencia de 30 a 20 minutos. Esta es la evidencia del acuerdo funcional; no se atribuye aprobación de código ni respuesta directa de Shirley.

En `origin/develop` `5ff50d9` no existen `auth_email_actions`, `encrypted_message`, `PUBLIC_WEB_ORIGIN` ni rutas de restablecimiento. El `smtp-mailer.js` compartido transforma actualmente cualquier error de `sendMail` en `MAIL_OUTCOME_UNCERTAIN`; no expone aún la distinción temporal/permanente que necesita el trabajador. Tampoco se encontró `SKIP LOCKED` en el código de Bookings consultado. El borrador de código sin commit citado por Edwin no está en esta rama: se toma la spec como base y no se reutiliza código no inspeccionado. La clasificación del adaptador y el arranque/operación del trabajador deben revisarse con Edwin y quien mantiene CORREO-01 antes de declararlos listos.

## Incrementos y comprobación

1. Preparar puertos pequeños de Auth/correo, clasificación segura de fallos SMTP y migración **nueva** para acciones/tokens, sin editar migraciones anteriores. Definir configuración y operación del trabajador con Edwin.
2. Implementar solicitud y emisión con pruebas unitarias e integración PostgreSQL aislado: cuenta existente/inexistente indistinguible, límites, duplicados, fallos SMTP y ausencia de secretos en logs.
3. Implementar consumo atómico y revocación de sesiones: token válido/vencido/usado, dos consumos simultáneos, política Argon2id y login antiguo rechazado.
4. Añadir interfaz y comprobar teclado, foco, lector de estado, escritorio/móvil y recorrido con backend real y transporte QA. La recepción en buzón real se comprueba solo con intervención del operador.
5. Ejecutar `npm run lint`, `npm run format:check` y `npm test` desde `backend/`; frontend lint/pruebas; si cambia la composición, comprobar arranque real. Registrar resultados sin ocultar fallos de la base.

La base original `5ff50d9` tenía un fallo de composición en `backend/src/server.js`; `origin/develop` `5c48d22` ya incorpora el hotfix 0.1.1. La actualización de esta rama desde ese commit requiere verificar la combinación; esta spec no declara operativo el arranque por inferencia. Sin cambios de producto, dependencias, migraciones ni pruebas en este incremento documental.

Guía de seguridad consultada: [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
