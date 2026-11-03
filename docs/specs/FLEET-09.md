# FLEET-09: Proteger la configuración de bus usada en hojas vigentes

- **ID local:** FLEET-09; libre en las specs y ramas accesibles al comprobarlo el 3 de noviembre de 2026. FLEET-08 está reservado para el borrador local de accesibilidad.
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `fleet`; lo consume `route-sheets` mediante `seatQueries.listByBus`
- **Responsable:** Edwin
- **Revisor propuesto / confirmado:** David; aceptó revisar el 3 de noviembre de 2026, según su mensaje reportado por Edwin
- **Estado:** Plan documental en revisión en PR #58; decisiones acordadas con David. La implementación de T1 espera autorización de Edwin y la aprobación final queda para la revisión de David.
- **Prioridad y dependencias:** FLEET-06, FLEET-07 T1 y ROUTE-SHEETS-07 presentes en develop. La sustitución pertenece a D-05 de ROUTE-SHEETS-04.
- **Rama / PR / base comprobada:** `feature/FLEET-09-configuracion-hojas`, creada desde `origin/develop` en `04868b2` el 3 de noviembre de 2026; [PR #58](https://github.com/Pato77232/ProyectoBusesUTA/pull/58) documental hacia develop.
- **Autorización de alcance:** el 3 de noviembre de 2026 Edwin pidió acordar con David cómo una hoja conserva la configuración usada y preparar su PR documental. Las decisiones con David están registradas en la sección 10; implementar T1 requiere todavía autorización expresa de Edwin. Publicar esta spec no autoriza modificar pruebas o código de otros módulos.

## 1. Objetivo

RN-12 exige que la configuración ordinaria del bus quede congelada para la hoja establecida y que los cambios apliquen a la siguiente. Una edición ordinaria no debe alterar el inventario de viajes ya publicados, y la sustitución excepcional de un bus no debe confundirse con esa edición.

## 2. Situación comprobada en develop (`04868b2`)

- **Route Sheets ya conserva su copia:** durante la publicación, ROUTE-SHEETS-07 consulta la API pública `seatQueries.listByBus` y guarda en su transacción una copia en `route_sheet_commercial_inventories` de los asientos con `offered: true` (`seatId`, `layoutSeatKey`, `label`, `deck`, `row`, `column`, `category`). La lectura pública actual de Fleet usa su pool: no comparte el cliente transaccional de Route Sheets, de ahí el supuesto de inmutabilidad descrito a continuación. No tiene FK ni SQL sobre tablas de Fleet, y el reintento de una publicación ya completada no vuelve a capturar Fleet.
- **Esa copia se apoya en un supuesto de Fleet:** ROUTE-SHEETS-07 §4.2 indica que se captura «bajo la inmutabilidad actual de Fleet» y que cualquier edición futura requiere acordar antes una sesión transaccional pública o una lectura de configuración inmutable por versión.
- **Fleet no edita hoy:** el código no tiene `UPDATE` ni `DELETE` sobre `buses` o `bus_seats`. La inmutabilidad es una convención del código, no una restricción de la base: un `UPDATE` directo la rompe sin aviso, y `bus_seats` se borra en cascada si se borra el bus.
- **Pruebas que actualizan asientos directamente:** `fleet/seat-queries.test.js`, `route-sheets/commercial-trips.test.js` y `route-sheets/trip-queries.test.js` usan `UPDATE bus_seats SET offered = false` para preparar datos, y `fleet/bus.migration.test.js` y `fleet/bus-vip-seats.test.js` para comprobar restricciones.

Conclusión: los viajes ya publicados están protegidos por su copia. Lo que falta es que Fleet garantice el supuesto del que depende esa copia y defina cómo se harán las ediciones futuras.

## 3. Reglas de negocio involucradas

- **RN-12:** configuración ordinaria congelada para la hoja establecida; cambios para la siguiente. La sustitución excepcional requiere un contrato adicional.
- **Acuerdos §3.6:** la sustitución por avería es una excepción auditada con motivo, autor y relación bus anterior/nuevo; comprueba compatibilidad y correspondencia de cada asiento comprometido, sin completar automáticamente.
- **Arquitectura:** Fleet es dueño de las versiones de configuración y los asientos físicos; Route Sheets, de la copia por hoja; Reservas, de la ocupación.

## 4. Alcance

**Incluye, según lo que se decida:**

- Hacer cumplir en la base la inmutabilidad de identidad y atributos de los asientos de un bus registrado.
- Registrar el contrato: `seatId` nunca se reutiliza ni cambia de bus, y una edición futura no modifica asientos en el lugar.
- Dejar definido el modelo de edición ordinaria futura, sin implementarlo.

**No incluye:**

- Editar la configuración de un bus: no hay pantalla ni endpoint de edición en esta entrega.
- Sustitución de bus: corresponde a D-05 de Route Sheets.
- Reservas, ocupaciones o sus tablas internas.
- Cambios en las tablas o el código de Route Sheets.

## 5. Datos

Propuesta sujeta a la sección 10: migración nueva con un trigger que rechace `UPDATE` de identidad y atributos en `bus_seats` (`id`, `bus_id`, `cooperative_id`, `layout_seat_key`, `label`, `deck`, `row_index`, `column_index`, `category`, `offered`) y `DELETE` de asientos de un bus registrado. Las migraciones existentes no se editan.

## 6. Endpoints

No aplica. `seatQueries.listByBus` conserva su contrato.

## 7. Criterios de aceptación

- [ ] Dado un bus registrado, cuando se intenta cambiar un atributo de sus asientos, entonces la base lo rechaza y el asiento no cambia.
- [ ] Dado un bus registrado, cuando se intenta borrar uno de sus asientos, entonces la base lo rechaza.
- [ ] Dada una hoja publicada, cuando se consulta su viaje, entonces su inventario es igual al capturado al publicar.
- [ ] Dado el alta de un bus, cuando se registra, entonces sus asientos se crean igual que hoy.

## 8. Casos borde y errores

| Caso | Comportamiento |
|---|---|
| Cooperativa quiere desactivar un asiento después del alta | No disponible en esta entrega; requiere la edición versionada de la decisión 2 |
| Bus averiado en un viaje vendido | Sustitución de D-05, no edición de Fleet |
| Migración de reversión | Elimina el trigger sin alterar datos |

## 9. Pruebas esperadas

- **Integración con PostgreSQL aislado:** rechazo de `UPDATE` y `DELETE`, alta intacta y reversión de la migración.
- **Contrato con Route Sheets:** el inventario de un viaje publicado no cambia tras intentar editar el bus.

## 10. Preguntas abiertas

David respondió el 3 de noviembre de 2026; Edwin reportó su mensaje. Acordó las tres decisiones con las condiciones registradas en cada una. La aprobación final de la implementación queda para su revisión.

### Decisión 1: ¿cómo garantiza Fleet la inmutabilidad en esta entrega?

- Estado: Decidida
- Fecha y participantes consultados: 3 de noviembre de 2026; Edwin y David
- Reglas, specs y contratos afectados: RN-12, ROUTE-SHEETS-07 §4.2, FLEET-02 y FLEET-06
- Opciones y recomendación: (A) trigger en la base que rechace cambios y borrados de asientos; (B) solo documentar que Fleet no edita. Se recomienda A: convierte en garantía el supuesto del que depende la copia de David. Su costo es que las pruebas que hoy usan `UPDATE bus_seats SET offered = false` deberán preparar datos con `disabledSeatKeys` en el alta, cambio que necesita autorización de cada responsable.
- Respuesta humana y evidencia de confirmación: David aceptó proteger la configuración en la base y adaptar sus pruebas conservando su cobertura
- Decisión y justificación: A, con tres condiciones de David para sus pruebas: (1) los asientos no ofrecidos se preparan con `disabledSeatKeys` en el alta; (2) las pruebas que simulan un cambio después de publicar conservan la comprobación de que la copia comercial no se recaptura, mediante un proveedor de prueba controlado; (3) se mantiene el caso de inventario vacío sin permitir registrar buses inválidos, porque el alta exige al menos un asiento ofrecido
- Responsable de aplicarla y revisor: Edwin en Fleet; David adapta las pruebas de Route Sheets y revisa
- Criterios de aceptación/pruebas que cambian: sección 7 y preparación de pruebas de Fleet y Route Sheets
- Trabajo dependiente e independiente: depende T1
- Decisión anterior que reemplaza, si aplica: ninguna

### Decisión 2: ¿cómo se hará una edición ordinaria futura?

- Estado: Decidida como modelo futuro, fuera de la implementación actual
- Fecha y participantes consultados: 3 de noviembre de 2026; Edwin y David
- Reglas, specs y contratos afectados: RN-12 y ROUTE-SHEETS-07 §4.2
- Opciones y recomendación: (A) versiones inmutables de configuración: editar crea una versión nueva, conserva el `seatId` de cada posición y `listByBus` informa la versión leída; (B) edición en el lugar dentro de una sesión transaccional pública compartida con la publicación. Se recomienda A: no exige coordinar transacciones entre módulos y la próxima publicación captura la versión vigente. Solo se acuerda el modelo; se implementará cuando exista una necesidad de edición.
- Respuesta humana y evidencia de confirmación: David aceptó el versionado inmutable como propuesta futura documentada
- Decisión y justificación: A, sin implementar ahora. Conserva los `seatId` de los mismos asientos del bus, la publicación captura la versión vigente y las copias ya publicadas se conservan
- Responsable de aplicarla y revisor: Edwin; David
- Criterios de aceptación/pruebas que cambian: ninguno en T1
- Trabajo dependiente e independiente: no bloquea T1
- Decisión anterior que reemplaza, si aplica: ninguna

### Decisión 3: ¿qué aporta Fleet a la sustitución excepcional?

- Estado: Decidida entre Edwin y David; falta Leslie para los asientos comprometidos
- Fecha y participantes consultados: 3 de noviembre de 2026; Edwin y David. Leslie, pendiente
- Reglas, specs y contratos afectados: acuerdos §3.6 y D-05 de ROUTE-SHEETS-04
- Opciones y recomendación: Fleet no modifica ningún bus al sustituir. Route Sheets registra la excepción y lee el inventario del bus nuevo con `listByBus` para comprobar compatibilidad por `layoutSeatKey`, `label` y `category`; Reservas aporta los asientos comprometidos por su API pública. Si un asiento no tiene correspondencia, no se completa automáticamente.
- Respuesta humana y evidencia de confirmación: David aceptó la separación para D-05
- Decisión y justificación: Route Sheets registra la sustitución y consulta Fleet por su API pública. La comparación por `layoutSeatKey`, `label` y `category` valida compatibilidad entre ambos buses sin asumir que comparten `seatId`. Si la consulta de asientos comprometidos falta o falla, no se asume que no hay reservas. El contrato de esa consulta sigue pendiente con Leslie
- Responsable de aplicarla y revisor: David; Edwin como consultado
- Criterios de aceptación/pruebas que cambian: ninguno en Fleet
- Trabajo dependiente e independiente: D-05 depende; T1 no
- Decisión anterior que reemplaza, si aplica: ninguna

## 11. Defecto inducido

No aplica.

## 12. Diseño SOLID y usabilidad

- **Responsabilidades:** Fleet garantiza la fuente inmutable; Route Sheets conserva la copia por hoja; Reservas, la ocupación. Ningún módulo lee tablas de otro.
- **Abierto/cerrado:** la edición futura agrega versiones sin cambiar el contrato de `listByBus` para buses sin ediciones.
- **Usabilidad:** sin interfaz en este alcance; no se verifica.

## 13. Plan y evidencias

| Paso | Resultado comprobable | Archivos compartidos |
|---|---|---|
| T1: inmutabilidad en la base | Migración con trigger y pruebas de rechazo | Preparación de pruebas de Fleet y Route Sheets que hoy actualizan `bus_seats`; las de Route Sheets las adapta David con sus condiciones |

**Evidencias:** pendientes; no hay implementación.

Revisión documental del 3 de noviembre: diff limitado a esta spec y su fila en `docs/estado-proyecto.md`; `git diff --check` aprobado. Se contrastaron `seatQueries.listByBus`, la preparación y persistencia del inventario comercial y ROUTE-SHEETS-07. No se ejecutaron lint ni pruebas de producto porque no cambian código, migraciones o pruebas; los criterios funcionales anteriores siguen pendientes. Los acuerdos se registran como mensaje de David reportado por Edwin, no como revisión final del código. Redacción inicial asistida por Claude Code; revisión y preparación de PR asistidas por Codex. El borrador FLEET-08 permanece local y fuera del diff.

## 14. Revisión y cierre

Pendientes. PR #58 publicada para revisión documental de David; no equivale a aceptación de la implementación. Autorizar T1 por separado y confirmar con Leslie el contrato de asientos comprometidos para D-05. No se enviaron mensajes a David o Leslie desde esta revisión.
