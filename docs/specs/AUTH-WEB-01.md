# AUTH-WEB-01: Pantalla de inicio de sesión

> Ampliación local de cierre/cambio de cuenta autorizada el 4 de noviembre:
> sección 21, pendiente de revisión humana. El cierre original inferior conserva
> su alcance histórico.

- **ID local:** AUTH-WEB-01; sin ticket externo antes de la revisión académica.
- **Responsable:** Pablo, conforme a la coordinación de autenticación y F-A6.
- **Revisora confirmada:** Shirley.
- **Estado:** Cerrada; controlador y pantalla revisados e integrados mediante las PR #42 y #45.
- **Fecha / base comprobada:** 3 de noviembre de 2026; `origin/develop` `65957a9`.
- **Rama de procedencia:** feature/AUTH-WEB-01-pantalla-login; cabeza integrada `74c17ee`.
- **Autorización:** preparación documental original durante la revisión de T3c;
  Pablo autorizó después el incremento visual T1, según sección 15. No implica
  fechas comprometidas ni aceptación de propuestas por parte de Edwin.
- **Dependencias:** AUTH-01/02, ADR 0004, FRONT-01 T3c integrada y T3d verificada
  antes de conectar/publicar la pantalla como funcional. No copiar la PR #30.

## 1. Objetivo

Permitir que una persona con cuenta existente inicie sesión y compruebe que el
servidor reconoce su identidad. Desbloquea el acceso autenticado a las pantallas
del equipo; no otorga permisos por ocultar o mostrar enlaces.

## 2. Reglas y referencias

RN-01: rol y autorización comprobados por backend. RN-02: cooperativa obtenida
de la identidad verificada; no elegirla en login. AUTH-01 define credenciales,
validaciones y errores; AUTH-02 define consulta de sesión; ADR 0004 define
cookies HttpOnly y CSRF. Aplicar docs/calidad.md y frontend/DESIGN.md.

## 3. Alcance

Incluye una página HTML pública, módulos ES de presentación/control y acceso a
la API mediante un único cliente común por página. Consulta inicial de sesión,
formulario email/contraseña, envío único, mensajes y verificación tras login.
Ruta propuesta /pages/login.html; enlace desde la portada solo al existir la página.

Fuera de alcance: registro, recuperación de contraseña, logout visual, paneles
por rol, returnTo/redirect externo, alta de administradores, refresco de JWT,
selección de cooperativa, cambios de backend, multipart y formulario de buses.
No agregar enlaces a pantallas todavía no integradas ni crear cuentas ficticias.

## 4. Flujo principal propuesto

1. Al abrir la página, consultar GET /api/v1/auth/me. Mientras responde, mostrar
   estado de comprobación, sin afirmar sesión ausente por un error de red.
2. Con 401, mostrar formulario. Con 200, mostrar «Sesión iniciada» y email
   verificado, sin permitir otro login accidental encima de la sesión actual.
3. Validar datos sin modificar la contraseña; el servidor mantiene la decisión.
4. Durante POST /api/v1/auth/login, impedir doble envío y anunciar progreso.
   La vista no obtiene ni guarda CSRF: lo gestiona el cliente compartido.
5. Tras 200 vacío, consultar auth/me y mostrar sesión iniciada solo tras 200
   válido. Mantener enlace a la portada existente; sin redirección por rol.
6. Si el resultado del login es incierto por red/cancelación/error de servidor,
   no reenviarlo. Ofrecer «Comprobar sesión» (lectura explícita de auth/me).
   Si esa lectura da 401, permitir un nuevo intento explícito de login.

## 5. Datos

| Campo | Tratamiento |
|---|---|
| email | Obligatorio, formato email, máximo 254 según backend; normalización en servidor |
| password | Obligatoria; 15–128 puntos de código Unicode según credentials.js; sin trim ni reglas adicionales |
| user | Procede exclusivamente de auth/me; usar email para confirmación y texto escapado |

