# FRONT-01: Base compartida del frontend

- **ID local:** FRONT-01
- **Responsable:** Pablo
- **Revisora propuesta:** Shirley; confirmación pendiente.
- **Estado:** En desarrollo: T1 autorizada por Pablo al solicitar guardar la documentación y comenzar su implementación. T2–T4 siguen pendientes.
- **Fecha / base comprobada:** 25 de octubre de 2026; origin/develop en `c89b1b9`.
- **Rama:** `feature/FRONT-01-base-compartida`.
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
