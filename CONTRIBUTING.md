# Contribuir a transViaje

Esta guía describe el procedimiento vigente del equipo. Consultar [AGENTS.md](AGENTS.md), [convenciones](docs/conventions.md) y la spec de la tarea antes de cambiar código. Una propuesta o revisión de IA no equivale a aprobación humana.

## Preparación

Requisitos y arranque: [README](README.md). Usar Node.js 24.x y Docker Compose v2. Desde la raíz del clon:

```sh
npm --prefix backend ci
```

Configurar la identidad Git propia antes de crear commits. No suplantar a otro integrante. No hay un `package.json` raíz ni hooks Husky/commitlint instalados: la convención se revisa con el diff y el PR; no se promete rechazo automático de commits.

Los recursos frontend están versionados localmente y sus pruebas usan herramientas del backend; no instalar dependencias nuevas sin avisar y justificarlo.

## Elegir y preparar un cambio

1. Consultar el [estado](docs/estado-proyecto.md), las ramas accesibles y las specs para evitar duplicar trabajo. Verificar fecha/commit de la evidencia.
2. Elegir una tarea pequeña y crear o actualizar `docs/specs/<ID>.md` antes de implementar. Registrar objetivo, reglas RN, responsable, dependencias, aceptación y cómo probar.
3. Resolver las decisiones de negocio con las personas afectadas según [equipo-y-acuerdos](docs/equipo-y-acuerdos.md); registrar solo respuestas reales. Los detalles reversibles dentro de un alcance autorizado no requieren inventar un comité.
4. Trabajar en una rama propia y preparar cambios por unidad lógica.

Se mantienen IDs locales de specs hasta confirmar un gestor externo. La constitución del CCB está pendiente en el registro del equipo: esta guía no designa miembros, fija plazos de respuesta ni presupone un dashboard en funcionamiento.

## Ramas y versiones

| Rama | Finalidad | Destino habitual |
|---|---|---|
| `feature/<ID>-descripcion` | Cambio acotado sobre una base acordada de `develop` | PR a `develop` |
| `hotfix/<ID>-descripcion` | Corrección urgente sobre versión acordada | Revisión humana del destino y posterior conciliación con `develop` |
| `release/x.y.z` | Preparación humana de una entrega | `main` y conciliación con `develop` |
| `develop` | Integración del equipo | Mediante PR |
| `main` | Versiones de entrega | Mediante PR |

Ejemplos de formato: `feature/DOCS-01-actualiza-documentacion-general`, `feature/FREQ-03-desactivacion-segura`. Un ejemplo no crea una asignación ni autorización nueva.

Las protecciones remotas y checks deben comprobarse en GitHub; esta guía no acredita que estén configurados. No hacer push directo a `main`/`develop` ni reescribir historia compartida. Las operaciones de merge, publicación y tags corresponden a las personas autorizadas. Codex solo trabaja en `feature/*` o `hotfix/*`, no ejecuta push/merge/rebase/tags ni cambia a `main`/`develop`.

Versiones exclusivamente `MAJOR.MINOR.PATCH`, tags `vMAJOR.MINOR.PATCH`, sin sufijos ni cuarto componente. Cambiar versión y preparar notas solo al acordar una entrega; no deducir una versión nueva de cada commit ni inventar una fecha de lanzamiento. Documentar una corrección urgente y su integración en las líneas afectadas.

## Commits

Formato definido en [conventions.md](docs/conventions.md): tipo en inglés, alcance y descripción en español, verbo en imperativo, sin punto final, máximo 72 caracteres en el título. Un commit contiene un cambio lógico.

```text
docs(docs): actualiza las guías generales del proyecto

Refs: docs/specs/DOCS-01.md
```

