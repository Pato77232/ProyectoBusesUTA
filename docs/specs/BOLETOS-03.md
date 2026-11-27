# BOLETOS-03: Agregar el boleto a Google Wallet

- **ID local:** BOLETOS-03
- **Ticket externo:** pendiente; el equipo evalúa Jira. No se inventan claves.
- **Módulo:** tickets (backend) y la pantalla «Mis boletos» (frontend).
- **Responsable:** Edwin (pato77232).
- **Revisor propuesto / confirmado:** pendiente; se propone a quien mantiene BOLETOS-01.
- **Estado:** Aprobada por Edwin el 10 de noviembre de 2026 («Vamos con lo de Boletos»). T1–T3 implementadas localmente, sin commits. Pendientes: configuración en Google (T0), prueba en Android (T4) y las preguntas de §10.
- **Prioridad y dependencias:** Media. Depende de BOLETOS-01 (boletos con `qrPayload`) y de la cuenta de emisor de Google Wallet. Apple Wallet queda fuera.
- **Rama / PR / base comprobada:** a petición de Edwin, en `feature/FRONT-02-cierre-flujo-web` (base `origin/develop` `162c80b`), el 10 de noviembre de 2026. Conviene separarla en commits propios. Sin PR.
- **Autorización de alcance:** el 10 de noviembre de 2026 Edwin pidió comenzar Google Wallet en esta rama. RN-55 lo aplazaba hasta después de la primera entrega, que ya ocurrió el 4 de noviembre de 2026. Edwin aprobó la spec el mismo día.

## 1. Objetivo

Que el cliente agregue cada boleto pagado a Google Wallet en Android y presente el mismo QR de BOLETOS-01 al abordar.

## 2. Reglas de negocio

- **RN-54:** solo se emite boleto de una compra aprobada (`SOLD`). El pase reutiliza ese boleto; no crea otro.
- **RN-55:** Wallet después de la primera entrega. Esta spec cubre solo Google Wallet.
- **Multi-tenant y propietario:** el pase solo se genera para el `CUSTOMER` dueño de la reserva, con la misma consulta de BOLETOS-01.
- **Privacidad:** el QR sigue codificando solo `TRANSVIAJE:TICKET:<code>`. La cédula nunca se envía a Google; el nombre del pasajero queda como pregunta abierta (§10).

## 3. Alcance

**Incluye:**
- Configuración por variables de entorno. Sin configuración, la función queda deshabilitada y el botón no aparece.
- Generar un JWT firmado (RS256) con un `transitObject` por boleto y devolver el enlace `https://pay.google.com/gp/v/save/<jwt>`.
- El botón «Agregar a Google Wallet» por boleto en «Mis boletos».

**No incluye:**
- Apple Wallet.
- Actualizar o anular el pase después de guardarlo (requiere la API REST con OAuth).
- Smart Tap y notificaciones.
- Crear la clase de pase desde código: se crea una vez en la consola (T0).
- Nuevas dependencias npm: la firma se hace con `node:crypto`.

## 4. Flujo principal

1. El cliente abre «Mis boletos» de una compra pagada.
2. El frontend pregunta si Google Wallet está habilitado. Si lo está, muestra el botón en cada boleto.
3. Al pulsarlo, el backend comprueba que el usuario es el dueño, arma el `transitObject` del boleto, firma el JWT y devuelve `saveUrl`.
4. El navegador abre `saveUrl`. Google pide la cuenta del usuario y guarda el pase con el QR.

## 5. Datos

**Variables de entorno**, nunca en el repositorio ni en `docker-compose.yml` con valores reales:

| Variable | Contenido |
|---|---|
| `GOOGLE_WALLET_ISSUER_ID` | ID numérico del emisor. |
| `GOOGLE_WALLET_CLASS_SUFFIX` | Sufijo de la clase creada en la consola, por ejemplo `transviaje_bus`. |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL` | Correo de la cuenta de servicio. |
| `GOOGLE_WALLET_PRIVATE_KEY_FILE` | Ruta del archivo de la clave privada dentro del contenedor, montado de solo lectura. |
| `GOOGLE_WALLET_ORIGINS` | Orígenes permitidos separados por comas, por ejemplo `http://localhost:8088`. |

