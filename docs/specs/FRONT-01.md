# FRONT-01: Base compartida del frontend

- **ID local:** FRONT-01
- **Responsable:** Pablo
- **Revisión:** T1 aprobada por Shirley; T2 y T3a integradas. T3b pendiente de revisión humana.
- **Estado:** T1, T2 y T3a integradas; T3b implementada localmente; T3c/T3d y T4 pendientes.
- **Fecha / base comprobada:** 29 de octubre de 2026; origin/develop f26415d. T2 integrada en 92d91d3 y T3a mediante PR #21 en e715c86.
- **Rama actual:** `feature/FRONT-01-T3b-cache-csrf`, creada desde f26415d.
- **Prioridad propuesta:** Alta, para desbloquear las pantallas de los cinco integrantes.
- **Dependencias:** ADR 0003/0004, INFRA-01 y contratos de autenticación existentes. El enfoque de [frontend-acuerdos.md](../frontend-acuerdos.md) está confirmado por reporte humano; completar los detalles técnicos de cada paso antes de ejecutarlo, sin volver a pedir el mismo acuerdo general.

## 1. Objetivo y conceptos

Proponer una base pequeña sobre la que cada integrante incorpore sus pantallas, con navegación consistente, acceso común a la API y mensajes comprensibles. Este documento no implementa pantallas ni declara el frontend terminado.

El **frontend** muestra información y recibe acciones; el **backend** valida permisos y reglas. Un **proxy** recibe las peticiones del navegador y reenvía `/api/v1` al backend. Servir ambos bajo el mismo **origen** significa usar el mismo protocolo, host y puerto desde el navegador, aunque haya contenedores separados. Esto facilita usar las cookies existentes sin introducir CORS entre orígenes.

## 2. Reglas y decisiones vigentes

- ADR 0003 ya define HTML, JavaScript con módulos ES y Bootstrap 5, servido por un contenedor propio; no proponer React, otro framework o un bundler como requisito de esta base.
- RN-01/02: ocultar un enlace no autoriza una operación. El backend conserva el control de roles y la cooperativa; el frontend no elige un tenant confiable ni decodifica el JWT para decidir permisos.
- ADR 0004: JWT en cookie HttpOnly, sin localStorage; mutaciones con CSRF y renovación después de login/logout. No agregar refresh tokens.
- Aplicar [calidad.md](../calidad.md). No introducir requisitos de fases futuras ni rol Chofer/Controlador.

## 3. Alcance propuesto de la implementación posterior

Incluye esqueleto HTML accesible, estructura de archivos compartida, Bootstrap 5 con versión exacta por acordar, contenedor frontend, proxy de `/api/v1`, cliente HTTP común y estados de carga/éxito/error. La primera vista solo comprueba conexión con la API real y ofrece navegación a páginas existentes.

No incluye formularios de login/registro, alta de cooperativas/oficinistas, flota, selección de asientos, reservas, pagos ni boletos. Cada pantalla tendrá una tarea con su spec. No crear enlaces que simulen funciones disponibles ni datos de viajes ficticios en producción. Tampoco cambiar esquema, dependencias de backend, permisos o reglas funcionales.

## 4. Contratos existentes comprobados

| Método / ruta | Resultado actual relevante para el cliente común |
|---|---|
| GET `/api/v1/health` | 200 con `{status: "ok"}`; no acredita por sí solo funcionamiento de módulos/pantallas |
| GET `/api/v1/auth/csrf` | 200 con `{csrfToken}` y cookies; respuesta no almacenable en caché |
| POST `/api/v1/auth/login` | 200 sin JSON de respuesta, con cookie HttpOnly; exige CSRF |
| GET `/api/v1/auth/me` | 200 con `{user}` o 401; devuelve identidad validada por el servidor |
| POST `/api/v1/auth/logout` | 204 sin cuerpo; exige sesión y CSRF |
| POST `/api/v1/auth/register` | 201 sin cuerpo; no inicia sesión; exige CSRF |

Formato de error backend: `{error: {code, message}}`. El cliente debe admitir éxitos vacíos, errores no JSON del proxy y fallo de red. Los contratos se comprobaron en app.js y auth/interfaces; esta tabla no agrega endpoints ni autoriza pantallas de autenticación.

## 5. Diseño propuesto para acordar

Estructura orientativa, no archivos implementados:

```text
frontend/
  index.html
  src/
    api/       cliente HTTP y gestión del token CSRF
    ui/        mensajes y navegación comunes
    styles/    estilos compartidos
  pages/       pantallas de cada tarea posterior
  assets/      recursos locales versionados
  Dockerfile
  nginx.conf   si se confirma Nginx como servidor/proxy
```

Mantener peticiones relativas a `/api/v1`, cookies de mismo origen y CSRF solo para la API interna. El token CSRF puede mantenerse en memoria y renovarse tras cambios de sesión. No reintentar automáticamente mutaciones ante un 403, timeout o fallo de red: podrían haberse aplicado; explicar la situación y permitir una acción explícita. No mostrar trazas ni insertar mensajes externos como HTML sin escapar.

El cliente HTTP devuelve datos o un error normalizado con estado/código/mensaje; la vista decide la navegación. Un 401 distingue ausencia/vencimiento de sesión, un 403 por rol distingue falta de permiso y `CSRF_TOKEN_INVALID` indica renovar el token. Un 429 conserva el mensaje sin inventar un tiempo de desbloqueo.

La ruta `/api/v1` no debe caer en un fallback HTML ni perder su prefijo al pasar por el proxy. Las respuestas privadas y de CSRF no deben cachearse. El equipo confirmó, según reporte de Pablo, Nginx y Bootstrap local como enfoque. La versión de imagen/Bootstrap y el puerto se elegirán y documentarán como detalles técnicos de los pasos correspondientes.

## 6. Riesgo de entorno local y HTTPS

El Compose actual usa NODE_ENV=production: cookies.js obliga Secure en producción y csrf.js usa `__Host-csrf_browser`. Un proxy local HTTP no debe dar por hecho que las cookies funcionarán en todos los navegadores. Proponer un perfil/override local explícito de desarrollo o HTTPS local; conservar HTTPS y cookies Secure en despliegue. No desactivar la seguridad de producción para hacer pasar una demostración.

La confianza del proxy para IP/protocolo debe definirse según la red real. server.js solo ofrece actualmente `TRUST_PROXY=loopback`; un contenedor proxy separado no es loopback del backend. Si se necesita cambiar esa política, delimitar una tarea específica y probar encabezados frente a peticiones directas; no confiar sin límites en X-Forwarded-For/Proto.

## 7. Criterios de aceptación propuestos

