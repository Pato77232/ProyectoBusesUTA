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
