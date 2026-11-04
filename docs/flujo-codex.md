# Trabajar con Codex sin Jira

## Empezar por el nombre

Abrir la copia del repositorio en Codex y escribir:

> Soy Edwin. Revisa el estado actualizado, dime qué me corresponde ahora y explícame cómo empezar. Señala dependencias, acuerdos pendientes y cómo comprobar el resultado.

Codex consulta AGENTS.md, [estado-proyecto.md](estado-proyecto.md), la spec pertinente y la evidencia disponible en Git. Debe explicar qué conoce, con qué fecha/commit y qué falta comprobar. Si no se puede actualizar el remoto, ofrece orientación con esa limitación. Consultar no requiere crear rama ni editar el registro.

La skill compartida se puede invocar como `$guia-proyecto`. Si una instalación no la descubre, pedir que lea `.agents/skills/guia-proyecto/SKILL.md` y este documento. Su disponibilidad en el equipo de otro integrante debe comprobarse allí; la validación del archivo no demuestra por sí sola su carga en la aplicación.

## Una tarea de principio a fin

1. **Elegir:** confirmar una tarea pequeña del registro con responsable y revisor. Si es una propuesta, redactar su spec y resolver sus requisitos antes de programar. No crear una spec por cada conversación.
2. **Acordar:** registrar alcance, dependencias y autorización humana en la spec. Para contratos compartidos seguir [equipo-y-acuerdos.md](equipo-y-acuerdos.md). Reutilizar acuerdos ya aprobados; no pedirlos de nuevo sin motivo.
3. **Preparar Git:** comprobar rama y cambios locales; actualizar la referencia remota si está permitido. Preparar `feature/<ID-spec>-<descripcion>` desde develop actualizado sin sobrescribir trabajo. Continuar en la rama existente si es la misma tarea; no cambiar a main/develop. La persona ejecuta las operaciones que AGENTS.md prohíbe al agente.
4. **Planificar:** leer reglas, ADR y código; dividir implementación y pruebas en pasos cortos que se puedan explicar. Señalar contratos, archivos compartidos y criterios SOLID/usabilidad aplicables.
5. **Implementar y aprender:** hacer un paso autorizado, explicar los conceptos nuevos y comprobarlo. Preguntar solo por información o acuerdos necesarios; no bloquear por detalles internos que pueden decidirse dentro de la spec.
6. **Verificar:** desde backend ejecutar lint, formato y pruebas; para PostgreSQL seguir [testing-database.md](testing-database.md). Si se toca composición, comprobar server.js y el arranque. Para pantallas, ejecutar los escenarios de [calidad.md](calidad.md). No declarar verificado lo no ejecutado.
7. **Preparar revisión:** revisar diff y alcance, actualizar la spec y solo las filas relacionadas del estado. Sugerir commits atómicos con `Refs: docs/specs/<ID>.md`; Codex solo los ejecuta si la persona los solicita explícitamente. Indicar asistencia de IA real.
8. **PR y revisión humana:** la persona publica la rama y abre PR hacia develop. Otro integrante revisa código, pruebas, SOLID y usabilidad aplicable. Codex puede ayudar, pero su veredicto no es aprobación humana.
9. **Integrar y cerrar:** la persona autorizada integra. Registrar PR, commit de integración y verificación posterior. No cerrar tareas porque terminó una sesión de Codex.

Una tarea puede tener varios commits atómicos; si requiere muchas funcionalidades independientes, dividir specs/PR. Los candidatos del registro no obligan a crear todas las ramas de inmediato. Resolver conflictos del registro comprobando evidencias de cada tarea.

## Procedimientos por rol

Son modos de trabajo de una misma guía, no agentes independientes ni permisos técnicos. Cambiar de rol no borra las reglas de AGENTS.md.

| Rol | Entrada y trabajo | Salida y límite |
|---|---|---|
| Arquitecto | Spec, RN, ADR y código existente; delimitar datos, puertos, casos de uso, endpoints y dependencias | Plan pequeño, archivos y pruebas; explicar alternativas. No escribir producto. Pedir decisiones solo si faltan y no hay autorización suficiente |
| Implementador | Tarea y alcance autorizados; rama válida; contratos definidos | Cambio mínimo con pruebas, explicación y resultados; actualizar evidencia. No implementar otra tarea por comodidad |
| Tester | Spec y criterios de calidad | Pruebas y reproducción; no modificar producción ni debilitar pruebas. Registrar fallos inesperados, inducidos autorizados y límites del entorno |
| Revisor | Spec, diff y base remota comprobada | Hallazgos concretos con archivo/línea e impacto; revisar reglas, tenancy, SOLID, usabilidad y composición. Solo lectura; no inventar defectos ni aprobaciones |

## Mensajes que se pueden copiar

**Planificar:**
> Usa el rol de arquitecto para la spec <ID>. Explica el objetivo, qué conceptos necesito, dependencias y plan por pasos. No implementes. Si falta un acuerdo, prepara la consulta y recomienda cómo resolverla.

**Implementar:**
> Implementa la tarea <n> autorizada de la spec <ID>. Explícame las decisiones y cómo probarlo. Respeta SOLID y los criterios de usabilidad aplicables. No hagas commits ni operaciones de integración.

**Probar:**
> Usa el rol de tester para la spec <ID>. Comprueba los criterios y reporta resultados reales. No cambies producción ni debilites las pruebas.

**Revisar:**
> Revisa en modo de solo lectura el diff de esta rama contra origin/develop actualizado. Indica la base usada, hallazgos con líneas, pruebas ejecutadas y pendientes. La aprobación humana queda pendiente.

**Preparar commit:**
> Revisa únicamente los cambios en staging y propón cómo separarlos y sus mensajes Conventional Commits. No hagas commits.

**Redactar PR:**
> Redacta título y descripción de la PR de <ID> hacia develop usando el diff real. Incluye problema, resultado, RN, cómo probar, resultados, riesgos y herramienta de IA utilizada. No publiques la rama ni abras la PR.

## Evidencia que permanece en el repositorio

La spec conserva alcance, acuerdos y resultados; el registro resume estado/dependencias y enlaza a ella. Commits y PR permiten seguir **spec → decisión → cambio → revisión → integración → verificación**. Los chats ayudan a trabajar, pero no son la única evidencia ni requieren copiar conversaciones completas. No guardar secretos ni datos personales en ejemplos/capturas.

La asignación no cambia por recomendación de Codex: confirmar con las personas afectadas y registrar la decisión. La revisión académica del 4 de noviembre mantiene [su protocolo](errores-inducidos.md), sin inventar defectos ni ocultar fallos. Jira o GitHub Issues se decidirá después de esa revisión.