- [ ] Desde un mismo origen del navegador, cargar HTML/JS/CSS y consultar health real por `/api/v1`, sin URL de backend fija en cada pantalla.
- [ ] Mantener prefijo API, códigos HTTP y cookies; una API inexistente no devuelve una página HTML de éxito.
- [ ] Obtener CSRF, ejecutar un flujo de autenticación con cliente de pruebas y renovar token tras login/logout; no hace falta construir un formulario en esta tarea.
- [ ] Aceptar respuestas 200/201/204 vacías y diferenciar error de red, respuesta inválida, 401, 403, 429 y error de servidor sin inventar un resultado exitoso.
- [ ] El usuario ve carga, conexión lista o error recuperable y puede reintentar una lectura con teclado; no hay enlaces rotos ni navegación a funciones inexistentes.
- [ ] Verificar navegación con teclado, foco visible, 360/1280 px y zoom de 200 %, según calidad.md. No declarar esos escenarios aprobados sin ejecutarlos.
- [ ] Las imágenes Docker y Bootstrap tienen versiones fijas documentadas y origen/licencia comprobados antes de incorporarse.

## 8. Pasos pequeños posteriores a los acuerdos

| Paso propuesto | Resultado comprobable | Archivos previstos |
|---|---|---|
| T1: esqueleto y recursos | Página mínima accesible con Bootstrap local y navegación sin enlaces ficticios | frontend/index.html, estilos y recursos |
| T2: servir y conectar API | Contenedor y proxy de solo lectura verificados con health/404 y backend no disponible | Dockerfile, configuración de proxy y Compose/override acordado |
| T3: cliente HTTP común | Manejo de cookies/CSRF, respuestas vacías y errores, con dobles en pruebas y comprobación real | frontend/src/api y pruebas de contrato |
| T4: comprobar y documentar integración | Guía para añadir la primera pantalla y evidencia de criterios; no implementar pantallas de otros módulos | documentación y pruebas de navegador |

Una sesión por paso y revisión de su resultado. No asumir que redactar esta spec autoriza T1–T4. Confirmar el alcance y si conviene separar T3 en una spec propia antes de programar. Evitar que varias personas cambien simultáneamente navegación, Compose y cliente HTTP.

## 9. Pruebas y diseño SOLID

Separar transporte HTTP, gestión de sesión/CSRF y presentación. Inyectar fetch/reloj cuando una prueba necesite controlarlos; no crear clases o un sistema genérico de plugins sin variación real. Cada pantalla consume operaciones pequeñas y no reproduce reglas de descuentos, precios, roles o aislamiento del backend.

Pruebas futuras significativas: respuestas sin cuerpo, CSRF renovado, fallo de red, API no JSON, rol denegado y sesión vencida; integración real del proxy/cookies con datos ficticios. Los dobles no acreditan funcionamiento del proxy ni del navegador. Definir dónde se ejecutan las pruebas ES modules antes de elegir herramientas; una dependencia nueva requiere aviso y justificación.

## 10. Acuerdos y revisión

Constancia y consulta original en [frontend-acuerdos.md](../frontend-acuerdos.md). Pablo reportó el 25 de octubre de 2026 que todos aceptaron las recomendaciones por comunicación directa. La fuente es su confirmación humana, sin inventar acta, canal o respuestas individuales. No se necesita repetir la consulta general. El estado de trabajo paralelo de cada integrante y la revisión concreta por Shirley no se deducen de ese reporte. Codex no contactó a los compañeros ni tomó el silencio como aceptación.

Pablo autorizó T1 después de registrar el acuerdo: página mínima accesible y Bootstrap local con versión exacta, procedencia/licencia y comprobación visual. No adelantar T2–T4 ni formularios de negocio.

### Contrato acotado de T1

- Incorporar únicamente CSS de Bootstrap 5.3.8 y su licencia MIT desde las fuentes oficiales, con integridad SHA-384 registrada. No instalar paquetes ni incluir plugins JavaScript sin un componente que los necesite.
- Crear index.html con lenguaje español, enlaces de salto/contenido, landmarks y navegación solo hacia secciones existentes. Mostrar explícitamente que aún no se pueden buscar/comprar pasajes; no crear cuentas, horarios, precios o botones de compra ficticios.
- Separar estilos propios en src/styles/app.css y recursos de terceros en assets/vendor. No crear módulos API, rutas de negocio o directorios vacíos para aparentar implementación de pasos posteriores.
- Permitir cargar la base sin conexión externa y sin JavaScript; verificar enlaces, teclado, foco, contraste y reflujo a 360/1280 px y 200 %. No presentar una emulación como prueba en todos los navegadores.
- Usar un servidor estático temporal para revisar T1. No incorporar Docker/proxy antes de T2. Documentar el comando y dónde añadirá cada integrante sus futuras páginas.

## 11. Defectos inducidos

No aplica. No introducir ni corregir defectos académicos por esta tarea documental.

## 12. Evidencia de la fase documental anterior

Solo se redactaron documentos y la fila de estado correspondiente. No hay frontend implementado, dependencias instaladas ni cambios en backend, Compose o migraciones.

Verificaciones del 25 de octubre de 2026 sobre esta rama documental, Node 24.21.0:
- `npm run lint`: aprobado.
- `npm test`: 346 aprobadas, 239 unitarias y 107 de integración, contra PostgreSQL 16.13 en el proyecto Docker exclusivo `busesuta-front01-spec`. Sin cargar .env ni tocar datos reales. Contenedor y red temporales retirados al terminar.
- `npm run format:check`: fallido en los mismos 26 archivos preexistentes del backend, sin cambios de esta tarea en esos archivos. No es un defecto inducido autorizado.
- `git diff --check` y 24 enlaces locales de esta spec, propuesta y registro: aprobados.

Estas comprobaciones no acreditan frontend, proxy, cookies en navegador ni usabilidad visual: no existen en este incremento. No se agregaron pruebas que solo comprueben el texto de los documentos. Aprobación de implementación, revisión humana, publicación e integración pendientes. No se hicieron commits ni push en esta fase.

## 13. Incremento T1 — implementación local

El solicitante autorizó guardar los documentos y comenzar T1. Commit documental: `50dac78`. Se incorporan página estática, CSS propio, favicon SVG propio, Bootstrap 5.3.8 CSS local con licencia MIT y SHA-384 oficial, guía de ejecución y prueba de navegador con Node/Chrome sin paquetes adicionales.

La página funciona sin JavaScript ni recursos de red externos. Usa navegación interna y details/summary nativos; señala que búsqueda y compra no están habilitadas. No agrega formularios, endpoints, datos ficticios de viajes, cliente API, contenedores, cambios en backend ni otras dependencias de ejecución.

La primera comprobación de ampliación detectó desbordamiento por gutters de la rejilla; se corrigió el espaciado del HTML conservando la aserción de no desbordamiento. El controlador de prueba se completó con los eventos de carácter de Enter para reproducir el teclado del navegador sin reemplazarlo por clics. Se comprueba navegación real con Tab hasta la segunda pregunta y su apertura con Enter.

### Verificación inicial de T1 — 25 de octubre de 2026

