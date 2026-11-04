# AUTH-CORREO-01: recuperar el acceso mediante correo

- **Responsable de preparación:** Pablo. **Revisora propuesta:** Shirley; revisión pendiente.
- **Estado:** borrador de contrato; sin implementación autorizada ni aprobación de revisión.
- **Base comprobada:** `origin/develop` `5ff50d9`, 4 de noviembre de 2026; rama `feature/AUTH-CORREO-01-recuperacion-cuenta`.
- **Reglas y decisiones:** RN-01/03 en [business-rules](../business-rules.md), [ADR 0004](../adr/0004-autenticacion-sesiones-credenciales.md), [CORREO-01](CORREO-01.md), [calidad](../calidad.md) y `frontend/DESIGN.md`.

## Objetivo y límites

Una persona que olvidó su contraseña solicita desde el login un enlace temporal al correo de su cuenta, establece una nueva contraseña y luego inicia sesión normalmente. Pablo confirmó el 4 de noviembre de 2026: **todos los roles**, vigencia del enlace de **30 minutos** y **revocación de todas las sesiones abiertas** al completar el cambio. La recuperación no crea sesión ni cambia el rol, correo o cooperativa de la cuenta.

La verificación inicial de correo, cambio de correo, MFA y recuperación cuando ya no se controla el buzón necesitan contratos separados. No se usarán preguntas de seguridad ni se enviarán contraseñas por correo. La pantalla de registro de `AUTH-WEB-02` puede integrarse antes o después: esta tarea parte del login ya existente en `develop`; al combinar ramas se revisarán los enlaces de `frontend/pages/login.html`.

El SMTP compartido (`backend/src/shared/mail/smtp-mailer.js`) solo informa aceptación del proveedor, no entrega. `CORREO-01` excluye expresamente la recuperación. La prueba real del buzón y la configuración del operador no están acreditadas por esta spec.

## Contrato propuesto para revisar

1. `POST /api/v1/auth/password-recovery/requests`, público con CSRF, recibe solo `email` normalizado como en login. Para un correo válido devuelve la misma respuesta y mensaje tanto si la cuenta existe como si no. No expone rol, existencia, estado de correo ni aceptación SMTP. Un límite por IP y por cuenta frena abuso sin crear bloqueos visibles que enumeren cuentas.
2. Para una cuenta elegible, Auth genera un token con fuente criptográfica segura, guarda solo su hash y fecha de caducidad, y solicita al puerto de correo un enlace de recuperación. El origen del enlace viene de configuración del servidor, nunca del `Host`, `Referer` ni del body. No se guarda el token en logs ni en analítica.
3. El enlace abre una página con nueva contraseña y confirmación. El token es secreto, de un solo uso y válido por 30 minutos. La página usa `Referrer-Policy: no-referrer`, no carga recursos externos y no conserva el token en almacenamiento del navegador. La URL y el historial se tratarán según el diseño aprobado antes de codificar.
4. `POST /api/v1/auth/password-recovery/resets`, público con CSRF, recibe token y nueva contraseña. Aplica la política vigente de 15–128 caracteres, espacios permitidos y Argon2id. Una transacción consume el token, cambia `users.password_hash` y revoca todas las filas activas de `auth_sessions` del usuario. La concurrencia solo permite un éxito. Token usado, vencido, inválido o mal formado produce un error seguro sin modificar cuenta ni sesiones.
5. Tras éxito, la interfaz lleva al login; no inicia sesión automáticamente. El enlace desde login, las dos pantallas y los mensajes siguen `frontend/DESIGN.md` D-02/03/04/07: etiquetas persistentes, foco visible, estados de envío, errores comprensibles, teclado y reflujo móvil.

Los nombres de rutas, códigos de respuesta y forma JSON son **propuestas**, no contrato aprobado. Los límites numéricos de solicitud/reenvío y la política de emisión de un nuevo token requieren concreción antes de implementar.

## Decisiones necesarias antes de implementar

| Pregunta | Propuesta | Participantes y efecto |
|---|---|---|
| ¿Cómo se registra y reintenta el aviso si SMTP falla o su respuesta es incierta? | Persistir una intención de envío sin prometer entrega; definir reintentos acotados y deduplicación antes de conectar el mailer. | Pablo y Shirley; afecta persistencia, estados y pruebas. |
| ¿Qué ocurre al solicitar otro enlace vigente? | Invalidar el anterior al emitir uno nuevo, con límite de frecuencia; nunca multiplicar enlaces activos. | Pablo y Shirley; afecta concurrencia y correo. |
| ¿Qué respuesta exacta y qué límites públicos se usarán? | Misma respuesta para cuentas existentes/inexistentes; límites configurables por IP y cuenta, sin filtrar existencia. | Pablo y Shirley; afecta HTTP, UX y pruebas. |
| ¿Cuál es la dirección pública autorizada para construir enlaces? | Valor de configuración obligatorio del servidor en el entorno que envía correos, validado como HTTPS fuera de desarrollo local. | Pablo y responsable del despliegue; evita enlaces manipulados. |

La implementación depende de cerrar estas preguntas y de la revisión de la spec. No se atribuye aceptación de Shirley por esta propuesta.

## Incrementos y comprobación

1. Cerrar contrato y puertos pequeños de Auth/correo; revisar dependencias y migración **nueva** para tokens/intenciones, sin editar migraciones anteriores.
2. Implementar solicitud y emisión con pruebas unitarias e integración PostgreSQL aislado: cuenta existente/inexistente indistinguible, límites, duplicados, fallos SMTP y ausencia de secretos en logs.
3. Implementar consumo atómico y revocación de sesiones: token válido/vencido/usado, dos consumos simultáneos, política Argon2id y login antiguo rechazado.
4. Añadir interfaz y comprobar teclado, foco, lector de estado, escritorio/móvil y recorrido con backend real y transporte QA. La recepción en buzón real se comprueba solo con intervención del operador.
5. Ejecutar `npm run lint`, `npm run format:check` y `npm test` desde `backend/`; frontend lint/pruebas; si cambia la composición, comprobar arranque real. Registrar resultados sin ocultar fallos de la base.

La base `5ff50d9` conserva un fallo de composición en `backend/src/server.js` informado para el hotfix #94. Esta spec no lo corrige ni declara operativo ese arranque. Sin cambios de producto, dependencias, migraciones ni pruebas en este borrador.

Guía de seguridad consultada: [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
