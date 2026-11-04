# transViaje — gestión y venta de pasajes interprovinciales

Proyecto académico de Manejo y Configuración de Software, carrera de Software de la Universidad Técnica de Ambato (FISEI). Plataforma web multi-tenant para cooperativas de transporte de Ecuador.

La versión declarada en [backend/package.json](backend/package.json) es `0.1.0`. El nombre del repositorio técnico es ProyectoBusesUTA; la marca pública es **transViaje**.

## Alcance actual

Fotografía del código local `64f39cd`, 4 de noviembre de 2026; no certifica despliegue ni aprobación de todos los recorridos.

| Área | Implementación y límites |
|---|---|
| Acceso y cooperativas | Autenticación con sesiones revocables, roles y aislamiento por cooperativa; inicialización del administrador mediante comando. |
| Flota | Registro de buses, configuración de asientos y fotografías. Las capacidades concretas dependen de las plantillas y contratos vigentes. |
| Frecuencias y hojas de ruta | Frecuencias con resolución ANT, consulta y estado; editor de programación/tarifas, publicación y renovación explícita de ciclos. |
| Reservas y pagos | Existen APIs y pantallas de reservas/comprobantes, cotización, recepción/revisión y contratos de ciclo de venta e historial/acceso invitado. La presencia de estos componentes no acredita compra completa habilitada: la acreditación comercial y el envío real de correo requieren sus integraciones. Ver specs y evidencia actuales. |
| Pendientes de primera entrega | No presentar boleto QR, notificaciones generales, todos los filtros comerciales o configuración visual administrativa como recorridos completos sin su evidencia específica. |
| Fuera de esta fase | Funcionalidad de Chofer/Controlador. |

Las [reglas de negocio](docs/business-rules.md) definen el comportamiento esperado; las [specs](docs/specs/) registran implementación y límites; el [estado del proyecto](docs/estado-proyecto.md) reúne fotografías fechadas por integrante. Sus resultados históricos no sustituyen una comprobación del checkout actual.

## Tecnologías

| Componente | Implementación |
|---|---|
| Backend | Node.js **24.x**, Express 5; monolito modular con arquitectura limpia |
| Persistencia | PostgreSQL 16, consultas con `pg`, migraciones con `node-pg-migrate` |
| Autenticación | JWT en cookie HttpOnly, sesiones revocables en base de datos, CSRF y Argon2id |
| Frontend | HTML, módulos JavaScript, Bootstrap 5 y recursos locales; Nginx sirve estáticos y reenvía `/api/v1` |
| Calidad | Jest en backend; `node:test` en frontend; ESLint y Prettier |
| Entornos | Docker y Docker Compose v2 |

No se utilizan Prisma ni plantillas EJS. Los scripts y versiones concretas están en los manifiestos y Dockerfiles; no hay hooks Husky/commitlint instalados en este checkout.

## Empezar en desarrollo

Requisitos: Git, Node.js 24.x con npm y Docker con Compose v2 activo. Desde una terminal:

```sh
git clone https://github.com/Pato77232/ProyectoBusesUTA.git
cd ProyectoBusesUTA
npm --prefix backend ci
node frontend/scripts/dev.cjs up
node frontend/scripts/dev.cjs status
```

Abrir **http://127.0.0.1:8081/**. La API se consulta desde el mismo origen, por ejemplo `/api/v1/health`. El lanzador crea configuración temporal, aplica migraciones y espera los servicios; no necesita el `.env` del proyecto. El health comprueba servicio/base, no todos los módulos.

**Es un entorno temporal:** al retirarlo se pierden sus datos. No introducir información real ni usarlo para trabajo que deba conservarse. No crea cuentas de demostración ni contraseñas predeterminadas.

```sh
node frontend/scripts/dev.cjs down
```

Para preparar usuarios/escenarios de cada módulo, consultar su spec y las [instrucciones de administrador inicial](docs/administrador-inicial.md). Configurar al operador contra la base correcta; no copiar comandos de limpieza de QA a desarrollo. Detalles, puerto alternativo y límites: [guía de integración frontend](frontend/GUIA-INTEGRACION.md).

## Configuración persistente con Compose

`docker-compose.yml` conserva la base y fotografías en volúmenes y ejecuta el backend con `NODE_ENV=production`. Es diferente del entorno temporal anterior; requiere configurar secretos y HTTPS para las sesiones de producción. Este Compose no configura por sí solo la terminación TLS ni constituye una guía completa de despliegue.

El operador puede copiar `.env.example` a `.env` y completar sus valores en su equipo. Nunca versionar `.env`, tokens, contraseñas ni archivos de usuarios.

| Variable de Compose | Uso |
|---|---|
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL, elegida por el operador |
| `DATABASE_URL` | Conexión del backend al servicio `db`, base y usuario `pasajes`; contraseña coherente con la anterior |
| `JWT_SECRET` | Secreto de firma; generar uno propio, sin valores de ejemplo en producción |
| `JWT_EXPIRES_IN` | Duración del acceso, valor predeterminado de Compose `30m` |

Compose fija `PORT=3000` y `BUS_PHOTO_STORAGE_DIR` dentro del contenedor. No inyecta automáticamente cualquier variable añadida al archivo local; consultar el Compose y la configuración del módulo antes de configurar almacenamiento o trabajadores adicionales.

