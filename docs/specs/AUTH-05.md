# AUTH-05: Crear administrador de cooperativa

- **Responsable:** Pablo.
- **Estado:** Alcance aprobado por Pablo: cuenta nueva y administrador principal único. Implementación pendiente de la fusión de TENANTS-01 y AUTH-FK-01 en develop.
- **Reglas:** RN-01, RN-02, RN-03; ADR 0004.
- **Dependencias:** TENANTS-01 y AUTH-FK-01 fusionadas en develop.

## Objetivo
Permitir que SYSTEM_ADMIN cree y asigne un administrador a una cooperativa existente para que pueda acceder a sus funciones operativas.

## Alcance confirmado por Pablo
- Crear una cuenta nueva con email y contraseña, sin convertir cuentas existentes.
- Un único administrador principal por cooperativa; rechazar una segunda alta. Reemplazarlo queda fuera de esta tarea.
- No iniciar sesión automáticamente ni enviar credenciales por correo.

## Contrato propuesto
POST /api/v1/cooperatives/:cooperativeId/admins, exclusivamente SYSTEM_ADMIN con sesión válida y CSRF.
Cuerpo: email y password. Rechazar campos adicionales, incluido role. El servidor asigna COOPERATIVE_ADMIN y toma la cooperativa objetivo del parámetro de ruta, tras autorizar al administrador global. Esta selección explícita es propia de RN-03; no permite que usuarios internos elijan otra cooperativa.

Normalización de email, política de contraseña y Argon2id conforme a ADR 0004. Respuesta 201 con id, email, role y cooperative_id, sin hash ni contraseña.
Errores propuestos: 400 VALIDATION_ERROR, 401 por sesión inválida, 403 por rol o CSRF, 404 COOPERATIVE_NOT_FOUND y 409 REGISTRATION_CONFLICT para conflictos de alta.

## Diseño y pruebas previstas
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
