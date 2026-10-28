# WEB-01: Página pública de bienvenida de transViaje

- **ID local:** WEB-01
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** frontend
- **Responsable:** por asignar
- **Estado:** Implementada y verificada el 27 de octubre de 2026; pendiente de revisión humana

## 1. Objetivo

Presentar a los visitantes una página pública de bienvenida a **transViaje**, con
el contexto de la plataforma de gestión y venta de pasajes interprovinciales en
Ecuador. Será la primera pantalla visible al abrir `http://localhost:8080/`.

Referencias: `docs/business-rules.md`, `docs/architecture.md` y ADR 0003.
El frontend se ubicará en `frontend/`, con HTML, Bootstrap 5 y JavaScript con
módulos ES cuando sea necesario, servido por su propio contenedor.

## 2. Reglas de negocio involucradas

- **Alcance funcional:** presentar el propósito de la plataforma multi-tenant de
  transporte interprovincial sin ofrecer operaciones todavía no implementadas.
- **RN-01:** la página es pública y no requiere autenticación. Los permisos de
  operaciones protegidas siguen siendo responsabilidad del backend.
- **RN-02:** no se muestran datos privados de usuarios ni cooperativas. Esta
  pantalla no consulta ni modifica información de los inquilinos.
- El rol Chofer/Controlador queda fuera de esta fase.

## 3. Alcance

**Incluye:**

- Una página pública en español con el nombre transViaje, un mensaje de
  bienvenida y una explicación breve del propósito de la aplicación.
- Presentación adaptable a móvil y escritorio con Bootstrap 5.
- Servicio `frontend` en Docker Compose, publicado localmente en el puerto 8080.
- Proxy de `/api/v1` hacia `backend:3000`, conservando el prefijo de la API.

**No incluye:** formularios o pantallas de login y registro, recuperación de
contraseña, cierre de sesión, paneles por rol, búsqueda interactiva de viajes,
reservas, pagos ni compra de boletos. Login y registro tendrán specs posteriores.
No se crearán enlaces que conduzcan a esas pantallas mientras no existan.

La página no requiere llamadas a la API para mostrar su contenido. El proxy deja
la comunicación con la API disponible desde el mismo origen para tareas futuras.
No se modifica la lógica de negocio ni la autenticación del backend.

Antes de incorporar Bootstrap u otra dependencia se avisará y justificará su uso.
Las imágenes de contenedor y los recursos externos tendrán versiones fijas según
ADR 0003. No se usará EJS ni un framework SPA.

## 4. Flujo principal

1. El visitante abre `http://localhost:8080/`.
2. El frontend muestra el nombre transViaje y el mensaje de bienvenida.
3. El visitante puede leer el contexto de la plataforma y su propósito de facilitar
   la gestión y venta de pasajes interprovinciales en Ecuador.
4. La página se adapta al tamaño de pantalla sin exigir una cuenta ni credenciales.

La bienvenida no cambia según exista o no una sesión. No consulta `/auth/me`,
solicita credenciales ni inicia operaciones de compra.

## 5. Datos

| Dato                    | Tipo                      | Tratamiento                                                |
| ----------------------- | ------------------------- | ---------------------------------------------------------- |
| Nombre de la aplicación | Texto estático            | transViaje.                                                |
| Bienvenida              | Texto estático en español | Saludo y presentación de la plataforma.                    |
| Contexto                | Texto estático en español | Descripción basada en el alcance de las reglas de negocio. |

No hay campos de entrada, datos personales, persistencia ni cambios de esquema.
No se inventan cooperativas, rutas, precios, estadísticas, testimonios, contactos
ni contenido institucional. Se usa el logo aportado por el usuario, conservado en la base FRONT-01.

## 6. Rutas y encaminamiento

| Método | Ruta pública                          | Destino                             | Resultado esperado                                       |
| ------ | ------------------------------------- | ----------------------------------- | -------------------------------------------------------- |
| GET    | `http://localhost:8080/`              | Frontend                            | 200 con la página de bienvenida.                         |
| GET    | `http://localhost:8080/api/v1/health` | `http://backend:3000/api/v1/health` | Respuesta existente del backend para verificar el proxy. |

