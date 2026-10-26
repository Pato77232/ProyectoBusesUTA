# FRONT-01 T2: plan de servidor y proxy local

- Responsable: Pablo. Revisora de T1 solicitada: Shirley (`shirley6126`); no se infiere aceptación de T2.
- Estado: **T2.1/T2.2 versionados; T2.3 implementado como verificación real local. T2.4 pendiente**.
- Base: `3285695`, última implementación de T1. Rama de preparación: `feature/FRONT-01-T2-proxy`, creada desde ese commit.
- Dependencia resuelta: [PR #16 de T1](https://github.com/Pato77232/ProyectoBusesUTA/pull/16), aprobada por Shirley e integrada el 26 de octubre de 2026 en `eebfe75`; conserva `3285695` como padre, sin squash. La rama actual se conserva; no se ejecutó merge/rebase.
- Referencias: [FRONT-01](specs/FRONT-01.md), [ADR 0003](adr/0003-stack-tecnologico.md), [ADR 0004](adr/0004-autenticacion-sesiones-credenciales.md) y [acuerdos](frontend-acuerdos.md).

## 1. Resultado de este incremento

Preparar un entorno local donde el navegador consulte portada y API mediante `http://127.0.0.1:8081`. Nginx sirve archivos de T1 y reenvía `/api/v1` al backend real. Backend y PostgreSQL no necesitan puertos publicados al host en este entorno.

Es un entorno de desarrollo y comprobación, no una configuración de despliegue. No incluye formularios, cliente HTTP común, indicador de health en la portada, login, cambios en reglas de negocio, migraciones o políticas de producción. T3/T4 conservan su alcance. Las pruebas de transporte pueden consultar CSRF para comprobar cookies, sin construir autenticación en la UI.

## 2. Selecciones técnicas de preparación

| Elemento | Selección y motivo |
|---|---|
| Imagen propuesta | `nginx:1.30.6-alpine3.24-slim`, versión y variante explícitas del catálogo oficial consultado; sin alias latest/stable |
| Verificación antes de implementar | Imagen y digest ya comprobados en T2.1. Configuración de proxy comprobada en T2.2 con nginx -t; conservar el digest del Dockerfile y actualizar evidencia antes de sustituirlo |
| Procedencia/licencias | NGINX y Docker Official Images; conservar avisos y documentar licencias de la imagen/distribución, sin atribuirle una única licencia a todo el sistema operativo |
| Puerto local | `127.0.0.1:8081`, configurable mediante `FRONTEND_DEV_PORT`; no usa el 8080 de la vista previa ni publica por defecto en toda la red |
| Puerto del servidor | Nginx escucha 8080 dentro de su contenedor; upstream `backend:3000` en red Docker del proyecto |
| Composición local | Archivo independiente `docker-compose.frontend-dev.yml`; evita heredar inadvertidamente NODE_ENV=production, puertos y volumen de datos del Compose existente |
| Backend local | `NODE_ENV=development`, sin `TRUST_PROXY=loopback` ni cambio de confianza en T2; acceso únicamente desde la red del proyecto |
| Base local | Servicio db con PostgreSQL 16.13-alpine ya usado en el repositorio, datos efímeros en tmpfs y base exclusiva de este entorno; nunca el volumen database existente |
| Contexto de construcción | frontend; copiar únicamente index.html, src/styles y assets necesarios. Excluir tests, documentación y fuentes ajenas al producto mediante .dockerignore |

Versión consultada en el [catálogo oficial de imágenes](https://raw.githubusercontent.com/docker-library/official-images/master/library/nginx), que referencia el commit `4b9f658be76820b24e4ef4605413a5c08707a512` del [Dockerfile oficial](https://github.com/nginx/docker-nginx/blob/4b9f658be76820b24e4ef4605413a5c08707a512/stable/alpine-slim/Dockerfile). [Aviso de licencia de NGINX](https://nginx.org/LICENSE). Esta consulta confirma procedencia declarada, no certifica ausencia de vulnerabilidades ni sustituye la prueba de la imagen seleccionada.

El archivo independiente es una selección local dentro del enfoque de un origen con Nginx ya acordado. No requiere votar otra vez F-A1–F-A6 ni modificar el Compose de producción para usar HTTP en la demostración.

## 3. Contrato de rutas, errores y recursos

- `/` sirve la portada de transViaje. Recursos HTML/CSS/PNG/SVG/TTF con tipos MIME correctos; ningún cambio de identidad o funciones de T1.
- Archivos inexistentes responden 404. Sin fallback de SPA a index.html, sin listado de directorios y sin exposición de tests/README/DESIGN en la imagen final.
- `/api/v1` y `/api/v1/…` tienen tratamiento explícito de proxy. Mantener método, query, cuerpo y prefijo: no convertir `/api/v1/health` en `/health`. Una variante similar como `/api/v10` no debe confundirse con la API.
- Conservar status, JSON, `Set-Cookie` múltiple y cabeceras necesarias. No interceptar los 401/403/404 del backend para devolver HTML o éxito. No reescribir Domain/Path ni quitar Secure para aparentar funcionamiento.
- Caché del proxy desactivada para toda la API; respetar `Cache-Control: no-store`, sin almacenar respuestas privadas o cookies. Estáticos sin caché larga en este incremento para facilitar revisión.
- Backend apagado después del arranque: API responde 502/503/504 explícito, con espera acotada, nunca la portada con 200. Propuesta de tiempos: conexión 3 s y lectura/escritura 10 s; no repetir automáticamente mutaciones. No prometer JSON para errores generados por Nginx: T3 debe admitir respuesta no JSON.
- La portada sigue disponible cuando falla el backend. Tras reiniciarlo, verificar recuperación; si cambia su IP, resolver el nombre del servicio de forma compatible con la versión fijada y comprobarlo, sin exigir reconstruir la imagen para recuperar la API.
- Nginx debe poder servir los archivos aun cuando el backend no esté listo. No dar por aprobada esta condición si su configuración aborta por resolución DNS del upstream; comprobar el arranque y las condiciones de depends_on.

Referencia de comportamiento: [documentación oficial de proxy_pass](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass). El slash/URI del upstream cambia cómo se transmite la ruta; la prueba del prefijo es obligatoria.

## 4. Cookies y CSRF en desarrollo

El código actual toma `process.env.NODE_ENV` para la política de cookies. Por eso la variable debe existir en el proceso real del contenedor, no solo en un doble o parámetro de prueba.

| Entorno | Resultado esperado |
|---|---|
| HTTP local con NODE_ENV=development | Cookie de vínculo `csrf_browser`, HttpOnly, SameSite=Lax y Path=/; `csrf_token` legible por el cliente; Secure ausente en HTTP según código actual |
| Producción | Conservar NODE_ENV=production, cookies Secure y vínculo `__Host-csrf_browser`; HTTPS obligatorio según ADR 0004 |

Prueba local real: `GET /api/v1/auth/csrf` por Nginx, respuesta 200/no-store, token y ambas cookies aceptadas por navegador. El navegador devuelve las cookies al mismo origen en otra petición; comprobar transmisión sin registrar valores. Una mutación sin CSRF debe conservar 403 `CSRF_TOKEN_INVALID` sin crear datos ni iniciar sesión.

La prueba local no valida cookies Secure o HTTPS de producción. T2 no añade TLS, emite certificados ni altera cookies.js/csrf.js. No depender de excepciones particulares de localhost para hacer que la configuración de producción funcione en HTTP. No añadir CORS o localStorage como sustituto del mismo origen.

## 5. IP del cliente y límites de esta preparación

`server.js` solo acepta `TRUST_PROXY=loopback` y `app.js` solo configura esa confianza. Un Nginx en otro contenedor no es loopback. Activar ese valor no solucionaría el problema.

**Para T2 local:** mantener confianza desactivada. Nginx sobrescribe las cabeceras Forwarded/X-Forwarded-* de entrada con información propia o las elimina según su uso; no transmitir una identidad de red elegida por el cliente. Las respuestas no deben filtrar detalles internos. El backend ignora esas cabeceras y verá la IP del proxy: los límites por IP agruparán a los clientes de este entorno.

**Límite explícito:** no declarar validada la separación de rate limiting por cliente, HTTPS terminado en proxy ni un despliegue público. Antes de probar login como recorrido completo en T3 o de desplegar, delimitar una tarea de confianza de proxy: topología/red y proxies autorizados, rechazo de cabeceras falsificadas, ausencia de acceso directo no controlado y pruebas de IP/protocolo por proxy y directas. Su contrato requiere revisión; T2 no ampliará trust proxy a true ni a rangos arbitrarios.

Esto no bloquea servir T1 o consultar health/CSRF localmente; sí limita las conclusiones de autenticación y despliegue que pueden obtenerse de esas pruebas.

## 6. Arranque, datos y configuración

Preparar variables exclusivas del entorno local por shell o archivo temporal fuera del repositorio. No leer ni copiar .env real, incrustar secretos en Dockerfile, añadir credenciales a la documentación ni imprimir un Compose renderizado que las contenga. Construir correctamente la URL PostgreSQL cuando las credenciales requieran codificación.

El stack debe tener nombre de proyecto distinto, base exclusiva, sin puertos de DB/backend al host y sin volúmenes de producción. Documentar que tmpfs descarta los datos al retirar el servicio y que no sirve para datos que se quieran conservar. Aplicar migraciones con el script existente, nunca modificar migraciones o esquema manualmente.

Proponer y comprobar un orden reproducible: validar configuración sin imprimir secretos; levantar DB y esperar health; aplicar migraciones existentes con servicio de una ejecución; levantar backend y frontend; verificar health real. Si falla una migración, no iniciar una demostración aparentemente sana ni limpiar datos ajenos para continuar.

Compose puede cargar .env implícitamente incluso usando otro archivo YAML: utilizar un env-file vacío explícito para esta ejecución y variables locales controladas. El comando definitivo se documentará para POSIX y PowerShell después de comprobarlo; no presentar aquí comandos de archivos que aún no existen como si ya funcionaran.

## 7. Archivos previstos y pasos verificables

| Paso | Archivos previstos | Comprobación |
|---|---|---|
| T2.1: empaquetar T1 | frontend/Dockerfile, frontend/.dockerignore, frontend/nginx.conf | Imagen fija, `nginx -t`, estáticos reales, MIME, 404 y exclusión de documentación/tests |
| T2.2: conectar entorno local | docker-compose.frontend-dev.yml, configuración mínima de migración/arranque si hace falta | Red/datos aislados, migraciones reales, puerto 8081 configurable y health por proxy |
| T2.3: comprobar errores/cookies | Prueba de transporte/navegador de T2, separada del smoke estático de T1 | Matriz inferior con contenedores y navegador real, sin mocks que acrediten falsamente el proxy |
| T2.4: documentar evidencia | frontend/README.md, FRONT-01 y estado compartido | Reproducción, limpieza del proyecto, fallos reales y límites; no cerrar T3/T4 |

Los pasos son el desglose de T2, no autorización de cuatro tareas adicionales. No crear archivos o carpetas vacíos en esta preparación. La implementación se hará por el siguiente incremento autorizado, con pruebas junto al código.

## 8. Criterios de aceptación de T2

Las casillas marcadas tienen evidencia de T2.1 en FRONT-01, sección 19. Las demás permanecen pendientes; no se deducen del servidor estático.

- [x] Construir imagen y comprobar versión/digest, licencia/procedencia y nginx -t.
- [x] Desde 127.0.0.1:8081 cargar portada y recursos locales sin errores ni red externa; repetir navegación/lectura en 360/1280 px. Confirmar que el puerto es configurable y solo loopback.
- [x] Archivos inexistentes devuelven 404; no se publican README, DESIGN, pruebas ni fuentes documentales.
- [x] `/api/v1/health` responde 200 y JSON real del backend con PostgreSQL accesible; URL con query probada y prefijo conservado en configuración, sin fallback HTML.
- [x] Ruta API inexistente conserva 404 y el contrato JSON del backend; `/api/v1` y `/api/v10` no reciben la portada con 200.
- [x] CSRF por proxy conserva 200, no-store y dos Set-Cookie; el navegador almacena y reenvía cookies de mismo origen. Sin valores de tokens/cookies en evidencia.
- [x] Mutación sin token conserva 403 CSRF y no genera efectos; variantes de token inválido y positivo con datos inválidos comprobadas. Sin formulario/login end-to-end.
- [x] Backend detenido: la portada continúa cargando y la API falla en tiempo acotado con status de error. Recuperación tras reinicio/recreación del backend comprobada.
- [x] Cabeceras definidas en proxy-api.conf sobrescritas/eliminadas, observadas por receptor QA separado; protocolo falso comprobado sobre cookies del backend real. IP agrupada y limitación de rate limiting conservadas.
- [x] Compose de producción y políticas Secure/__Host permanecen sin cambios; configuración local no reutiliza datos/volúmenes existentes ni expone servicios adicionales.
- [x] Backend: lint, formato y npm test ejecutados con DB aislada, más arranque real. Lint y 346 pruebas aprobados; formato fallido en 26 archivos preexistentes (no equivale a formato aprobado).
- [x] Arranque/limpieza documentados mediante lanzador Node con sintaxis POSIX/PowerShell. Verificado en Linux; Windows no probado.

## 9. Trazabilidad, rama y estado real

La preparación está en otra rama basada en T1 para no añadir T2 a la PR #16. No se publica una PR T2 hacia develop mientras su diff incluya T1 pendiente, ni se ejecutan merge/rebase/cherry-pick por anticipado. Una vez integrada T1, comprobar si develop contiene `3285695` o si se usó squash; elegir con la persona la continuación compatible con el historial real. No dar por hecho que cambiar la base de una PR elimina commits duplicados después de un squash.

En la preparación inicial solo se autorizaron documentos: no se habían construido contenedores ni descargado Nginx. Posteriormente se autorizó T2.1, con resultados en la sección 10 y FRONT-01. Las pruebas del proxy/cookies con backend continúan pendientes. No se hicieron commits ni push. La evidencia de T1 no valida T2 por sí sola.

La PR #16 se comprobó abierta y sin integrar, con Shirley como revisora solicitada. No se comprobó una aprobación suya ni se contactó al equipo. No hay defectos inducidos propuestos para este incremento.


## 10. Incremento posterior autorizado: T2.1

Pablo pidió continuar después de proponer empaquetar la portada. Se incorporan Dockerfile, .dockerignore y nginx.conf, más prueba real del contenedor y reutilización del smoke de navegador sobre un origen loopback externo. Imagen oficial descargada, versión 1.30.6 confirmada, digest fijado en Dockerfile. Usuario efectivo nginx UID/GID 101 y aviso COPYRIGHT de Nginx conservado.

T2.1 está comprobado como servidor estático; `/api/v1` responde 503 `API_NOT_CONNECTED` expresamente. Aún no hay Compose frontend-dev ni upstream o health real por proxy. No se modifica la confianza de IP, backend o seguridad de producción. El siguiente incremento propuesto es T2.2. Evidencia de ejecución en FRONT-01, sección 19. Sin commits ni push.


## 11. Guardado autorizado y punto de revisión

Pablo pidió guardar el plan y T2.1 con commits atómicos y después decidir si continuar o esperar. Se separan el documento de planificación y la implementación con pruebas/estado. Las referencias anteriores a «sin commits» describen las sesiones previas. No se autoriza ni realiza push en este incremento.

La comprobación posterior de la PR #16 la mantiene abierta y sin integrar, con solicitud a Shirley y sin revisiones registradas; develop continúa en c89b1b9. La decisión de continuidad se registra junto con la evidencia de los commits en FRONT-01 y el estado, sin inventar aceptación humana ni cambios de base.


## 12. T1 integrada y T2.2 autorizado

Pablo pidió implementar T2.2 tras comprobar la integración de T1. La recomendación anterior de esperar quedó superada por la aprobación de Shirley y merge eebfe75. La comparación con develop contiene solo el trabajo de T2; no hace falta rehacer la rama o duplicar T1. No se declara cerrada toda FRONT-01.

Se añade Compose independiente y lanzador de credenciales efímeras, configuración de proxy separada del modo estático de T2.1 y prueba con backend/DB/migraciones reales. Se verifican health, 404/401, arranque sin backend y recuperación con cambio real de IP sin reiniciar Nginx. Evidencia en FRONT-01, sección 21. Cookies/CSRF en navegador y cabeceras falsificadas siguen pendientes de T2.3; la confianza de IP continúa desactivada. Backend, Compose existente, migraciones y políticas de producción no se modificaron. Sin commits ni push.


## 13. T2.2 guardado y T2.3 autorizado

T2.2 guardado en 4d37295 por petición de Pablo. Posteriormente se autorizaron las comprobaciones de cookies, CSRF y cabeceras: frontend/tests/csrf-smoke.cjs y helper de Chrome exclusivo de pruebas, sin modificar código productivo o expectativas previas. La aprobación del backend real y la observación del receptor de transporte se distinguen expresamente.

Dos perfiles aislados comprueban HttpOnly, reenvío, no-store, tokens ausentes/alterados/rotados/de otro vínculo y validación posterior a CSRF válido sin crear usuarios/sesiones. Otra instancia QA del backend real conserva flags de producción; esto no acredita TLS. Detalle de ejecución en FRONT-01, sección 23. T2.4, confianza de proxy y autenticación completa siguen pendientes; sin push ni commit de T2.3 en esta sesión.
