# INFRA-04: Migrar la guía de trabajo a Codex y compartir el estado del proyecto

- **ID local:** INFRA-04
- **Módulo:** infra / documentación
- **Responsable:** Pablo
- **Revisora propuesta:** Shirley; aceptación de la revisión pendiente.
- **Estado:** En desarrollo; implementación local completada y preparada para revisión. PR, revisión humana e integración pendientes.
- **Fecha:** 25 de octubre de 2026.
- **Base:** `origin/develop` en `67ee38d`, actualizado mediante fetch antes de crear la rama.
- **Rama:** `feature/INFRA-04-flujo-codex-y-estado-proyecto`.

## 1. Solicitud y decisión

El solicitante reporta obstáculos y lentitud con OpenCode y decide usar Codex como guía técnica y de coordinación para un equipo sin experiencia en backend/frontend. Solicita estado compartido, orientación por nombre, tareas más pequeñas, apoyo para alcanzar acuerdos, SOLID y usabilidad. Autoriza crear la rama y realizar commits atómicos. Esta autorización no equivale a la aprobación de los otros integrantes ni demuestra una mejora de rendimiento.

La decisión se registra aquí; no cambia la arquitectura del producto ni exige un ADR nuevo. La distribución de referencia procede del documento externo `Division.md`, aportado por el solicitante. Sus propuestas de comité, revisores y nuevas asignaciones deben confirmarse con las personas afectadas.

## 2. Alcance

Incluye instrucciones comunes en AGENTS.md, una skill de repositorio para Codex, guía para principiantes, registro de estado contrastado con Git/código/specs, desglose de pendientes propuestos, protocolo y plantilla de acuerdos, criterios SOLID y usabilidad, y actualización del flujo de IA y la plantilla de specs.

Se conserva la configuración de OpenCode como legado identificado, sin reescribir las evidencias históricas de uso. Codex usa su propia configuración de permisos: el frontmatter de OpenCode y las skills no son controles de acceso de Codex.

No incluye backend/frontend, corrección de defectos existentes, migraciones, dependencias, creación masiva de specs o ramas, reasignaciones aprobadas en nombre del equipo, nuevos defectos académicos, Jira, push, merge, rebase ni tags.

## 3. Reglas y calidad

No modifica RN-xx. Mantiene RN-01/02/03 y el protocolo de errores inducidos. Aclara las excepciones ya existentes de RN-02 para operaciones globales autorizadas y consultas públicas de solo lectura. SOLID y usabilidad se documentan como criterios para cambios futuros; no se afirma que el sistema actual ya los cumpla.

## 4. Plan por cambios atómicos

1. Registrar esta solicitud y sus límites. Commit: `docs(infra): registra la migración del flujo a Codex`.
2. Definir calidad y ampliar la plantilla de specs. Commit: `docs(docs): define criterios SOLID y de usabilidad`.
3. Registrar estado, tareas pequeñas y coordinación entre integrantes. Commit: `docs(docs): registra el estado y la coordinación del equipo`.
4. Conectar AGENTS.md, skill y guías de contribución/IA con esos documentos. Commit: `docs(infra): incorpora la guía compartida de Codex`.

Cada commit referencia esta spec. La aprobación de otro integrante y la integración serán posteriores y humanas.

## 5. Criterios de aceptación

- [x] «Soy <integrante>, ¿qué hago ahora?» tiene un procedimiento para consultar estado, specs y evidencia, sin inventar aprobaciones ni progreso remoto. Revisado documentalmente; adopción en sesiones nuevas pendiente.
- [x] Cada integrante tiene próximos pasos propuestos, dependencias y revisión de referencia; las tareas sin spec no se implementan.
- [x] Las instrucciones distinguen propuestas, trabajo local, código integrado, verificación y cierre.
- [x] Los desacuerdos identifican participantes, opciones, recomendación y forma de registrar la decisión humana; solo se pausa el trabajo dependiente.
- [x] Hay instrucciones para planificar, implementar, probar, revisar y redactar PR, conservando la revisión humana y las restricciones Git.
- [x] SOLID y usabilidad tienen criterios observables y campos en la plantilla, sin imponer una certificación o refactorización general.
- [x] La skill tiene metadatos válidos, rutas resolubles y ejemplos de uso; no requiere dependencias nuevas.
- [x] Se ejecutan lint, formato y pruebas y se registran resultados reales y limitaciones.
- [x] No se cambian código del producto, pruebas existentes, migraciones ni evidencias históricas de IA.

