# DOCS-02: conciliar la política de defectos académicos de v0.1.0

- **Responsable:** Pablo.
- **Estado:** En desarrollo documental; revisión humana pendiente.
- **Base:** `origin/develop` `5ff50d9`, 4 de noviembre de 2026.
- **Rama:** `feature/DOCS-02-politica-defectos`.
- **Fuente de decisión:** Edwin indicó que v0.1.0 no requiere errores
  inducidos, según `docs/releases/v0.1.0.md` §3 y el mensaje del equipo
  compartido por Pablo el 4 de noviembre. No se atribuye aceptación individual
  de otros integrantes.

## Resultado

Actualizar `docs/errores-inducidos.md`, `AGENTS.md` y `CONTRIBUTING.md` para que
no obliguen a introducir defectos en la versión entregada. Conservar el registro
histórico de candidatos y el protocolo si una futura actividad concreta se
autoriza expresamente. Un fallo imprevisto, incluido el de `server.js`, nunca
se convierte en defecto académico por esta decisión.

No cambia código, reglas RN, pruebas, migraciones, versiones ni permisos Git.
Comprobar el diff, las referencias y la coherencia textual. La revisión humana
e integración se registrarán después de ocurrir; no se infieren de esta edición.

## Verificación local

`git diff --check` aprobado; referencias principales presentes y búsqueda de
mandatos antiguos en los tres documentos sin coincidencias. No se ejecutaron
lint ni pruebas de producto porque el cambio es exclusivamente documental.
Sin push, PR, revisión humana ni integración.
