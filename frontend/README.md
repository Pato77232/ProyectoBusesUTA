# Frontend de transViaje

HTML, módulos JavaScript, Bootstrap local y Nginx. La portada pública no requiere API para mostrar su contenido; las pantallas operativas usan el cliente compartido y comprueban sesión/rol cuando corresponde.

## Pantallas presentes

Inventario del checkout `64f39cd`, 4 de noviembre de 2026. Tener un archivo de pantalla no certifica que toda la función esté habilitada o integrada con sus proveedores.

| Ruta | Función / contrato |
|---|---|
| `/` | Bienvenida pública, marca y enlaces |
| `/pages/login.html` | Acceso con sesión/CSRF y recuperación de resultado incierto |
| `/pages/operaciones-cooperativa.html` | Menú autenticado para COOPERATIVE_ADMIN con accesos a Flota, Frecuencias, Hojas de ruta y Oficinistas |
| `/pages/registrar-bus.html` | Registro de bus |
| `/pages/crear-frecuencia.html` | Alta de frecuencia con resolución ANT |
| `/pages/frecuencias.html` | Consulta, detalle y cambio de estado |
| `/pages/hojas-ruta.html` | Consulta y alta de borradores |
| `/pages/programar-hoja.html?id=<UUID>` | Programación, tarifas, publicación y preparación del siguiente ciclo |
| `/pages/reservas.html` | Flujo de reservas sujeto a inventario, tarifa y acreditación verificables |
| `/pages/comprobantes.html` | Interfaz de comprobantes; permisos y operaciones según contrato de Pagos |

Consultar [specs](../docs/specs/) y [estado](../docs/estado-proyecto.md) para evidencia y límites. No se anuncia registro público, emisión QR, correo completo ni historial web porque exista un contrato backend. Chofer/Controlador está fuera de esta fase.

## Ejecutar con API

Desde la raíz, con Node.js 24 y Docker Compose v2:

```sh
node frontend/scripts/dev.cjs up
node frontend/scripts/dev.cjs status
```

Abrir **http://127.0.0.1:8081/**. El lanzador prepara configuración temporal, PostgreSQL y migraciones; no lee `.env`. No crea cuentas de demostración. Los datos se pierden al retirar el entorno:

```sh
node frontend/scripts/dev.cjs down
```

Más detalles y puerto alternativo: [GUIA-INTEGRACION.md](GUIA-INTEGRACION.md). Para configuración persistente, migraciones y administrador: [README general](../README.md) y [administrador inicial](../docs/administrador-inicial.md).

## Revisar solo los estáticos

Desde la raíz:

```sh
docker build -t busesuta-frontend frontend
docker run --rm -p 127.0.0.1:8080:8080 busesuta-frontend
```

Abrir **http://localhost:8080/**. La imagen usa `nginx.conf` estático: `/api/v1` devuelve 503; no permite comprobar login ni escrituras reales. Compose selecciona `nginx-proxy.conf` y reenvía `/api/v1` a `backend:3000` conservando el prefijo. Si el backend no está disponible, la portada puede seguir visible; eso no acredita disponibilidad de las operaciones.

## Código y recursos

- `pages/` y `src/`: pantallas y lógica de presentación por módulo.
- `src/api/`: transporte, sesión y CSRF compartidos; no duplicar clientes por pantalla.
- `src/styles/app.css`: tokens y base visual. Aplicar [DESIGN.md](DESIGN.md).
- `assets/`: recursos locales con procedencia y avisos de licencia; sin CDN obligatorio.
- `nginx-proxy.conf` y `proxy-api.conf`: estáticos/proxy sin caché de API.
- `scripts/`: entorno temporal. `tests/`: unitarias, contratos y escenarios de navegador.

Conservar [licencia de Bootstrap](assets/vendor/bootstrap-5.3.8/LICENSE), [OFL de Plus Jakarta Sans](assets/vendor/plus-jakarta-sans/OFL.txt) y [procedencia de marca](assets/brand/README.md).

## Verificar

Desde la raíz, con dependencias de desarrollo del backend instaladas:

```sh
npm --prefix backend ci
npm --prefix frontend run lint
npm --prefix frontend test
```

El frontend usa `node:test`; el lint utiliza ESLint instalado en backend. No necesita instalar un paquete frontend adicional.

Ejemplos de recorridos específicos, desde la raíz:

```sh
npm --prefix frontend run test:login
node frontend/tests/route-sheet-editor-smoke.cjs
node frontend/tests/route-sheet-lifecycle-smoke.cjs
```

Estos escenarios requieren Docker y Chrome/Chromium, generan entornos/usuarios ficticios exclusivos y retiran sus recursos al terminar. Configurar `BROWSER_BIN` si el navegador no se encuentra y `QA_OUTPUT_DIR` para guardar capturas; consultar cada script antes de usarlo. No introducir credenciales reales ni asumir que un escenario verifica pantallas ajenas.

En PowerShell, por ejemplo, definir `BROWSER_BIN` con la ruta real del ejecutable instalado:

```powershell
$env:BROWSER_BIN = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
npm --prefix frontend run test:login
```

`tests/proxy-smoke.cjs` comprueba un stack existente; `FRONTEND_URL` selecciona su origen y `API_UNAVAILABLE=1` permite comprobar un backend deliberadamente detenido. No construye ni retira ese stack. Las instrucciones detalladas están en la guía de integración.

Registrar resultados por escenario y fecha; una captura o prueba de reflujo no certifica zoom nativo ni lector de pantalla. Las evidencias previas conservan sus limitaciones; no se declara conformidad global de accesibilidad.