Desde la raíz, con la configuración preparada por el operador:

```sh
docker compose build
docker compose up -d --wait db
docker compose run --rm --no-deps backend npm run migrate
docker compose up -d backend frontend
```

Frontend: **http://localhost:8080/**; backend: **http://localhost:3000/api/v1/health**. El acceso autenticado en modo producción requiere el HTTPS indicado arriba. Para el primer administrador, usar una terminal interactiva y el procedimiento documentado; no hay `seed` general:

```sh
docker compose exec backend npm run bootstrap:admin
```

Diagnóstico y parada, sin borrar los volúmenes:

```sh
docker compose logs --tail 50 backend
docker compose down
```

La imagen backend instala dependencias de ejecución; ejecutar desarrollo y pruebas desde `backend/` con sus dependencias de desarrollo, no dentro de esa imagen.

## Pruebas y calidad

Desde la raíz, después de `npm --prefix backend ci`:

```sh
npm --prefix backend run lint
npm --prefix backend run format:check
npm --prefix frontend run lint
npm --prefix frontend test
```

Las pruebas backend de integración limpian tablas: usar exclusivamente PostgreSQL aislado según [testing-database.md](docs/testing-database.md). Esa guía explica cómo configurar `DATABASE_URL` para pruebas y ejecutar `npm test` desde `backend/`. No ejecutarlo contra la base persistente. Si fallan unitarias, `npm test` no continúa con integración; reportar el fallo y ejecutar la integración separadamente sobre la base aislada cuando corresponda.

Las pruebas de navegador requieren Chrome/Chromium y, según el script, Docker. Ver [frontend/README.md](frontend/README.md). No existe garantía de CI verde por tener scripts locales; registrar siempre resultados reales.

## Estructura

```text
backend/
  src/modules/       auth, tenants, fleet, frequencies, route-sheets, bookings, payments
  src/shared/        infraestructura y errores compartidos
  migrations/        historia de esquema versionada
  scripts/           migraciones, administrador inicial y utilidades
  tests/             unitarias, integración y contratos
frontend/
  pages/             pantallas HTML
  src/               módulos JavaScript y estilos
  assets/            marca y recursos locales con procedencia/licencias
  tests/             pruebas unitarias y de navegador
  scripts/           entorno temporal de desarrollo
docs/
  specs/             alcance, acuerdos y evidencia por tarea
  adr/               decisiones de arquitectura
  evidence/          resultados y capturas
```

Cada módulo backend organiza `domain`, `application`, `infrastructure` e `interfaces`; las dependencias y APIs públicas se explican en [architecture.md](docs/architecture.md).

## Documentación y contribuciones

| Documento | Para qué consultarlo |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Preparación, ramas, commits y revisión |
| [Reglas de negocio](docs/business-rules.md) | Fuente de verdad funcional |
| [Convenciones](docs/conventions.md) y [calidad](docs/calidad.md) | Código, pruebas y usabilidad |
| [Equipo y acuerdos](docs/equipo-y-acuerdos.md) | Coordinación y decisiones confirmadas/propuestas |
| [Estado](docs/estado-proyecto.md) | Evidencia fechada y siguientes pasos |
| [Uso de IA](docs/AI-USAGE.md) y [flujo de Codex](docs/flujo-codex.md) | Asistencia con responsabilidad y revisión humana |
| [Diseño](frontend/DESIGN.md) | Identidad transViaje y criterios visuales |
| [Errores inducidos](docs/errores-inducidos.md) | Protocolo académico, sin autorización para inventar defectos |

Se usan specs locales como referencia hasta que el equipo confirme la adopción de un gestor externo. La fecha prevista de revisión no demuestra que ese cambio de proceso ya haya ocurrido. No se anuncian políticas, archivos de cita, changelog, workflows o protecciones remotas que no estén disponibles y comprobados.

## Equipo

Coordinación de referencia, según el [registro de acuerdos](docs/equipo-y-acuerdos.md); no designa un comité ni acredita aprobaciones:

| Integrante | Área |
|---|---|
| Pablo | Infraestructura, autenticación y cooperativas |
| Edwin | Flota |
| David | Frecuencias, hojas de ruta y viajes |
| Leslie | Reservas |
| Shirley | Pagos y boletos |

## Licencia y recursos

La declaración existente del proyecto es **`GPL-3.0-only`**, según [backend/package.json](backend/package.json); el texto completo está en [LICENSE](LICENSE). Esta actualización documental no cambia la licencia ni establece una nueva atribución de titularidad.

Los recursos de terceros mantienen sus avisos: [Bootstrap](frontend/assets/vendor/bootstrap-5.3.8/LICENSE) y [Plus Jakarta Sans](frontend/assets/vendor/plus-jakarta-sans/OFL.txt). La procedencia del logo se documenta en [marca](frontend/assets/brand/README.md). Conservar estos avisos y revisar la procedencia/licencia de nuevas aportaciones.

Para citar este trabajo académico, usar el nombre, URL del repositorio y commit o versión realmente consultados; no se proporciona todavía un archivo `CITATION.cff` ni una lista formal de autoría completa.
