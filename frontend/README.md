# transViaje — Frontend compartido, FRONT-01 T1

Base estática en HTML y CSS. Incluye Bootstrap 5.3.8 local, navegación por secciones, enlace para saltar al contenido y preguntas con details/summary nativos. No necesita JavaScript para funcionar. Aún no incluye búsqueda, compra, login ni conexión a la API.

Guía visual y trazabilidad: [DESIGN.md](DESIGN.md). La referencia original y la adaptación están separadas. Pablo confirmó nombre transViaje, logo definitivo y paleta blanco/negro/violeta; la revisión humana de la implementación sigue pendiente.

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
