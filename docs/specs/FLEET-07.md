# FLEET-07: Marcar los asientos VIP de un bus

- **ID local:** FLEET-07; libre en las specs y ramas accesibles al comprobarlo el 2 de noviembre de 2026.
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `fleet`; lo consume `bookings` mediante la API pública de Fleet
- **Responsable:** Edwin
- **Revisor propuesto / confirmado:** Leslie propuesta, por consumir el inventario; sin confirmación registrada
- **Estado:** T1 técnicamente preparada para revisión en PR #44; Edwin confirmó VIP no ofrecido. Integración aislada 280/280 aprobada el 3 de noviembre; la suite unitaria global de la base conservada mantiene dos fallos ajenos. Confirmación del contrato por Leslie y revisión humana pendientes. T2 se gestiona aparte.
- **Prioridad y dependencias:** FLEET-02, FLEET-03 y FLEET-06 presentes en develop; PR #41 comprobada integrada el 2 de noviembre. T2 depende de la PR #37 de FLEET-05. Accesibilidad se trata en el borrador local FLEET-08, fuera de esta PR.
- **Rama / PR / base comprobada:** `feature/FLEET-07-T1-vip`, sobre `979fad4` el 2 de noviembre de 2026, que parte de FLEET-06 en `447fcce`; [PR #44](https://github.com/Pato77232/ProyectoBusesUTA/pull/44) hacia develop. `origin/develop` comprobado en `f5b9bde` el 3 de noviembre; Edwin rechazó incorporar esa base, por lo que no se ejecutó merge/rebase.
- **Autorización de alcance:** el 2 de noviembre de 2026 Edwin pidió agregar VIP y eligió marcarlo por bus. El mismo día Edwin pidió comenzar la implementación e informó que Leslie aprobó FLEET-06.

## 1. Objetivo

RN-12 exige asientos VIP, pero las tres plantillas de FLEET-03 solo tienen asientos `NORMAL`. ROUTE-SHEETS-05 ya guarda el recargo VIP, y una compra real necesita que Fleet indique qué asientos lo llevan.

## 2. Reglas de negocio involucradas

- **RN-12:** el bus mapea sus asientos VIP.
- **RN-11 y acuerdos:** VIP es categoría del asiento, distinta del tipo operativo del grupo. No se infiere por piso ni por grupo.
- **Tarifas / RN-43:** el recargo se aplica antes del descuento. Lo calcula Reservas con la política de la hoja; Fleet solo informa la categoría.

## 3. Alcance

**Incluye:**

- Indicar en el alta qué posiciones son VIP.
- Nueva migración que admita `VIP` en `bus_seats.category`.
- Devolver la categoría en `seatQueries.listByBus`.
- Selección en el formulario de registro.

**No incluye:**

- Editar un bus ya registrado o cambiar las plantillas publicadas.
- Espacios accesibles: borrador local FLEET-08, no publicado en esta PR.
- Versión de configuración por hoja: tarea pendiente de Fleet, coordinada con David, que requiere su propia spec.
- Cálculo del recargo o pantalla de compra.

## 4. Flujo principal

1. El administrador elige plantilla y desactiva posiciones, como hoy.
2. Marca las posiciones VIP de ese bus.
3. Fleet valida las claves contra la plantilla y guarda la categoría en `bus_seats`.
4. Reservas lee la categoría con `listByBus`.
5. El pasajero elige un asiento en el diagrama; si es VIP, Reservas aplica el recargo.

## 5. Datos

Entrada nueva en `data` del alta:

| Campo | Tipo | Validación |
|---|---|---|
| `vipSeatKeys` | lista de `layoutSeatKey` | Opcional; claves existentes y sin repetir |

Una migración nueva amplía el CHECK de `bus_seats.category` a `NORMAL` y `VIP`; la migración existente no se edita. Los buses ya registrados conservan `NORMAL`.

## 6. Endpoints

Sin rutas nuevas. `POST /api/v1/buses` acepta `vipSeatKeys`, con 400 si es inválido. `seatQueries.listByBus` puede devolver `category: 'VIP'`, que es un cambio de contrato para Reservas.

## 7. Criterios de aceptación

- [x] Dada una clave VIP válida, cuando se registra el bus, entonces ese asiento llega con `category: 'VIP'` y los demás conservan `NORMAL`.
- [x] Dada una clave inexistente en la plantilla, cuando se registra el bus, entonces responde 400 y no crea nada.
- [x] Dada una clave repetida, cuando se registra el bus, entonces responde 400.
- [x] Dado un bus registrado antes de este cambio, cuando se consulta, entonces sus asientos siguen en `NORMAL`.
- [x] Dado un alta sin `vipSeatKeys`, cuando se registra el bus, entonces el resultado es igual al actual.
- [x] Dados dos buses con la misma plantilla, cuando marcan asientos VIP distintos, entonces cada uno conserva los suyos.

## 8. Casos borde y errores

| Caso | Comportamiento |
|---|---|
| Posición desactivada y marcada como VIP | Edwin confirmó que se permite el 3 de noviembre: conserva `category: 'VIP'` y `offered: false`; no se vende mientras no se ofrezca |
| Bus sin asientos VIP | Todo `NORMAL`, igual que hoy |

## 9. Pruebas esperadas

- **Unitarias:** validación de `vipSeatKeys` y derivación de categoría.
- **Integración con PostgreSQL aislado:** alta con VIP, migración sobre buses existentes y lectura por `listByBus`.
- **Frontend:** selección en el formulario y prueba de pantalla.

## 10. Preguntas abiertas

### Decisión: ¿dónde se define qué asiento es VIP?

- Estado: Decidida
- Fecha y participantes consultados: 2 de noviembre de 2026; Edwin
- Reglas, specs y contratos afectados: RN-12, FLEET-02, FLEET-03 y FLEET-05
- Opciones y recomendación: (A) por bus al registrarlo, como `disabledSeatKeys`; (B) en versiones nuevas de las plantillas. Se recomendó A.
- Respuesta humana y evidencia de confirmación: Edwin eligió A al pedir dividir la spec con VIP por bus
- Decisión y justificación: A; reutiliza el alta y no fija los mismos asientos VIP para toda cooperativa. El pasajero elige un asiento ya marcado; no convierte cualquier asiento en VIP.
- Responsable de aplicarla y revisor: Edwin; Leslie propuesta
- Criterios de aceptación/pruebas que cambian: secciones 5 y 7
- Trabajo dependiente e independiente: dependen T1 y T2
- Decisión anterior que reemplaza, si aplica: amplía la decisión de FLEET-03, que limitó esas tres bases a `NORMAL`

### Otras preguntas

1. Confirmar con Leslie que Reservas aplicará el recargo según `category` y no tratará `VIP` como `NORMAL`.
2. Caso VIP no ofrecido confirmado por Edwin el 3 de noviembre de 2026: se permite y conserva `offered: false`. No implica confirmación de Leslie del contrato.

## 11. Defecto inducido

No aplica.

## 12. Diseño SOLID y usabilidad

- **Responsabilidades:** Fleet identifica la categoría; Reservas decide precio y disponibilidad.
- **Abierto/cerrado:** las plantillas publicadas no cambian; la categoría VIP se aplica al copiar los asientos al bus.
- **Usabilidad:** el administrador debe distinguir VIP de desactivado sin depender solo del color, con teclado y en pantalla pequeña. Se verificará en T2.

## 13. Plan y evidencias

| Paso | Resultado comprobable | Archivos compartidos |
|---|---|---|
| T1: VIP en backend | Alta y consulta con categoría VIP, con migración nueva | `bus-registration.js`, `bus-seat-configuration.js`, `pg-bus.repository.js` |
| T2: formulario | Selección en la pantalla de registro | `bus-form.js`, `bus-form-view.js`, de la PR #37 |

**Evidencias anteriores registradas (2 de noviembre de 2026, PostgreSQL aislado):** implementación en `5846d93`. Lint sin errores y Prettier correcto en los archivos tocados. Integración: 280 de 280 aprobadas en 25 suites. Unitarias: 1074 aprobadas y 2 fallidas de 1076, las mismas de `publish-route-sheet.use-case.test.js`; por eso la suite global no queda en verde y la integración se ejecutó aparte. Edwin autorizó cambiar en `bus.migration.test.js` el valor `VIP` por `OTRA`, porque esa prueba exigía el contrato anterior; la comprobación de rechazo se conserva.

**Revisión de publicación por Codex, 2 de noviembre:** lint aprobado, formato de los siete JS del incremento aprobado; formato global fallido en 17 archivos ajenos. Unitarias repetidas con acceso HTTP local: 1074 aprobadas y 2 fallidas por preparación sin `tariffRepository` en hojas de ruta; su código y pruebas no cambian frente a develop. La migración VIP es nueva y su reversión falla transaccionalmente si hay VIP persistidos, sin convertirlos silenciosamente a NORMAL. Sin dependencias nuevas ni cambios de código de otros módulos. Implementación asistida por Claude Code; revisión y publicación asistidas por Codex. Sin aprobación humana ni integración de FLEET-07.

Integración repetida de esta revisión: 279 aprobadas y una fallida de 280, en 25 suites; las cinco pruebas de `fleet/bus-vip-seats.test.js` aprobaron. Falló `tests/integration/database.test.js`, caso «migraciones reversibles y reaplicación sin duplicados en PostgreSQL», por superar 20 000 ms. Este resultado no se sustituye por el 280/280 anterior ni se atribuye la causa del timeout sin investigarla. Se usó PostgreSQL 16.13 efímero exclusivo con tmpfs y puerto dinámico, base `busesuta_test`, sin leer `.env`; contenedor eliminado al terminar. No se amplió ningún timeout ni se cambió código/pruebas durante esta revisión.

## 14. Revisión y cierre

### Cierre técnico de T1 solicitado el 3 de noviembre

Edwin pidió terminar T1 y confirmó permitir VIP no ofrecido. Rechazó incorporar develop: se conserva la base de la rama, sin merge/rebase ni cambios a hojas de ruta. Por ello los dos fallos unitarios de ese módulo en esta base no se corrigen desde Fleet; sus correcciones ya existen en develop, pero no se afirma validación de la combinación.

Edwin autorizó específicamente renombrar solo la migración VIP nueva, no integrada, de `1793640000000` a `1793740000000`, conservando su SQL. La numeración anterior precedía las migraciones de programación y viajes comerciales ya integradas y habría impedido aplicar VIP sobre esa BD con la comprobación de orden activa. No se renumeran migraciones ajenas ni se desactiva dicha comprobación.

La prueba de reversión ahora localiza la migración VIP por nombre, revierte primero las posteriores y verifica la restauración exacta del historial; comprueba también que el intento fallido de revertir con VIP preserva tanto el historial como los asientos VIP y NORMAL. No se rebajan expectativas ni se amplían límites de tiempo.

Verificación adicional con Node 24.21.0 y PostgreSQL 16.13 en Docker, sin cambiar la base del checkout: upgrade de todas las migraciones de develop `f5b9bde` seguido de la nueva VIP aprobado, con orden activo; las cinco pruebas VIP también aprobaron con una migración posterior ficticia `1793750000000-fleet-qa-followup` montada solo en el contenedor. Esa fixture no se incorpora a migraciones del producto. Las 101 unitarias de registro/configuración Fleet aprobaron. Lint y formato propio aprobados; formato global conserva 17 pendientes ajenos. La repetición unitaria completa de la base conservada da 1074 aprobadas y 2 fallidas de hojas de ruta; no se declara suite global aprobada.

Los primeros intentos del auxiliar temporal de upgrade fallaron por resolución de dependencias y configuración de tabla de historial; se corrigió solo el auxiliar QA, no producción. El resultado aprobado usa `pgmigrations` igual que `scripts/migrate.js`. Dependencias instaladas en volumen efímero mediante `npm ci` con el lock existente; sin cambios de versiones ni lectura de `.env`.

Resultado final reproducible con Node 24.21.0 sobre Linux y PostgreSQL 16.13: integración completa **280/280 en 25 suites**, incluida `database.test.js` (6,805 s), sin ampliar su timeout. El timeout previo de Windows no se reprodujo en esta ejecución; no se afirma una causa demostrada ni una corrección universal de rendimiento. Escenario de migración posterior: **5/5**; upgrade de migraciones de develop a VIP: aprobado con orden activo. Contenedores, redes y volúmenes exclusivos retirados. Ningún archivo de hojas de ruta, pagos o reservas fue modificado. El resultado global sigue sin declararse verde por los dos fallos unitarios existentes; la rama conserva su base por decisión explícita de Edwin.

Pendientes externos al cierre de Fleet T1: confirmación de Leslie del contrato, revisión humana y comprobación global de la combinación final antes de integrar. VIP no ofrecido está confirmado por Edwin; FLEET-06 y PR #37 están integradas. T2 se gestiona en su rama. No se enviaron mensajes a Leslie desde esta revisión ni se integró PR #44.
