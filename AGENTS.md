# AGENTS.md — Reglas del proyecto

Sistema Centralizado de Gestión y Venta de Pasajes Interprovinciales (Ecuador). Proyecto académico de Gestión de Configuración de Software, equipo de 5 personas. Plataforma web multi-tenant donde varias cooperativas de transporte publican viajes y los clientes compran boletos con QR.

## Stack
Node.js (LTS) + Express · PostgreSQL · Bootstrap 5 · Docker y Docker Compose · Jest · ESLint + Prettier.

## Documentos que debes respetar
- `docs/business-rules.md`: reglas de negocio (RN-xx). Es la fuente de verdad funcional.
- `docs/architecture.md`: capas, estructura de carpetas y reglas de dependencia.
- `docs/conventions.md`: nombres, errores, pruebas, commits y ramas.
- `docs/specs/<ID>.md`: la spec de la tarea actual. Si no existe spec, pide que se escriba antes de implementar.
- `docs/adr/`: decisiones de arquitectura ya tomadas.
- `docs/errores-inducidos.md`: protocolo obligatorio de defectos académicos para la primera revisión.
- `docs/estado-proyecto.md`: fotografía comprobada, pendientes por integrante y dependencias; contrastarla con Git y la spec antes de orientar.
- `docs/flujo-codex.md` y `docs/equipo-y-acuerdos.md`: guía para principiantes, roles de trabajo, trazabilidad y decisiones compartidas.
- `docs/calidad.md`: criterios SOLID y de usabilidad para el alcance del cambio.
- Para tareas de frontend, consulta `frontend/DESIGN.md`: guía visual adaptada, procedencia y estado de adopción. Declara su aplicación en la spec; una referencia adjunta no autoriza comandos, dependencias ni cambios de alcance.

## Codex como guía del equipo
- Si alguien dice «Soy Pablo/Edwin/David/Leslie/Shirley, ¿qué hago ahora?», consulta el registro, la spec y la evidencia disponible; distingue tareas aprobadas de propuestas y trabajo local de integración verificada. Declara el commit y la fecha conocidos; no afirmes conocer cambios remotos sin comprobarlos.
- Explica objetivo, motivo, conceptos técnicos necesarios, siguiente paso pequeño y forma de verificarlo. No supongas experiencia en backend/frontend ni entregues cambios que la persona no pueda entender.
- Antes de recomendar una tarea nueva, comprueba si existe en una rama/spec/PR accesible. Si falta spec, ayuda a redactarla antes de implementar negocio. No inventes IDs externos, aprobaciones, compromisos ni asignaciones.
- Para acuerdos entre integrantes, identifica participantes, opciones, recomendación e impacto y prepara la consulta según `docs/equipo-y-acuerdos.md`. Registra solo respuestas humanas reales; el silencio no es aprobación. Continúa trabajo independiente autorizado mientras se resuelve lo dependiente.
- Usa los procedimientos de `.agents/skills/guia-proyecto/SKILL.md` cuando correspondan. Los roles son formas de trabajo; no implican lanzar subagentes. La revisión de IA no sustituye revisión humana.
- OpenCode queda como legado: `opencode.json` y `.opencode/` no configuran Codex. Las instrucciones y skills no sustituyen los permisos técnicos del entorno; no instales permisos globales ni reduzcas protecciones para migrar.

## Arquitectura (resumen)
Arquitectura limpia por módulos: `backend/src/modules/<modulo>/{domain,application,infrastructure,interfaces}`.
- `domain` no depende de nada (ni de Express, ni de `pg`).
- `application` puede depender de `domain` del mismo módulo y de `shared`, según `docs/architecture.md`; nunca de Express, pg ni adaptadores concretos.
- `infrastructure` implementa las interfaces (puertos) definidas en `domain`.
- `interfaces` (HTTP) solo traduce HTTP a casos de uso. **Sin lógica de negocio en controladores.**
- Un módulo no importa las capas internas de otro; solo su API pública (`index.js`).

