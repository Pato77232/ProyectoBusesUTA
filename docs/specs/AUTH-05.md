# AUTH-05: Crear administrador de cooperativa

- **Responsable:** Pablo.
- **Estado:** Alcance aprobado por Pablo: cuenta nueva y administrador principal único. Implementada y verificada; pendiente de revisión. Dependencias verificadas en origin/develop b489487.
- **Reglas:** RN-01, RN-02, RN-03; ADR 0004.
- **Dependencias:** TENANTS-01 y AUTH-FK-01 fusionadas en develop.

## Objetivo
Permitir que SYSTEM_ADMIN cree y asigne un administrador a una cooperativa existente para que pueda acceder a sus funciones operativas.

## Alcance confirmado por Pablo
- Crear una cuenta nueva con email y contraseña, sin convertir cuentas existentes.
- Un único administrador principal por cooperativa; rechazar una segunda alta. Reemplazarlo queda fuera de esta tarea.
- No iniciar sesión automáticamente ni enviar credenciales por correo.

## Contrato implementado
POST /api/v1/cooperatives/:cooperativeId/admins, exclusivamente SYSTEM_ADMIN con sesión válida y CSRF.
Cuerpo: email y password. Rechazar campos adicionales, incluido role. El servidor asigna COOPERATIVE_ADMIN y toma la cooperativa objetivo del parámetro de ruta, tras autorizar al administrador global. Esta selección explícita es propia de RN-03; no permite que usuarios internos elijan otra cooperativa.

Normalización de email, política de contraseña y Argon2id conforme a ADR 0004. Respuesta 201 con id, email, role y cooperative_id, sin hash ni contraseña.
Errores: 400 VALIDATION_ERROR, 401 por sesión inválida, 403 por rol o CSRF, 404 COOPERATIVE_NOT_FOUND y 409 REGISTRATION_CONFLICT para conflictos de alta.

## Diseño y pruebas
- Caso de uso en auth, puertos definidos en domain y composición mediante las API públicas de módulos; sin importar capas internas de tenants.
- Verificar cooperativa existente y proteger conflictos concurrentes en PostgreSQL. Añadir una migración nueva para imponer esa unicidad; no modificar migraciones anteriores.
- Probar alta, hash, login posterior y contexto de cooperativa correcto, sin crear sesión durante el alta.
- Probar email normalizado duplicado, cooperativa inexistente, datos inválidos y campos extra.
- Probar sesión ausente, vencida y revocada, todos los roles no autorizados y CSRF inválido; comprobar ausencia de escrituras.
- Probar altas simultáneas y conservar todas las filas preexistentes.
- Ejecutar lint, formato y suite completa antes del commit.

## Fuera de alcance
Oficinistas, cambio de administrador, conversión de clientes existentes, recuperación de contraseña, frontend y creación del primer SYSTEM_ADMIN.

## Defectos inducidos
No aplica; no hay un defecto autorizado para esta tarea.

La existencia de la cooperativa se verifica atómicamente mediante la FK al insertar el usuario; no se consultan capas internas de tenants. La unicidad se impone con un índice parcial nuevo. Una migración con administradores duplicados falla sin modificar datos. Pablo autorizó adaptar el recorrido de reversión de las pruebas AUTH-FK-01 para alcanzar su migración concreta.

## Evidencia de implementación
- `npm run lint` y `npm run format:check`: correctos.
- `npm test` contra PostgreSQL temporal: 89 pruebas aprobadas (45 unitarias y 44 de integración).
- Verificados login posterior, ausencia de sesión automática, permisos, CSRF, datos inválidos, email duplicado, concurrencia y reversibilidad del índice sin pérdida de filas.
- No se agregaron dependencias ni se introdujeron defectos académicos.

## Uso
Con una sesión de SYSTEM_ADMIN y un token CSRF renovado, enviar `POST /api/v1/cooperatives/<UUID>/admins` con `X-CSRF-Token` y JSON `{"email":"administrador@example.ec","password":"contraseña de ejemplo larga"}`. La cooperativa debe existir. La cuenta creada puede entrar mediante el login existente y consultar su identidad en `/api/v1/auth/me`.
La creación inicial de SYSTEM_ADMIN sigue fuera de esta tarea; las pruebas preparan esa identidad en su base aislada.
