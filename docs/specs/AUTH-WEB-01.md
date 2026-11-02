# AUTH-WEB-01: Pantalla de inicio de sesión

- **ID local:** AUTH-WEB-01; sin ticket externo antes de la revisión académica.
- **Responsable:** Pablo, conforme a la coordinación de autenticación y F-A6.
- **Revisora propuesta:** Shirley; aceptación de esta revisión pendiente.
- **Estado:** Controlador preparado para revisión; pantalla e integración pendientes.
- **Fecha / base actual:** 2 de noviembre de 2026; origin/develop 1fb0ade.
- **Rama actual:** feature/AUTH-WEB-01-controlador-login; procedencia 5a18259.
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