Usar autocomplete=username y current-password; permitir pegado y gestores de
contraseñas. No usar maxlength=128 como sustitución del conteo Unicode del
backend. No guardar credenciales en storage, URL, logs, capturas ni telemetría.
Limpiar contraseña al finalizar un intento; conservar email ante errores.
Sin migraciones ni dependencias nuevas previstas.

## 6. Contratos existentes

| Método | Ruta | Resultado relevante |
|---|---|---|
| GET | /api/v1/auth/me | 200 con {user}; 401 sin sesión válida |
| GET | /api/v1/auth/csrf | Lo usa internamente el cliente; 200 {csrfToken} |
| POST | /api/v1/auth/login | 200 vacío y cookie; 400/401/403/429 o fallo técnico |

Usar rutas relativas, mismo origen y cliente de FRONT-01; no llamar fetch desde
la vista ni interpretar JWT/cookies. Tras login la invalidación CSRF es del cliente.

## 7. Criterios de aceptación

- [ ] Dado auth/me=401, se presenta formulario con etiquetas y acción de acceso.
- [ ] Dada sesión existente, se confirma desde auth/me sin reenviar credenciales.
- [ ] Dado login=200, se espera auth/me=200 antes de anunciar sesión confirmada.
- [ ] Dado doble clic/Enter repetido, existe como máximo un login en curso.
- [ ] Dado error, se anuncia en texto, conserva email y limpia contraseña.
- [ ] Dado resultado incierto, se ofrece comprobar sesión, sin repetir POST.
- [ ] Dado error de red al comprobar sesión, no se declara sesión ausente.
- [ ] Sin sesión/rol válido no se simula acceso autorizado a Fleet u otro módulo.
- [ ] La imagen Docker sirve la página y todos sus módulos con MIME correcto.
- [ ] Portada, recursos, proxy y pruebas compartidas existentes siguen funcionando.

## 8. Errores y recuperación

| Situación | Respuesta de la vista |
|---|---|
| 400 VALIDATION_ERROR | Indicar datos de acceso inválidos sin reglas nuevas |
| 401 INVALID_CREDENTIALS | Mensaje genérico; no revelar existencia de cuenta |
| 403 CSRF_TOKEN_INVALID | Pedir nuevo intento explícito; el cliente invalida caché, sin reintento POST |
| 429 TOO_MANY_ATTEMPTS | Mensaje del contrato; sin inventar cuenta regresiva |
| 5xx/red/cancelación durante login | Resultado incierto y opción de comprobar sesión |
| auth/me falla después del login | No declarar fracaso del login ni repetirlo; permitir comprobar sesión |

No introducir comprobación de disponibilidad del backend como condición de login.

## 9. Pruebas previstas

Pruebas del controlador con cliente inyectado para estados, envío único y
recuperación; conservar las del cliente común. Navegador con API real: usuario
QA creado por infraestructura aislada, login/me, credenciales erróneas, sesión
existente, CSRF inválido y backend no disponible. Sin depender de bootstrap
no integrado, insertar datos en un entorno real ni leer .env.
Verificar imagen real y recursos mediante Dockerfile y .dockerignore coordinados.
Ejecutar frontend lint/test y backend lint/format:check/test con BD aislada;
registrar resultados de esa rama, sin reutilizar conteos históricos como evidencia.

## 10. Coordinación y decisiones

Propuestas técnicas de esta spec: confirmar sesión en la misma página, sin panel
ni redirección; un cliente por página; sin logout visual en este incremento.
No necesitan cambiar reglas de negocio. Revisor y fecha de entrega pendientes;
no existe promesa de entrega a Edwin. Consultas sobre proxy/multipart en
[frontend-acuerdos.md](../frontend-acuerdos.md), registro F-A7–F-A9.

## 11. Defecto inducido

No aplica. La autorización académica general no permite introducir uno aquí.

## 12. SOLID y usabilidad

