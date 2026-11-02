# FLEET-06: Consultar los asientos de un bus

- **ID local:** FLEET-06; libre en las specs y ramas accesibles al comprobarlo el 1 de noviembre de 2026.
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `fleet`; lo consume `bookings` mediante la API pública de Fleet
- **Responsable:** Edwin
- **Revisor propuesto / confirmado:** Leslie propuesta, por ser quien consume el contrato; sin confirmación registrada
- **Estado:** T1 publicada en borrador en PR #41; falta confirmación de Leslie del contrato y revisión humana. Suite global no aprobada.
- **Prioridad y dependencias:** FLEET-02 y FLEET-04 (PR #29) presentes en develop. No depende del módulo de viajes.
- **Rama / PR / base comprobada:** `feature/FLEET-06-T1-lectura-asientos`, creada desde `origin/develop` en `1fb0ade` el 2 de noviembre de 2026; [PR #41](https://github.com/Pato77232/ProyectoBusesUTA/pull/41) en borrador hacia develop. La rama `feature/FLEET-06-consulta-asientos` conserva el borrador original sobre `b1e6720`.
- **Autorización de alcance:** el 1 de noviembre de 2026 Edwin pidió preparar esta spec para Leslie. El 2 de noviembre de 2026 Edwin pidió comenzar la implementación y, tras recibir el mensaje de Leslie, aprobó ajustar T1 a lo que ella pide.

## 1. Objetivo

BOOK-02 necesita saber qué asientos existen en un viaje. Su puerto `TripCatalog` debe entregar `seatIds` obtenidos del bus realmente asignado, pero Fleet aún no publica ninguna lectura de `bus_seats`. Esta tarea publica esa lectura para que Reservas use identidades reales y no datos ficticios.

Fleet responde qué asientos tiene un bus y cuáles ofrece. No sabe de viajes, tramos ni ocupación: eso sigue en Reservas.

## 2. Reglas de negocio involucradas

- **RN-02 y aislamiento multi-tenant:** la consulta filtra por cooperativa. Un bus ajeno se comporta como inexistente.
- **RN-12:** los asientos provienen de la plantilla copiada al registrar el bus.
- **RN-40:** la identidad estable del asiento permite que Reservas evite la doble ocupación. Fleet no la comprueba.

## 3. Alcance

**Incluye:**

- Un método de lectura en el puerto `BusRepository` y en `PgBusRepository`.
- Un caso de uso pequeño y `seatQueries` en el resultado de `createFleetModule`.
- Pruebas de contrato, aislamiento y orden.

**No incluye:**

- Endpoint HTTP o pantalla; la lectura es interna entre módulos.
- Adaptador `TripCatalog`, viajes, tramos, ocupación o precios.
- Diagrama con pasillos y servicios para la pantalla de asientos.
- Migraciones o cambios en `bookings`.

## 4. Flujo principal

1. Reservas resuelve el viaje y obtiene `busId` y `cooperativeId` desde su propia fuente confiable.
2. Reservas llama a `seatQueries.listByBus({ busId, cooperativeId })`.
3. Fleet filtra por bus y cooperativa y devuelve todos los asientos del bus con su condición `offered`.
4. Reservas toma como inventario vendible los asientos con `offered: true`, usa su `seatId` y calcula disponibilidad.

Ningún valor de esta consulta viene directamente del cliente.

## 5. Datos

Entrada: `{ busId, cooperativeId }`, ambos UUID. Fleet rechaza campos extra y formatos inválidos con un error de validación.

Salida propuesta:

```js
{
  busId: 'uuid',
  seats: [
    { seatId: 'uuid', layoutSeatKey: 'deck-2-0-0', label: 1, deck: 2, row: 0, column: 0,
      category: 'NORMAL', offered: true },
  ],
}
```

| Campo | Fuente | Garantía |
|---|---|---|
| `seatId` | `bus_seats.id` | UUID estable. No se reutiliza entre buses |
| `layoutSeatKey` | `bus_seats.layout_seat_key` | Clave de plantilla, repetida entre buses; no identifica al asiento |
| `label` | `bus_seats.label` | Número visible, único por bus. No se renumera |
| `deck` | `bus_seats.deck` | Piso 1 o 2 |
| `row`, `column` | `row_index`, `column_index` | Posición en el diagrama; no son medidas físicas |
| `category` | `bus_seats.category` | Hoy solo `NORMAL`. VIP requiere otra tarea y será un cambio del contrato |
| `offered` | `bus_seats.offered` | `false` si la cooperativa lo desactivó al alta; no se vende |

La lista y sus objetos son inmutables. No hay tablas ni migraciones nuevas.

## 6. Endpoints

No aplica. El contrato es la API pública de `backend/src/modules/fleet/index.js`:

| Método | Resultado | Fallos |
|---|---|---|
| `seatQueries.listByBus({ busId, cooperativeId })` | `{ busId, seats }` en orden de presentación | `null` si el bus no existe o es de otra cooperativa; error de validación si la entrada es inválida; errores de infraestructura se propagan |

## 7. Criterios de aceptación

- [x] Dado un bus con asientos no ofrecidos, cuando se consulta, entonces aparecen todos y los no ofrecidos llevan `offered: false`.
- [x] Dados dos buses con la misma plantilla, cuando se consultan, entonces comparten `layoutSeatKey` y no `seatId`.
- [x] Dado un bus de otra cooperativa, cuando se consulta, entonces la respuesta es igual a la de un bus inexistente.
- [x] Dadas dos consultas del mismo bus, cuando se comparan, entonces `seatId`, `label` y orden coinciden.
- [x] Dado un bus de dos pisos, cuando se consulta, entonces el piso 2 va primero y cada piso sigue la numeración.
- [x] Dado un bus con todos sus asientos no ofrecidos, cuando se consulta, entonces devuelve sus asientos con `offered: false` y no `null`.
- [x] Dado un fallo de base de datos, cuando se consulta, entonces el error se propaga y nunca se devuelve una lista vacía.
- [x] Dada la salida, cuando se inspecciona, entonces no contiene VIN, placa, fotografías ni datos de la cooperativa.

## 8. Casos borde y errores

| Caso | Comportamiento |
|---|---|
| UUID inválido | Error de validación; no se consulta la base |
| Bus sin asientos ofrecidos | Sus asientos con `offered: false`; si el viaje puede venderse lo decide quien lo gestiona |
| Asiento ya reservado o vendido | Fleet lo devuelve igual; no conoce la ocupación |
| Bus cambiado en un viaje con reservas | Fuera de alcance; depende del contrato de viajes |

## 9. Pruebas esperadas

- **Unitarias:** validación de entrada, orden e inmutabilidad, con repositorio simulado.
- **Integración con PostgreSQL aislado:** bus real con asientos no ofrecidos, aislamiento entre cooperativas y plantilla de dos pisos.
- **API pública:** `createFleetModule` expone `seatQueries`.

## 10. Preguntas abiertas

Las decisiones siguen abiertas salvo donde se indique. `docs/acuerdos-primera-entrega.md` §4 propone además un inventario con la condición de ofrecido y categorías VIP y accesibilidad, pendiente entre Edwin, David y Leslie y fuera de esta lectura.

### Decisión: ¿qué asientos forman el inventario?

- Estado: Decidida e implementada en `7d6353a`; falta la confirmación de Leslie del contrato resultante
- Fecha y participantes consultados: 2 de noviembre de 2026; Edwin y Leslie
- Reglas, specs y contratos afectados: RN-12, BOOK-02 y `TripCatalog`
- Opciones y recomendación: (A) devolver solo ofrecidos; (B) devolver todos con `offered`. Se recomendó A al redactar; se eligió B porque Reservas necesita conocer la condición de ofrecido.
- Respuesta humana y evidencia de confirmación: mensaje de Leslie reportado por Edwin, que pide la condición de ofrecido; Edwin aprobó el ajuste
- Decisión y justificación: B; `seatQueries.listByBus` devuelve todos los asientos con `layoutSeatKey` y `offered`, y Reservas solo vende los que tengan `offered: true`
- Responsable de aplicarla y revisor: Edwin; Leslie propuesta
- Criterios de aceptación/pruebas que cambian: primer criterio de la sección 7
- Trabajo dependiente e independiente: depende esta spec; BOOK-02 T1 no depende
- Decisión anterior que reemplaza, si aplica: ninguna

### Decisión: ¿la consulta incluye los datos del diagrama?

- Estado: Propuesta
- Fecha y participantes consultados: pendiente; Edwin y Leslie
- Reglas, specs y contratos afectados: RN-12 y BOOK-02 T4
- Opciones y recomendación: (A) solo asientos con piso y posición, como en la sección 5; (B) agregar pasillos, escaleras y servicios del snapshot; (C) solo `seatId`. Se recomienda A ahora y tratar B en la tarea de la pantalla de asientos, cuando se conozca lo que necesita.
- Respuesta humana y evidencia de confirmación: pendiente
- Decisión y justificación: pendiente
- Responsable de aplicarla y revisor: Edwin; Leslie propuesta
- Criterios de aceptación/pruebas que cambian: sección 5
- Trabajo dependiente e independiente: BOOK-02 T4 depende; T2a no
- Decisión anterior que reemplaza, si aplica: ninguna

### Decisión: ¿cómo se relacionan las reservas con `bus_seats`?

- Estado: Propuesta
- Fecha y participantes consultados: pendiente; Edwin y Leslie
- Reglas, specs y contratos afectados: RN-40, BOOK-03 y `docs/architecture.md`
- Opciones y recomendación: (A) guardar `seatId` como UUID sin clave foránea, validándolo con esta consulta; (B) clave foránea a `bus_seats.id`. `docs/architecture.md` regula las dependencias de código, no las claves foráneas entre módulos. Sin recomendación firme: B da integridad en la base y A deja menos acoplados los módulos. La respuesta no cambia esta consulta, pero Fleet debe saber si alguna vez podrá eliminar asientos.
- Respuesta humana y evidencia de confirmación: pendiente
- Decisión y justificación: pendiente
- Responsable de aplicarla y revisor: Leslie; Edwin como consultado
- Criterios de aceptación/pruebas que cambian: ninguno en esta spec
- Trabajo dependiente e independiente: BOOK-03 depende; esta spec no
- Decisión anterior que reemplaza, si aplica: ninguna

### Otras preguntas

1. **Origen de `busId`:** aún no existe la relación de viaje fechado con bus. Hace falta saber quién la publica; participan Leslie y David. Esta spec no depende de la respuesta.
2. **Boleto:** Shirley puede necesitar `label` y `deck` para imprimirlos. Conviene confirmar si Reservas los copia al vender.
3. **Revisora:** confirmar que Leslie acepta revisar.

**Mensaje sugerido para Leslie:** «Leslie, FLEET-06 expone `seatQueries.listByBus({ busId, cooperativeId })`, que devuelve todos los asientos del bus con `seatId`, `layoutSeatKey`, número, piso, posición, categoría y `offered`. ¿Te sirve este contrato? Versión por hoja, VIP y accesibilidad siguen pendientes.» No hay envío registrado en esta spec.

### Respuesta de Leslie recibida el 2 de noviembre de 2026

Mensaje de Leslie reportado por Edwin: necesita identificador propio del asiento distinto de la clave de plantilla, condición de ofrecido, categoría NORMAL/VIP, consulta de la versión de inventario usada por una hoja, identificación de espacios accesibles y el comportamiento ante bus inexistente, ajeno o fallo. Su pedido motivó reemplazar la opción A del borrador. Edwin aprobó ajustar T1: se adoptó la opción B (todos los asientos con `offered`), se agregó `layoutSeatKey` y la función pasó a `listByBus`; estos cambios están implementados en `7d6353a`. Falta que Leslie confirme el contrato resultante. Quedan pendientes y fuera de T1 la versión de inventario por hoja (con David), VIP y espacios accesibles; hoy ningún asiento se identifica como accesible.

## 11. Defecto inducido

No aplica.

## 12. Diseño SOLID y usabilidad

- **Responsabilidades:** Fleet es dueño de la identidad del asiento; Reservas, de la ocupación. Reservas consume solo la API pública de `index.js`.
- **Segregación:** `seatQueries` expone un método y no da acceso al repositorio ni a datos del bus.
- **Abstracción:** no se crea un adaptador nuevo sin necesidad; se extiende el repositorio de buses.
- **Usabilidad:** no hay interfaz en este alcance, por lo que no se verifica.

## 13. Plan y evidencias

| Paso | Resultado comprobable | Archivos compartidos |
|---|---|---|
| T1: lectura en Fleet | `seatQueries.listByBus` probado contra PostgreSQL aislado | `bus.repository.js`, `pg-bus.repository.js` e `index.js`, también tocados por FLEET-04 T1 |

Una sesión basta. Leslie implementa aparte el adaptador `TripCatalog`.

**Evidencias (2 de noviembre de 2026, PostgreSQL aislado):** `seatQueries.listByBus` guardado en el commit `7d6353a`; devuelve todos los asientos con `layoutSeatKey` y `offered`.

- **Pruebas de FLEET-06:** 21 de 21 aprobadas (13 unitarias y 8 integraciones). `npm run lint` sin errores y Prettier correcto en los archivos tocados.
- **Suite global: no aprobada.** Las causas no se atribuyen a Fleet mientras no se investiguen.
  - Unitarias: 1066 aprobadas y 2 fallidas de 1068, ambas en `publish-route-sheet.use-case.test.js`. `src/modules/route-sheets` y sus pruebas unitarias son idénticos a `origin/develop` en `1fb0ade`; el caso de uso exige `tariffRepository` y la prueba no lo entrega.
  - Integración: la ejecución anterior registrada aprobó 275 de 275 en 24 suites. La repetición realizada por Codex al revisar el mismo código el 2 de noviembre terminó con 274 aprobadas y una fallida en 24 suites: `tests/integration/user-cooperative-integrity.test.js`, caso «datos previos incompatibles (null) hacen fallar up sin pérdida ni restricciones parciales», superó el límite de 20 000 ms. Usó PostgreSQL 16.13 efímero exclusivo con puerto dinámico y base `busesuta_test`, sin leer `.env`; el contenedor fue eliminado. La ejecución aprobada anterior no anula este fallo; su causa no se atribuye a Fleet sin investigarla.
  - Formato global de la revisión de Codex: fallido en 17 archivos ajenos al incremento; formato de los siete JS de Fleet tocados aprobado. Los tres fallos iniciales EACCES de HTTP local desaparecieron al repetir las unitarias con acceso permitido; permanecieron los dos fallos de hojas de ruta indicados arriba.

Repetición dirigida del 2 de noviembre de 2026 sobre PostgreSQL aislado: `user-cooperative-integrity.test.js` aprobó 8 de 8 en tres ejecuciones seguidas, unos 45 s cada una, y el archivo es idéntico a `origin/develop`. Sugiere un fallo intermitente, sin demostrarlo ni explicar su causa; el timeout sigue sin resolverse y no se amplió el límite.

La revisión documental posterior no cambió código ni pruebas desde `7d6353a`; no se repitieron suites para estos cambios exclusivamente documentales. Implementación asistida por Claude Code; revisión y preparación de publicación asistidas por Codex. La PR se prepara en borrador para acordar el contrato, sin declarar aprobación de Leslie ni integración.

## 14. Revisión y cierre

Pendientes. Los criterios de la sección 7 están cubiertos por pruebas; eso no equivale a revisión humana. Antes de integrar: confirmación de Leslie, revisión humana y suite global en verde, que depende de corregir `publish-route-sheet.use-case.test.js` y de investigar el timeout sin debilitar la prueba ni ampliar su límite incidentalmente.
