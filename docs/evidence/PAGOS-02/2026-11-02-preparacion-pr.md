# PAGOS-02: verificación local y borrador de PR

> Descripción vigente ampliada: [descripcion-pr.md](descripcion-pr.md). Este archivo conserva las verificaciones anteriores; el adaptador posterior tiene [su evidencia propia](2026-11-02-adaptador-lector.md), con 802 pruebas globales aprobadas y sin conexión productiva del lector nuevo. No reutilizar los conteos anteriores como estado actual.

- Fecha: 2 de noviembre de 2026, America/Guayaquil.
- Responsable: Shirley; Pablo aceptó revisar, sin aprobación anticipada.
- Spec: [PAGOS-02](../../specs/PAGOS-02.md).
- Rama comprobada: `feature/PAGOS-02-aprobar-comprobante`, HEAD `4e6bbf79193b9ed1ee906fc00cb29fe3a7631762`, del 29 de octubre, con cambios locales conservados.
- Estado: preparación local de revisión; no publicada, integrada ni cerrada. Esta verificación no aprueba contratos nuevos ni autoriza su implementación.

## Resultado comprobado

Se volvió a verificar la implementación existente de bandeja, lectura privada, intención durable y aprobación mediante puertos simulados. No se escribió funcionalidad nueva ni se adaptó todavía el consumidor al contrato propuesto de lectura autorizada.

GitHub confirmó `develop` en `8fdf7e4b9103c40efa6a2ee28e95e3b44c2289a6`. La comparación desde la base común pública `518c46bb87bc167568ec1e2031f2bc5550ad2fd9` muestra 77 commits posteriores en develop, sin cambios del backend de Payments, pero sí en `server.js`, el registro compartido y las specs PAGOS-01/BOOK-07. La rama local contiene ocho commits posteriores a esa base común y cambios sin commit. No se incorporó develop ni se verificó la combinación de ambas líneas de trabajo.