Separar controlador de estados, vista DOM y cliente HTTP inyectado. No añadir
una jerarquía de clases ni duplicar reglas de autorización. Reutilizar Bootstrap
local, logo y paleta blanco/negro/violeta de DESIGN.md; cambios compartidos de
tokens requieren coordinación, no editar CSS de terceros.
Etiquetas visibles, foco en primer error, mensajes anunciados con aria-live,
teclado Tab/Shift+Tab/Enter, sin bloqueo de foco; foco visible. Comprobar 360 y
1280 px, ampliación 200 % y contraste 4,5:1. No depender solo del color.
La verificación funcional sigue pendiente; la presentación T1 se comprueba
por separado en la sección 15.

## 13. Pasos y evidencia documental

1. Esta entrega: spec y consulta compartida, sin código ni revisión humana inferida.
2. Tras integrar T3c, ejecutar T3d con su spec; no mezclarlo con login.
3. Implementar un incremento de login con pruebas de estados; después verificar
   sesión en navegador/API real y empaquetado en su rama propia desde develop.
4. PR propia con revisión humana; registrar integración y verificación posterior.

Base contrastada b1e6720; PR #30 abierta al consultar. Se contrastaron contratos
con auth-router.js, credentials.js y auth-errors.js. En esta entrega solo se
verificaron diff --check, 7 enlaces locales de spec/acuerdos y coherencia
documental; aprobados. Sin cambios ni pruebas de producto nuevas.

## 14. Revisión y cierre — constancia del borrador original

Pendientes aceptación del alcance de implementación, revisión por otra persona,
PR/commit de integración y evidencia del flujo real. No marcar Integrada/Cerrada
por redactar la spec. Pablo autorizó guardar este borrador el 1 de noviembre de 2026. El commit
que contiene esta constancia reúne spec y coordinación como un cambio lógico;
no implementa login ni autoriza por sí solo integración. Sin publicación ni
mensajes enviados al equipo. PR #30 aprobada, todavía abierta; develop remoto
efcfcf2 contrastado sin merge/rebase sobre la base documental b1e6720.


## 15. Plan de T1 visual y guardado autorizado

El 1 de noviembre de 2026 Pablo autorizó continuar con T1 visual y después
solicitó guardarla. Esta entrega documental recupera la spec de 63ce51c,
registra coordinación y planifica una presentación independiente de T3d.
El producto y sus pruebas se guardarán en un commit posterior, con evidencia.

T1: formulario con etiquetas y autocomplete, controles deshabilitados y aviso
explícito; retorno al inicio; Bootstrap, logo y tokens de DESIGN.md. Estilos
locales, sin cambios compartidos con FLEET-05. Sin API, JavaScript de producto,
almacenamiento, enlace desde portada ni cambios Docker en esta entrega.
Verificar recursos locales, teclado/foco y reflujo en 360/1280 y zoom CSS 200 %.
No declarar funcionales los criterios de sesión y envío de la sección 7.

PR #32 comprobada abierta, head b51bbd2 y base 2b8a543. Pablo reportó la
asignación a Edwin; GitHub muestra solicitud a Pato77232. Sin aprobación
inferida. Conexión a API y empaquetado después de integrar T3d.

Separar esta documentación y la presentación en entregas revisables menores
que ~400 líneas. No se ejecutan push, merge, rebase ni integración. Asistencia
de Codex; verificación de enlaces y diff documental, sin pruebas de producto
atribuidas a este commit. Revisión humana pendiente.

## 16. T1 visual implementada y verificada

Pablo pidió continuar después de asignar la revisión de PR #32 a Edwin.
Autoriza el primer incremento visual propuesto; no se infiere aprobación
humana de T3d. GitHub muestra solicitud a Pato77232, PR abierta, base 2b8a543,
head b51bbd2. Rama visual desde esa base integrada, sin incorporar la PR.
Las constancias anteriores describen la preparación de 63ce51c, no el estado actual.

Incluye pages/login.html, login.css aislada y prueba Chrome. Aplica DESIGN.md
D-02/D-03/D-04/D-07, logo definitivo y Bootstrap local; no altera tokens comunes.
Formulario con etiquetas y autocomplete; fieldset y botón deshabilitados para
no recoger/enviar credenciales. Aviso explícito, retorno al inicio, sin enlaces
ficticios, sin JavaScript de producto, almacenamiento ni llamadas API.
No enlaza todavía desde la portada ni modifica Dockerfile/.dockerignore:
este incremento se sirve como presentación local, no como login funcional.

