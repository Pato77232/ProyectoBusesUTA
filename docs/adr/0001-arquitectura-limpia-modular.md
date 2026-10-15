# ADR 0001: Arquitectura limpia en un monolito modular

- **Estado:** Propuesta (pendiente de aprobación del equipo)
- **Fecha:** 2026-10
- **Decidido por:** equipo

## Contexto
Cinco personas desarrollan en paralelo durante dos meses. Se exige código limpio, trazabilidad por PR y que la IA genere código consistente. Se necesita evitar conflictos de merge y que cada integrante sea dueño de un módulo completo.

## Decisión
Un **monolito modular** en Node.js. Cada módulo funcional (`fleet`, `frequencies`, `bookings`, `payments`, etc.) contiene sus cuatro capas de arquitectura limpia (`domain`, `application`, `infrastructure`, `interfaces`). Las dependencias apuntan hacia el dominio y los módulos se comunican solo mediante su API pública. Detalle en `docs/architecture.md`.

## Alternativas consideradas
- **Capas globales** (`src/domain`, `src/application`...): más simple de explicar, pero cada funcionalidad toca varias carpetas compartidas y aumenta los conflictos entre integrantes.
- **Microservicios:** demasiada complejidad operativa para dos meses y cinco personas.
- **MVC simple:** más rápido al inicio, pero mezcla lógica de negocio con controladores y no cumple el requisito de arquitectura limpia.

## Consecuencias
- Cada integrante trabaja casi siempre dentro de su módulo.
- Hay más archivos y más disciplina en las dependencias; se refuerza con ESLint y la revisión.
- Si un módulo debe separarse más adelante, la estructura lo facilita.
