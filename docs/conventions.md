# Convenciones

## 1. Idioma
| Elemento | Idioma |
|---|---|
| Identificadores de código (clases, funciones, variables, tablas, columnas, rutas) | Inglés, usando el glosario de `docs/business-rules.md` |
| Comentarios, mensajes de error al usuario y documentación | Español |
| Tipo de commit | Inglés (estándar de Conventional Commits) |
| Alcance y descripción de commit | Español |

## 2. Nombres
- Archivos: `kebab-case.js` (`create-bus.use-case.js`, `bus.repository.js`).
- Clases: `PascalCase`. Funciones y variables: `camelCase`. Constantes: `UPPER_SNAKE_CASE`.
- Casos de uso: verbo + sustantivo (`CreateBus`, `ApprovePaymentProof`).
- Puertos: `<Nombre>Repository` en `domain`; implementación `Pg<Nombre>Repository` en `infrastructure`.
- Rutas HTTP: sustantivos en plural y minúsculas (`/api/v1/frequencies`).
- Tablas: `snake_case` plural (`bus_groups`). Columnas: `snake_case` (`cooperative_id`, `created_at`).

## 3. Código limpio
- Funciones cortas con una sola responsabilidad. Si necesita un comentario para explicar qué hace, extrae una función con buen nombre.
- Sin números ni cadenas mágicas: constantes con nombre o configuración.
- Sin lógica de negocio en controladores ni en consultas SQL.
- Errores de dominio explícitos (`FrequencyRequiresAntResolutionError`), no `throw new Error('error')`.
- Sin `console.log` en código final: usar el logger de `shared`.
- ESLint y Prettier sin advertencias antes de cada commit.

## 4. Pruebas
- Jest. Archivos en `backend/tests/unit/<modulo>/` y `backend/tests/integration/<modulo>/`, con sufijo `.test.js`.
- Estructura Arrange / Act / Assert, un comportamiento por prueba, nombres descriptivos en español.
- Cada caso de uso y cada regla RN-xx tiene al menos una prueba.
- **Nunca se modifica una prueba para que pase.**
- Cobertura mínima de `domain` y `application`: a acordar por el equipo (propuesta: 70 %).

## 5. Ramas
Gitflow: `main`, `develop`, `feature/*`, `bugfix/*`, `release/*`, `hotfix/*`.
Formato: `feature/<ID-spec>-<descripcion-corta>`; cuando se elija el gestor, se acordará el uso de su identificador.
Hasta la primera revisión del 4 de noviembre de 2026, usa el ID de la spec, sin exigir un ticket externo. Después de esa revisión se decidirá e implementará Jira o GitHub Issues por petición del docente. No inventes claves.

## 6. Commits (Conventional Commits en español)
Formato: `tipo(alcance): descripción`

- **Tipos:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`.
- **Alcance** (en español): `autenticacion`, `cooperativas`, `flota`, `frecuencias`, `hojas-ruta`, `busqueda`, `reservas`, `pagos`, `boletos`, `infra`, `docs`.
- **Descripción:** verbo en **imperativo** (agrega, corrige, implementa, elimina, actualiza, renombra, extrae, valida), minúscula inicial, sin punto final, máximo 72 caracteres. Prueba: "Este commit **agrega**..."
- **Pie:** `Refs: docs/specs/<ID>.md` hasta elegir el gestor; después se acordará la referencia al ticket. Cambio incompatible: `!` después del alcance o `BREAKING CHANGE:` en el pie.
- Commits **atómicos**: un cambio lógico, el proyecto compila y las pruebas pasan, salvo los fallos inducidos autorizados y reportados según `docs/errores-inducidos.md`.

```
feat(flota): agrega entidad Bus e interfaz del repositorio
fix(frecuencias): rechaza frecuencias sin número de resolución ANT
test(pagos): cubre el vencimiento del plazo para subir comprobante
docs(adr): registra la decisión sobre la estrategia multi-tenant
```

## 7. Pull Requests
- Salen de una rama `feature/*` o `bugfix/*` hacia `develop`.
- Título en formato de commit. Descripción con resumen, reglas RN-xx, cómo probar y nota de uso de IA.
- CI en verde y al menos 1 aprobación de otro integrante. Para la entrega académica, documentar explícitamente la excepción de aceptación de fallos inducidos según `docs/errores-inducidos.md`; no presentarlos como pruebas aprobadas. Nadie aprueba su propio PR.

## 8. Versiones
SemVer exclusivamente `MAJOR.MINOR.PATCH`, sin cuarto componente ni sufijos de prerelease. El tag lleva prefijo `v` (por ejemplo `v0.1.0`) y `package.json` la misma versión sin prefijo. Los defectos académicos se documentan por versión según `docs/errores-inducidos.md`.

## 9. Seguridad
- Nada de secretos en el repositorio. `.env` en `.gitignore`; `.env.example` con valores de ejemplo.
- Contraseñas con hash (bcrypt o argon2). Consultas SQL parametrizadas siempre.
- Validar y sanear toda entrada. Validar el rol en el backend en cada endpoint.