Criterios propios de T1: recursos locales y marca cargan; campos etiquetados;
aviso legible y controles inactivos; enlaces reales; salto al contenido y foco
visibles; sin desbordamiento a 360/1280 px y zoom CSS 200 %; sin peticiones API.
Esto no acredita los criterios funcionales de la sección 7.

Verificación: npm --prefix frontend run test:login-visual. La prueba crea servidor
loopback y Chrome efímeros, valida los escenarios y guarda capturas temporales.
Lint frontend (cliente API) y sus 81 contratos aprobados. Backend lint aprobado;
format:check falla en 20 archivos previos. npm test aprobado: 786 unitarias y
239 de integración (1025), con PostgreSQL 16.13 aislado, base auth_web01_test,
puerto aleatorio 32774 y tmpfs; contenedor QA retirado al terminar.
La copia QA /tmp/t3d-backend-2u2w9ob8/backend se comparó archivo por archivo
con backend de HEAD: idéntica, con dependencias existentes del mismo lockfile.
Sin nuevas dependencias, migraciones ni cambios de backend. Contraste calculado
sobre los tokens existentes: texto secundario/blanco 5,92:1, aviso 14,20:1 y
botón 16,29:1. Capturas temporales inspeccionadas en escritorio/móvil;
pendiente observación humana, lector de pantalla y zoom nativo.

Próximo incremento: tras integrar T3d, conectar estados de sesión y envío con el
cliente compartido, probar errores y recuperación, empaquetar página/módulos y
enlazar desde portada. No crear otra política de sesión ni resolver multipart aquí.
Revisión de login y T4 de FRONT-01 pendientes. Sin publicación nueva.
Preparado con asistencia de Codex.


### Guardado solicitado por Pablo

Plan y coordinación guardados en 1d7e0db, conservado en
feature/AUTH-WEB-01-plan-visual para revisión documental separada.
El commit que contiene esta constancia guarda presentación, prueba Chrome y
evidencia/estado como un cambio lógico. No hay cambios de producto desde las
pruebas de T1 descritas arriba; no se repite la suite completa por guardar.
Diff, formato propio y enlaces comprobados antes del commit.

PR #32 consultada nuevamente: abierta, sin revisiones registradas y sin merge.
No se conecta todavía la API, conforme al orden autorizado de esta spec.
Para revisión, publicar primero la rama documental hacia develop; después
preparar la PR visual sobre esa documentación integrada, resolviendo el estado
con evidencia. Ambas diferencias son menores de ~400 líneas por separado.
No hubo push ni PR nueva en este guardado. Asistencia de Codex.


## Plan de guardado actual — 1 de noviembre de 2026

Pablo autorizó continuar. Base 0b4041e, rama feature/AUTH-WEB-01-login-integracion.
Esta entrega recupera la spec y procedencia de los commits locales citados;
las evidencias anteriores describen aquellas sesiones y no incluyen producto
en este commit documental. Guardar controlador/pruebas, pantalla/empaquetado y
prueba de navegador/evidencia como incrementos separados menores de ~400 líneas.
No se hace push ni se infiere revisión humana. El siguiente commit incorpora
el controlador; la conexión usará el cliente compartido y la confirmación me.


## 17. Entrega del controlador sobre develop actual — 2 de noviembre

Pablo solicitó preparar/publicar su siguiente incremento. Plan integrado en
PR #34/954f812; base actual 1fb0ade con validación Fleet T1a y tarifario de hojas.
Se recuperaron controlador y pruebas de 5a18259 sin modificar su contenido.
Los scripts/configuración añaden Auth y conservan API y Fleet; no se copia
package.json antiguo ni se incorpora PR #40, todavía abierta en af27d5b.