| Comprobación | Resultado real |
|---|---|
| Prueba reproducible `node frontend/tests/smoke.cjs` | Aprobada en Chrome 153.0.8010.36 con Node 24.21.0 |
| Tamaños de 1280 y 360 px, sin desbordamiento | Aprobados; capturas desktop.png y mobile.png |
| Ampliación 200 % mediante CSS zoom | Aprobada sin desbordamiento; captura zoom-200.png. Es emulación, no zoom nativo |
| Tab/Enter, enlace de salto, foco y preguntas nativas | Aprobados en los tres escenarios |
| Bootstrap local y enlaces internos reales | Aprobados; sin recursos externos ni respuestas de error observadas |
| Contraste de las cinco combinaciones de texto usadas | Ratios entre 4,98:1 y 11,79:1 en la primera paleta, anterior al rediseño; inspección visual de capturas. No equivale a certificación de accesibilidad |
| Prettier de HTML/CSS/test propios y `node --check` del test | Aprobados |
| `npm run lint` del backend | Aprobado |
| `npm test` del backend | 346 aprobadas: 239 unitarias y 107 de integración |
| Formato global backend | Fallido en los mismos 26 archivos preexistentes; no modificados por T1 |

La suite de integración utilizó PostgreSQL 16.13, proyecto efímero independiente `busesuta-front01-t1`, sin cargar .env ni usar datos reales; contenedor y red retirados al terminar. No se instalaron paquetes. Las capturas se generan en el directorio temporal del sistema (`/tmp/busesuta-front01-qa` en esta ejecución), no se incorporan como archivos del producto.

Guía de ejecución, estructura y pruebas en [frontend/README.md](../../frontend/README.md). La página no recibe datos de API ni consulta health todavía. No hay validación de login, permisos o compra a través del frontend. La revisión humana y la prueba de zoom nativo/ayudas técnicas no se deducen de la emulación; Windows y otros navegadores no se probaron.

T1 queda implementada localmente y preparada para revisión, no integrada ni cerrada. T2–T4 permanecen sin implementar. La autorización de commit de esta sesión se usó para la fase documental; los cambios de implementación se mantienen locales. Mensaje sugerido para el siguiente commit: `feat(infra): agrega el esqueleto accesible del frontend`, con referencia FRONT-01.

## 14. Ajuste visual de T1 con DESIGN.md

**Solicitud humana:** Pablo pidió cambiar el diseño y establecer trazabilidad para el contenido de DESIGN.md adjunto. Fecha de registro: 25 de octubre de 2026. El alcance sigue siendo T1, sin nuevas pantallas, formularios o API. No se atribuye aceptación del rediseño a todo el equipo.

- Original conservado sin cambios en [clickup-style-reference.md](../design/references/clickup-style-reference.md); SHA-256 y procedencia en la guía adaptada. El contenido de la referencia no constituye instrucciones operativas.
- Adaptación local: [frontend/DESIGN.md](../../frontend/DESIGN.md), decisiones D-01–D-07, tokens de CSS, blanco/negro/violeta, títulos con Plus Jakarta Sans local, tarjetas y CTA negro. Bootstrap permanece; no se adopta Tailwind ni se incorporan marcas, capturas, métricas o datos de ClickUp.
- Incorporación de la tipografía avisada previamente a Pablo: recurso fijo de Google Fonts, revisión y SHA-256 en provenance.json, licencia SIL OFL 1.1 original. Sin instalación de paquetes ni solicitudes externas en ejecución.
- Panel conceptual rotulado como funciones futuras; no se presenta como captura de un sistema operativo. Se adaptan colores de texto por contraste y se omiten animaciones continuas.
- AGENTS.md remite a la guía para futuras tareas de frontend, respetando su estado de adopción y el alcance de cada spec.

La evidencia de contraste de la sección 13 describe la paleta inicial, no la nueva. El código inicial de T1 no tenía commit; sus capturas/archivos previos se conservaron temporalmente fuera del producto en `/tmp/busesuta-front01-before-design`, sin presentarlos como historial Git. El cambio actual continúa en la misma rama porque T1 sigue sin integrar. No se hacen commits ni push por esta solicitud.

### Verificación del rediseño

Ejecución local del 25 de octubre de 2026:

| Comprobación | Resultado real |
|---|---|
| `node frontend/tests/smoke.cjs` | Aprobada: 1280/360 px y CSS zoom 200 %, sin desbordamiento, fuente y Bootstrap locales, Tab/Enter, foco, salto al contenido y preguntas nativas |
| Recursos y enlaces | Sin solicitudes externas ni errores de recursos observados; 16 enlaces locales de los documentos relacionados comprobados |
| Contraste texto/fondo | Siete pares comprobados, entre 4,91:1 y 19,41:1; incluido violeta sobre insignia clara. Blanco sobre CTA negro: 16,29:1 |
| Capturas | Escritorio, móvil y ampliación inspeccionados en `/tmp/busesuta-front01-qa`; no se versionan como producto |
| Integridad | SHA-256 de referencia original, fuente y licencia comprobados contra las huellas registradas |
| Formato y sintaxis propios | Prettier HTML/CSS/test y `node --check` aprobados; `git diff --check` aprobado |
| `npm run lint` | Aprobado |
| `npm test` | 346 aprobadas: 239 unitarias y 107 de integración |
| `npm run format:check` | Fallido en los mismos 26 archivos preexistentes del backend; no se modificaron |

La primera ejecución aprobó las comprobaciones del navegador, pero terminó con ENOTEMPTY al retirar el perfil temporal de Chrome. Se añadieron reintentos acotados de limpieza; la ejecución completa posterior terminó con código 0, conservando todas las aserciones. PostgreSQL se levantó en el proyecto temporal `busesuta-front01-design`, sin leer .env ni usar datos reales; contenedor y red retirados al terminar. No se instalaron paquetes.

Las capturas y ratios no certifican accesibilidad completa. Zoom nativo, ayudas técnicas y otros navegadores siguen pendientes. La emulación de 200 % comprueba ausencia de desbordamiento; no sustituye la revisión humana de lectura y composición. T1 permanece local y en desarrollo; no hay aprobación humana del diseño, integración ni cambios T2–T4.

## 15. Identidad confirmada y referencias orientativas

Tras revisar el plan, Pablo confirmó nombre **transViaje**, logo aportado definitivo y blanco/negro/violeta. Los mockups son **solo guía**; no fijan campos, recorridos, funcionalidades o datos de negocio. Delegó a Codex decidir si conservarlos; se incorporan originales con SHA-256, [constancia de procedencia](../design/README.md) y [catálogo orientativo por página](../design/pantallas.md). DESIGN.md remite a estas fuentes y conserva la separación entre identidad y alcance funcional.

Este incremento es documental. HTML, CSS, favicon y backend no cambian; adaptar la identidad visible de T1 es el siguiente paso propuesto, sin volver a pedir nombre/logo/paleta. No se crearon derivados del logo, pantallas adicionales, commits ni push. Solo integridad/enlaces y diff comprobados; las pruebas de producto de la sección 14 son evidencia anterior, no una ejecución nueva.

