# Configurar correo para la demostración

Edwin eligió Gmail el 4 de noviembre de 2026. Estado: adaptador y comprobación preparados; cuenta/credenciales y recepción real pendientes de ejecutar por el operador. SMTP aceptado no significa entrega en el buzón. No compartir contraseñas ni capturas con secretos en el chat.

1. Usar una cuenta Gmail controlada por el equipo. Activar verificación en dos pasos y crear una contraseña de aplicación llamada transViaje. [Guía oficial de Google](https://support.google.com/accounts/answer/185833). Si la cuenta no ofrece esa opción, no desactivar protecciones: revisar sus restricciones o escoger otro proveedor.
2. En `backend/.env.smtp.local` (ignorado por Git), configurar estos nombres. Los valores de abajo son solo instrucciones; sustituirlos en el archivo local. El asistente no lee ese archivo.

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-cuenta@gmail.com
SMTP_PASSWORD=contraseña-de-aplicación-local
SMTP_FROM=tu-cuenta@gmail.com
SMTP_TEST_TO=tu-propio-correo-de-prueba
```

3. Desde backend, comprobar sin enviar:

```powershell
node --env-file=.env.smtp.local scripts/check-smtp.js --verify
```

4. Si devuelve CONFIGURATION_VERIFIED, enviar explícitamente una prueba al buzón propio configurado:

```powershell
node --env-file=.env.smtp.local scripts/check-smtp.js --send-test
```

5. ACCEPTED acredita solo aceptación SMTP. Abrir el buzón (incluido spam) y registrar la recepción humana sin incluir secretos ni datos personales en la evidencia. MAIL_OUTCOME_UNCERTAIN exige comprobar si llegó antes de repetir; el CLI no reintenta automáticamente. No enviar a clientes reales desde QA.

Los puertos permitidos son 587 con STARTTLS obligatorio y 465 con TLS desde el inicio, con validación del certificado. [Referencia de Gmail](https://developers.google.com/workspace/gmail/imap/imap-smtp), [Nodemailer SMTP](https://nodemailer.com/smtp). No usar la contraseña normal de Google. Rotar/revocar la contraseña de aplicación cuando deje de utilizarse.

Proton puede sustituir la configuración: SMTP directo requiere plan de pago con dominio propio, token SMTP y STARTTLS en smtp.protonmail.ch:587; una cuenta gratuita no alcanza. [Referencia oficial](https://proton.me/support/smtp-submission).

Este incremento verifica el adaptador; todavía no acredita integración de recuperación de contraseña, boleto, invitado o corrección. Esos consumidores deben registrar su aviso durable y usar el puerto de envío conforme a su spec. No anunciar correo entregado por una prueba con dobles ni por ejecutar verify.