**`transitObject` propuesto**, uno por boleto:

| Campo | Valor |
|---|---|
| `id` | `<issuerId>.<ticketId>` |
| `classId` | `<issuerId>.<CLASS_SUFFIX>` |
| `state` | `ACTIVE` |
| `tripType` | `ONE_WAY` |
| `ticketLeg` | `originName`, `destinationName` y `departureDateTime` (ISO 8601 con desfase −05:00) |
| `ticketNumber` | Código del boleto |
| `barcode` | `type: QR_CODE`, `value`: el `qrPayload` de BOLETOS-01, `alternateText`: el código |
| `passengerNames` | Según la decisión de §10 |
| `ticketCost` | Valor pagado, en USD |

**JWT:**
- Claims: `iss` (correo de la cuenta de servicio), `aud: "google"`, `typ: "savetowallet"`, `iat`, `origins` y `payload.transitObjects`.
- Se firma con RS256.
- Se envía un objeto por enlace para no superar los 1800 caracteres que Google recomienda.

## 6. Endpoints

| Método | Ruta | Roles | Respuestas |
|---|---|---|---|
| GET | `/api/v1/tickets/google-wallet/status` | CUSTOMER | 200 `{ enabled }` |
| GET | `/api/v1/tickets/bookings/:bookingId/tickets/:ticketId/google-wallet` | CUSTOMER (dueño) | 200 `{ saveUrl }`, 401, 403, 404, 503 `GOOGLE_WALLET_DISABLED` |

Las dos rutas responden con `Cache-Control: no-store`.

## 7. Criterios de aceptación

- [ ] Sin las cinco variables, `status` devuelve `{ enabled: false }`, el botón no aparece y el endpoint del pase responde 503.
- [ ] Dado un cliente dueño de una compra pagada, cuando pide el pase de su boleto, recibe un `saveUrl` cuyo JWT se verifica con la clave pública de la cuenta de servicio. El JWT contiene los claims de §5 y el `barcode.value` es exactamente el `qrPayload` del boleto.
- [ ] Otro cliente, un oficinista o una reserva no pagada obtienen 404 o 403, sin firmar nada.
- [ ] El JWT nunca contiene la cédula.
- [ ] En modo demo, una cuenta de prueba agrega el pase desde Android y el QR se lee igual que el impreso.

## 8. Casos borde y errores

- Si la clave falta, no se puede leer o es inválida al arrancar, Wallet queda deshabilitado y se registra un aviso sin imprimir la clave. La aplicación sigue funcionando.
- Si el `ticketId` no pertenece a la reserva, la respuesta es 404.
- Un JWT de más de 1800 caracteres es un error de integridad (500) y no se entrega truncado.

## 9. Pruebas esperadas

- **Unitarias:**
  - Construir el `transitObject` (campos, privacidad, formato de fecha).
  - Firmar y verificar el JWT con una clave RSA generada en la prueba.
  - Leer la configuración (deshabilitada o incompleta).
- **Integración:** la ruta con PostgreSQL aislado (dueño, ajeno, no pagada, deshabilitada), sin llamar a Google.
- **Frontend:** el controlador del botón (habilitado, deshabilitado, error).
- **Manual:** guardar el pase en un Android con la cuenta de prueba en modo demo.

## 10. Preguntas abiertas

- **`passengerNames`:** BOLETOS-01 excluyó el nombre del QR, y el pase lo enviaría a Google.
  - Opciones: (a) incluir el nombre completo; (b) no incluirlo.
  - Recomendación: (a). El pase ya es personal del cliente que lo guarda en su cuenta de Google, y ayuda a distinguir los pasajeros de una misma compra.
  - Participantes: Edwin y quien mantiene BOLETOS-01. Respuesta: pendiente.
- **Cuenta de emisor:** quién la registra y bajo qué correo; recomendación: una cuenta del equipo, no personal. Respuesta: pendiente.
- **Logo:** la clase exige un logo con URL pública HTTPS. Opciones: subirlo a un alojamiento público o usar el de la consola. Respuesta: pendiente.
- **Botón oficial:** las guías de marca de Google piden su botón «Agregar a Google Wallet». La implementación usa por ahora un botón de texto con el mismo rótulo, porque el recurso oficial debe descargarse e incluirse en el repositorio. Decidir si se incorpora antes de publicar. Respuesta: pendiente.