Las solicitudes bajo `/api/v1` se encaminan al backend conservando ruta y método.
No se agregan endpoints de negocio. El navegador utiliza el origen público del
frontend; `backend:3000` es una dirección interna de Docker.

## 7. Criterios de aceptación

- [x] Al abrir `http://localhost:8080/`, se recibe una página HTML de bienvenida
      en español con el nombre transViaje.
- [x] La página explica el propósito de la plataforma conforme a las reglas de
      negocio, sin presentar datos ficticios como reales.
- [x] La página se puede consultar sin autenticación y sin llamadas a la API.
- [x] La bienvenida se mantiene accesible aunque el backend no responda.
- [x] El contenido usa estructura semántica, idioma del documento y encabezados
      coherentes; cualquier elemento interactivo es accesible con teclado.
- [x] La página es legible en móvil y escritorio sin desplazamiento horizontal.
- [x] No hay formularios de acceso o registro ni enlaces a pantallas inexistentes.
- [x] Docker Compose levanta el frontend en el puerto 8080 junto al entorno actual.
- [x] Con el backend disponible, `/api/v1/health` a través del puerto 8080 devuelve
      200 y el JSON de salud existente, conservando el prefijo `/api/v1`.

## 8. Casos borde y errores

- **Backend no disponible:** la bienvenida estática sigue visible; una solicitud
  a la API refleja el fallo del servicio y no devuelve el HTML de bienvenida.
- **Pantalla estrecha o texto ampliado:** el contenido sigue siendo legible y no
  se superpone ni exige desplazamiento horizontal.
- **Sesión existente:** se presenta la misma bienvenida pública, sin consultar ni
  modificar la sesión.
- **Puerto 8080 ocupado:** documentar el conflicto en la guía de arranque, sin
  cambiar el puerto acordado silenciosamente.

## 9. Pruebas esperadas

- **Verificación del frontend:** comprobar respuesta HTML, nombre, bienvenida,
  contexto y ausencia de enlaces a pantallas inexistentes.
- **Integración de despliegue:** comprobar que la raíz se sirve en el puerto 8080
  y que el proxy entrega la respuesta de `/api/v1/health` del backend.
- **Independencia del contenido estático:** comprobar que la bienvenida permanece
  disponible cuando el backend no responde.
- **Verificación manual:** revisar legibilidad, estructura, teclado cuando aplique
  y adaptación a móvil y escritorio.
- En la implementación, ejecutar `npm run lint` y `npm test` desde `backend/` y
  reportar los resultados reales. No agregar herramientas de pruebas nuevas sin
  avisar y justificar su necesidad.

## 10. Decisiones confirmadas y pendientes

**Confirmadas por el usuario:**

- Primera pantalla: página pública de bienvenida y contexto de la aplicación.
- Nombre: transViaje.
- URL local: `http://localhost:8080/`.
- Proxy de `/api/v1` hacia `backend:3000`.
- Login y registro se abordarán posteriormente con sus propias specs.

**Decisiones técnicas aplicadas:**

- Nginx 1.30.6 alpine3.24-slim con digest fijo en frontend/Dockerfile.
- Bootstrap 5.3.8 local, recuperado del remoto con su licencia MIT; incorporación
  avisada antes de copiar los recursos. Sin paquetes nuevos de frontend.
- Paleta blanco/negro/violeta y fuente local reutilizadas de la base compartida.
- El usuario autorizó finalizar WEB-01 en la rama actual el 27 de octubre de 2026.

## 11. Defecto inducido

No aplica. Esta spec no propone ni autoriza defectos académicos. Cualquier defecto
futuro requiere la documentación y aprobación indicadas en `docs/errores-inducidos.md`.

## 12. Decisiones de implementación de WEB-01