La consulta directa de PR abiertas solo devolvió la [PR #44](https://github.com/Pato77232/ProyectoBusesUTA/pull/44), de Fleet. No se encontró PR abierta de PAGOS-02; las búsquedas de ramas de Pagos mostraron las ramas de PAGOS-01 y el antecedente BOOK-07-T1. La consulta de comparación remota usando el HEAD local devolvió 404; no se presenta ese HEAD como publicado.

## Verificación ejecutada

Entorno: Windows/PowerShell, Node 24.15.0, npm 11.6.1 y PostgreSQL 16.13-alpine. Se usó una imagen ya disponible, una base `busesuta_test` exclusiva en memoria, puerto local dinámico y credenciales públicas de prueba. El contenedor `pagos02-qa-20261102-1739` se retiró al terminar; no se tocó la base existente.

| Comprobación | Resultado real |
| --- | --- |
| Desde backend, `npm run lint` | Aprobado, salida 0. |
| Desde backend, `npm run format:check` | Fallido, salida 1; 48 archivos ajenos al cambio de Pagos. No se corrigieron ni se trataron como defectos inducidos. |
| Prettier de los 28 JS del incremento, incluidos los cambios de rama desde la base común y la migración nueva local | Aprobado con la configuración de backend. |
| Primer intento unitario con acceso local restringido | 588 aprobadas y 6 fallidas por `connect EACCES 127.0.0.1`, en rutas HTTP de Payments. |
| Desde backend, repetición completa `npm test` con acceso HTTP local y PostgreSQL aislado | 44 suites / 594 unitarias y 13 suites / 120 integraciones aprobadas; 714 pruebas en total, salida 0. Sin cambiar pruebas ni límites. |
| Arranque real mediante `src/server.js`, función `start` | Aprobado con migraciones por el ejecutor existente y configuración de QA en memoria. Health 200 con base accesible; listado y aprobación sin sesión devuelven 401. Servidor cerrado al terminar. |
| `git diff --check` | Aprobado antes de registrar esta evidencia. |

La primera comprobación de Docker estuvo restringida; se repitió con acceso autorizado. No se instalaron dependencias, no se leyeron archivos `.env`, no se usaron cuentas reales ni se guardaron claves de sesión. No se cambiaron código, migraciones o pruebas en esta continuación. El arranque acredita montaje/protección básica, no una venta real ni el flujo entre módulos. Los 20 escenarios del contrato nuevo siguen siendo criterios futuros.

Comprobación posterior a las ediciones documentales: `git diff --check` aprobado; 68 enlaces locales de siete documentos sin destinos inexistentes. Los SHA-256 de los 20 archivos backend modificados/no seguidos permanecen idénticos antes y después de registrar la evidencia.

## Coordinación que falta para conectar realmente

Los cinco puntos están concentrados en [el documento principal, §9](../../pagos-reservas-find-for-payment.md#9-cinco-puntos-para-cerrar-con-leslie-y-pablo). Enviar el documento o aceptar el papel de revisor no sustituye las respuestas:

| Afectados | Resultado pendiente | Trabajo que habilita |
| --- | --- | --- |
| Leslie y Shirley | Firma y propósitos; DTO mínimo, minimización de ownerId, inicio exacto del plazo y estados realmente soportados; evidencia de ausencia de recepción aceptada. | Adaptación del lector y sus dos consumidores, con un alcance comprobable. |
| Pablo, con Leslie y Shirley | Contrato exacto del contexto verificado, vigencia y clasificación/traducción de errores. | Paso de identidad y errores sin bypass de permisos ni filtración entre cooperativas. |
| Leslie y Shirley; Pablo si afecta Auth o contrato compartido | Recepción y confirmación: identidad/versionado, importe observado, respuestas, errores y recuperación con autorización propia. | Conexión productiva de carga y aprobación; la lectura por sí sola no la autoriza. |

No se reabren los plazos 3/15 minutos, efectivo mediante reserva, autoridad para crear CLERK ni la aceptación de Pablo como revisor. Correcciones, rechazo/liberación, caja, correo e invitado conservan sus pendientes en sus contratos propios; no es necesario resolverlos todos para revisar el trabajo local anterior o cerrar únicamente el lector.

Tras las respuestas: registrar las decisiones humanas en las specs, delimitar el incremento autorizado, adaptar únicamente ese consumidor y probarlo con el proveedor publicado de Leslie. Después verificar la composición y combinación con develop actualizado. No cambiar la firma ni habilitar una venta real a partir de este borrador.

## Borrador de PR para revisión del trabajo local

Este texto describe el trabajo encontrado y verificado, no una PR ya creada ni una funcionalidad lista para integrar. Debe revisarse de nuevo contra el diff efectivamente seleccionado y publicado. Mantener fuera los borradores de correcciones/caja, que son tareas separadas.

**Título:** `feat(pagos): agrega bandeja y aprobación de comprobantes`

**Descripción preparada:**

Permite a un CLERK consultar los comprobantes pendientes de su cooperativa y leer sus archivos privados. La aprobación guarda primero una intención durable con el actor original y solo registra la decisión final tras la confirmación del puerto de Reservas. Los reintentos conservan la identidad del comprobante y la intención previa.

Incluye paginación, total de reserva por el puerto de lectura, protección de rutas por sesión/rol/CSRF, persistencia y migraciones aditivas de aprobación e intención. Regla de cooperativa desde identidad verificada: RN-02; revisión/aprobación: RN-40, RN-52 y RN-54. El ajuste de recepción de PAGOS-01 conserva bookingId, cooperativeId y paymentProofId.

**PR en borrador para revisión:** la composición usa adaptadores simulados. No confirma una venta en Bookings real ni implementa el nuevo contexto de findForPayment, versiones de archivos o importe observado. No incluye pantallas, rechazo, correcciones, efectivo, invitado, correo ni QR.

Validación actualizada de la rama local: lint aprobado; repetición final de npm test completo con 594 unitarias y 134 integraciones aprobadas en PostgreSQL aislado (728 total); formato de los 29 JS del incremento aprobado. Incluye 14 pruebas nuevas de HTTP, Auth, archivos y PostgreSQL. format:check global falla en 48 archivos ajenos. Arranque real de la verificación anterior: health 200 y rutas de listado/aprobación sin sesión 401; no se repitió por añadir pruebas. Historial de intentos y límites en [la evidencia HTTP](2026-11-02-integracion-http.md), incluida una ejecución global con salida 1 sin detalle antes de las repeticiones aprobadas.

Base remota consultada: develop 8fdf7e4, no incorporada. La evidencia no certifica su combinación con esta rama. Antes de solicitar integración se requieren cierre de contratos, proveedor real, adaptación y pruebas entre módulos, conciliación de la base y revisión humana de Pablo. Los fallos globales de formato permanecen visibles y requieren resolución o una decisión humana explícita sobre su tratamiento; esta nota no los exceptúa.

Refs: [PAGOS-02](../../specs/PAGOS-02.md), [PAGOS-01](../../specs/PAGOS-01.md) y [propuesta de lectura](../../pagos-reservas-find-for-payment.md).

Asistencia de IA: Codex revisó el estado, el código y la evidencia, escribió la suite nueva de 14 pruebas HTTP, ejecutó validaciones y preparó esta documentación. La revisión humana sigue pendiente.

## Publicación pendiente

No se hicieron commits, push, merge, rebase ni tags, ni se creó la PR. Hay cambios de varias tareas en el directorio de trabajo: no usar una selección global de todos los archivos. La persona deberá revisar/separar el diff, conciliar la base sin perder cambios y publicar la rama según el flujo del proyecto. La publicación en borrador permite revisar el alcance anterior; no equivale a aceptar los contratos pendientes ni a autorizar integración.

### Continuación después de la respuesta de Pablo

La evidencia inicial de este archivo conserva su alcance y resultados anteriores. Después se añadió únicamente una suite HTTP de 14 pruebas al backend, prevista en PAGOS-02 §9/§16, y se actualizó la descripción preparada. [Resultados actuales y límites](2026-11-02-integracion-http.md): 728 pruebas aprobadas en la repetición completa, Reservas simulado y sin cambios de producción. Pablo confirmó origen Auth/matriz y ratificación de formatos; proyección/códigos nuevos esperan conciliación con Leslie. No se exige volver a aprobar la matriz ni la ratificación a Pablo. La última consulta también encontró la PR #45 de pantalla Auth abierta; no altera el alcance de Pagos ni acredita su combinación con esta rama.