**Decisión provisional de implementación:** mientras `passengerNames` no tenga respuesta, el pase **no** envía el nombre del pasajero. Es la opción más privada y agregarlo después es un cambio de una línea.

## 11. Defecto inducido

No aplica.

## 12. Diseño SOLID y usabilidad

- **SRP:** separar en tres piezas:
  - `google-wallet-pass.js` (dominio): arma el objeto, sin firma ni HTTP.
  - `jwt-signer` (infraestructura): firma con `node:crypto`.
  - Caso de uso: reutiliza `viewOwnerTickets` y selecciona el boleto.
- **DIP:** el caso de uso recibe un puerto `walletLinkSigner`; sin configuración se inyecta un firmante deshabilitado.
- **OCP:** BOLETOS-01 no cambia. Apple Wallet podría añadirse luego con otro firmante.
- **Usabilidad:**
  - Se usa el botón oficial «Agregar a Google Wallet», según las guías de marca de Google.
  - Botón con estado de carga, error comprensible y uso por teclado.
  - El botón se oculta al imprimir y se usa uno por boleto, cada uno con su nombre accesible.

## 13. Plan y evidencias

| Tarea | Descripción | Quién |
|---|---|---|
| T0 | Configuración externa en Google (abajo) | Edwin |
| T1 | Dominio y firma del JWT, con pruebas unitarias | Código |
| T2 | Configuración, caso de uso y rutas, con pruebas de integración | Código |
| T3 | Botón en «Mis boletos», con pruebas | Código |
| T4 | Prueba manual en Android en modo demo | Edwin |

**T0. Configuración en Google** (según la documentación oficial consultada el 10 de noviembre de 2026):