## 16. Adaptación de identidad en T1

Pablo autorizó continuar con «hazlo» tras proponer adaptar la portada a transViaje y preparar recursos para encabezado, móvil y favicon. Este incremento actualiza únicamente identidad y documentación, sin cambiar backend, funcionalidades, repositorio técnico o T2–T4.

- Título, descripción, nombre accesible del enlace de inicio, panel conceptual y pie usan transViaje.
- Logo definitivo local, copiado sin cambios del original documental. El marco CSS retira visualmente márgenes exteriores conservando píxeles y proporción. Imagen decorativa dentro del enlace ya nombrado para evitar lectura duplicada.
- Favicon: ventana sobre el símbolo del PNG original, incrustado en un contenedor SVG sin solicitudes remotas. No es un trazado vectorial ni un logo redibujado. La fuente raster aumenta el tamaño frente a un icono vectorial; el fondo claro permanece. Procedencia, rectángulos de encuadre y límites en [assets/brand/README.md](../../frontend/assets/brand/README.md).
- Prueba de navegador conserva sus aserciones y añade carga efectiva del logo local; MIME PNG en el servidor de prueba.

### Verificación de identidad

Ejecución del 25 de octubre de 2026:

- Prueba de navegador final aprobada a 1280/360 px y ampliación CSS 200 %: logo/fuente/Bootstrap locales, enlaces, Tab/Enter, foco, salto al contenido y preguntas. Sin recursos externos ni errores observados. Capturas en `/tmp/busesuta-front01-qa` inspeccionadas; no equivalen a zoom nativo o certificación de accesibilidad.
- Favicon inspeccionado en Chrome a 16/32/64 px (`/tmp/transviaje-favicon-review.png`). Se corrigió el primer encuadre con recorte explícito para excluir la palabra; el símbolo conserva su origen. A 16 px pierde detalle por la complejidad del dibujo; no se atribuye nitidez vectorial al raster original.
- PNG del producto y PNG incrustado en favicon idénticos byte a byte al original documental. SVG parseado correctamente, enlaces locales y `git diff --check` aprobados. Sin «Buses UTA» en el HTML público.
- Prettier propio y sintaxis del test aprobados. `npm run lint` aprobado. `npm test`: 346 aprobadas (239 unitarias, 107 integración), con PostgreSQL temporal `busesuta-front01-brand`, sin leer .env ni usar datos reales; contenedor y red retirados. No se instalaron dependencias.
- `npm run format:check`: fallido en los mismos 26 archivos preexistentes del backend, sin modificaciones en ellos.

La revisión humana del resultado no se deduce de aprobar la identidad original. La implementación sigue local, sin commits ni push. T2–T4 permanecen pendientes.

## 17. Commits atómicos autorizados por Pablo

Pablo solicitó explícitamente guardar el avance. Se conserva la rama `feature/FRONT-01-base-compartida` y se separan tres cambios lógicos:

1. `152f5a2` — `chore(infra): incorpora recursos locales con sus licencias`.
2. `98d20bd` — `docs(infra): registra la identidad y las referencias de transViaje`.
3. Commit que contiene esta constancia — `feat(infra): agrega la portada accesible de transViaje`, con HTML/CSS, identidad local, prueba de navegador y estado de T1.

Todos referencian FRONT-01 y declaran asistencia de Codex. Los textos anteriores «sin commits» describen el estado en sus respectivas sesiones. T1 queda versionada en la rama local, sin push, integración o aprobación humana del resultado. T2–T4 siguen pendientes.

Validación previa a los commits: prueba de navegador aprobada en escritorio/móvil/CSS zoom 200 %, Prettier propio y `npm run lint` aprobados; `npm test` con 346 aprobadas (239 unitarias, 107 de integración). PostgreSQL aislado en `busesuta-front01-commits`, sin .env ni datos reales; retirado al terminar. `npm run format:check` falla en los mismos 26 archivos preexistentes del backend, sin cambios en ellos.

Al revisar archivos añadidos, `git diff --cached --check` detectó un espacio final en `frontend/assets/vendor/plus-jakarta-sans/OFL.txt:21`. Se conserva el archivo de licencia original y su SHA-256, sin reformatearlo; no se oculta la observación ni se debilita una prueba. Las comprobaciones anteriores de diff solo cubrían archivos rastreados en ese momento. El resto de los cambios propios pasa la comprobación de espacios; integridad de Bootstrap, fuente y referencias verificada.

## 18. Preparación documental de T2

Pablo autorizó preparar T2 mientras espera la revisión de T1. [Plan acotado de servidor/proxy](../frontend-t2-plan.md): versión fija propuesta de Nginx, puerto local 8081 configurable, Compose local independiente, política HTTP de desarrollo sin cambiar producción, contrato de rutas/caché/errores y matriz de pruebas reales.

