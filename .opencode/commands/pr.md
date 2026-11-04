---
description: Redacta la descripción del Pull Request (uso: /pr <ID-de-spec>)
---
Redacta la descripción del PR para la rama actual. **No hagas push ni abras el PR.**

Rama: !`git branch --show-current`
Commits:
!`git log develop..HEAD --oneline`
Archivos:
!`git diff develop...HEAD --stat`

Formato, en español:
- **Título:** `tipo(alcance): descripción` con las reglas de commits.
- **Resumen:** qué hace el cambio y por qué.
- **Reglas de negocio involucradas:** RN-xx.
- **Cambios principales:** por capa.
- **Cómo probar:** pasos concretos.
- **Pruebas:** qué se cubre y resultado de lint y tests.
- **Riesgos o notas para el revisor.**
- **Asistido por IA:** indica que se usó OpenCode.
- Referencia: `docs/specs/$ARGUMENTS.md`. No exijas Jira ni GitHub Issues antes de su elección posterior a la primera revisión.
- Defectos inducidos: identifica los autorizados para esta tarea según `docs/errores-inducidos.md` y reporta sus fallos reales separados de los inesperados.
