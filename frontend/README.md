# transViaje — WEB-01

Bienvenida pública en HTML y Bootstrap 5.3.8 local, con logo aportado, tipografía
local y estilos reutilizados de FRONT-01. No consulta la API para mostrar contenido.
No incluye login, registro, búsqueda ni compra. Alcance: [WEB-01](../docs/specs/WEB-01.md).

## Ejecutar

Con el entorno del backend configurado por el responsable, desde la raíz:

```sh
docker compose up --build
```

Abrir http://localhost:8080/. El frontend sirve estáticos y reenvía `/api/v1`
a `backend:3000` conservando el prefijo. No depende del arranque del backend:
si este falla, la bienvenida funciona y la API devuelve un error HTTP.
Si 8080 está ocupado, detener el servicio que lo utiliza; no cambiarlo silenciosamente.
Para revisar únicamente la bienvenida, sin backend ni variables de entorno:

```sh
docker build -t busesuta-web01-frontend frontend
docker run --rm -p 127.0.0.1:8080:8080 busesuta-web01-frontend
```

Esta ejecución aislada usa nginx.conf estático: API 503 explícita. Compose
selecciona nginx-proxy.conf y conecta la API; ambos archivos están en la imagen.

El proxy de Compose requiere una red Docker donde `backend` sea resoluble.
El segundo comando solo sirve estáticos, incluso si existe otro backend.
Nginx 1.30.6 alpine3.24-slim se fija por digest en Dockerfile, reutilizado de la
rama FRONT-01-T2-proxy. Bootstrap conserva su licencia MIT y la fuente su OFL.
La pantalla de acceso usa el proxy del mismo origen y el cliente compartido.
La prueba de AUTH-WEB-01 usa exclusivamente el entorno efímero de desarrollo.

## Archivos y pruebas

- `index.html`: bienvenida y enlaces internos reales.
- `src/styles/app.css`: tokens compartidos, adaptación y foco.
- `assets/`: logo, favicon y dependencias locales con procedencia/licencias.
- `nginx-proxy.conf`, `proxy-api.conf`: estáticos, DNS Docker y proxy sin caché.
- `tests/smoke.cjs`: navegador, teclado, recursos y reflujo 360/1280 px y ampliación CSS 200 %.
- `tests/proxy-smoke.cjs`: portada/API/404 sobre un servidor levantado.

```sh
BROWSER_BIN=/ruta/al/navegador-chromium node frontend/tests/smoke.cjs
node frontend/tests/proxy-smoke.cjs
API_UNAVAILABLE=1 node frontend/tests/proxy-smoke.cjs
```

La última comprobación se ejecuta con el backend detenido. No certifica zoom nativo
ni ayudas técnicas. Lint y suite del backend se ejecutan desde `backend/`.
No se instalaron dependencias nuevas de frontend; recursos recuperados de Git.


## Pantalla de inicio de sesión — AUTH-WEB-01

Ruta /pages/login.html, enlazada desde la portada. La página comprueba primero
la sesión y solo muestra el formulario tras 401; confirma el login mediante
auth/me. Ante resultado incierto ofrece comprobar sesión sin repetir el POST.
No redirige a paneles ni añade permisos de Fleet por mostrar una sesión iniciada.

```sh
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run test:login
```

La última prueba requiere Docker Compose y Chrome/Chromium (BROWSER_BIN si hace
falta); usa puerto aleatorio, perfil de navegador, usuario, API y PostgreSQL
exclusivos de QA. No lee .env. El lanzador genera configuración temporal y retira
los contenedores al terminar. Capturas en /tmp/transviaje-login-api por defecto
o en QA_OUTPUT_DIR. No introducir credenciales reales ni compartir contraseñas.
Ver [spec y evidencia](../docs/specs/AUTH-WEB-01.md).
