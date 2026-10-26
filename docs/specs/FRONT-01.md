# FRONT-01: Base compartida del frontend

- **ID local:** FRONT-01
- **Responsable:** Pablo
- **Revisora propuesta:** Shirley; confirmación pendiente.
- **Estado:** Borrador técnico con enfoque F-A1–F-A6 confirmado por reporte de Pablo. Preparación documental autorizada; implementación no iniciada.
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

Siguiente paso propuesto: T1, página mínima accesible y Bootstrap local con versión exacta, procedencia/licencia y comprobación visual. No adelantar T2–T4 ni formularios de negocio. La decisión anterior de preparar solo documentos sigue delimitando la ejecución hasta que Pablo indique continuar con implementación.

## 11. Defectos inducidos

No aplica. No introducir ni corregir defectos académicos por esta tarea documental.

## 12. Evidencia de la fase actual

Solo se redactaron documentos y la fila de estado correspondiente. No hay frontend implementado, dependencias instaladas ni cambios en backend, Compose o migraciones.

Verificaciones del 25 de octubre de 2026 sobre esta rama documental, Node 24.21.0:
- `npm run lint`: aprobado.
- `npm test`: 346 aprobadas, 239 unitarias y 107 de integración, contra PostgreSQL 16.13 en el proyecto Docker exclusivo `busesuta-front01-spec`. Sin cargar .env ni tocar datos reales. Contenedor y red temporales retirados al terminar.
- `npm run format:check`: fallido en los mismos 26 archivos preexistentes del backend, sin cambios de esta tarea en esos archivos. No es un defecto inducido autorizado.
- `git diff --check` y 24 enlaces locales de esta spec, propuesta y registro: aprobados.

Estas comprobaciones no acreditan frontend, proxy, cookies en navegador ni usabilidad visual: no existen en este incremento. No se agregaron pruebas que solo comprueben el texto de los documentos. Aprobación de implementación, revisión humana, publicación e integración pendientes. No se hicieron commits ni push en esta fase.