Solo controlador puro con cliente y vista inyectados: consulta me, formulario
tras 401, confirmación de sesión tras POST, validación Unicode, envío único,
limpieza de contraseña y recuperación de resultado incierto sin reintentar POST.
Sin HTML, DOM, CSS, Docker o cambios del cliente HTTP, backend o dependencias.
Aplica separación de responsabilidades de calidad.md; DESIGN.md se mantiene
como referencia para la futura vista, sin cambios visuales en esta entrega.

Verificación: lint frontend aprobado; 106 pruebas frontend aprobadas (81 API,
11 Fleet y 14 controlador). Copia QA con diff frontend de PR #40: 115 aprobadas;
compatibilidad local no equivale a integración ni aprobación de multipart.
Backend 1fb0ade exportado sin cambios, npm ci con lockfile en copia temporal:
lint aprobado; format:check fallido en 17 archivos previos. npm test falla en
dos pruebas de publish-route-sheet.use-case por TariffSourceError: 1053 unitarias
aprobadas y dos fallidas. El mismo backend base se probó sin código de login;
fallos ajenos al controlador, no defectos inducidos ni pruebas aprobadas.
Integraciones ejecutadas por separado: 267 aprobadas en 23 suites. PostgreSQL
16.13 exclusivo, auth_controller_test en tmpfs y puerto aleatorio 32771;
contenedor retirado al terminar. npm test global sigue FALLIDO por las dos
unitarias; no sumar conteos como si toda la suite hubiera pasado.
Sin .env ni nuevas versiones de dependencias. Asistencia de Codex.

Pantalla/empaquetado b1f3761 y navegador/evidencia 99c8a91 permanecen como
procedencia local de incrementos siguientes; deben adaptarse a la base vigente
sin perder cambios Fleet. Enlace desde portada y revisión humana pendientes.
Guardado/publicación autorizados en esta sesión; no implica integración.

La PR se prepara en borrador para revisión del incremento mientras se atienden
los fallos globales de la base; no se recomienda integrar con comprobaciones
obligatorias fallidas. Este commit guarda el controlador/pruebas/configuración
y su trazabilidad como un único cambio lógico, con asistencia de Codex.


## 18. Observación de revisión: lint portable y compatibilidad con Fleet

El 2 de noviembre de 2026 Pablo compartió la revisión asistida remitida por
Shirley sobre 037302b: reprodujo 106 pruebas frontend y 14 del controlador en
Windows/PowerShell; indicó que el script POSIX de lint falla antes de analizar
código. Su mensaje aclara que todavía no constituye aprobación humana de PR #42.
No se registra una nueva asignación de revisor ni aceptación de los otros
compromisos propuestos por el mensaje.

Pablo pidió continuar con la corrección. Se cambia únicamente la invocación
de ESLint a Node y se conservan API, Fleet y Auth. Se incorporan las declaraciones
globales document, Option, Request y FormData que ya existen en develop para
no perder compatibilidad con la vista Fleet y el transporte multipart. No se
deshabilitan reglas ni se modifica el controlador, sus pruebas o dependencias.

Fetch comprobado: origin/develop 1e9d956, que incorpora la adaptación de David
a las pruebas de publicación y los cambios de Fleet. Sin merge/rebase; la rama
sigue basada en 1fb0ade. Compatibilidad comprobada en una copia temporal de
1e9d956 superponiendo solo package.json, eslint.config.js y controlador/pruebas
Auth actuales. Backend de esa copia sin cambios, dependencias reutilizadas de
la instalación npm ci anterior: package.json y lockfile idénticos entre bases.

Lint frontend local y combinado aprobado; 106 pruebas locales y 115 combinadas
aprobadas. Formato de los dos archivos de configuración aprobado. Node 24.21.0
en Linux: no equivale a una nueva ejecución Windows. Backend actualizado: lint
y 1068 unitarias aprobadas, incluidas las dos de publicación; formato global
sigue fallando en 17 archivos previos, incluidas dos migraciones existentes
que no se modifican. Primera ejecución unitaria restringida falló al abrir
loopback (3 pruebas); repetición con acceso local permitido aprobada.