Tipos acordados: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`. Alcances: `autenticacion`, `cooperativas`, `flota`, `frecuencias`, `hojas-ruta`, `busqueda`, `reservas`, `pagos`, `boletos`, `infra`, `docs`. Usar `!` o `BREAKING CHANGE:` al describir una incompatibilidad real.

Revisar archivos y diff antes de confirmar. Codex no crea commits salvo petición humana explícita; puede proponer título y pie.

## Código, seguridad y pruebas

- Respetar [arquitectura](docs/architecture.md): negocio fuera de controladores, dominio independiente de infraestructura, APIs públicas entre módulos y aislamiento por cooperativa autenticada.
- Identificadores en inglés; mensajes, comentarios y documentos en español. Aplicar [calidad](docs/calidad.md) de forma proporcional y [DESIGN.md](frontend/DESIGN.md) si cambia una pantalla.
- No modificar migraciones existentes ni borrar/debilitar pruebas para lograr resultados verdes. v0.1.0 no incluyó defectos académicos inducidos; una actividad futura requiere autorización específica y su [protocolo](docs/errores-inducidos.md).
- No guardar secretos, `.env`, contraseñas, tokens, comprobantes ni datos personales en Git, prompts o evidencias. Reportar hallazgos sensibles al responsable por un canal privado acordado; no publicar credenciales en un issue. Todavía no se declara una política formal `SECURITY.md`.
- Mantener avisos de licencia/procedencia y documentar nuevas dependencias en el PR. Declaración del proyecto: `GPL-3.0-only`; avisos de terceros en sus recursos. No modificar LICENSE para incorporar nombres del equipo: el texto incluye ejemplos propios de la licencia.

Desde la raíz, con dependencias instaladas:

```sh
npm --prefix backend run lint
npm --prefix backend run format:check
npm --prefix frontend run lint
npm --prefix frontend test
```

Para backend, levantar PostgreSQL exclusivo y configurar el entorno según [testing-database.md](docs/testing-database.md). Desde `backend/`, ejecutar `npm test`. Nunca usar bases de desarrollo/producción: los tests limpian tablas. Si las unitarias detienen `npm test`, registrar el fallo y ejecutar `npm run test:integration` por separado sobre esa base aislada cuando corresponda. No presentar la combinación como suite verde.

`format:check` verifica sin modificar; usar el formateador solo sobre archivos del cambio cuando sea necesario. No reformatear módulos ajenos. Ejecutar pruebas proporcionales al cambio y los controles exigidos por AGENTS.md; para documentación pura contrastar enlaces, comandos y diff, sin atribuir resultados de código no ejecutados.

Si cambia la composición del servidor, verificar el arranque real. Las pruebas de navegador y sus requisitos están en [frontend/README.md](frontend/README.md). Documentar entorno, resultados reales, limitaciones y limpieza de recursos propios.

## Pull request y revisión

Abrir PR desde la rama de trabajo hacia `develop` para cambios normales, con título de Conventional Commit. Incluir:

- Problema y comportamiento final, alcance y reglas RN pertinentes.
- Spec local, dependencias o decisiones pendientes.
- Cómo probar, resultados reales y evidencia visual si corresponde.
- Fallos conservados y límites conocidos, sin describir una ejecución fallida como aprobada.
- Herramienta de IA utilizada y responsabilidad humana del autor.

Preferir PRs acotados y comprensibles; dividir por comportamiento cuando facilite revisión, sin fijar un límite arbitrario de líneas. Otro integrante revisa código, pruebas y documentación. Nadie aprueba su propio PR y la revisión de IA no sustituye esa aprobación.

Resolver hallazgos y comprobar los controles antes de integrar. La primera entrega no tiene excepción por defectos académicos. Un fallo inesperado, aunque sea histórico, no obtiene una excepción por antigüedad; cualquier ejercicio futuro necesita una decisión específica y evidencia.

## Terminado y seguimiento

Una tarea no está cerrada solo porque existe código o un PR. Verificar:

- Alcance y criterios de la spec cumplidos.
- Pruebas/controles ejecutados y resultados reales registrados; fallos resueltos o excepción académica explícita aplicable.
- Documentación y fila de [estado](docs/estado-proyecto.md) actualizadas con fecha/commit conocido.
- Revisión y aprobación por otro integrante.
- Integración y comprobación en `develop`, con evidencia antes de marcar Integrada/Cerrada.

Para uso de IA, seguir [AI-USAGE.md](docs/AI-USAGE.md) y [flujo-codex.md](docs/flujo-codex.md). Las contribuciones deben respetar los acuerdos del equipo; consultar al responsable ante ambigüedades sin inventar aprobaciones, compromisos o políticas aún no adoptadas.
