# FLEET-05: Pantalla de registro de buses

- **ID local:** FLEET-05; libre en las specs y ramas accesibles al comprobarlo el 31 de octubre de 2026.
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `frontend`; consume la API de `fleet`
- **Responsable:** Edwin, según la distribución de `docs/estado-proyecto.md`; por confirmar
- **Revisor propuesto / confirmado:** Pablo propuesto, por ser responsable de la base frontend; sin confirmación registrada
- **Estado:** En desarrollo; T1 local sin commit, T2 y T3 pendientes de las preguntas de la sección 10
- **Prioridad y dependencias:** FLEET-01, FLEET-02 y FLEET-03, presentes en develop. Requiere además la pantalla de inicio de sesión y FRONT-01 T3c/T3d, que no existen en develop (sección 10).
- **Rama / PR / base comprobada:** `feature/FLEET-05-pantalla-registro-buses`, creada desde `origin/develop` en `4f34748` el 31 de octubre de 2026; sin PR.
- **Autorización de alcance:** el 31 de octubre de 2026 se aprobó por chat esta spec e iniciar solo T1. Las preguntas 1 a 4 de la sección 10 siguen sin respuesta de Pablo.

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

1. **Inicio de sesión (bloqueante).** No hay pantalla de login en develop y `docs/design/pantallas.md` la asigna a Pablo en otra spec. Sin ella, nadie llega a esta pantalla con sesión. Participantes: Pablo y Edwin. Recomendación: esperar esa pantalla para T3 y avanzar T1 y T2, que no dependen de ella.
2. **FRONT-01 T3c/T3d (bloqueante).** La política común de sesión y recuperación CSRF sigue pendiente. Participantes: Pablo y Edwin. Recomendación: no crear una política propia.
3. **Límite del proxy (bloqueante para fotos reales).** `nginx-proxy.conf` no define `client_max_body_size`, y el valor por defecto de Nginx es 1 MB, por debajo del contrato de 50 MB. `proxy_read_timeout` es 10 s, y decodificar 10 fotos puede acercarse a ese tiempo. Estos archivos son compartidos. Participante: Pablo. Recomendación: permitir 51 MB y un tiempo mayor solo en `location = /api/v1/buses`, y medirlo con el proxy real.
4. **Transporte multipart.** `json-transport.js` solo envía JSON. Participante: Pablo. Recomendación: agregar un transporte hermano que reutilice errores y CSRF, sin duplicar `fetch`.
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
| T1: formulario sin envío | Página con validación y lista de fotos, probada con datos controlados | `Dockerfile`, `.dockerignore`, `app.css` |
| T2: transporte y proxy | Multipart con límites probado por el proxy real | `src/api/`, `nginx-proxy.conf`, `proxy-api.conf` |
| T3: lectura y envío reales | Recorrido completo en navegador real, tras resolver las preguntas 1 y 2 | Ninguno previsto |
| T4: evidencia | Capturas de 360 y 1280 px, resultados y estado del proyecto actualizados | `docs/estado-proyecto.md`, `frontend/DESIGN.md` |

Una sesión por paso. T2 requiere coordinar con Pablo antes de tocar los archivos compartidos.

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

## 14. Revisión y cierre

Pendientes. Próxima acción: consultar a Pablo las preguntas 1 a 4 antes de iniciar T2.
