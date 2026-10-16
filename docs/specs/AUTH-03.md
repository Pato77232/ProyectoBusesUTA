# AUTH-03: Cerrar la sesión actual

- **ID local:** AUTH-03
- **Responsable:** Pablo
- **Estado:** Aprobada e implementación autorizada por Pablo en esta sesión.
- **Reglas:** RN-01, RN-02. Depende de INFRA-01 y AUTH-01; ADR 0004.

## Alcance acordado
Revocar únicamente el sid autenticado en auth_sessions y borrar la cookie de acceso. Exigir CSRF y autenticación. Otras sesiones permanecen válidas.

## Endpoint y permisos
POST /api/v1/auth/logout → 204; 401 UNAUTHENTICATED; 403 CSRF_TOKEN_INVALID.
Las mutaciones requieren double-submit firmado. No registrar contraseñas, cookies ni tokens en logs.

## Datos
Reutiliza users y auth_sessions de AUTH-01; sin cambios de esquema adicionales. Configuración y cookies según AUTH-01.

## Criterios y pruebas
- Camino exitoso conforme al contrato anterior contra PostgreSQL real.
- Entradas inválidas y credenciales/sesiones ausentes, manipuladas, vencidas o revocadas son rechazadas.
- Los datos de rol/cooperativa provienen del servidor; nunca se aceptan desde el cuerpo del cliente.
- Pruebas unitarias de casos de uso e integración HTTP, sin debilitar pruebas anteriores.
- AUTH-02 verifica cambios de rol/cooperativa y autorización de un rol incorrecto.
- AUTH-03 verifica que el token anterior deja de funcionar y una segunda sesión sigue vigente.
- AUTH-04 verifica duplicado normalizado, concurrencia, hash y ausencia de login automático.

## Plan atómico
1. Caso de uso y errores de dominio, con puertos inyectados y pruebas.
2. Adaptador PostgreSQL y HTTP, composición mediante API pública, pruebas de integración.
3. Verificación lint y test; commit de este caso de uso.

## Fuera de alcance
Frontend, recuperación de contraseña, MFA, altas de personal y cooperativas (requieren sus specs). Sin defectos inducidos.
