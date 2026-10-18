# TENANTS-01: Registrar cooperativa

- **ID local:** TENANTS-01
- **Responsable:** Pablo
- **Módulo:** tenants
- **Estado:** Implementada y verificada localmente (18 de octubre de 2026); revisión humana e integración pendientes.
- **Base de trabajo:** feature/cooperativas, creada desde origin/develop con autenticación integrada.

## 1. Objetivo
Permitir al Administrador del Sistema dar de alta una cooperativa para su posterior gestión operativa.

## 2. Reglas de negocio
- RN-01: permisos comprobados en backend mediante sesión vigente y rol actual.
- RN-02: la identidad y el contexto de cooperativa provienen del servidor. Este caso de uso es el alta global autorizada por RN-03, no un acceso de usuarios operativos a datos ajenos.
- RN-03: solo SYSTEM_ADMIN puede registrar cooperativas y asignar su administrador principal. La asignación se realizará en una tarea posterior; se permite crear sin administrador.

## 3. Alcance aprobado
Incluye un único caso de uso: crear cooperativa, con migración nueva, validaciones, endpoint protegido y pruebas.
No incluye listado, edición, eliminación, logo, colores, frontend ni altas de personal.
La FK de users.cooperative_id corresponde a AUTH-FK-01, posterior a la creación de cooperatives; ninguna migración existente se modifica.

## 4. Flujo
1. Autenticar la sesión y exigir SYSTEM_ADMIN usando exclusivamente la API pública de auth.
2. Comprobar CSRF antes de procesar la creación.
3. Validar la entrada y rechazar propiedades no previstas.
4. Ejecutar CreateCooperative con un puerto de repositorio inyectado.
5. Insertar la cooperativa; la base debe prevenir duplicados también ante solicitudes concurrentes.
6. Responder 201 con los datos creados, sin credenciales.

## 5. Datos aprobados
Confirmados por Pablo:
- Nombre y RUC obligatorios.
- Email, teléfono y dirección opcionales.
- RUC único, texto de exactamente 13 dígitos; solo formato, sin consulta externa ni validación de dígito verificador.
- ID UUID generado por el servidor; created_at y updated_at.
Contrato JSON: name, ruc, email, phone, address. Todos los valores presentes son texto o, para opcionales, null. Se recortan espacios exteriores; name no puede quedar vacío. ruc conserva ceros iniciales. Email se normaliza a minúsculas y se valida como dirección de correo. Los opcionales ausentes, null o vacíos se guardan como null. Phone y address son texto libre; no se impone validación territorial adicional ni unicidad al nombre. No se añaden límites de longitud funcionales no acordados; aplica el límite de cuerpo JSON de Express.
Respuesta 201: { cooperative: { id, name, ruc, email, phone, address, created_at, updated_at } }. No se crea usuario ni relación de administrador.
Errores: 400 VALIDATION_ERROR, 401 UNAUTHENTICATED, 403 FORBIDDEN/CSRF_TOKEN_INVALID, 409 COOPERATIVE_ALREADY_EXISTS. El conflicto no expone datos de otra cooperativa.

## 6. Endpoint
| Método | Ruta | Rol | Respuestas |
|---|---|---|---|
| POST | /api/v1/cooperatives | SYSTEM_ADMIN | 201, 400, 401, 403, 409 |

## 7. Criterios de aceptación
- Administrador del Sistema autenticado, CSRF válido y datos válidos: 201 y persistencia.
- Sin sesión o sesión revocada/vencida: 401 y ninguna inserción.
- CUSTOMER, COOPERATIVE_ADMIN o CLERK: 403 y ninguna inserción.
- Sin CSRF o con CSRF manipulado: 403 y ninguna inserción.
- Datos inválidos o campos extra: 400.
- RUC duplicado, incluidas dos solicitudes concurrentes: una sola fila y conflicto 409.
- Los clientes no pueden elegir id ni cambiar permisos mediante el cuerpo.

## 8. Arquitectura y plan
1. Entidad/validaciones y errores en domain, sin dependencias externas; puerto CooperativeRepository.
2. CreateCooperative en application, dependiente solo de domain y del puerto inyectado.
3. Migración nueva y repositorio PostgreSQL parametrizado en infrastructure.
4. Controlador y validación HTTP en interfaces; composición a través de tenants/index.js y auth/index.js.
5. Pruebas unitarias e integración contra la base aislada; lint y suite completa.

## 9. Pruebas
Unitarias: reglas del alta, invocación del repositorio y propagación de errores.
Integración: endpoint real, permisos por rol, CSRF, sesión revocada, duplicados y concurrencia, migración reversible.
Conservar las pruebas existentes; revisar supuestos sobre el número de migraciones antes de agregar la nueva.

## 10. Decisiones y dependencias
Campos, RUC de formato/único y asignación posterior confirmados por Pablo. Sin preguntas bloqueantes para este endpoint. AUTH-FK-01 y altas de administradores se realizarán después con sus specs.
Pablo autorizó adaptar la prueba general de migraciones para verificar todas las disponibles y sus nombres, conservando reversión, reaplicación y ausencia de duplicados.

## 11. Defecto inducido
No se ha autorizado ningún defecto concreto para este caso de uso. No se introduce uno automáticamente.

## 12. Evidencia de implementación
- Endpoint montado en app.js mediante la API pública de tenants; composición de auth y tenants en server.js.
- Migración nueva `1792280000000-create-cooperatives.js`; sin editar las migraciones existentes.
- Restricción `cooperatives_ruc_unique`, RUC de 13 dígitos y nombre no vacío en PostgreSQL.
- 69 pruebas aprobadas: 43 unitarias y 26 de integración (incluidas las 43 pruebas anteriores).
- La prueba de migraciones ahora identifica las disponibles por nombre, revierte todas, comprueba tabla de infraestructura ausente y registro vacío, reaplica dos veces y compara nombres/ausencia de duplicados. Adaptación autorizada por Pablo.
- Lint y formato aprobados. Sin dependencias nuevas ni defectos inducidos.

## 13. Uso del endpoint
Con sesión de SYSTEM_ADMIN, obtener CSRF después del login y enviar cookies y cabecera X-CSRF-Token:

```json
{
  "name": "Cooperativa de prueba",
  "ruc": "0012345678901",
  "email": "contacto@example.ec",
  "phone": "0991234567",
  "address": "Ambato"
}
```

El RUC del ejemplo es un dato ficticio; la aplicación solo comprueba formato y unicidad. La respuesta entrega cooperative con UUID y fechas generados por el servidor.
Las pruebas crean administradores ficticios en la base aislada. No se implementa un inicializador del administrador real en esta tarea; requiere su spec. La asignación del administrador operativo y AUTH-FK-01 siguen pendientes.
