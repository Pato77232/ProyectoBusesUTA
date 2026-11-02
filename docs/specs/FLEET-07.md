# FLEET-07: Marcar los asientos VIP de un bus

- **ID local:** FLEET-07; libre en las specs y ramas accesibles al comprobarlo el 2 de noviembre de 2026.
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `fleet`; lo consume `bookings` mediante la API pública de Fleet
- **Responsable:** Edwin
- **Revisor propuesto / confirmado:** Leslie propuesta, por consumir el inventario; sin confirmación registrada
- **Estado:** En desarrollo, T1 local sin commit; falta avisar a Leslie del cambio de contrato y revisión humana
- **Prioridad y dependencias:** depende de FLEET-02 y FLEET-03, en develop, y de FLEET-06, en `e37051e` sin publicar. T2 depende de la PR #37 de FLEET-05. Accesibilidad se trata en [FLEET-08](FLEET-08.md), como piden los acuerdos.
- **Rama / PR / base comprobada:** `feature/FLEET-07-T1-vip`, sobre `979fad4` el 2 de noviembre de 2026, que parte de FLEET-06 en `447fcce`; sin PR.
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
- Espacios accesibles: [FLEET-08](FLEET-08.md).
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
| Posición desactivada y marcada como VIP | T1 aplica la propuesta: se acepta y conserva `offered: false`; falta confirmarla |
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
2. Confirmar el caso de la posición desactivada y marcada como VIP.

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

**Evidencias (2 de noviembre de 2026, PostgreSQL aislado):** T1 sin commit. Lint sin errores y Prettier correcto en los archivos tocados. Integración: 280 de 280 aprobadas en 25 suites. Unitarias: 1074 aprobadas y 2 fallidas de 1076, las mismas de `publish-route-sheet.use-case.test.js`, ajenas a este cambio; por eso `npm test` no queda en verde y la integración se ejecutó aparte. Edwin autorizó cambiar en `bus.migration.test.js` el valor `VIP` por `OTRA`, porque esa prueba exigía el contrato anterior; la comprobación de rechazo se conserva.

## 14. Revisión y cierre

Pendientes. Próxima acción: avisar a Leslie del cambio de contrato, integrar FLEET-06 y conseguir revisión humana. T2 espera la PR #37.
