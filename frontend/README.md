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

El proxy requiere una red Docker donde `backend` sea resoluble. El segundo comando
solo permite revisar estáticos; la API fallará sin ese servicio.
Nginx 1.30.6 alpine3.24-slim se fija por digest en Dockerfile, reutilizado de la
rama FRONT-01-T2-proxy. Bootstrap conserva su licencia MIT y la fuente su OFL.
La configuración de cookies de producción no cambia: una futura pantalla de acceso
necesitará el entorno HTTPS o de desarrollo definido en su propia tarea.

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
