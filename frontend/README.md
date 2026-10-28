# transViaje — Frontend compartido, FRONT-01 T1/T2

Base estática en HTML y CSS. Incluye Bootstrap 5.3.8 local, navegación por secciones, enlace para saltar al contenido y preguntas con details/summary nativos. No necesita JavaScript para funcionar. Aún no incluye búsqueda, compra, login ni cliente HTTP de la portada. El entorno local de T2.2 conecta las rutas API reales mediante Nginx.

Para levantar la base y preparar futuras pantallas, consultar [GUIA-INTEGRACION.md](GUIA-INTEGRACION.md). Matriz y material de revisión en [revisión de T2](../docs/revision-FRONT-01-T2.md).

Guía visual y trazabilidad: [DESIGN.md](DESIGN.md). La referencia original y la adaptación están separadas. Pablo confirmó nombre transViaje, logo definitivo y paleta blanco/negro/violeta; T1 fue aprobada por Shirley e integrada en PR #16; la revisión humana de T2 sigue pendiente.

## Ver la página

Desde la raíz del repositorio, con Python 3 disponible:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory frontend
```

Abrir http://127.0.0.1:8080. Detener con Ctrl+C. Es un servidor temporal para revisar T1, no un despliegue: el contenedor/proxy corresponde a T2. Si el puerto está ocupado, elegir otro y usarlo también en el navegador. En Windows se puede usar `py -3` en lugar de `python3` si ese es el lanzador instalado.

## Estructura y responsabilidades

- `index.html`: estructura semántica y contenido público, sin enlaces a funciones inexistentes.
- `src/styles/app.css`: estilos propios, foco, tamaños y adaptación. Mantener overrides aquí en vez de modificar Bootstrap.
- `assets/brand/`: logo original local y guía de encuadre/procedencia.
- `assets/favicon.svg`: contenedor SVG con símbolo encuadrado del PNG original incrustado; no es una fuente vectorial ni depende de imágenes remotas.
- `assets/vendor/plus-jakarta-sans/`: tipografía local, licencia OFL 1.1 y procedencia verificable.
- `assets/vendor/bootstrap-5.3.8/`: CSS original y licencia; procedencia en su README.
- `tests/smoke.cjs`: comprobaciones de navegador sin paquetes adicionales. No es código servido/importado por la página.

Las carpetas de páginas, API y componentes se crearán cuando exista una tarea concreta; no hay un router ni módulos ficticios de producción. Antes de añadir una pantalla, usar su spec y acordar navegación/cliente HTTP común. Las pantallas deben conservar lang, viewport, landmarks, foco visible y el enlace al contenido. Los permisos y reglas del negocio permanecen en el backend.

## Repetir las comprobaciones

Con Node 24 y Google Chrome instalados:

```sh
node frontend/tests/smoke.cjs
```

La prueba inicia un servidor en un puerto libre de loopback y Chrome headless con un perfil temporal, y los cierra al terminar. No lee .env ni inicia PostgreSQL. Si Chrome no está en PATH como `google-chrome`, definir BROWSER_BIN con la ruta real del ejecutable. QA_OUTPUT_DIR permite elegir el directorio de capturas; por defecto se usa `busesuta-front01-qa` en el directorio temporal del sistema. No almacenar perfiles ni datos personales en el repositorio.

Se comprueban carga de Bootstrap y tipografía locales, enlaces internos, ausencia de errores de recursos, Tab/Enter, foco visible, enlace de salto, apertura nativa de preguntas y ausencia de desbordamiento a 360/1280 píxeles. El escenario de 200 % usa zoom CSS: es una emulación de ampliación, no prueba de zoom nativo ni certificación de accesibilidad. Revisar también manualmente contraste, lectura y comportamiento con ayudas técnicas antes de la aceptación final.

El formato de los archivos propios puede comprobarse con la herramienta ya instalada en backend, sin instalar paquetes:

```sh
backend/node_modules/.bin/prettier --config backend/.prettierrc.json --check frontend/index.html frontend/src/styles/app.css frontend/tests/smoke.cjs
```

No reformatear el recurso de terceros: debe conservar su integridad. Las verificaciones del backend siguen ejecutándose desde backend según AGENTS.md.

## Ejecutar el contenedor — FRONT-01 T2.1

T2.1 empaqueta únicamente la portada de T1. Usa Nginx 1.30.6, variante alpine3.24-slim, fijada por digest en Dockerfile:

`sha256:dede8895648b461178c3bc604f7eed4423efe5220b2c4d839f5eb3d34ac3f8f7`.

Procedencia: [Docker Official Images](https://github.com/docker-library/official-images/blob/master/library/nginx), vinculada al [Dockerfile del mantenedor](https://github.com/nginx/docker-nginx/blob/4b9f658be76820b24e4ef4605413a5c08707a512/stable/alpine-slim/Dockerfile). La imagen final conserva `/usr/share/licenses/nginx/COPYRIGHT`, además de las licencias Bootstrap y OFL. Las dependencias de Alpine tienen sus propios avisos; no atribuirles una licencia única.

Con Docker disponible, desde la raíz (cada comando en una línea, también válido como sintaxis de PowerShell):

```sh
docker build -t busesuta-frontend:t2.1 frontend
docker run --rm --name transviaje-frontend --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m,mode=1777 --cap-drop=ALL --security-opt=no-new-privileges:true -p 127.0.0.1:8081:8080 busesuta-frontend:t2.1
```

Abrir http://127.0.0.1:8081. Puede sustituirse 8081 por otro puerto libre; 8080 después de los dos puntos es el puerto interno. Detener con Ctrl+C o `docker stop transviaje-frontend` en otra terminal; `--rm` retira el contenedor. La imagen de construcción queda local para reutilizarla. No se levantan backend o base de datos con estos comandos. Verificado en Linux; no se ejecutó en Windows/Docker Desktop.

La portada y recursos reales responden 200, los archivos inexistentes 404 y los directorios sin índice 403. No se publica documentación, tests ni provenance.json; se conservan las licencias de los recursos. El contexto se limita mediante .dockerignore y las copias del Dockerfile.

**API aún sin conectar:** `/api/v1` y sus rutas responden 503 JSON con código `API_NOT_CONNECTED`, no la portada con 200. Esto es un estado explícito de empaquetado T2.1, no una prueba de salud ni un proxy implementado. T2.2 lo sustituirá por la conexión real con backend.

### Prueba real del contenedor

```sh
node frontend/tests/container-smoke.cjs
```

Requiere Docker, Node 24 y Chrome. Construye la imagen, ejecuta nginx -t, comprueba usuario no root, archivos incluidos/excluidos, MIME, HTTP 404/503 y ausencia de listado. Inicia un contenedor temporal con puerto loopback libre y ejecuta sobre él las mismas pruebas de navegador de T1, sin cambiar sus expectativas. Retira el contenedor incluso ante un fallo; la imagen queda en caché local. No lee .env ni necesita PostgreSQL.

`QA_BASE_URL` permite que smoke.cjs compruebe un servidor HTTP existente en 127.0.0.1; sin esa variable conserva el servidor estático temporal de T1. La prueba del contenedor configura esa variable automáticamente. Las capturas siguen usando QA_OUTPUT_DIR o el directorio temporal habitual.

Resultados y límites en [FRONT-01](../docs/specs/FRONT-01.md), sección 19. El [plan T2](../docs/frontend-t2-plan.md) conserva pendientes proxy, cookies reales con backend y confianza de IP; no declarar T2 completo por empaquetar T1.

## Entorno local conectado — FRONT-01 T2.2

Requiere Node 24 y Docker con Compose. Desde la raíz, el mismo lanzador funciona con sintaxis POSIX y PowerShell:

```sh
node frontend/scripts/dev.cjs up
node frontend/scripts/dev.cjs status
node frontend/scripts/dev.cjs down
```

`up` construye las imágenes, espera PostgreSQL, aplica las migraciones existentes y espera backend/frontend saludables. Abre http://127.0.0.1:8081/; http://127.0.0.1:8081/api/v1/health debe devolver JSON real con status ok. La portada sigue siendo informativa: tener la API conectada no implementa formularios o compras.

`down` retira únicamente el proyecto `transviaje-frontend-dev` y descarta sus datos efímeros. Las imágenes quedan en caché local. No usar este entorno para datos que quieras conservar. Si ya existe, `up` pide usar status o down primero: genera credenciales nuevas por arranque y no debe mezclarlas con una instancia anterior.

El lanzador crea contraseña de DB y JWT aleatorios en memoria, y usa un env-file vacío temporal para que Compose no cargue .env implícitamente. No solicita, lee, imprime ni guarda credenciales reales en archivos del repositorio. Solo frontend publica puerto en loopback; backend y PostgreSQL quedan en una red propia, sin reutilizar el volumen de producción. La base usa tmpfs. Durante la ejecución, Docker conserva las variables necesarias en sus contenedores; no compartas inspecciones completas o configuraciones renderizadas con esos valores.

Puerto alternativo, antes de up:

```sh
FRONTEND_DEV_PORT=8082 node frontend/scripts/dev.cjs up
```

En PowerShell:

```powershell
$env:FRONTEND_DEV_PORT = '8082'
node frontend/scripts/dev.cjs up
```

Se comprobó el lanzador en Linux con puerto 8081 y la prueba automatizada con puerto aleatorio 0. No se ejecutó Windows/Docker Desktop; la sintaxis del lanzador no equivale a esa validación.

La imagen conserva dos modos explícitos. Dockerfile sin Compose utiliza nginx.conf (estático T2.1, API 503). El Compose local selecciona nginx-proxy.conf y proxy-api.conf para rutas reales. No se monta configuración del host ni se modifica el modo de producción. Las pruebas originales de T2.1 conservan sus aserciones.

El proxy mantiene el prefijo /api/v1 y no convierte errores del backend en HTML de éxito. Si cae el backend, la portada continúa funcionando y la API devuelve un error HTTP, posiblemente HTML de Nginx. DNS dinámico permite recuperar una nueva IP sin reiniciar frontend. Con NODE_ENV=development y confianza de proxy desactivada, el backend verá la IP de Nginx; no se considera validado el rate limiting por cliente ni el despliegue HTTPS.

### Prueba de la conexión real

```sh
node frontend/tests/proxy-smoke.cjs
```

Construye los Dockerfiles reales y usa un proyecto QA exclusivo, base efímera y credenciales aleatorias. Comprueba portada sin backend, migraciones, health por proxy, errores 404/401, ausencia de puertos DB/backend y volúmenes de datos, y navegador con las expectativas de T1. Después detiene y reinicia backend, y fuerza un cambio real de IP ocupando temporalmente la dirección anterior con un contenedor auxiliar; exige recuperación sin recrear o reiniciar Nginx. Finalmente retira contenedores, auxiliar, red y archivo vacío temporal, incluso ante fallo.

La prueba de T2.3 descrita abajo comprueba cookies/CSRF en navegador y cabeceras manipuladas; esta prueba de T2.2 no acredita autenticación completa. No introduce usuarios, contraseñas de acceso, pantalla de login ni un cliente API. Resultados y límites en FRONT-01, sección 21.

El uso de upstream con zona compartida y resolve sigue la [documentación de Nginx](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#resolve). El orden DB/migración/backend usa [condiciones de dependencia de Compose](https://docs.docker.com/compose/how-tos/startup-order/), sin asumir que iniciar un proceso equivale a estar listo.

## Cookies y cabeceras — FRONT-01 T2.3

```sh
node frontend/tests/csrf-smoke.cjs
```

Requiere Docker, Node 24 y Chrome. Crea otro proyecto QA con PostgreSQL y backend reales, credenciales aleatorias y dos perfiles temporales de Chrome. No necesita ni utiliza cuentas existentes, y no modifica el proyecto interactivo de dev.cjs.

Comprobaciones:

- GET CSRF devuelve 200/no-store y dos Set-Cookie reales. El navegador almacena csrf_browser como HttpOnly y csrf_token legible; SameSite=Lax, Path=/ y cookies host-only. En HTTP development no llevan Secure.
- El navegador reenvía las cookies: un token válido llega a validación de datos y devuelve 400 VALIDATION_ERROR al enviar `{}`. Esta ruta positiva comprueba CSRF sin registrar una cuenta.
- Sin cabecera, token alterado, cookies omitidas, token antiguo tras rotación y token de otro perfil devuelven 403 CSRF_TOKEN_INVALID. Copiar también la cookie legible a otro perfil sigue fallando con su nonce HttpOnly distinto.
- Cabeceras de HTTPS falsificadas no alteran el modo HTTP real del backend de desarrollo. Se verifica que no hubo usuarios o sesiones creados.
- Se recrea solo el backend QA con NODE_ENV=production, usando una configuración temporal sin secretos. La respuesta real conserva Secure y __Host-csrf_browser, HttpOnly/Path=/ y ausencia de Domain. Es lectura de Set-Cookie por HTTP; no acredita TLS o aceptación de cookies por un navegador sobre HTTPS.
- Al final se reemplaza el backend QA por un receptor HTTP de diagnóstico efímero: observa que Nginx preserva POST, URI, query y cuerpo; elimina Forwarded y sobrescribe las cabeceras de red definidas en proxy-api.conf. Esta evidencia de transporte no se presenta como una prueba del backend o de autorización.

La prueba conserva tokens/cookies únicamente en memoria, no los imprime ni guarda perfiles o respuestas sensibles. Los resultados usan códigos/atributos sin valores. Retira contenedores, receptor de diagnóstico, redes, perfiles y configuración temporal aun ante error; las imágenes quedan en caché. No se agregan endpoints de diagnóstico al backend ni se publica el receptor en un puerto del host.

La confianza de IP sigue desactivada: los clientes comparten la IP del proxy para el backend. No valida separación de rate limiting por cliente, login/logout completos, renovación ligada a sesión autenticada, TLS, otros navegadores ni Windows. Los criterios de autenticación restantes se comprobarán en T3/T4 y la tarea específica de confianza de proxy. Esta verificación no añade UI ni altera la identidad visual.

Commit T2.2: 4d37295. Evidencia de T2.3 en FRONT-01, sección 23; revisión humana e integración de T2 pendientes.

## Bienvenida WEB-01 y compatibilidad con T2

WEB-01 conserva la bienvenida transViaje, el logo y el puerto 8080 del Compose
principal. No añade login ni compra. La corrección de integración se documenta
en [WEB-01](../docs/specs/WEB-01.md), sección 14.

La misma imagen contiene dos configuraciones: el arranque predeterminado usa
`/etc/nginx/nginx.conf` (estático, API 503 `API_NOT_CONNECTED`); ambos Compose
seleccionan explícitamente `/etc/nginx/nginx-proxy.conf` (proxy conectado).
El puerto por defecto del entorno de desarrollo es 8081; el principal conserva 8080. No levantar ambos sobre el mismo puerto.

Con el entorno principal ya configurado por el responsable:

```sh
docker compose up --build
```

Abrir http://localhost:8080/. La bienvenida no requiere backend; el proxy usa
`backend:3000` y devuelve error HTTP si no está disponible. El Compose principal
conserva NODE_ENV=production y exige configuración externa. Para probar cookies
por HTTP, usar el lanzador de desarrollo anterior; no desactivar Secure/CSRF.

La prueba compartida `tests/proxy-smoke.cjs` conserva íntegramente los escenarios
FRONT-01 T2. La comprobación adicional de WEB-01 vive en otro archivo y acepta
un origen ya levantado:

```sh
FRONTEND_URL=http://127.0.0.1:8080 node frontend/tests/web01-smoke.cjs
API_UNAVAILABLE=1 FRONTEND_URL=http://127.0.0.1:8080 node frontend/tests/web01-smoke.cjs
```

Ejecutar la segunda con el backend detenido. La imagen estática aislada se
comprueba con container-smoke.cjs, no con la prueba de proxy WEB-01. Los
resultados históricos de T2 anteriores no acreditan por sí solos esta combinación.

### Requisito de red observado al validar WEB-01

En Docker 28.1.1, la prueba T2 de cambio de IP exige una red QA con subred
explícita para usar --ip. Si el comando directo falla con «user specified IP
address», consultar la preparación reproducible de [WEB-01, sección 14](../docs/specs/WEB-01.md).
Con esa preparación la prueba original pasa sin cambiar sus aserciones.
No confundir esa restricción del escenario QA con un fallo del proxy en ejecución.