PR de T1 [#16](https://github.com/Pato77232/ProyectoBusesUTA/pull/16) comprobada abierta y sin integrar, head `3285695`, base develop `c89b1b9`, revisión solicitada a Shirley. Preparación separada en `feature/FRONT-01-T2-proxy`, basada en el head de T1 para no modificar su PR. No se afirma aprobación humana ni se publica otra PR antes de revisar la dependencia.

Se conserva TRUST_PROXY desactivado en el alcance local: el backend verá la IP de Nginx. La confianza en un proxy de otro contenedor necesita una tarea acotada y pruebas antes del login integrado/rate limiting por cliente o despliegue. T2 cubre transporte de lectura, cookies CSRF y preservación de errores, no cliente HTTP o pantallas de autenticación.

Estado real: solo documentación, no Dockerfile/configuración/Compose nuevos ni dependencias instaladas. Imagen, arranque real, cookies, fallos y recuperación del upstream pendientes de ejecución. No se ejecutaron otra vez las pruebas de producto por no cambiar código/configuración; no se atribuyen resultados de T1 al proxy. Enlaces locales y diff de la preparación comprobados. Sin commit ni push en esta sesión.

## 19. T2.1 — empaquetado estático con Nginx

Pablo autorizó continuar después de proponer T2.1. Se incorporan `frontend/Dockerfile`, `.dockerignore` y `nginx.conf`: imagen oficial Nginx 1.30.6 alpine3.24-slim fijada por versión/digest, servidor en 8080 como usuario nginx no root y rutas temporales en /tmp. El runtime se comprobó con raíz de solo lectura, tmpfs y capacidades retiradas.

Se copia solo portada, CSS y assets; no se incluye documentación/tests/provenance.json y se conservan licencias. Estáticos reales, 404 sin fallback, listado desactivado y logs sin query/cookies. API todavía no conectada: `/api/v1` y subrutas responden 503 JSON `API_NOT_CONNECTED` con no-store. No es un upstream funcional ni se declara T2 completo.

Prueba nueva `node frontend/tests/container-smoke.cjs`, junto con soporte QA_BASE_URL en smoke.cjs para reutilizar sus expectativas sobre Nginx en loopback. No se cambian aserciones existentes ni se instalan paquetes. Comandos de ejecución y procedencia en [frontend/README.md](../../frontend/README.md).

### Resultados reales

- Imagen descargada: digest `sha256:dede8895648b461178c3bc604f7eed4423efe5220b2c4d839f5eb3d34ac3f8f7`; `nginx -v` confirma 1.30.6 y `nginx -t` aprobado. Usuario efectivo UID/GID 101, licencia Nginx conservada en la imagen final.
- La primera prueba falló porque TTF se servía como application/octet-stream. Se corrigió nginx.conf con font/ttf; no se cambió la expectativa. Ejecución final completa aprobada.
- Verificados HTTP 200 y MIME de HTML/CSS/PNG/SVG/TTF, 404 de archivos ausentes y documentación excluida, 403 de directorio sin índice y 503/no-store/JSON explícito de API pendiente.
- Pruebas de navegador aprobadas sobre el contenedor: 1280/360 px, ampliación CSS 200 %, logo/fuente/Bootstrap locales, Tab/Enter, foco, salto, preguntas y ausencia de desbordamiento/recursos externos. Capturas en `/tmp/busesuta-front01-qa`. No certifica zoom nativo ni accesibilidad completa; la identidad visual no cambió.
- Prettier de pruebas propias, sintaxis Node y diff: aprobados. `npm run lint`: aprobado. `npm test`: 346 aprobadas, 239 unitarias y 107 integración.
- `npm run format:check`: fallido en los mismos 26 archivos preexistentes del backend, sin cambios en ellos.

PostgreSQL temporal `busesuta-front01-t21`, sin cargar .env ni datos reales; contenedor/red retirados. El contenedor de prueba Nginx se retiró en finally; la imagen queda en caché local. Backend, Compose existente y migraciones sin modificaciones. T2.2 (conexión), T2.3 (errores/cookies con backend) y T2.4 siguen pendientes, igual que la resolución de confianza de IP antes de login integrado. Sin commit, push o cambios en la PR #16 en esta sesión.

## 20. Guardado de T2.1 y decisión de continuidad

Pablo solicitó commits atómicos y decidir si continuar o esperar. Plan guardado en `2815747` (`docs(infra): define el plan del proxy local del frontend`). El commit de implementación que contiene esta constancia (`feat(infra): empaqueta la portada con Nginx`) guarda Dockerfile, exclusiones, configuración, pruebas y evidencia/estado relacionados. Ambos referencian FRONT-01 y declaran asistencia de Codex. Sin push ni cambios en la PR #16.

Comprobación remota: PR #16 abierta, sin integrar, solicitud a Shirley y lista de revisiones vacía; develop sigue en `c89b1b9` después de fetch. No se confunde el merge commit provisional que informa GitHub con una integración real.

**Decisión recomendada por Codex:** esperar el resultado de la revisión de T1 antes de ampliar T2 con T2.2. T2.1 ya ofrece un incremento comprobable y depende de la portada pendiente; recibir primero las observaciones reduce cambios simultáneos sobre esa base y conserva la revisión por incrementos. Es una recomendación de coordinación, no una aprobación del equipo ni un bloqueo técnico inventado. No se declara T2 integrada/cerrada y no se crea una PR que duplique T1.

Al llegar la revisión: atender sus observaciones y comprobar el método/commit real de integración (incluido posible squash); después preparar la continuación de T2.2 sobre el historial acordado. No ejecutar merge/rebase ni asumir que un squash conserva los commits originales.

Verificación previa al guardado: contenedor Nginx y navegador aprobados; formato propio, sintaxis y enlaces/diff aprobados; lint aprobado. npm test contra PostgreSQL temporal `busesuta-front01-t21-commits`: 346 aprobadas (239 unitarias y 107 integración); contenedor y red retirados al terminar. Formato global del backend conserva los 26 archivos preexistentes; no se modificaron. No se leen .env ni datos reales.

## 21. T1 integrada y T2.2 — entorno local y proxy real

Fecha: 26 de octubre de 2026. Pablo autorizó implementar T2.2 tras el análisis de integración. Shirley aprobó PR #16 y esta se fusionó en develop mediante `eebfe7550a869018211088530a6160261b95f8f5`, con padres c89b1b9 y 3285695. El árbol de ese merge coincide con T1. La rama `feature/FRONT-01-T2-proxy` sigue válida y su diferencia contiene T2. Las recomendaciones anteriores de esperar quedan superadas; no se ejecutaron merge, rebase o cambios a develop.

### Cambio acotado

- Compose local independiente: PostgreSQL efímero en tmpfs, migración con script existente, backend NODE_ENV=development/TRUST_PROXY=false y frontend. Solo el frontend publica en loopback; no se comparten volúmenes o datos existentes.
- Lanzador Node up/status/down: credenciales aleatorias en memoria y env-file vacío temporal para impedir carga implícita de .env; configuración validada sin imprimir valores. Rechaza reutilizar un proyecto ya existente antes de generar otro arranque con nuevas credenciales. Limpieza del entorno propio en fallo.
- Imagen frontend con configuración adicional nginx-proxy.conf y proxy-api.conf. El modo sin Compose conserva nginx.conf/503 de T2.1; las pruebas previas no se debilitan. Configuración adicional excluida del contenido público.
- Upstream real backend:3000 con zona compartida y resolución dinámica del DNS Docker; prefijo API preservado, caché de proxy desactivada, cabeceras de red sobrescritas/eliminadas, sin interceptar errores o repetir mutaciones automáticamente. Tiempos de conexión/lectura/escritura acotados.
- Sin cambios de aplicación backend, migraciones, reglas de negocio, Compose de producción, TLS, login o cliente HTTP. No se amplía confianza de proxy/IP.

### Verificación real de T2.2

| Comprobación | Resultado |
|---|---|
| node frontend/tests/proxy-smoke.cjs | Aprobado con stack Docker real y proyecto QA propio |
| Frontend antes de existir backend/DNS | Portada 200, API con error 502/503/504, sin falso health |
| DB, migraciones y server.js reales | Servicios saludables, migración exitosa, health 200 JSON por /api/v1 con query |
| Errores y rutas | 404 JSON real de API inexistente y /api/v1; 401 JSON de auth/me; /api/v10/documentación/scripts ausentes sin fallback HTML |
| Aislamiento local | Solo puerto frontend en loopback; DB/backend sin puertos publicados y sin volúmenes persistentes de datos; development:false comprobado |
| Backend detenido y reiniciado | Portada disponible, API con error acotado, recuperación posterior |
| Backend recreado con IP distinta | Dirección anterior ocupada temporalmente por contenedor auxiliar, cambio real exigido; health recuperado sin recrear ni reiniciar Nginx |
| Navegador sobre el proxy | 1280/360 px y ampliación CSS 200 %, recursos locales, teclado/foco/salto/preguntas sin desbordamiento; no certifica zoom nativo |
| Regresión node frontend/tests/container-smoke.cjs | Aprobada; modo estático y todas sus aserciones conservados |
| Lanzador up/status/down | Probado en Linux en 127.0.0.1:8081, portada y health 200; nginx -t -c /etc/nginx/nginx-proxy.conf aprobado; entorno retirado |
| Prettier/sintaxis propios y diff | Aprobados |
| Backend lint / npm test | Aprobados, 346 pruebas: 239 unitarias y 107 integración |
| Backend format:check | Fallido en los mismos 26 archivos preexistentes, sin cambios en ellos |

QA genera credenciales sin imprimirlas y retira contenedores, auxiliar, red y archivo temporal en finally. La suite backend usó PostgreSQL separado `busesuta-front01-t22`; entorno de lanzador y contenedores de regresión también retirados. Las imágenes quedan en caché local. No se leyeron .env ni datos reales, ni se agregaron dependencias de proyecto; se construyeron las imágenes con los Dockerfiles/dependencias ya existentes.

T2.2 implementado localmente, sin commit ni push. T2.3 verificará cookies/CSRF del navegador y cabeceras manipuladas; no se deduce su aprobación de health o del 401. El proxy sigue agrupando la IP de los clientes: no se declara validado rate limiting individual, HTTPS o autenticación completa. T2.4 y T3/T4 siguen pendientes. Guía de ejecución en frontend/README.md.

## 22. Guardado autorizado de T2.2

Pablo solicitó explícitamente un commit atómico de T2.2 y continuar después con T2.3. El commit que contiene esta constancia guarda el entorno local, proxy, lanzador, pruebas y documentación bajo `feat(infra): conecta el frontend con la API en el entorno local`, con referencia FRONT-01 y asistencia de Codex. Las constancias anteriores «sin commit» describen sus sesiones; no hubo nuevos cambios de producto después de la verificación completa de la sección 21 y antes de este guardado.

T2.2 queda versionado en la rama actual. T2.3 queda autorizado para comprobar cookies/CSRF reales y cabeceras manipuladas; no incluye formularios, login completo ni ampliación de confianza de proxy. Sin push.

## 23. T2.3 autorizado — cookies/CSRF y cabeceras

Pablo autorizó continuar después del commit de T2.2 `4d37295`. Alcance: pruebas del navegador sobre backend/DB/proxy reales, cookies HTTP de desarrollo, CSRF ausente/alterado/antiguo/con otro vínculo y ruta positiva hasta validación de datos sin crear usuarios o sesiones. Comprobar no-store, separación HttpOnly y retransmisión real; no exponer valores de cookies/tokens en logs o evidencia.

Para cabeceras, separar dos evidencias: comportamiento de cookies del backend real con X-Forwarded-Proto falsificado, y transporte observado por un receptor HTTP de diagnóstico efímero que reemplaza al backend únicamente al final de la prueba. El receptor no acredita autenticación, pero permite observar eliminación/sobrescritura de cabeceras y preservación de método/URI/query/cuerpo sin añadir endpoints de diagnóstico a la aplicación.

Verificar además las banderas de cookies del backend real en una instancia QA con NODE_ENV=production, conservando configuración de seguridad; esta lectura de Set-Cookie por HTTP no acredita TLS ni almacenamiento por navegador HTTPS. Mantener TRUST_PROXY=false y no ampliar permisos. Usar bases/proyectos exclusivos, comprobar ausencia de usuarios/sesiones creados y retirar perfiles/configuraciones auxiliares al terminar. No implementar login, UI, cliente HTTP o nuevas dependencias. Resultado de la ejecución final: aprobado, incluida la comprobación de copiar token y cookie legible entre perfiles con distinto nonce HttpOnly.

### Evidencia de T2.3 — 26 de octubre de 2026

| Comprobación | Resultado real |
|---|---|
| node frontend/tests/csrf-smoke.cjs | Aprobado sobre Chrome y backend/DB/proxy reales en proyecto QA exclusivo |
| Cookies y respuesta CSRF | 200/no-store y dos Set-Cookie observados por CDP; cookies almacenadas con HttpOnly diferencial, SameSite=Lax, Path=/ y Secure ausente en HTTP development |
| Lectura JavaScript y reenvío | Cookie de vínculo HttpOnly no visible en document.cookie; token válido alcanza 400 VALIDATION_ERROR con cuerpo vacío de datos, probando reenvío sin registrar cuenta |
| Rechazos 403/no-store | Sin cabecera, token alterado, cookies omitidas, token previo tras rotación, token de otro perfil y token/cookie legible copiados con otro nonce |
| Perfil independiente y rotación | Dos perfiles efímeros, casos positivos propios y token renovado verificados, sin recursos externos |
| X-Forwarded-Proto falso sobre backend real | No convierte las cookies de desarrollo HTTP en Secure ni __Host; confianza no ampliada |
| NODE_ENV=production en backend QA real | Dos Set-Cookie con Secure/SameSite=Lax/Path=/ y sin Domain; nonce __Host-csrf_browser HttpOnly y csrf_token legible. Lectura HTTP, no TLS ni prueba de aceptación en navegador HTTPS |
| Receptor de transporte separado | POST, URI, query y cuerpo preservados; Forwarded eliminado y X-Real-IP/X-Forwarded-For/Proto/Host/Port sobrescritos según proxy-api.conf. No acredita autenticación ni separación por IP |
| Efectos de las pruebas | Cero usuarios y cero sesiones antes/después de los casos sobre backend real |
| Prettier/sintaxis propios, enlaces y diff | Aprobados |
| npm run lint / npm test | Aprobados, 346 pruebas: 239 unitarias y 107 integración |
| npm run format:check | Fallido en los mismos 26 archivos preexistentes del backend, sin modificarlos |

Solo se añadieron pruebas y documentación; el código productivo/Compose/proxy de T2.2 y las pruebas anteriores permanecen sin cambios. No se agregaron dependencias. Tokens/cookies se mantienen en memoria y no se incluyen en mensajes de aserción, archivos o evidencia; los perfiles, configuración temporal, receptor y contenedores se retiran en finally. La suite backend usa PostgreSQL aislado busesuta-front01-t23; contenedor/red retirados al terminar. Las imágenes quedan en caché local.

No se valida login/logout end-to-end, renovación CSRF ligada a una sesión autenticada, vencimiento tras esperar 600 segundos en navegador, TLS, Windows/otros navegadores o rate limiting individual; la IP sigue agrupada en Nginx. T2.4, tarea de confianza del proxy y T3/T4 pendientes. T2.3 permanece local sin commit/push y sin aprobación humana; únicamente T2.2 se guardó en el commit solicitado 4d37295.

## 24. Guardado autorizado de T2.3

Pablo solicitó guardar T2.3 en commit(s) atómicos y continuar con T2.4. Las pruebas de cookies/CSRF, su helper de Chrome y su documentación forman un único cambio lógico: `test(infra): verifica cookies y CSRF del proxy en navegador`. El commit que contiene esta constancia conserva la verificación completa de la sección 23; no hay cambios de producto desde esa ejecución. Referencia FRONT-01 y asistencia de Codex. Sin push.

T2.3 queda versionado; T2.4 autorizado para consolidar la guía, los criterios y el material de revisión, sin publicar una PR ni implementar T3.

## 25. T2.4 — guía y preparación de revisión

Pablo autorizó continuar después de guardar T2.3 en `cddbe34`. Se añade [GUIA-INTEGRACION.md](../../frontend/GUIA-INTEGRACION.md) para los integrantes: arranque/limpieza, modos de prueba, diagnóstico, preparación de la primera pantalla y límites. No se implementan pantallas de ejemplo, módulos vacíos, cliente HTTP o T3.

La guía señala que Dockerfile/.dockerignore incluyen rutas concretas: una futura página/módulo ES deberá ampliar esas listas dentro de su propia tarea, con prueba desde la imagen real. No copiar todo el repositorio ni dar por disponible un cliente HTTP aún inexistente. Reglas de negocio/roles permanecen en backend y se coordina navegación/recursos compartidos con Pablo.

La [matriz de revisión de T2](../revision-FRONT-01-T2.md) contrasta todos los criterios generales de FRONT-01: transporte/CSRF anónimo comprobados, cliente HTTP y recorridos autenticados pendientes de T3/T4. Incluye comandos, evidencia, material de PR y límites reales. No se declara aprobada toda FRONT-01 por marcar las pruebas específicas de T2.

### Auditoría final de T2.4 — 26 de octubre de 2026

- Sobre cddbe34: container-smoke, proxy-smoke y csrf-smoke ejecutados secuencialmente, aprobados; código de producto/pruebas previas no modificado por T2.4.
- Backend: lint aprobado; 346 pruebas aprobadas (239 unitarias, 107 integración). PostgreSQL temporal aparte busesuta-front01-t24, sin .env ni datos reales; contenedor y red retirados. Proyectos QA, receptor, perfiles y configuraciones temporales también retirados por las pruebas. Imágenes conservadas en caché.
- Formato propio, sintaxis, enlaces locales y diff aprobados. Formato global backend fallido en los 26 archivos preexistentes; no se modifican ni se declara una excepción académica inexistente.
- Linux, Node 24.21.0, Chrome 153.0.8010.36 y Docker Compose 5.6.1. No acredita Windows, zoom nativo, ayudas técnicas, TLS, sesión autenticada o rate limiting individual.
- Fetch actualizó origin/develop a c8bb5d3: incorpora PAGOS-01 y archivos nuevos de pagos, sin solaparse con T2 ni modificar server.js/app.js/Compose. Los resultados corresponden a nuestra rama, no a una combinación integrada con ese cambio. Comprobar diff y validación de la combinación antes de aceptar la PR; no se ejecutó merge/rebase.

T2.4 queda documentado/verificado localmente y preparado para revisión, sin commit nuevo, push o PR creada. Revisor de T2 y aprobación humana pendientes. Antes de integrar debe resolverse/reportarse el fallo global de formato según las reglas del equipo, sin ocultarlo o clasificarlo como inducido. T2 no está integrado/cerrado y T3/T4 siguen pendientes. La siguiente acción es revisar/guardar la documentación final de T2 y preparar su publicación/revisión con autorización humana.

## 26. Guardado y publicación autorizados de T2.4

Pablo solicitó guardar T2.4, publicar la rama y entregar contenido de PR y recomendación de revisor. El commit documental que contiene esta constancia consolida guía, matriz de revisión y estado bajo `docs(infra): consolida la guía y la revisión del proxy local`. No hay cambios de producto o pruebas desde la auditoría de T2.4; se verifican enlaces y diff de los documentos antes del guardado.

Publicación autorizada de feature/FRONT-01-T2-proxy, sin force-push, creación de PR, asignación automática de revisor, merge/rebase o tags. La confirmación del push se obtiene después del commit; no se da por hecha desde esta constancia. Recomendación: Shirley (shirley6126), por coordinación de revisión de infraestructura de Pablo y continuidad con T1; su aceptación de esta nueva revisión aún no consta. Nadie aprueba su propio cambio.

Resultados de la rama y límites permanecen en la matriz: 3 comprobaciones frontend, lint y 346 pruebas aprobados; formato global con 26 archivos preexistentes fallido. La combinación con develop y aprobación humana siguen pendientes antes de integrar.

## 27. División de T3 según CONTRIBUTING.md

Autorización humana del 28 de octubre de 2026: corregir tamaño de PR y base de
rama. La implementación completa anterior se conserva sin modificar ni perder
pruebas en el checkout original, rama feature/FRONT-01-T3-cliente-http, base
6bf2cbc. No se propone publicar esa rama monolítica ni cerrarla como integrada.

Se divide el mismo alcance T3 en entregas secuenciales bajo esta spec:

| Entrega | Contenido | Base y dependencia |
|---|---|---|
| T3a | Transporte JSON, errores normalizados y pruebas de contrato | feature/FRONT-01-T3a-transporte-json desde origin/develop 92d91d3 |
| T3b | Caché/renovación CSRF y sus contratos | Crear desde develop después de integrar T3a |
| T3c | Cliente de rutas/métodos y los 45 contratos completos ya escritos | Crear desde develop después de integrar T3b; conservar las aserciones |
| T3d | Empaquetado, documentación y navegador con backend real | Crear desde develop tras integrar T3c; verificar el empaquetado vigente (ver sección 28) |

Cada PR tendrá menos de unas 400 líneas de cambio; el tamaño se comprueba sobre
su diff real antes de publicarla. No basta dividir commits dentro de una PR grande.
T3a no necesita WEB-01: añade solo módulos internos y herramientas/pruebas; no
modifica Nginx, Compose, portada ni backend. Las entregas siguientes no se publican acumuladas
sobre una base antigua: se retomarán una por una tras integrar su dependencia.

Contrato T3a: createJsonTransport recibe fetch y devuelve una función send para
rutas ya validadas por el futuro cliente. Normaliza JSON, vacíos, errores HTTP,
red y cancelación; no hace reintentos ni obtiene CSRF por sí misma. No es aún
la API pública para pantallas ni autoriza una pantalla o mutación de negocio.
RN-01/02 y ADR 0004 se mantienen en el backend. Sin nuevas dependencias.
Aplica DESIGN.md sin cambios visuales. No aplica defecto inducido.

Pruebas T3a: Node 24 con dobles de transporte, lint/formato propios y comprobación
backend exigida por AGENTS.md. Resultados se registran abajo; no se trasladan los
45 contratos ni el navegador de la rama completa como evidencia de esta entrega.
Sin commit/push, revisión humana o integración inferidas.


Se separa CSRF del cliente para no recortar las 45 pruebas completas solo para
reducir líneas. Estimación de cambios propios por entrega: T3a aproximadamente
300; T3b menos de 250; T3c aproximadamente 390; T3d menos de 300. Las tres últimas
cifras son planificación, no PRs creadas ni tamaño final verificado.

Ejecutar en frontend: npm run lint y npm test, con Node 24 y dependencias de
backend disponibles. Las pruebas de T3a se ejecutan sobre el transporte interno;
la validación de rutas, métodos y renovación de sesión permanece fuera de esta
primera entrega. No publicar estos módulos como API lista para pantallas.


### Verificación propia de T3a — 28 de octubre de 2026

- HEAD y merge-base con origin/develop coinciden en 92d91d3; rama creada desde
  esa base, sin incorporar commits WEB-01 ni ejecutar merge/rebase.
- Frontend Node 24.21.0: npm run lint aprobado; 17 contratos de transporte
  aprobados, sin omisiones. Prettier de archivos nuevos y diff --check aprobados.
- Backend sin modificaciones: lint aprobado; npm test con 657 aprobadas,
  550 unitarias y 107 de integración en PostgreSQL 16.13 temporal en tmpfs.
  format:check falló en 27 archivos preexistentes, conservados sin cambios.
- Se reutilizaron dependencias existentes mediante montajes de solo lectura;
  no se instalaron paquetes ni se leyó .env. El primer intento de montaje no
  inició las pruebas porque faltaba su directorio; tras crearlo como punto de
  montaje ignorado por Git, la ejecución completa aprobó.
- Dockerfile, Compose, portada, CSS, backend y pruebas anteriores intactos.
  No se atribuye a esta entrega la prueba de autenticación de T3 completa.
- Los módulos de transporte coinciden byte a byte con el avance conservado.
  Código y 45 pruebas completas siguen disponibles en la carpeta original.
- Sin commit/push ni PR creada. Revisión humana e integración pendientes.

El usuario autorizó expresamente commit y push de T3a el 28 de octubre de 2026,
como excepción puntual a la prohibición de push de AGENTS.md. El commit que
contiene esta constancia guarda el transporte y su evidencia; no autoriza merge,
rebase, tags ni publicación de las demás entregas. Confirmar el resultado del push
con Git; esta autorización no equivale a revisión humana o integración.

## 28. T3b — caché CSRF en memoria

Pablo autorizó continuar el 29 de octubre de 2026 y aclaró que la PR #20 fue
un error y se cerró por ese motivo. No se reabre ni se traslada su corrección a
esta entrega. Esa PR no es un requisito de T3b; T3d comprobará el empaquetado
vigente y cualquier incompatibilidad real se delimitará antes de corregirla.
T3a está integrada mediante PR #21, commit e715c86, en la base f26415d.

### Contrato y alcance

- `createCsrfCache(send)` recibe el transporte JSON de T3a por inyección y expone
  `getToken({signal})` e `invalidate()`. Son funciones internas, no el cliente
  público para pantallas. Guarda exclusivamente en memoria, sin leer cookies,
  JWT ni almacenamiento persistente.
- La primera lectura obtiene `/api/v1/auth/csrf`; las posteriores reutilizan el
  token. Invalidar obliga a una lectura nueva. No se interpreta su firma ni se
  inventa una vigencia distinta de la validada por el servidor.
- Las lecturas se serializan: dos consumidores simultáneos no rotan cookies en
  paralelo. Tras invalidar se espera a que termine la lectura anterior antes de
  obtener otra; una respuesta anterior no se devuelve ni repuebla la caché.
  Ese consumidor recibe `CSRF_STATE_CHANGED` y puede solicitar la acción otra vez.
- Cada lectura de red recibe el signal de su consumidor. Una operación en cola
  comprueba la cancelación al llegar a su turno; no cancela la petición ajena.
  Fallos, cancelaciones y respuestas sin token no se guardan ni se reintentan.
- T3c conectará la invalidación con login/logout y `CSRF_TOKEN_INVALID`, sin
  repetir mutaciones automáticamente. Esta entrega no realiza login/logout,
  no añade pantallas ni cambia backend, Nginx, Compose o dependencias.
- RN-01/02 y ADR 0004 siguen vigentes. SOLID: responsabilidad separada del
  transporte y dependencia inyectada. Aplica DESIGN.md sin cambios visuales;
  usabilidad en este alcance: errores distinguibles para la futura vista, sin
  exponer detalles internos. No acredita accesibilidad de una pantalla nueva.
- No se introduce ni corrige ningún defecto académico autorizado.

### Verificación — 29 de octubre de 2026

- Node 24.21.0. Frontend: lint aprobado y 30 contratos aprobados (17 existentes
  de T3a y 13 nuevos). `npm test` aprobó ambos archivos; además se ejecutó
  `node --test --test-isolation=none tests/api/*.test.js` para enumerar los 30.
- Backend sin cambios: lint aprobado; `npm test` aprobado, 564 unitarias y 116
  de integración (680 en total). PostgreSQL 16.13 aislado, base terminada en
  `_test`, datos en tmpfs y puerto aleatorio local; sin leer .env ni datos reales.
- Primer intento limitado por el sandbox: 3 unitarias fallaron por listen EPERM;
  la ejecución completa con permisos para sockets locales pasó sin cambiar
  pruebas. Docker Desktop no estaba disponible; se usó el daemon default.
- `format:check` global falló en 24 archivos preexistentes del backend. No se
  modificaron ni se clasifican como errores inducidos. Prettier propio y
  `git diff --check` aprobados; diff completo revisado, incluidos archivos nuevos.
- El avance completo citado en la sección 27 no está en las ramas locales de
  este checkout; no se eliminó ni se modificaron sus 45 contratos. Estas 13
  pruebas son propias de T3b y no sustituyen la verificación posterior de T3c.
- Sin verificación nueva en navegador: corresponde a T3d. Sin commit, push,
  aprobación humana ni integración de T3b; implementación asistida por Codex.

El contenedor PostgreSQL temporal fue retirado al finalizar. La entrega completa
abarca menos de 400 líneas de cambio, incluidos código, pruebas y documentación.

### Guardado autorizado — 30 de octubre de 2026

Pablo solicitó el commit atómico de T3b. El commit que contiene esta constancia
guarda la caché, sus 13 pruebas y la documentación como un único cambio lógico,
con el mensaje `feat(infra): agrega la caché CSRF del frontend` y referencia a
esta spec. Diff completo y `git diff --check` revisados antes de guardar.
El código no cambia respecto de la verificación del 29 de octubre; no se
repitió la batería completa para este guardado. Permanecen los resultados y
el fallo global de formato documentados arriba. Sin push, PR ni integración.
