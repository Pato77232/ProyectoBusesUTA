# FLEET-05: Pantalla de registro de buses

- **ID local:** FLEET-05; libre en las specs y ramas accesibles al comprobarlo el 31 de octubre de 2026.
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `frontend`; consume la API de `fleet`
- **Responsable:** Edwin, responsable de Fleet y solicitante de revisión/publicación
- **Revisor propuesto / confirmado:** Pablo propuesto, por ser responsable de la base frontend; sin confirmación registrada
- **Estado:** T1a, T1b, T2a y T2b integradas. T3 implementada en `ffc0798`, publicada en [PR #63](https://github.com/Pato77232/ProyectoBusesUTA/pull/63) en borrador: alta real verificada, con hallazgo de respuesta ambigua y revisión humana pendientes. No integrada ni cerrada.
- **Prioridad y dependencias:** FLEET-01, FLEET-02, FLEET-03 y FRONT-01 T3c/T3d, presentes en develop. T3 requiere además la pantalla de inicio de sesión (sección 10).
- **Rama / PR / base comprobada:** `feature/FLEET-05-T1a-validacion` y `feature/FLEET-05-T1b-formulario`, creadas desde `origin/develop` en `b60201e` el 1 de noviembre de 2026. Reemplazan a `feature/FLEET-05-pantalla-registro-buses` y a PR #31: https://github.com/Pato77232/ProyectoBusesUTA/pull/31.
- **Autorización de alcance:** el 31 de octubre de 2026 se aprobó por chat esta spec e iniciar solo T1. El 1 de noviembre Edwin aprobó dividir PR #31. La decisión sobre T2 consta en la sección 10.

## 1. Objetivo

Permitir al administrador operativo registrar desde el navegador un bus de su cooperativa, con sus datos, su plantilla de asientos y sus fotografías. Hoy el alta solo existe como `POST /api/v1/buses`; `frontend` no tiene ninguna pantalla autenticada.

## 2. Reglas de negocio involucradas

- **RN-01:** los permisos se comprueban en el backend; ocultar la pantalla no protege la operación.
- **RN-02:** la cooperativa sale de la identidad autenticada. El formulario nunca la envía.
- **RN-10:** chasis, marca de carrocería, color y fotografías son obligatorios.
- **RN-11:** el bus pertenece a un grupo existente de la cooperativa.
- **RN-12:** el bus se registra con una plantilla de asientos. Esta tarea no agrega VIP ni silla de ruedas.

## 3. Alcance

**Incluye:**

- Página `frontend/pages/registrar-bus.html` y su módulo ES.
- Carga de grupos y plantillas reales desde la API.
- Selección de posiciones no ofrecidas, porque no existe edición posterior del bus.
- Envío multipart reutilizando la gestión común de CSRF.
- Límite de cuerpo y tiempos del proxy suficientes para el contrato del alta.
- Empaquetado de los archivos nuevos en `Dockerfile` y `.dockerignore`.
- Pruebas de la pantalla y evidencia de usabilidad.

**No incluye:**

- Pantalla de inicio de sesión ni recuperación de sesión.
- Consulta, listado, edición o eliminación de buses.
- Crear grupos o plantillas; editor gráfico de asientos.
- Cambios en backend, migraciones o dependencias.
- Enlaces en la portada a funciones que el visitante no pueda usar.

## 4. Flujo principal

1. El administrador abre la página con una sesión vigente.
2. La pantalla pide grupos y plantillas y muestra un estado de carga.
3. El administrador completa los datos y elige grupo y plantilla.
4. La pantalla muestra los asientos de la plantilla por piso; el administrador marca los no ofrecidos.
5. El administrador adjunta de 1 a 10 fotografías y ve su lista antes de enviar.
6. Al enviar, el botón se deshabilita y se muestra el progreso de envío.
7. Con 201, muestra placa, unidad y capacidad devueltas y permite registrar otro bus.

## 5. Datos

Parte `data`, un JSON de texto:

| Campo | Control | Comprobación en el navegador |
|---|---|---|
| `plate` | Texto | Tres letras y cuatro dígitos, con guion opcional |
| `vin` | Texto | Obligatorio; sin patrón ni longitud, porque no se acordaron |
| `unitNumber` | Numérico | Entero positivo |
| `bodyworkBrand` | Texto | Obligatorio |
| `color` | Texto | Obligatorio |
| `busGroupId` | Lista | Grupo devuelto por la API |
| `seatLayoutId`, `seatLayoutVersion` | Lista | Plantilla devuelta por la API; `version` se envía como número |
| `disabledSeatKeys` | Casillas | Claves de la plantilla elegida; lista vacía por defecto |

Partes `photos`: de 1 a 10 archivos JPEG o PNG con extensión `.jpg`, `.jpeg` o `.png`, hasta 5 000 000 bytes cada uno. La suma permitida es 50 000 000 bytes.

La comprobación del navegador solo orienta. La validación que decide sigue en el backend, y la pantalla no duplica la decodificación de imágenes. No hay tablas ni migraciones nuevas.

## 6. Endpoints

Todos existen y exigen `COOPERATIVE_ADMIN`; esta tarea no agrega ninguno.

| Método | Ruta | Uso | Respuestas relevantes |
|---|---|---|---|
| GET | `/api/v1/bus-groups` | Llenar grupos | 200, 401, 403 |
| GET | `/api/v1/seat-layouts` | Llenar plantillas y asientos | 200, 401, 403 |
| POST | `/api/v1/buses` | Registrar el bus, con `X-CSRF-Token` | 201, 400, 401, 403, 404, 409, 413, 415 |

Rutas comprobadas en `backend/src/app.js`. El 201 devuelve `bus` con `plate` formateada, `unitNumber` y `capacity`.

## 7. Criterios de aceptación

- [x] Dado un administrador con sesión, cuando abre la pantalla, entonces ve solo los grupos de su cooperativa y las plantillas del catálogo.
- [x] Dado un formulario válido con foto, cuando lo envía, entonces el bus queda registrado y la pantalla confirma con los datos devueltos por el servidor.
- [x] Dado un doble clic en enviar, cuando la petición está en curso, entonces solo se envía un alta.
- [x] Dada una foto cercana a 5 MB y una carga de 10 fotos, cuando se envían por el proxy real, entonces el alta responde 201. Acreditado en T2b (PR #40); no se repitió en T3.
- [x] Dado un cambio de plantilla, cuando ya había asientos marcados, entonces esas marcas se limpian y la pantalla lo indica.
- [x] Dada una cooperativa sin grupos, cuando abre la pantalla, entonces se explica que hace falta un grupo y no se permite enviar.
- [x] Dado un 409, cuando el servidor rechaza el bus, entonces el formulario conserva datos y fotos y muestra el error.
- [x] Dado un error, cuando se muestra, entonces el foco llega al mensaje y el texto no depende solo del color.
- [x] Dado cualquier envío, cuando se inspecciona la petición, entonces no incluye `cooperative_id`.

## 8. Casos borde y errores

| Caso | Comportamiento |
|---|---|
| 400 | Mensaje general; el backend no indica qué campo falló y el contrato no se cambia aquí |
| 401 | Avisar que la sesión venció, conforme al contrato de FRONT-01 T3c/T3d |
| 403 | Indicar falta de permiso. Si es `CSRF_TOKEN_INVALID`, seguir la recuperación común |
| 404 | Indicar que el grupo ya no existe y recargar grupos |
| 409 | Indicar que placa, chasis o número de unidad ya están registrados |
| 413 | Indicar que la carga supera el tamaño permitido |
| Red, 502 o 503 | Mantener el formulario. No reintentar solo: el alta pudo haberse completado |
| 504 al registrar | Mantener datos y fotos, indicar resultado incierto y pedir comprobar si el bus existe antes de reenviar; sin reintento automático |
| Salir con cambios sin enviar | Sin aviso en este incremento |

Tras un error de red, reintentar puede responder 409 si el primer envío se completó. El mensaje debe advertirlo.

## 9. Pruebas esperadas

- **Módulo, con `node --test`:** armado de `data`, comprobaciones, límites de fotos, transporte multipart y traducción de errores.
- **Navegador real, en `frontend/tests/`:** recorrido con backend y datos ficticios, doble envío, 409, 413 y cooperativa sin grupos.
- **Proxy real:** 10 fotos cercanas al límite por Nginx, para acreditar límite y tiempos.
- **Empaquetado:** archivos nuevos servidos desde la imagen real.
- **Backend:** no cambia; se ejecutan lint, formato y `npm test` si se tocan archivos compartidos.

## 10. Preguntas abiertas

### Decisión: reparto de T2 y división de PR #31

- Estado: Propuesta de Pablo aceptada por Edwin para dividir PR #31; la aceptación de T2 falta enviarla a Pablo
- Fecha y participantes consultados: 1 de noviembre de 2026; Pablo y Edwin
- Reglas, specs y contratos afectados: FRONT-01, `frontend/src/api/`, `nginx-proxy.conf` y `proxy-api.conf`
- Opciones y recomendación: Pablo propuso que Edwin haga multipart y proxy como T2, y que él revise la integración
- Respuesta humana y evidencia de confirmación: mensaje de Pablo reenviado por Edwin en el chat: T3c/T3d integradas en `d0a5f8d`; multipart debe compartir cliente, caché CSRF y errores; límite de 50 065 536 bytes solo para `/api/v1/buses`; tiempos validados con pruebas de carga; conservar la configuración Nginx y los módulos API de T3d; dividir PR #31 conservando las pruebas
- Decisión y justificación: T1 se divide en T1a y T1b. El límite coincide con `MAX_REQUEST_BYTES` del backend
- Responsable de aplicarla y revisor: Edwin; Pablo revisa la integración
- Criterios de aceptación/pruebas que cambian: ninguno; el límite recomendado de 51 MB se sustituye por 50 065 536 bytes
- Trabajo dependiente e independiente: T2 no depende del formulario; T3 depende del login
- Decisión anterior que reemplaza, si aplica: recomendación de la pregunta 4 de agregar un transporte hermano

### Otras preguntas

1. **Inicio de sesión (bloqueante para T3).** Pablo continúa con el login; la pantalla visual está lista, falta conectarla y verificarla, y no hay fecha confirmada.
2. **FRONT-01 T3c/T3d.** Resuelta: integradas en `d0a5f8d`. No se crea una política propia.
3. **Tiempos del proxy.** Acuerdo de Pablo reenviado por Edwin el 2 de noviembre: `proxy_read_timeout 60s` solo para `/api/v1/buses`, 10 s para el resto y sin reintentos. Decisión y evidencia en la sección 14.
4. **Transporte multipart.** Resuelta en la decisión anterior; el diseño concreto se define en T2.
5. **Posiciones no ofrecidas.** Recomendación: incluir casillas por piso. Omitirlas registraría todos los asientos, y hoy no hay forma de corregirlo después. Si se prefiere posponerlas, el bus se envía con lista vacía. Decide el responsable.
6. **Acceso a la pantalla.** La portada no debe enlazar destinos no disponibles para el visitante. El menú por rol queda por definir con Pablo. Recomendación: acceder por URL directa hasta que exista ese menú.
7. **Responsable y revisor.** Por confirmar.

## 11. Defecto inducido

No aplica.

## 12. Diseño SOLID y usabilidad

- **Responsabilidades:** la página presenta; un módulo arma los datos; el transporte envía. La autorización y las reglas siguen en el backend.
- **Dependencias:** `fetch` se inyecta para probar el transporte, como en `json-transport.js`. No se crean abstracciones sin variación real.
- **DESIGN.md:** D-02, D-03, D-04, D-05 y D-07 se adoptan. Los estados de error y éxito de formularios no estaban definidos; esta tarea los propone con tokens existentes y registra en la guía lo que se adopte. M-04 orienta, pero solo se toma el alta de bus.
- **Plantilla base:** `lang=es`, viewport, un `h1`, `main`, enlace de salto, etiquetas persistentes y foco visible.
- **Estados:** carga, sin grupos, error de carga, listo, enviando, error y éxito.
- **Teclado:** todo el recorrido se completa sin ratón, incluidas casillas y selección de archivos.
- **Tamaños:** comprobar 360 px, 1280 px y zoom del 200 %; en móvil, una columna.

## 13. Plan y evidencias

| Paso | Resultado comprobable | Archivos compartidos |
|---|---|---|
| T1a: validación | Comprobaciones y armado del contrato con pruebas de módulo | `package.json`, `eslint.config.js` |
| T1b: formulario sin envío | Página con validación y lista de fotos, probada con datos controlados | `Dockerfile`, `.dockerignore`, `app.css`, `DESIGN.md` |
| T2a: multipart | Envío multipart por el cliente común, con su CSRF y errores | `src/api/` |
| T2b: proxy | Límite de 50 065 536 bytes solo en `/api/v1/buses`, medido con carga real | `nginx-proxy.conf`, `proxy-api.conf` |
| T3: lectura y envío reales | Recorrido completo en navegador real, tras resolver las preguntas 1 y 2 | Ninguno previsto |
| T4: evidencia | Capturas de 360 y 1280 px, resultados y estado del proyecto actualizados | `docs/estado-proyecto.md`, `frontend/DESIGN.md` |

Una sesión por paso. T1b y T2 no pueden integrarse antes de T1a y de la revisión de Pablo, respectivamente.

**Evidencias de T1** (31 de octubre de 2026, Windows, Node 24.22.0, Chrome local):

| Comprobación | Resultado |
|---|---|
| `node --test tests/api/*.test.js tests/fleet/*.test.js` | Pasa: 41 pruebas |
| ESLint de `src/api`, `src/fleet`, `tests/api` y `tests/fleet` | Pasa, invocado directamente |
| Prettier de los archivos nuevos | Pasa |
| `frontend/tests/registrar-bus-smoke.cjs` | Pasa: 8 comprobaciones, incluidos 360 px sin desbordamiento y orden de tabulación básico |
| `frontend/tests/smoke.cjs` (portada) | Pasa |
| `docker build` e inspección de la imagen | Página y módulos incluidos; sin `tests` |
| `frontend/tests/container-smoke.cjs` | Falla: espera 503 y recibe 502. Falla igual en develop `4f34748`, en la misma línea, porque el Dockerfile usa `nginx-proxy.conf`; no es de esta tarea |

**Límites:** T1 no consulta la API ni envía datos. La página publicada muestra el formulario deshabilitado y avisa que no está conectada; los datos de prueba solo existen en la prueba. No se comprobó zoom nativo del 200 %, lector de pantalla ni recorrido completo por teclado. `npm run lint` no funciona en Windows porque invoca `../backend/node_modules/.bin/eslint`; es un problema previo.

**Evidencias de la división** (1 de noviembre de 2026, T1a y T1b sobre `b60201e`, Windows, Chrome local):

| Comprobación | Resultado |
|---|---|
| Pruebas de módulo en T1a y T1b | Pasan: 92, incluidas las de T3d |
| ESLint directo y Prettier del incremento | Pasan en ambas ramas |
| `frontend/tests/registrar-bus-smoke.cjs` en T1b | Pasa: 8 comprobaciones |
| `frontend/tests/smoke.cjs` en T1b | Pasa |
| `docker build` e inspección de la imagen de T1b | Pasan: `pages`, `src/fleet`, `src/api` y las tres configuraciones Nginx presentes; sin `tests`; usuario `nginx` |
| `frontend/tests/container-smoke.cjs` en T1b | Pasa. El fallo 502/503 anotado en T1 ya no aparece sobre esta base |
| `frontend/tests/api-client-smoke.cjs` en T1b | Pasa |
| Imagen de T1b en ejecución | Página, módulos y estilos responden 200; pruebas y documentación responden 404; el formulario sigue deshabilitado |

## 14. Revisión y cierre

### Acuerdo de timeout de PR #40, 2 de noviembre de 2026

- Participantes: Pablo y Edwin; evidencia: mensaje de Pablo reenviado por Edwin en este chat. Pablo propone y autoriza ampliar a 60 s únicamente el timeout de lectura de buses, conservar 10 s en las demás rutas y no habilitar reintentos.
- Decisión aplicada: el valor general de 10 s se declara en el contexto `http` de `nginx-proxy.conf`; la ubicación exacta de buses lo sustituye por 60 s. Se retira la declaración del include `proxy-api.conf` para evitar duplicados. El timeout de conexión/envío y `proxy_next_upstream off` se conservan.
- Comprobación exigida: `nginx -t`, alta real demorada entre 10 y 60 s y exactamente un bus persistido. La demora se induce mediante un bloqueo de 15 s exclusivamente sobre la tabla de buses de la BD efímera; no se añade una pausa al backend de producción.
- Contrato de pantalla para T3: ante 504, conservar datos/fotos y mostrar «No pudimos confirmar si el bus se registró. Comprueba si ya existe antes de volver a enviarlo». Sin reenvío automático. La pantalla conectada aún no está implementada en esta PR; este comportamiento queda como criterio pendiente de T3, no como funcionalidad ya verificada. El estado HTTP 504 sigue disponible en el error del cliente común.
- Revisión de Pablo y nueva aprobación sobre el commit actualizado pendientes. El acuerdo de timeout no equivale a aprobar el código completo.
- Resultado real de la comprobación demorada: `nginx -t -c /etc/nginx/nginx-proxy.conf` aprobado; diez fotos de 4 787 782 bytes y alta en 12 847 ms (más de 10 y menos de 60 s), un único bus persistido antes y después de las cargas rechazadas con 413. Las 101 pruebas frontend y ESLint directo aprobaron. Esta verificación sustituye la conclusión anterior de mantener 10 s por la medición local de 7 720 ms.

### Revisión de T2a/T2b para publicación, 2 de noviembre de 2026

Edwin solicitó comprobar T2b y publicar PR si correspondía. Rama `feature/FLEET-05-T2b-proxy`: incluye su dependencia multipart T2a (`ac6e613`) y el proxy/prueba de carga T2b (`12e1882`), conservados en commits separados para revisión conjunta. Base de implementación `8886553`; referencia remota comprobada `origin/develop` `1fb0ade`. Sin merge/rebase ni cambios de producto durante esta revisión. No había PR de T2a/T2b al consultarlo.

- `npm test` frontend: 101 pruebas aprobadas (9 nuevas sobre las 92 anteriores).
- ESLint directo de `src/api` y `tests/api`: aprobado. El script lint conserva la incompatibilidad de ruta POSIX en Windows.
- Prettier con configuración backend sobre los JS del incremento: aprobado; `git diff --check` aprobado.
- `bus-upload-smoke.cjs`: alta real desde Chrome por Nginx y cliente multipart, diez JPEG de 24 MP y 4 789 180 bytes cada uno, completada en 7 720 ms; un bus persistido. Cargas excesivas reciben 413 tanto en `/api/v1/buses` como en otra ruta, sin crear otro bus.
- `container-smoke.cjs`: aprobado, incluyendo Nginx sin root, recursos/MIME, exclusiones y comportamiento API.
- `api-client-smoke.cjs`: aprobado con sesión real, CSRF, cookies, errores y caída del backend.

Los smokes usaron servicios Docker y PostgreSQL efímeros mediante el runtime de pruebas sin leer `.env`; sus recursos fueron eliminados. La medición es local, no garantiza tiempos en otros equipos o con concurrencia. Se mantienen los tiempos del proxy de 10 s: esta carga pasó sin ampliarlos. Solo `/api/v1/buses` admite 50 065 536 bytes y desactiva el buffering del cuerpo para evitar el tmpfs de 16 MB. No se cambió el backend ni se ejecutó su suite completa. No se modificaron pruebas para hacerlas pasar. Sin dependencias nuevas ni defectos inducidos. Implementación asistida por Claude Code; revisión/publicación asistidas por Codex. Revisión de Pablo pendiente; T3 y la pantalla conectada siguen fuera de este incremento.

Pendientes. Próxima acción: publicar T1a y T1b, cerrar PR #31 y confirmar a Pablo el reparto de T2.

### Revisión de T1 para publicación, 1 de noviembre de 2026

Edwin solicitó revisar FLEET-05 y abrir PR si era posible. Se revisaron los 12 archivos del commit 00085d5, sin modificar código de producto ni ampliar T1. Se aplicó frontend/DESIGN.md (D-02/03/04/05/07); las dos capturas se inspeccionaron visualmente. La rama conserva base 4f34748; develop comprobado en efcfcf2 y FRONT-01 T3c/PR #30 abierta. No se incorporaron esos cambios ni se afirma haber validado la combinación con develop.

| Comprobación actual | Resultado |
|---|---|
| npm test de frontend | 41 pruebas aprobadas |
| npm run lint de frontend en Windows | Fallido: el script usa una ruta POSIX al ejecutable y cmd no la reconoce, igual que documentaba T1 |
| ESLint directo con ../backend/node_modules/.bin/eslint.cmd sobre src/api, src/fleet y sus pruebas | Aprobado |
| Prettier con configuración explícita ../backend/.prettierrc.json | Aprobado en HTML, JS, CSS y pruebas del incremento |
| Prettier sin esa configuración | Advierte siete archivos: frontend no tiene configuración propia y el estilo predeterminado difiere; no se oculta el resultado ni se cambia código para aparentar conformidad |
| registrar-bus-smoke.cjs en Chrome real, perfil temporal | Ocho comprobaciones aprobadas: estado inicial deshabilitado, sin grupos, errores, cambio de plantilla, callback de prueba, fotos, móvil 360 px y orden básico de Tab |
| smoke.cjs de portada | Aprobado en escritorio, móvil y zoom 200 % emulado con CSS; no acredita zoom nativo |
| container-smoke.cjs | Fallido: /api/v1 responde 502 donde la prueba espera 503. Ya documentado en T1; Dockerfile/proxy y ese caso de prueba no cambiaron en develop respecto de la base al compararlos. No se debilita la comprobación ni se declara la ejecución aprobada |
| Comprobación específica de la imagen real de T1 | Aprobada: Nginx inicia sin root, página y ambos módulos 200, formulario deshabilitado y tests excluidos |
| git diff --check | Aprobado |

No se ejecutó una nueva suite backend en esta revisión de frontend: ningún archivo del backend cambió; no se certifica su combinación con la base remota actual. No se instalaron dependencias ni se alteraron políticas de scripts.

La PR se prepara en borrador exclusivamente para T1. El documento completo conserva el objetivo final, pero T2 (multipart/proxy), T3 (sesión y API real) y la aceptación humana no están completos. No se envió consulta a Pablo ni se presume su respuesta. Hay que acordar con él las preguntas 1–4; no duplicar la política común de sesión/CSRF. El cliente JSON de PR #30 no equivale a un transporte multipart ni está integrado al comprobarlo.

Capturas de T1 con datos ficticios inyectados solo por la prueba, sin red/API ni bus registrado; no representan la página habilitada en producción:

- [Escritorio, viewport 1280](../evidence/FLEET-05/formulario-1280.png).
- [Móvil, viewport 360](../evidence/FLEET-05/formulario-360.png).

La pantalla real publicada permanece deshabilitada y avisa que no está conectada. Sin revisión de código humana, integración ni cierre. Implementación original asistida por Claude Code (consta en 00085d5); revisión, repetición de pruebas y preparación de PR asistidas por Codex.
Publicación confirmada el 1 de noviembre: PR #31 abierta en borrador hacia develop, https://github.com/Pato77232/ProyectoBusesUTA/pull/31, con implementación 00085d5 y evidencia de revisión/capturas 213f8ab. Se publicaron las limitaciones de lint en Windows y del smoke Docker 502/503; no se presenta T1 como funcionalidad completa. Revisión humana, acuerdos con Pablo, conexión real e integración pendientes.

### T3: registro conectado, 3 de noviembre de 2026

Edwin pidió conectar el registro antes del listado. Rama `feature/FLEET-05-T3-registro-conectado`, creada desde `origin/feature/FLEET-07-T2-formulario-vip` en `aef6707` (PR #57, que ya incorpora develop), para no duplicar el formulario VIP. La pregunta 1 de la sección 10 quedó resuelta: el login está en develop por la PR #45.

**Implementación:**

- `src/fleet/bus-controller.js`: verifica con `/api/v1/auth/me` que la sesión sea `COOPERATIVE_ADMIN`, carga grupos y plantillas, revalida la sesión antes de enviar y manda `data` y `photos` como multipart por el cliente común. La cooperativa sale de la sesión, nunca del formulario. Una respuesta 201 sin `id`, `plate`, `unitNumber` y `capacity` válidos no se confirma: se trata como resultado incierto (ver corrección del hallazgo).
- Errores según la sección 8: 409, 400, 413, 415 y CSRF vencido conservan el formulario con su mensaje; 404 recarga la lista de grupos; 401 muestra el enlace al login; 403 bloquea; 502, 503, 504 y fallo de red muestran el aviso de resultado incierto acordado con Pablo, sin reintento automático.
- `bus-form-view.js` agrega `createBusFormView` (estados ocupado, bloqueado, sin sesión y registrado). `bus-page.js` es el punto de entrada. La página arranca con «Comprobando tu sesión…» y, tras el alta, ofrece «Registrar otro bus» junto al mensaje.

**Evidencia en Windows con Chrome:**

- Pruebas frontend: 135 de 135 aprobadas, 18 nuevas del controlador (sesión y roles, multipart sin cooperativa, revalidación, doble envío, cada error y respuesta no verificable).
- ESLint directo y Prettier correctos en los archivos tocados.
- `registrar-bus-smoke.cjs`: 9 de 9. Edwin autorizó adaptar su preparación: sirve la página sin `bus-page.js`, siguiendo el patrón de la prueba de frecuencias, y espera el nuevo texto inicial. Sus demás comprobaciones no cambiaron.
- `registrar-bus-api-smoke.cjs`, nueva, con backend, Nginx y PostgreSQL efímeros: sin sesión muestra el enlace al login; con administrador solo aparecen los grupos de su cooperativa; un doble clic registra un único bus con la cooperativa de la sesión, el asiento no ofrecido y el VIP correctos y una fotografía; repetir el alta responde 409 conservando placa y foto, con el foco en el mensaje. 3 de 3 aprobadas; se revisó la captura.
- Persistencia de fotografías: con `docker-compose.yml`, un archivo escrito en `/home/node/fleet-photos` desde un contenedor se leyó desde otro distinto, gracias al volumen `fleet_photos`. Variables ficticias en el entorno del proceso, sin leer `.env`; recursos retirados. El compose de desarrollo no tiene ese volumen, así que allí las fotos no sobreviven a recrear el contenedor.
- `container-smoke.cjs` falla en la portada por el enlace al login de AUTH-WEB-01, igual que en develop; no se modificó.

Pendiente: revisión humana. El listado y el detalle de buses quedan para una spec propia, porque requieren endpoints nuevos.

### Revisión de publicación de T3 por Codex, 3 de noviembre

PR #63 abierta en borrador desde `feature/FLEET-05-T3-registro-conectado`, commit funcional `ffc0798`, base `aef6707`. PR #57 comprobada integrada; `origin/develop` consultado en `c08ce6c`, sin merge/rebase en esta revisión. El diff solo incluye frontend Fleet y documentación; FLEET-08 permanece local y fuera del cambio. Se aplica frontend/DESIGN.md para mensajes, foco y acciones usando los estilos comunes (D-02/03/04/05/07).

Repetición real: **225/225 pruebas frontend** de las suites actuales, `npm run lint` aprobado, nueve comprobaciones del formulario y tres de API real aprobadas. La última cifra registrada de 135 corresponde a una ejecución anterior y no es el total de esta revisión. Chrome/Nginx/backend/PostgreSQL efímeros verificaron sin sesión, grupos del tenant, alta única con doble clic, VIP/no ofrecido/foto y 409 conservando datos/foco. Se inspeccionó la captura de confirmación con datos ficticios. Recursos Docker de QA eliminados, sin leer `.env`. No se repitió la suite completa backend ni el escenario de persistencia entre contenedores de producción, al no modificar esos archivos.

Formato HTML/JS del incremento aprobado con configuración backend; `app.css` advierte formato, y la copia de esa hoja anterior a T3 también falla el mismo check. No se declara formato global aprobado ni se reformatea la hoja compartida. `git diff --check` aprobado. No se repitió `container-smoke.cjs`; su fallo previo de portada permanece documentado.

Hallazgo pendiente antes de integrar: una respuesta exitosa incompleta o `RESPONSE_INVALID` no permite concluir que el alta fue rechazada. Actualmente cae en «No se aceptó el registro»; debe conservarse como resultado incierto y pedir comprobar existencia antes de reenviar, igual que los demás resultados ambiguos, sin reintento automático. Se mantiene este punto explícito en el borrador, sin cambiar producto ni pruebas durante la evaluación. La revisión/publicación fue asistida por Codex; falta revisión humana de Pablo.

### Corrección del hallazgo de publicación, 3 de noviembre

Edwin pidió resolver el hallazgo anterior. Una respuesta exitosa sin `bus` verificable, sin cuerpo o con `RESPONSE_INVALID` ya no muestra «No se aceptó el registro»: muestra el aviso de resultado incierto, conserva datos y fotos, libera el formulario y no reintenta, igual que 502, 503, 504 y fallo de red. Solo cambió `src/fleet/bus-controller.js`.

La prueba unitaria que fijaba el mensaje de rechazo para ese caso describía el comportamiento que el hallazgo declaró incorrecto; se reemplazó por tres casos (datos incompletos, sin cuerpo y `RESPONSE_INVALID`) que exigen el aviso incierto, un único envío y el formulario liberado. No se debilitó ninguna otra aserción.

Evidencia en Windows: 227 de 227 pruebas frontend (20 del controlador); ESLint y Prettier correctos en los dos archivos tocados. No se repitieron las comprobaciones con Chrome, porque no cubren este caso ni cambió la página. Falta revisión humana de Pablo.