- Se reutilizan portada, estilos, logo, fuente y Bootstrap 5.3.8 de
  `origin/develop` en c8bb5d3, sin integrar otros módulos. La autorización actual
  cubre finalizar WEB-01; no se heredan permisos de sesiones documentadas.
- Nombre visible transViaje conforme al logo y mockups aportados. Blanco, negro,
  controles redondeados y acentos violetas de la base compartida existente.
  Los mockups son referencia visual; sus ejemplos no agregan requisitos.
- Nginx e imagen fijada por digest reutilizados de FRONT-01 T2. El proxy conserva
  /api/v1 y puede arrancar sin backend mediante DNS de Docker.
- Servicio frontend publicado en 127.0.0.1:8080, sin dependencia de arranque del
  backend. No se cambia la política de cookies ni se implementa autenticación.
- WEB-01 completa únicamente bienvenida y proxy; no reemplaza FRONT-01 T3/T4.

## 13. Verificación real — 27 de octubre de 2026

- Imagen frontend construida; nginx -t aprobado.
- Navegador Brave/Chromium: prueba heredada smoke.cjs aprobada a 1280/360 px
  y ampliación CSS 200 %, teclado, foco, enlaces internos, recursos locales y
  ausencia de desbordamiento. Capturas desktop/mobile inspeccionadas.
  No equivale a zoom nativo ni certificación de accesibilidad.
- proxy-smoke.cjs aprobado con backend real: health 200 y JSON esperado,
  API inexistente 404 JSON, rutas estáticas inexistentes 404.
- Sin backend al arrancar y tras detenerlo: portada 200 y API 502/503/504,
  sin devolver la bienvenida como respuesta de API.
- npm run lint: aprobado en Node 24.21.0 mediante Docker.
- npm test: 256 aprobadas, 175 unitarias y 81 de integración. PostgreSQL
  16.13 temporal en tmpfs, sin .env ni datos reales. Sin cambios de backend.
- npm ci restauró el lockfile existente; reportó dos vulnerabilidades de
  dependencias existentes (una moderada y una alta). No se actualizaron paquetes.
- Sin commits, push, merge, rebase ni tags. El remoto sigue sin integrarse;
  solo se reutilizaron recursos acotados del frontend.

Compose: build y up --no-deps frontend aprobados en proyecto aislado
busesuta-web01-preview, puerto 8080. La vista previa permanece disponible;
backend/base temporal retirados. Health real se comprobó antes en la red de QA.
Para detener la vista previa sin cargar variables ni .env:
`docker stop busesuta-web01-preview-frontend-1`.

## 14. Corrección de integración WEB-01 / FRONT-01 T2

Solicitud humana del 28 de octubre de 2026: corregir la integración revisada.
Base: e77716d de origin/feature/WEB-01-primera-pantalla, que contiene
origin/develop 92d91d3. Rama de corrección: bugfix/WEB-01-integracion.

Alcance autorizado: recuperar los dos modos de Nginx de FRONT-01 T2, conservar
la bienvenida y el puerto 8080 de WEB-01, y recuperar documentación y pruebas
compartidas reemplazadas durante la combinación. No hay cambios de negocio,
backend, dependencias, login, política de cookies ni diseño de la portada.
Se aplica frontend/DESIGN.md conservando identidad, tokens y accesibilidad.
No aplica defecto inducido: estos fallos de integración son inesperados.

Plan y criterios:

- Dockerfile copia nginx.conf como modo estático predeterminado y también
  nginx-proxy.conf en su ruta propia. El contenedor aislado devuelve 503 JSON
  API_NOT_CONNECTED; conserva las aserciones de container-smoke.cjs.
- Compose principal activa nginx-proxy.conf explícitamente en 8080. Compose
  de desarrollo conserva su modo conectado en 8081; ambos usan la misma imagen.
- Restaurar proxy-smoke.cjs íntegro desde develop 92d91d3, sin reducir
  expectativas. Conservar la prueba adicional WEB-01 con otro nombre.
