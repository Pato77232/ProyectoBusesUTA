# AUTH-FK-01: Integridad de usuarios y cooperativas

- **Responsable:** Pablo
- **Estado:** Implementada y verificada; pendiente de revisión y fusión. Basada en los acuerdos aprobados de AUTH-01 y ADR 0004.
- **Dependencias:** TENANTS-01 y AUTH-01.
- **Reglas:** RN-01, RN-02 y RN-03.

## Objetivo y alcance
Agregar mediante una migración nueva la FK users.cooperative_id → cooperatives.id y el CHECK por rol ya acordado. COOPERATIVE_ADMIN y CLERK requieren cooperativa; SYSTEM_ADMIN y CUSTOMER requieren null. No se crean endpoints ni usuarios internos.

## Decisiones
- La FK rechaza referencias inexistentes y eliminación de cooperativas referenciadas; no borra usuarios en cascada.
- No editar migraciones anteriores ni modificar datos existentes para hacerlos encajar.
- Si hay usuarios incompatibles, la migración falla de forma transaccional, sin borrar, reasignar ni publicar datos personales. El equipo debe resolverlos mediante una tarea explícita antes de reintentar.
- Down elimina únicamente las dos restricciones nuevas, conservando tablas y filas.
- La regla de puerta de AUTH-01 sigue vigente: las altas internas requieren que esta tarea esté fusionada antes de implementarse.

## Criterios de aceptación y pruebas
1. CUSTOMER y SYSTEM_ADMIN sin cooperativa se guardan; con cooperativa se rechazan.
2. CLERK y COOPERATIVE_ADMIN sin cooperativa se rechazan; con cooperativa existente se guardan.
3. Una referencia a UUID inexistente falla por FK.
4. Actualizar el rol o cooperative_id también respeta el CHECK.
5. No se puede borrar una cooperativa referenciada.
6. Up rechaza datos previos incompatibles sin eliminarlos y sin dejar restricciones parciales.
7. Down conserva datos; up reaplica las restricciones.
8. Suite completa, lint y formato correctos. Los fixtures de pruebas internas deben tener cooperativas reales y conservar las aserciones de permisos/ausencia de escrituras.

## Plan
1. Migración nueva con FK y CHECK.
2. Pruebas PostgreSQL de cada combinación de rol y de reversibilidad/datos previos.
3. Adaptar fixtures de cooperativas con autorización de Pablo, sin debilitar pruebas.
4. Ejecutar controles y guardar un commit separado.

## Defectos inducidos
No aplica. No se introducen inconsistencias deliberadas en esta migración.

## Verificación realizada
- `npm run lint`: correcto.
- `npm run format:check`: correcto.
- `npm test` con PostgreSQL de pruebas: 77 pruebas aprobadas (43 unitarias y 34 de integración).
- Pablo autorizó adaptar los datos de prueba: los usuarios internos referencian una cooperativa real. Se conservan las comprobaciones de permisos, duplicados y ausencia de escrituras; las solicitudes rechazadas comparan las filas completas con la base inicial.
- Se verifican el rollback ante datos incompatibles, la reversibilidad y la conservación de usuarios.
- La implementación de altas internas continúa condicionada a la fusión de AUTH-FK-01.
