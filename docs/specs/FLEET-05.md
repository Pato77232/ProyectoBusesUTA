# FLEET-05: Pantalla de registro de buses

- **ID local:** FLEET-05; libre en las specs y ramas accesibles al comprobarlo el 31 de octubre de 2026.
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `frontend`; consume la API de `fleet`
- **Responsable:** Edwin, responsable de Fleet y solicitante de revisión/publicación
- **Revisor propuesto / confirmado:** Pablo propuesto, por ser responsable de la base frontend; sin confirmación registrada
- **Estado:** T1 en división: T1a y T1b reemplazan a PR #31, en borrador. T2 acordada con Pablo y sin iniciar; T3 espera el login. No es un alta funcional desde la pantalla
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

- [ ] Dado un administrador con sesión, cuando abre la pantalla, entonces ve solo los grupos de su cooperativa y las plantillas del catálogo.
- [ ] Dado un formulario válido con foto, cuando lo envía, entonces el bus queda registrado y la pantalla confirma con los datos devueltos por el servidor.
- [ ] Dado un doble clic en enviar, cuando la petición está en curso, entonces solo se envía un alta.
- [ ] Dada una foto cercana a 5 MB y una carga de 10 fotos, cuando se envían por el proxy real, entonces el alta responde 201.
- [ ] Dado un cambio de plantilla, cuando ya había asientos marcados, entonces esas marcas se limpian y la pantalla lo indica.
- [ ] Dada una cooperativa sin grupos, cuando abre la pantalla, entonces se explica que hace falta un grupo y no se permite enviar.
- [ ] Dado un 409, cuando el servidor rechaza el bus, entonces el formulario conserva datos y fotos y muestra el error.
- [ ] Dado un error, cuando se muestra, entonces el foco llega al mensaje y el texto no depende solo del color.
- [ ] Dado cualquier envío, cuando se inspecciona la petición, entonces no incluye `cooperative_id`.

## 8. Casos borde y errores

| Caso | Comportamiento |
|---|---|
| 400 | Mensaje general; el backend no indica qué campo falló y el contrato no se cambia aquí |
| 401 | Avisar que la sesión venció, conforme al contrato de FRONT-01 T3c/T3d |
| 403 | Indicar falta de permiso. Si es `CSRF_TOKEN_INVALID`, seguir la recuperación común |
| 404 | Indicar que el grupo ya no existe y recargar grupos |
| 409 | Indicar que placa, chasis o número de unidad ya están registrados |
| 413 | Indicar que la carga supera el tamaño permitido |
| Red, 502, 503 o 504 | Mantener el formulario. No reintentar solo: el alta pudo haberse completado |
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
3. **Tiempos del proxy.** `proxy_read_timeout` es 10 s, y decodificar 10 fotos puede acercarse a ese tiempo. Se validan con pruebas de carga en T2.
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