npm test completo en la copia de develop aprobado: 1068 unitarias y 275
integraciones (24 suites de integración), PostgreSQL 16.13 aislado con base
auth_portable_test en tmpfs y puerto 32772; contenedor retirado al terminar.
Sin .env ni datos reales. Los fallos unitarios anteriores no se reproducen en
1e9d956; persiste la comprobación de formato fallida, por lo que no se declara
la base completamente libre de fallos ni la PR lista para integrar.

Pablo solicitó guardar y publicar la corrección en la rama de PR #42. El commit
que contiene esta constancia reúne script portable, compatibilidad de lint y
evidencia como un único cambio lógico. No modifica el controlador de 037302b.
Repetición Windows y aprobación humana pendientes; se actualizará la descripción
de la PR con los resultados actuales sin dar por aprobada la revisión. Sin pruebas de pantalla o
arranque nuevas: este incremento solo afecta herramientas de análisis.
Preparado y verificado con asistencia de Codex.


## 19. Pantalla sobre controlador integrado — 2 de noviembre de 2026

Pablo solicitó continuar después de integrar PR #42. GitHub confirma merge
8fdf7e4 a las 15:55:13 UTC (10:55:13 Ecuador); fetch de origin/develop coincide.
La revisión APPROVED de shirley6126 corresponde al controlador/lint de 58d4cbe,
no a esta pantalla. La documentación de dependencias de Pagos permanece
resguardada en stash identificado desde feature/ACUERDOS-01-dependencias-pagos;
no se mezcla ni se pierde al continuar esta tarea.

Alcance: recuperar vista/página y CSS local de b1f3761 sin modificar controlador,
API común ni Fleet; añadirlos expresamente a Dockerfile/.dockerignore vigentes,
conservar recursos Fleet y enlace real desde portada. Recuperar prueba de
navegador de 99c8a91 y comando test:login manteniendo lint/test existentes.
Aplicar DESIGN.md D-02/D-03/D-04/D-07, paleta/recursos locales y criterios de
sección 12. Sin paneles por rol, registro visual, logout visual o redirecciones.

Plan de verificación: lint/formato y contratos frontend; imagen real con API y
PostgreSQL exclusivos de QA, estados/errores de login y CSRF, doble envío,
recuperación por lectura, sesión existente, backend no disponible y recursos
MIME. Teclado, 360/1280 y zoom CSS 200 %, sin afirmar lector de pantalla ni
zoom nativo. Backend lint/format:check/npm test con BD aislada según guía.
Registrar resultados actuales, sin reutilizar conteos históricos como nueva
evidencia. No hay defecto inducido autorizado. Sin commits ni publicación
solicitados en esta continuación. Asistencia de Codex.


### Resultado de la verificación de pantalla

Recuperados login.html, login-page.js, login-view.js y login.css; identidad textual
con textContent, contraseña limpiada, foco y aria-live por estado, formulario
inactivo/oculto hasta comprobar ausencia de sesión. Se añade ajuste de línea
para correos largos en la confirmación. Docker incluye explícitamente recursos
Auth/CSS sin quitar Fleet, y la portada enlaza la página que sirve la imagen.
No se modifica controlador integrado, transporte común, proxy, backend o dependencias.

- Frontend: lint y formato de los siete archivos HTML/CSS/JS/JSON propios
  aprobados. npm test aprobado; ejecución sin aislamiento enumera 115 pruebas
  aprobadas (90 API, 11 Fleet, 14 Auth).
- test:login aprobado en Chrome con Docker Compose efímero: login/me real,
  credenciales incorrectas, limpieza y conservación de email, CSRF inválido,
  Enter/doble envío, sesión existente, pérdida de respuesta seguida de consulta
  sin repetir POST y backend detenido sin afirmar sesión ausente.
- Imagen real: módulos Auth con MIME JavaScript, CSS/página y recursos Fleet
  presentes; enlace de portada y exclusión del archivo de pruebas verificados.
  Arranque real de API y migraciones mediante composición QA aprobado.