1. **Cuenta de emisor:** en la [Google Pay & Wallet Console](https://pay.google.com/business/console/), crear o abrir la cuenta de negocio y entrar a «Google Wallet API». Anotar el **Issuer ID**.
2. **Proyecto de Google Cloud:** en [console.cloud.google.com](https://console.cloud.google.com), crear un proyecto (por ejemplo `transviaje-wallet`) y habilitar la [Google Wallet API](https://console.cloud.google.com/apis/library/walletobjects.googleapis.com).
3. **Cuenta de servicio:** crearla en [IAM → Cuentas de servicio](https://console.cloud.google.com/iam-admin/serviceaccounts/create) y copiar su correo. En la pestaña *Keys*, elegir *Add key → Create new key → JSON* y guardar el archivo **fuera del repositorio**.
4. **Autorizar la cuenta de servicio:** en la Pay & Wallet Console, ir a *Users → Invite a user*, poner el correo de la cuenta de servicio y elegir el nivel **Developer**.
5. **Clase de pase:** en la consola, en Google Wallet API, crear una clase de tipo **Transit** con *transit type* **Bus**, el nombre del emisor (transViaje, máximo 20 caracteres) y el logo. Anotar el sufijo del ID, la parte después de `issuerId.`.
6. **Usuarios de prueba:** mientras la cuenta esté en modo demo, agregar los correos de Google de quienes probarán. Los pases saldrán con «[TEST ONLY]».
7. **Publicación:** solo para producción, pedir *publishing access* desde la consola. No hace falta para la revisión académica.

Nunca subir el JSON a Git ni pegarlo en el chat. En local se monta como archivo de solo lectura en el contenedor y se apunta con `GOOGLE_WALLET_PRIVATE_KEY_FILE`.

**Implementación (10 de noviembre de 2026):**
- T1: `domain/google-wallet-pass.js` arma el `transitObject` (id `<issuerId>.<ticketId>`, `ticketLeg` con nombres de origen y destino en español y horas con desfase −05:00, `ticketNumber`, `barcode` QR con el `qrPayload` de BOLETOS-01 y `purchaseDetails.ticketCost.faceValue` en micros). No incluye la cédula ni, por ahora, el nombre. `infrastructure/google-wallet-link-signer.js` firma el JWT con RS256 usando `node:crypto` y rechaza enlaces de más de 1800 caracteres.
- T2: `infrastructure/google-wallet-config.js` lee las cinco variables. Sin ninguna, deshabilita en silencio. Incompletas, inválidas o con una clave ilegible o de otra cuenta, deshabilita con un aviso en el log que no incluye la clave ni el correo. El archivo de clave es el JSON de la cuenta de servicio; su `client_email` debe coincidir con `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`. `application/get-google-wallet-link.js` reutiliza `issueOwnerTickets` de BOLETOS-01, así que dueño, venta aprobada y cooperativa se validan igual. Rutas `GET /api/v1/tickets/google-wallet/status` y `GET /api/v1/tickets/bookings/:bookingId/tickets/:ticketId/google-wallet`, con `Cache-Control: no-store` y rol CUSTOMER. El módulo lee `process.env` por defecto, así que `server.js` no cambió. `docker-compose.yml` y `.env.example` reciben las cinco variables vacías.
- T3: `frontend/src/tickets/google-wallet.js` y `tickets-page.js`. Si el estado responde habilitado, cada boleto muestra «Agregar a Google Wallet» con nombre accesible por boleto, estado de carga y mensajes para 503, 404 y 401. Solo abre enlaces que empiezan con `https://pay.google.com/gp/v/save/`. El botón se oculta al imprimir.

**Evidencias:**
- Backend: 18 pruebas unitarias nuevas en `tests/unit/tickets/google-wallet.test.js` (objeto, privacidad, hora con cambio de día, firma verificada con clave pública, largo máximo, configuración válida e inválida sin filtrar secretos, caso de uso). Cuatro pruebas de integración en `tests/integration/tickets/google-wallet.http.test.js` con PostgreSQL aislado: estado, enlace firmado del dueño con el QR correcto y sin cédula ni nombre, 404 para otro cliente, reserva no pagada y boleto ajeno, y 503 sin emitir boletos cuando está deshabilitado.
- Frontend: 5 pruebas nuevas en `tests/tickets/google-wallet.test.js`; 459 de 459 y lint en verde.
- Docker QA: sin variables, el backend arranca, `status` responde `{ enabled: false }`, el enlace responde 503 y «Mis boletos» no muestra el botón. Con una clave RSA generada localmente (no de Google) montada de solo lectura, aparece «Agregar a Google Wallet: boleto 1 de 1» y el enlace mide 1524 caracteres, lleva el QR del boleto y no incluye la cédula. No se abrió Google con esa clave; la configuración de prueba se retiró.
- Pendiente: T0 y T4 con una cuenta de emisor real en modo demo.

**Avance de T0 (10 de noviembre de 2026, Edwin):** cuenta de Google Cloud con la Google Wallet API, cuenta de servicio y clave JSON creadas; la clave se guarda fuera del repositorio. En la Pay & Wallet Console se completó la información del negocio («TransViajes»). El LEI se dejó vacío y el acceso de publicación **no** se solicitó, porque solo hace falta para producción. La consola no ofreció ninguna opción para crear la clase Transit ni para encontrar el Issuer ID numérico; solo mostró «Acceso de publicación». El identificador alfanumérico de la cabecera de la consola corresponde al perfil de Google Pay, no al Issuer ID de Wallet. T0 queda bloqueada en la creación de la clase. Opciones a decidir: (a) volver a intentarlo desde la consola o con el soporte de Google; (b) crear la clase una sola vez con la API REST y la cuenta de servicio, lo que cambia §3 («Crear la clase de pase desde código» está fuera del alcance) y requiere aprobación.

**Cómo activarlo en local tras T0:** guardar el JSON fuera del repositorio, definir las cinco variables en el `.env` local y montar el archivo con un override local que no se versiona, por ejemplo:

```yaml
services:
  backend:
    volumes:
      - C:/ruta/fuera/del/repo/google-wallet.json:/run/secrets/google-wallet.json:ro
```

con `GOOGLE_WALLET_PRIVATE_KEY_FILE=/run/secrets/google-wallet.json` y `GOOGLE_WALLET_ORIGINS` con el origen desde el que se abre la app (por ejemplo, el del túnel).

## 14. Revisión y cierre

Aprobada por Edwin; pendiente de revisión humana del código. Sin commits ni push.
