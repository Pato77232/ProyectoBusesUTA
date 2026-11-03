# PAGOS-02: integración HTTP con Auth y PostgreSQL

- Fecha: 2 de noviembre de 2026, America/Guayaquil.
- Spec: [PAGOS-02 §16](../../specs/PAGOS-02.md#16-incremento-independiente-de-pruebas-http-con-postgresql).
- Rama: `feature/PAGOS-02-aprobar-comprobante`, HEAD `4e6bbf7`; cambios locales conservados, sin commits nuevos.
- Resultado: 14 pruebas de integración nuevas y verificación global local aprobada. Revisión humana e integración pendientes.

## Objetivo y alcance

Comprobar los endpoints existentes del incremento local PAGOS-02 a través de HTTP real con los módulos públicos Auth/Payments, PostgreSQL aislado y lectura de un archivo temporal. El archivo añadido es `backend/tests/integration/payments/payment-proof-review.http.test.js`; no modifica pruebas anteriores ni código de producción, migraciones, dependencias, composición productiva o frontend.

Las identidades de QA se registran por la API pública existente, se preparan sus roles/cooperativas directamente como datos ficticios de la base de prueba y se inicia sesión por HTTP. Los permisos, sesión y CSRF se verifican mediante Auth real. Esa preparación no utiliza ni implementa el endpoint AUTH-06, todavía no disponible. Contraseñas y clave de firma se generan en memoria; no se documentan ni comparten.

La lectura de reservas y confirmación de venta siguen simuladas. La prueba conserva los puertos vigentes del alcance local anterior, sin implementar la proyección ni códigos nuevos propuestos por Pablo y pendientes de Leslie. La lectura del archivo prueba bytes y aislamiento, no la validación de formatos durante carga.

## Escenarios añadidos

| Escenario | Resultado observado |
| --- | --- |
| Bandeja con sesión CLERK real y filtro de cooperativa; query intenta elegir otra cooperativa. | Solo comprobante propio, total 875 USD y sin clave privada. |
| Archivo privado propio frente a ajeno e inexistente. | Bytes/headers seguros para el propio; mismo 404 para ajeno/ausente. |
| Ausencia de sesión y rol declarado en body. | 401 sin listar, leer, crear intención o confirmar. |
| CUSTOMER, COOPERATIVE_ADMIN y SYSTEM_ADMIN autenticados (tres casos). | 403 para las operaciones de revisión/aprobación, sin intención ni confirmación. |
| CSRF ausente o falso. | 403 sin intención ni confirmación. |
| Aprobación y repetición. | Mismo resultado, actor persistido, una llamada al confirmador y salida de la bandeja. |
| Confirmador acepta pero se pierde la respuesta; reintenta otro CLERK. | Primero 503 con intención pendiente; después 200, misma identidad y actor original, sin segunda venta en el simulador. |
| Dos solicitudes de aprobación concurrentes. | Ambas recuperan la misma decisión; un actor en PostgreSQL y una venta en el simulador. |
| Sesión revocada y vencida (dos casos). | Nueva solicitud devuelve 401 sin crear intención. |
| Body intenta seleccionar cooperativa/actor para aprobar un comprobante ajeno. | Mismo 404 que ausente, sin modificación ni confirmación. |
| Confirmador rechaza definitivamente. | 409 y sin aprobación local. No es el flujo de rechazo PAGOS-03. |

Son 14 pruebas en total. La simulación de respuesta perdida conserva una aceptación en el mismo adaptador; no demuestra persistencia ni recuperación del proveedor real después de un reinicio, ni autorización de un trabajador durable. Esos contratos siguen pendientes.

## Verificación ejecutada

Entorno: Windows, Node 24.15.0, npm 11.6.1, PostgreSQL 16.13-alpine ya disponible. Base `busesuta_test`, puerto local dinámico 49681 y almacenamiento de PostgreSQL en memoria; contenedor exclusivo `pagos02-http-qa-20261102`, retirado al terminar. Archivos de prueba temporales eliminados sin borrado recursivo. No se leyó `.env` ni se usó la base existente.

| Comprobación | Resultado |
| --- | --- |
| Prueba dirigida del archivo nuevo, con NODE_ENV=test y base aislada | 14/14 aprobadas; 3,265 s. |
| Desde backend, npm run lint | Aprobado, salida 0. |
| Desde backend, npm run format:check | Fallido, salida 1; los mismos 48 archivos ajenos pendientes. |
| Prettier del incremento completo (29 JS), incluida la prueba nueva | Aprobado, salida 0. |
| Primera ejecución global de esta continuación | Unitarias 594/594; terminó con salida 1 durante integración sin detalle final recuperado. Causa no determinada; no se declara aprobada esa ejecución. |
| Repetición de integración conservando salida | 14 suites / 134 pruebas aprobadas; salida 0, 32,150 s. |
| Repetición final de npm test completo conservando salida | 44 suites / 594 unitarias y 14 suites / 134 integraciones aprobadas; 728 total, salida 0. Tiempos 2,596 s y 32,325 s. |

No se modificaron pruebas ni sus límites entre ejecuciones. La repetición aprobada no establece la causa de la salida 1 anterior. El script global de formato no incluye tests; por eso se comprobó también explícitamente el nuevo archivo con Prettier.

No cambió la composición productiva: el arranque real anterior conserva su fecha y alcance en [la evidencia de preparación](2026-11-02-preparacion-pr.md). Esta continuación monta las APIs reales de Auth/Payments dentro de la prueba; no vuelve a certificar server.js ni una combinación con develop.

Los 20 archivos backend con cambios anteriores se compararon mediante SHA-256 y permanecen idénticos al snapshot previo. Solo se añadió esta prueba al backend. Los fallos de formato no son defectos inducidos autorizados ni se exceptúan por este registro.

Verificación documental final: `git diff --check` aprobado y 77 enlaces locales de ocho documentos comprobados sin destinos inexistentes. No se verificaron enlaces externos ni anclas.

## Coordinación recibida y revisión pendiente

La respuesta humana de Pablo confirma origen de autenticación, matriz de permisos y ratificación PDF/JPEG/PNG de 5 MiB. Proyección exacta y nuevos códigos siguen propuestos; invitado, correo y alta CLERK son borradores locales reportados, sin API disponible. Procedencia y detalle en [el contrato principal](../../pagos-reservas-find-for-payment.md#respuesta-humana-de-pablo--2-de-noviembre).

GitHub comprobado en esta continuación: develop `8fdf7e4`; PR abiertas #44 de Fleet y #45 de pantalla Auth, sin PR abierta de PAGOS-02. No se incorporó develop. Las pruebas nuevas dependen de la implementación local PAGOS-02: no presentarlas aisladas como pruebas que ya pasan sobre develop sin ese incremento.

Siguiente resultado pequeño: recibir y registrar la respuesta de Leslie sobre DTO/inicio/estados y ausencia de recepción; cerrar con ella la proyección/códigos propuestos por Pablo. Después autorizar y adaptar únicamente el lector. Recepción y venta requieren sus contratos propios antes de una conexión productiva. La PR de PAGOS-02 puede prepararse en borrador para revisión del alcance local con simuladores; no se declara lista para integrar.

Mensaje sugerido para un commit del incremento de pruebas, cuando Shirley autorice guardarlo: `test(pagos): verifica revisión HTTP con sesión y PostgreSQL`.

Refs: docs/specs/PAGOS-02.md, §16. Sin commits, push, merge, rebase, tags ni publicación de PR. Asistencia de Codex en preparación de pruebas, ejecución y documentación; revisión humana de Pablo pendiente.