- Capturas desktop/mobile/zoom-200 en /tmp/transviaje-login-api; escritorio y
  móvil inspeccionados visualmente. Sin desbordamiento horizontal a 360/1280
  y zoom CSS 200 %, etiquetas y Tab/Shift+Tab/Enter/foco comprobados. Zoom nativo,
  lector de pantalla y observación humana pendientes. Se reutilizan tokens sin
  cambiar colores; esta sesión no ejecuta auditoría de contraste adicional.
- Backend de HEAD 8fdf7e4 exportado a copia temporal sin modificaciones: lint
  aprobado; npm test completo aprobado (1068 unitarias/63 suites y 275
  integraciones/24 suites). PostgreSQL 16.13 exclusivo login_screen_test en
  tmpfs/puerto 32774; retirado al terminar. Dependencias de npm ci anterior
  reutilizadas con package.json/lockfile sin diferencias. Sin .env ni datos reales.
- format:check backend sigue fallido en 17 archivos previos, incluidas dos
  migraciones publicadas que no se tocan. No son defectos académicos autorizados.

La prueba de pantalla crea otro entorno temporal con usuario aleatorio y base
transviaje_frontend_dev exclusiva en tmpfs mediante el lanzador existente;
ambos proyectos QA se retiraron. Esta evidencia no prueba compras ni formularios
Fleet conectados a la sesión. No se marca AUTH-WEB-01 Cerrada ni se publica PR.
Separar guardado de producto/empaquetado y prueba reproducible/evidencia como
cambios lógicos al solicitarse commits; no se ejecutaron commits en esta sesión.


### Guardado atómico solicitado

Pablo pidió guardar el incremento y preparar su revisión humana. El producto
y empaquetado se guardan en un primer commit; la prueba reproducible de navegador,
comando, guía y evidencia se guardan en el siguiente. Se mantienen los resultados
reales anteriores: no se repiten suites por cambios exclusivamente documentales
y guardado Git. Sin push, PR nueva ni aprobación humana de la pantalla.

## 20. Revisión, integración y cierre