## 6. Validación prevista

Validar la skill con `quick_validate.py`; revisar enlaces locales y diff. Recorrer los casos «Soy Pablo», «Soy Leslie», solicitud de acuerdo entre reservas/pagos y revisión del PR: la salida debe distinguir datos observados de propuestas y respetar los límites del rol. Desde backend ejecutar `npm run lint`, `npm run format:check` y `npm test`. Para integración seguir `docs/testing-database.md`; si el entorno no permite ejecutarla, reportar la ejecución fallida sin atribuirla a un defecto inducido.

## 7. Defectos inducidos

No aplica. No se introduce ni corrige ninguno.

## 8. Evidencia y cierre

Verificaciones del 25 de octubre de 2026, Node 24.21.0, sin instalar dependencias ni leer .env:

| Comprobación | Resultado real |
|---|---|
| `npm run lint`, desde backend | Aprobado |
| `npm run format:check`, desde backend | Fallido: 26 archivos preexistentes de fleet, route-sheets, server y migraciones; sin corregirlos fuera de alcance |
| Primera ejecución `npm test` sin DATABASE_URL en sandbox | Unitarias aprobadas; integración fallida por URL de pruebas ausente y `listen EPERM` |
| Repetición `npm test` con PostgreSQL 16.13 aislado y acceso a puertos locales | Aprobado: 239 unitarias (27 suites) y 107 de integración (12 suites), 346 pruebas en total |
| `quick_validate.py .agents/skills/guia-proyecto` | Skill válida |
| Enlaces locales de las guías y `git diff --check` | 36 enlaces comprobados sin roturas; diff sin errores de espacios |

La repetición usó `docker-compose.test.yml`, proyecto independiente `busesuta-infra04-review`, sin cargar .env y con las credenciales ficticias versionadas de pruebas. La primera ejecución sigue registrada como fallida; no corresponde a defectos inducidos. Los comandos completos y los parámetros no sensibles de la base están en `docs/testing-database.md`.

El contenedor y la red temporales se retiraron al terminar. El diff contra `67ee38d` no contiene cambios en backend: los 26 avisos de formato corresponden a archivos idénticos a la base. No se ocultan ni se consideran autorizados por el protocolo académico.

Revisión documental de escenarios, sin simular aprobación humana ni afirmar una prueba automática de comportamiento:

- **Soy Pablo:** la guía dirige a INFRA-04 y a comprobar la rama AUTH-BOOTSTRAP-01 existente; no propone duplicar su implementación ni integrarla automáticamente.
- **Soy Leslie:** el registro identifica acuerdos de asiento/viaje y descuentos antes de implementar; permite proponer la spec y trabajar en pasos independientes autorizados.
- **Acuerdo reservas/pagos:** protocolo con Leslie/Shirley, alternativas y consulta; no fija duración, no envía mensajes ni convierte una recomendación en acuerdo.
- **Revisión de PR:** procedimiento de solo lectura contra referencia comprobada; exige resultados reales y deja la aprobación humana pendiente.

La carga automática de la skill en una sesión nueva y su uso por los cinco integrantes quedan pendientes de comprobación en sus instalaciones. No se evaluó la usabilidad de pantallas, porque esta tarea no implementa frontend. No se afirma conformidad SOLID del código existente. No hay fallos inducidos autorizados en esta tarea.

PR, revisión humana, commit de integración y verificación en develop pendientes. No marcar Cerrada hasta registrar esos datos.