- Restaurar README compartido y añadir instrucciones WEB-01 sin borrar T2.
- Comprobar imagen estática, stack real, transporte/cookies/CSRF y bienvenida
  WEB-01 mediante Compose principal; sin backend debe seguir sirviendo HTML.
- Ejecutar lint, format:check y npm test del backend con PostgreSQL aislado.
- Registrar resultados reales en esta spec y estado-proyecto.md; sin commits,
  push, merge, rebase ni cierre/aprobación humana inferidos.

La responsabilidad de configuraciones se mantiene separada: empaquetado estático
por defecto, selección explícita del proxy en Compose y prueba de cada contrato.
Usabilidad: conservar teclado, foco, recursos locales y reflujo de la bienvenida
mediante las pruebas existentes; no se agregan interacciones.

### Resultados de la corrección — 28 de octubre de 2026

- Fallo reproducido antes del arreglo: container-smoke.cjs esperaba 503 y
  recibió 502 en /api/v1. Tras restaurar Dockerfile, la misma prueba pasó,
  incluidas sus aserciones de navegador, MIME, licencias y exclusiones.
- Dockerfile y proxy-smoke.cjs restaurados byte a byte desde develop 92d91d3.
  La comprobación propia WEB-01 se conserva íntegra como web01-smoke.cjs;
  container-smoke.cjs y csrf-smoke.cjs no se modificaron.
- Prueba restaurada del proxy: primera ejecución fallida por requisito de Docker
  al asignar --ip en una red sin subred explícita. Nueva ejecución con red QA
  precreada con IPAM explícito aprobada, sin modificar ninguna aserción:
  arranque sin backend, migraciones, health/404/401, navegador, caída/reinicio y
  cambio real de IP sin recrear ni reiniciar Nginx. La ejecución directa sin
  preparar IPAM sigue dependiendo de la política de redes de Docker.
- csrf-smoke.cjs: aprobada con backend real, navegador, cookies/CSRF, atributos
  Secure/__Host y receptor QA de transporte. No acredita TLS de producción,
  login completo ni separación de rate limiting por IP de cliente.
- Compose principal real: aprobado con frontend, backend y DB de QA, sin .env.
  Se usó un override temporal solo del puerto publicado para evitar ocupar la
  vista previa existente; la declaración original 8080 se conserva. La prueba
  WEB-01 pasó antes de iniciar backend, con health real y después de detenerlo.
- npm run lint: aprobado. npm test: 657 aprobadas (550 unitarias, 107 integración)
  con Node 24.21.0 y PostgreSQL 16.13 temporal en tmpfs.
- npm run format:check: fallido en 27 archivos preexistentes del backend;
  ninguno se modificó. No se oculta ni se clasifica como defecto inducido.
- Pruebas frontend ejecutadas con Node 25.9.0 del host y Brave/Chromium instalado;
  backend y sus pruebas con Node 24.21.0. Reflujo 360/1280 y CSS zoom 200 %
  aprobados; no certifica zoom nativo, Windows ni ayudas técnicas.
- Sin dependencias nuevas, cambios de backend, commits ni publicación.
  Estado: corrección implementada localmente; revisión humana pendiente.

Para repetir la prueba del proxy intacta en Docker que exige IPAM explícito,
precrear la red del proceso de QA. Elegir antes una subred libre (la siguiente
fue utilizada solo para QA en esta ejecución); Docker rechaza solapamientos.
Desde la raíz, con BROWSER_BIN apuntando al navegador Chromium:

```sh
node - <<'JS'
const { execFileSync } = require('node:child_process');
const project = `transviaje-frontend-qa-${process.pid}`;
execFileSync('docker', [
  'network', 'create', '--subnet', '10.233.249.0/24',
  '--label', `com.docker.compose.project=${project}`,
  '--label', 'com.docker.compose.network=default', `${project}_default`,
], { stdio: 'pipe' });
require(process.cwd() + '/frontend/tests/proxy-smoke.cjs');
JS
```

La propia prueba retira el proyecto y la red en su finally; no usar redes o
contenedores ajenos. Este ejemplo es preparación QA, no configuración del producto.