Shirley aprobó la cabeza `74c17ee` de la
[PR #45](https://github.com/Pato77232/ProyectoBusesUTA/pull/45) después de
reproducir en Windows las 115 pruebas frontend, lint, formato y `test:login`
con Chrome, API y PostgreSQL aislados. La revisión incluyó sesión, errores de
credenciales y CSRF, doble envío, recuperación sin repetir POST, backend no
disponible y capturas de escritorio, móvil y ampliación CSS al 200 %.

La PR se integró en `develop` mediante `3d053a4` el 2 de noviembre a las 13:38
(America/Guayaquil). La base `65957a9` conserva ese merge y la regresión global
posterior registrada con PR #65 aprobó 1772 pruebas unitarias y 564 de integración.
Zoom nativo y lector de pantalla no fueron certificados y permanecen como límites
de la evidencia, no como funcionalidad prometida por esta spec. AUTH-WEB-01 queda
Cerrada sin incluir paneles por rol, recuperación de contraseña ni logout visual.

## 21. Ampliación: cierre de sesión y cambio de cuenta

Autorizada por el solicitante el 4 de noviembre de 2026 en la rama feature que
administra el humano. El cierre anterior conserva su alcance histórico. No se
ejecutan comandos de Git, incluida consulta de rama/base. No se atribuye nueva
aprobación de Shirley/Pablo ni revisión del incremento a sus aprobaciones previas.

Objetivo: con sesión confirmada mostrar «Cerrar sesión y usar otra cuenta».
Usar `POST /api/v1/auth/logout` existente con cliente compartido y CSRF; no cambiar
backend, cookies, dependencias ni otras pantallas. Aplicar frontend/DESIGN.md:
botón Bootstrap existente, tipografía/colores/foco compartidos, sin nuevos tokens.

- Tras pulsar, borrar correo/contraseña locales y bloquear envíos duplicados.
- Consultar `auth/me` tras el intento de logout; únicamente 401 habilita el
  formulario de otra cuenta. No basta con ocultar el panel ni recargar la página.
- Si sigue autenticado, mostrar identidad confirmada y permitir otro cierre
  explícito. No navegar por `next` mientras se intenta cambiar de cuenta.
- Si no se puede comprobar, mostrar estado incierto y «Comprobar sesión» sin
  repetir POST automáticamente. Una respuesta perdida puede recuperarse con GET.
- El nuevo login conserva el retorno seguro a reservas, tras confirmar identidad.
- Durante cierre ocultar acceso administrativo y bloquear login/comprobación.
  Al mostrar formulario, limpiar identidad/enlace anterior y enfocar correo.

Aceptación: cambio SYSTEM_ADMIN → CUSTOMER con API/DB reales; contraseña/correo
limpios, doble clic sin duplicación, CSRF fallido, cierre con respuesta perdida,
fallo de comprobación y recuperación por GET, sin redirección al usuario anterior.
Teclado, foco, 360/1280 px y ampliación CSS 200 % para el control nuevo.

SOLID: controlador orquesta API/estados y vista presenta; sesión/CSRF siguen en
cliente/backend existentes. Pruebas nuevas sin debilitar las anteriores. Evidencia
y resultados se registran al terminar; revisión humana e integración pendientes.

Implementación: botón de cambio de cuenta, estado `signing-out`, limpieza de
credenciales y control de concurrencia en el controlador; cierre por cliente
HTTP/CSRF existente y confirmación posterior por GET. Durante recuperación se
suprime `onAuthenticated` para no redirigir a la cuenta anterior; se restaura el
retorno normal tras confirmar ausencia de sesión y completar un nuevo login.
La vista limpia el enlace administrativo y usa foco violeta local en el botón.

Frontend: lint y 361/361 pruebas aprobadas (nueve nuevas), formato de los archivos
tocados aprobado. Prueba nueva `node tests/change-account-smoke.cjs`: Chrome
headless real con imagen frontend, proxy, backend y PostgreSQL efímeros; cambio
SYSTEM_ADMIN → CUSTOMER, 401 posterior al cierre, campos limpios, enlace retirado,
foco por Tab/Enter, 360/1280 px, reflujo CSS 200 %, doble clic y respuesta perdida
después de revocar, aprobados. Capturas en
[evidencia](../evidence/AUTH-WEB-01/cambio-cuenta/README.md).

Intentos iniciales del harness no aprobados: se corrigió la preparación de foco
con Tab real y la instrumentación de fetch antes de instanciar el cliente; la
comprobación detectó además la necesidad de aplicar foco local al botón nuevo.
Se conservaron las expectativas de foco visible y un solo POST. La repetición
final aprobó todos los escenarios; no se modificaron pruebas anteriores.

Sin cambios de backend, dependencias, migraciones o permisos. No se certifica
zoom nativo ni lector de pantalla. Git queda al humano, sin comandos ni diff
ejecutados por el asistente y sin afirmar nueva base/remoto. Asistencia de Codex
en implementación, pruebas y documentación; sin aprobación humana nueva inferida.

Validación backend exigida con Node 24.22.2/Windows y PostgreSQL 16.13 aislado,
proyecto `cambio-cuenta-backend` con `--env-file NUL`: lint y formato global
aprobados; npm test con **2037/2037 unitarias (117 suites)** y **692/693
integraciones (62 suites aprobadas, una fallida)**. Único fallo: timeout de 20 s
en `fleet/bus-photo-storage.test.js`, «prepara y promueve todos los bytes sin
conservar nombres ni rutas del cliente». Repetición aislada: 17/18 aprobadas,
mismo timeout. No se cambia Fleet ni su prueba/límite y no se declara verde la
regresión global. Es un fallo fuera de los archivos de este incremento; no se
afirma su causa ni se oculta tras el resultado favorable del recorrido web.

Capturas finales móvil/escritorio/200 % inspeccionadas; formato de JS, HTML, CSS
y harness comprobado. Archivos modificados revisados por lectura, sin diff de
Git por instrucción humana. Entornos web y base de integración retirados al
terminar. La aprobación histórica de Shirley no cubre automáticamente esta
ampliación; revisión humana e integración siguen pendientes.