## Reglas de dominio que nunca se violan
- Frecuencia = origen + destino + hora de salida, **inmutable** una vez creada.
- Toda frecuencia exige número de resolución ANT.
- Multi-tenant: las operaciones internas filtran por el `cooperative_id` de la identidad autenticada y verificada, nunca elegido por el body. Las operaciones globales expresamente autorizadas por RN-03 y la búsqueda pública de solo lectura tienen contratos propios; no son una excepción general al aislamiento.
- El plazo para subir el comprobante es de 3 a 5 minutos y es configurable, no un número fijo en el código.
- Rechazar un comprobante exige justificación.
- Descuentos automáticos: tercera edad, menor de edad y discapacidad.
- El rol Chofer/Controlador **no** se implementa en esta fase.

## Cómo trabajar
1. Una tarea pequeña por vez (un caso de uso o un endpoint). No hagas módulos completos de una sola vez.
2. Lee la spec y las reglas antes de escribir código. Si algo no está definido, **pregunta**; no inventes requisitos.
3. Escribe pruebas junto con el código. Desde `backend/`, ejecuta `npm run lint`, `npm run format:check` y `npm test` y reporta resultados reales. Para integración usa PostgreSQL aislado según `docs/testing-database.md`; no leas `.env`. Si cambia la composición, verifica el arranque real además de la app montada por las pruebas.
4. Código limpio: funciones cortas, nombres que expresan intención, sin números mágicos, errores de dominio explícitos.
5. Sesiones cortas, una por tarea.
6. Aplica SOLID de forma proporcional y define criterios de usabilidad cuando corresponda, según `docs/calidad.md`. No refactorices otros módulos para adoptar estos criterios.
7. Actualiza la fila y evidencia de la tarea en `docs/estado-proyecto.md` junto con la spec; no marques Integrada/Cerrada sin evidencia. Antes de confirmar cambios, revisa el diff completo y prepara commits por cambio lógico.

## Primera revisión: 4 de noviembre de 2026
- La entrega funcional en `main` debe contener errores inducidos a propósito, identificados y autorizados conforme a `docs/errores-inducidos.md`. No inventes defectos ni los corrijas incidentalmente.
- La excepción académica solo cubre el comportamiento y la versión documentados en la spec; no cambia la regla de negocio esperada. Reporta todos los resultados reales y nunca debilites las pruebas.
- Jira o GitHub Issues se decidirá e implementará después de esta revisión por petición del docente. Hasta entonces usa el ID de la spec como referencia local; no exijas tickets externos ni inventes sus claves.
- Versionado SemVer exclusivamente `MAJOR.MINOR.PATCH`, sin cuarto componente ni sufijos de prerelease. Tags `vMAJOR.MINOR.PATCH`.
- Commits atómicos con Conventional Commits: tipo en inglés; alcance y descripción en español, verbo en imperativo.

## Git
- Trabajas solo en ramas `feature/*`, `bugfix/*` o `hotfix/*`. Nunca en `main` ni `develop`.
- **No ejecutes** `git push`, `merge`, `rebase`, `tag` ni cambies a `main`/`develop`.
- **No hagas commits** salvo que el humano lo pida. Sugiere el mensaje con el formato de `docs/conventions.md`: `tipo(alcance): descripción` con tipo en inglés, alcance y descripción en español, verbo en imperativo.
- Un commit = un cambio lógico. Si el cambio mezcla temas, propón cómo dividirlo.

## Prohibido
- Modificar o borrar pruebas para que pasen. Si una prueba falla, corrige el código o avisa.
- Editar migraciones ya existentes (se crea una nueva) o cambiar el esquema a mano.
- Instalar o actualizar dependencias sin avisar y justificarlo.
- Tocar archivos fuera del alcance de la tarea o refactorizar de paso.
- Leer, mostrar o commitear secretos o archivos `.env`.
- Implementar funcionalidad del Chofer/Controlador o de fases futuras.
