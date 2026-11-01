# FLEET-03: Consultar el catálogo base de plantillas de asientos

- **ID local:** FLEET-03; referencia local, sin ticket externo.
- **Módulo / alcance:** fleet / flota.
- **Responsable:** Edwin.
- **Revisor propuesto:** David, sin confirmación registrada. Leslie participa en el contrato de inventario posterior.
- **Estado:** En revisión, implementación funcional y validación local completadas; revisión humana pendiente. Edwin aprobó la spec el 30 de octubre y autorizó continuar con los incrementos restantes. Incluye distribuciones, puerto, caso de uso, endpoint protegido y composición. No implica integración ni cierre.
- **Fecha:** 30 de octubre de 2026, America/Guayaquil.
- **Prioridad:** dependencia del registro de buses [FLEET-02](FLEET-02.md).
- **Base examinada:** checkout `f26415d`; referencia origin/develop comprobada en `1d9381d` el 30 de octubre. No se integraron esos dos commits posteriores al checkout.
- **Rama de implementación:** `feature/FLEET-03-catalogo-plantillas`, creada sobre `f26415d` conservando los borradores locales FLEET-02/estado sin sobrescribirlos. No hay implementación de alta de buses en este cambio.
- **Autorización:** Edwin aprobó expresamente FLEET-03 el 30 de octubre; después pidió abrir PR y continuar con lo faltante de esta tarea. PR #26 abierta en borrador para revisión del incremento y su continuación. Los contratos de inventario real por bus/viaje con Leslie/David siguen pendientes y fuera de esta implementación.

## 1. Objetivo

Consultar tres distribuciones base reales que sirvan para elegir la plantilla durante el alta de un bus. Cada base describe asientos y espacios de servicios; no representa la ocupación de un viaje ni crea asientos de un bus todavía inexistente.

## 2. Reglas y decisiones confirmadas

- RN-01: autorización en backend.
- RN-02: no exponer configuración ni datos de buses de otra cooperativa.
- RN-12: distribución visual de uno/dos pisos y posiciones de asientos/servicios. Edwin confirmó solo asientos normales para estas tres bases el 30 de octubre de 2026. Este incremento no cubre VIP ni espacios para silla de ruedas y no acredita cumplimiento completo de RN-12; la regla permanece vigente y su cobertura restante requiere otra tarea.
- RN-40: un asiento físico se diferencia de su ocupación por viaje/tramo. Este catálogo no calcula disponibilidad ni administra reservas.
- Edwin seleccionó tres bases, confirmó el total y numeración 2+1 y aceptó adaptar posiciones por bus manteniendo sencilla la interfaz. Las respuestas y antecedentes están en FLEET-02, sección 8.

## 3. Alcance

**Incluye:** un único caso de uso de lectura, `ListSeatLayouts`, que devuelve las tres bases completas y ordenadas, con pisos, coordenadas, numeración y servicios; API pública de Fleet, un endpoint protegido y pruebas del catálogo/contrato.

**Fuera:** crear/editar/eliminar plantillas, editor gráfico, tipos VIP y espacios para silla de ruedas, carga de imágenes, registro de buses, persistir posiciones ofrecidas por bus, asientos UUID por bus, consulta de inventario de un bus real, viajes, tarifas, reservas, ocupación, cambios en cooperativas y pantallas. Estas funciones no se incorporan de paso.

Seleccionar/desactivar posiciones pertenece al alta posterior FLEET-02. Esta spec entrega la geometría para hacerlo; no crea esa configuración ni modifica buses existentes.

## 4. Flujo propuesto

1. Autenticar sesión y autorizar `COOPERATIVE_ADMIN` mediante la API pública de auth.
2. Ejecutar `ListSeatLayouts` con el catálogo inyectado.
3. Validar que las bases satisfacen las invariantes de la sección 5.
4. Devolver las tres bases en orden fijo; lectura sin escrituras, ocupaciones ni carga de datos ficticios de buses.

## 5. Catálogo y distribución

### Bases y orientación

| Código técnico propuesto | Base | Asientos |
|---|---|---|
| SINGLE_DECK_2_2 | Un piso 2+2 | 42 en piso 1 |
| DOUBLE_DECK_2_2 | Dos pisos 2+2 | 44 en piso 2 y 16 en piso 1: 60 |
| DOUBLE_DECK_2_1 | Dos pisos 2+1 | 34 en piso 2 y 12 en piso 1: 46 |

Se usa la orientación de las imágenes aportadas: frente arriba, parte posterior abajo, pares a la izquierda y asientos individuales 2+1 a la derecha, del lado de la escalera. Es una orientación del diagrama, no una afirmación adicional sobre la marcha del vehículo.

Referencias: imágenes de Flota Imbabura compartidas por Edwin el 29 de octubre. Se describe su distribución; no reutilizar marca, mascota, teléfono ni diseño publicitario. Los recuentos anteriores sustituyen las estimaciones iniciales de 36/42, no definen capacidades universales.

### Un piso 2+2

Once filas longitudinales. En las filas 1 a 10, cuatro asientos separados por el pasillo: para fila `r`, las etiquetas de izquierda a derecha son `4r-3`, `4r-2`, pasillo, `4r`, `4r-1`. Ejemplo primera fila: `1 2 | 4 3`; décima: `37 38 | 40 39`.

En la fila 11 solo hay asientos 41 y 42 a la izquierda; a la derecha se conservan minibar y baño. Los servicios no son asientos ni se cuentan en la capacidad.

### Dos pisos 2+2

- **Piso 2:** 12 filas. Fila 1: `1 2 | 4 3`. Filas 2 y 3: pares `5 6` y `7 8` a la izquierda; el lado derecho lo ocupa la escalera. Filas 4 a 12: cuatro asientos, con etiquetas `9 10 | 12 11` hasta `41 42 | 44 43`.
- **Piso 1:** conservar baño y escalera delante del bloque de cuatro filas de asientos. Filas de asientos: `45 46 | 48 47`, `49 50 | 52 51`, `53 54 | 56 55`, `57 58 | 60 59`. Mantener minibar central al final del pasillo y equipaje detrás del bloque, como referencia visual; sin inventar posiciones de asientos en esos espacios.

### Dos pisos 2+1

- **Piso 2:** conservar las mismas 12 filas y el espacio de escalera de las filas 2 y 3. Primera fila `1 2 | 3`; filas 2 y 3, pares `4 5` y `6 7`, sin asiento a la derecha. Desde fila 4: `8 9 | 10`, continuando secuencialmente hasta fila 12: `32 33 | 34`.
- **Piso 1:** cuatro filas `35 36 | 37`, `38 39 | 40`, `41 42 | 43`, `44 45 | 46`. Conservar los mismos espacios de baño, escalera, minibar y equipaje del esquema de dos pisos.
- Numerar de adelante hacia atrás, primero piso 2 y luego piso 1, sin asignar etiquetas a servicios ni dejar asientos ficticios en escaleras. Eliminar posiciones del lado derecho para formar 2+1 no desplaza los espacios de servicios.

### Modelo técnico propuesto

Cada base: `id` estable, `version`, `name` en español, `arrangement` (2+2/2+1), `capacity` derivada y `decks`.

Cada piso: número 1 o 2, orden de presentación explícito (piso 2 antes de 1 para dobles), dimensiones de cuadrícula y elementos posicionados por fila/columna. Cada elemento tiene `kind` (asiento, pasillo, escalera, baño, minibar o equipaje), clave estable dentro de la versión, coordenadas y extensión si ocupa varias celdas. Solo los asientos tienen etiqueta numérica y cuentan para capacidad. Las coordenadas son de diagrama; no medidas físicas certificadas.

Todos los elementos de tipo asiento de estas tres bases tienen categoría `NORMAL`, por decisión explícita de Edwin, sin inferir categoría por piso ni asignar características VIP/accesibilidad. Los servicios conservan su tipo y no se convierten en asientos normales.

Las claves de posición de la plantilla NO son los UUID de asientos por bus ni `seatIds` de un viaje. FLEET-02 generará identidades por bus con trazabilidad a base/versión/posición; la interfaz definitiva de inventario debe acordarse con Leslie y David. Dos buses con la misma base no comparten identidad de asiento.

Invariantes: posiciones únicas y dentro de la cuadrícula; servicios/asientos sin solapamientos; etiquetas únicas en toda la base, incluidos pisos; cantidad declarada igual al recuento; sin asientos sobre escaleras/pasillo/equipaje; lecturas deterministas sin mutaciones compartidas. Una versión publicada de base no se modifica silenciosamente al existir buses vinculados.

### Almacenamiento propuesto

Catálogo estático versionado en Fleet para estas tres bases, con un puerto de lectura inyectado. No agregar tablas ni migraciones solo para un catálogo sin edición en este incremento. Persistencia/vinculación por bus se define en FLEET-02; cambiar a catálogo editable necesitará otra tarea. Esta es una propuesta técnica pendiente de revisión, no una decisión colectiva ya aceptada.

## 6. Endpoint y API pública propuestos

| Método | Ruta | Rol | Respuesta |
|---|---|---|---|
| GET | /api/v1/seat-layouts | COOPERATIVE_ADMIN | 200 `{ "seatLayouts": [...] }`, 401 o 403 |

Respuesta completa con las tres bases; no añadir endpoint de detalle en esta tarea. La forma de cada entrada sigue la sección 5. GET no modifica estado ni requiere CSRF de mutación. Errores usan el formato central del proyecto. Fallo de catálogo/configuración debe propagarse; no devolver éxito con una lista vacía ni disponibilidad inventada.

API pública implementada en `fleet/index.js`: `seatLayoutQueries.list()` para consumidores internos de confianza/composición, devuelve una promesa de las tres bases. Esta lectura genérica no autentica un actor interno ni entrega inventario privado; el endpoint sí usa autenticación/autorización. Los consumidores no importan capas internas de Fleet.

El catálogo común de solo lectura contiene únicamente distribuciones genéricas, sin datos de cooperativas/buses. Esta propuesta no habilita lectura global de inventarios privados: las futuras consultas por bus deberán exigir el contexto autorizado de cooperativa y su pertenencia.

## 7. Criterios de aceptación

- [x] Dado un administrador operativo autenticado, recibe las tres bases completas en el orden de la tabla.
- [x] Sin sesión válida o con otro rol, se rechaza sin entregar catálogo; comprobar roles y sesiones revocadas/vencidas.
- [x] Los recuentos por piso y totales son 42, 44+16 y 34+12, calculados desde posiciones reales.
- [x] Las etiquetas, filas sin asiento individual y servicios coinciden con los esquemas de la sección 5.
- [x] La base 2+1 comienza `1 2 | 3` arriba y continúa `35 36 | 37` abajo; termina en 46 sin duplicados.
- [x] Las bases 2+2 conservan la numeración de las referencias, incluida la inversión visual del par derecho.
- [x] Claves/orden de lectura permanecen estables entre consultas; modificar un resultado no altera consultas posteriores.
- [x] Pasillos y servicios no cuentan como asientos ni tienen identidad de asiento reservable.
- [x] Cada asiento de las tres bases tiene categoría NORMAL; no se crean posiciones VIP ni espacios para silla de ruedas ni se confunden servicios con asientos.
- [x] No se crean buses, reservas, viajes ni tablas por consultar bases; no se incluyen ocupaciones ni datos privados.

## 8. Casos borde

Catálogo con etiqueta repetida entre pisos, asiento sobre escalera, elemento fuera de límites, recuento incorrecto o clave duplicada: fallo explícito de validación/configuración, sin respuesta parcial exitosa. Probar que un resultado manipulado por el consumidor no corrompa el catálogo. Las posiciones no ofrecidas por un bus no modifican una base compartida; ese comportamiento de configuración se verifica al implementar FLEET-02.

## 9. Pruebas esperadas

- Dominio/catálogo: recuentos, números exactos por fila, coordenadas, espacios de servicios y negativos de cada invariante. Usar distribuciones esperadas independientes; no comparar el catálogo consigo mismo ni solo aprobar su longitud.
- Aplicación: contrato del puerto, orden determinista, propagación de fallos y ausencia de mutaciones/escrituras.
- Integración HTTP: endpoint real, rol/sesión, formato y respuesta completa. Comparar las tres bases y filas significativas, no solo estado 200.
- Ejecutar la suite existente contra PostgreSQL aislado aunque esta lectura no necesite tablas nuevas; no debilitar ni omitir pruebas de migraciones o módulos ajenos.

## 10. Acuerdos pendientes y propuestas

| Tema | Participantes | Propuesta / próxima acción |
|---|---|---|
| Catálogo común, estático, versionado; nombres de API/modelo y rol de lectura | Edwin y revisor David | Revisar propuesta técnica de esta spec antes de implementar |
| Inventario por bus y viaje | Edwin, Leslie y David | Contrastar claves/UUID, cooperativa, bus y recorrido con BOOK-02 T2a y API real de viajes. El catálogo no sustituye TripCatalog ni lista por sí mismo asientos vendibles de un viaje |
| Tipos en este incremento | Edwin confirmó NORMAL para todos los asientos de las tres bases | Decisión cerrada para estas bases. VIP y silla de ruedas quedan fuera y pendientes de otra tarea para completar RN-12; no ampliar tipos sin su definición |
| Diagrama revisable | Edwin y David | Verificar las tres matrices antes de codificarlas; aprobar coordenadas de servicios sin exigir reproducir el diseño publicitario |

Confirmaciones humanas: distribuciones, numeración 2+1, adaptación sencilla y solo asientos normales confirmados por Edwin; ninguna respuesta de Leslie/David registrada. Revisar contratos no significa asignarles implementación ni aprobar por silencio. Mientras se resuelve el inventario compartido, puede revisarse el catálogo independiente; no conectar proveedores ficticios para adelantar reservas.

## 11. Defecto inducido

No aplica. Ningún defecto autorizado para esta tarea; seguir `docs/errores-inducidos.md`.

## 12. SOLID y usabilidad

Un caso de uso de lectura; datos/validación en dominio y catálogo concreto conectado por inyección. HTTP solo traduce/autentica. Puerto pequeño, retornos equivalentes en adaptador y dobles; sin dependencias HTTP/BD en dominio. No introducir un repositorio CRUD ni jerarquías sin necesidad.

Sin pantalla en esta tarea: no se declara usabilidad visual verificada. El contrato entrega nombres españoles, pisos y datos de posición para una pantalla posterior. Esa pantalla deberá permitir seleccionar base y activar/desactivar asientos con teclado, mostrar capacidad, distinguir no ofrecido de reservado/vendido y conservar etiquetas; su implementación no está incluida aquí.

## 13. Plan y evidencia

1. Revisar y aprobar el alcance de catálogo; cerrar preguntas aplicables sin ampliar a inventario/reservas.
2. Definir las tres matrices versionadas y su validación, con pruebas significativas.
3. Implementar `ListSeatLayouts` y puerto con pruebas, sin tocar otros módulos.
4. Exponer el único endpoint y API pública; coordinar edición de composición compartida. Verificar arranque real si se modifica composición.
5. Desde backend ejecutar `npm run lint`, `npm run format:check` y `npm test`; PostgreSQL aislado según `docs/testing-database.md`, sin leer `.env`. Reportar fallos reales y límites, no corregir módulos ajenos de paso.
6. Actualizar esta spec y solo las filas propias del estado. Proponer commit atómico `feat(flota): agrega consulta del catálogo de plantillas`, con referencia a esta spec; ejecutar commits solo por petición humana.

Preparación inicial del 30 de octubre: documentación y verificación de enlaces/diff. El ID local FLEET-03 no aparece en las specs de origin/develop comprobadas; no se inventa ticket externo ni aprobación colectiva.

Primer incremento autorizado: `domain/seat-layout.js` valida y devuelve copias profundamente inmutables con error explícito `INVALID_SEAT_LAYOUT`; `infrastructure/seat-layout-bases.js` define las tres distribuciones mediante datos deterministas; `tests/unit/fleet/seat-layout-bases.test.js` verifica matrices completas, servicios, numeración, capacidades y rechazos. No hay caso de uso público, endpoint, migraciones, dependencias nuevas ni cambios en otros módulos. Las claves de posición son internas de la plantilla, no UUID de asientos de un bus.

La representación técnica del primer incremento usa filas/columnas desde cero, pasillo en columna 2, pares en 0/1, par derecho 3/4 o individual en 3. Para pisos inferiores se representan servicios delante, cuatro filas de asientos, minibar y equipaje posteriores como cuadrícula lógica, sin afirmar medidas físicas. Las matrices implementadas y pruebas permiten su revisión humana.

Validación final del primer incremento, 30 de octubre de 2026:
- Prueba específica `seat-layout-bases.test.js`: 28 aprobadas.
- `npm run lint`: correcto.
- Formato de los dos archivos nuevos de producción y la prueba nueva: correcto.
- `npm run format:check`: fallido, 24 archivos existentes sin cambios en este incremento (router previo de Fleet, archivos de hojas de ruta y migraciones). No se reformatearon ni editaron migraciones.
- `npm test` con PostgreSQL 16.13 aislado, proyecto Docker `busesuta-fleet03-test`, puerto local 55433 y base `busesuta_test`: 592 unitarias y 116 de integración aprobadas, 708 en total. Contenedor saludable antes de la ejecución final; retirado al finalizar.
- Intentos anteriores: la ejecución restringida de unitarias tuvo 3 errores EACCES en pruebas HTTP de pagos; otro intento completo pasó unitarias pero falló integración al iniciarse antes de disponer de PostgreSQL. La repetición con acceso local y base saludable aprobó; no se modificaron ni debilitaron esas pruebas.
- `git diff --check`: correcto. Sin cambios de composición: no se acredita un endpoint nuevo ni se requiere validar arranque de uno inexistente. Revisión humana y pruebas de pantalla pendientes; no hay pantalla en este incremento.

## 14. Revisión y cierre

Continuación autorizada el 30 de octubre:
- PR de trabajo: https://github.com/Pato77232/ProyectoBusesUTA/pull/26, abierta como borrador antes de completar este incremento.
- Puerto `SeatLayoutCatalog.list`, adaptador estático y caso de uso `ListSeatLayouts`. El caso de uso valida copias inmutables, exige exactamente las tres bases, rechaza IDs ausentes/duplicados/desconocidos y mantiene su orden; propaga fallos sin catálogo vacío.
- `seatLayoutRouter` en Fleet con GET protegido por sesión/rol; montaje opcional en app.js sin alterar rutas anteriores ni server.js. `INVALID_SEAT_LAYOUT` de configuración se traduce a 500 genérico mediante el middleware central, sin detalles del catálogo.
- Prueba HTTP nueva arranca `start()` real de server.js sobre PostgreSQL aislado y un puerto disponible, con credenciales exclusivamente ficticias. Verifica sesión, roles, revocación/vencimiento, dos cooperativas, respuesta completa, ausencia de escrituras y error genérico. No se modificaron pruebas anteriores.
- Validación dirigida: 10 pruebas nuevas de aplicación/puerto y 10 de integración HTTP aprobadas; 63 pruebas unitarias de Fleet aprobadas incluyendo las 28 de matrices. El formato de todos los archivos de este incremento está correcto; lint correcto. Formato global sigue fallido en los mismos 24 archivos previos, sin modificaciones incidentales.

Validación final del endpoint, 30 de octubre: `npm test` aprobó 602 unitarias y 126 integraciones (728 en total) con PostgreSQL 16.13 aislado en busesuta-fleet03-test, puerto 55433. Incluye los 10 casos HTTP con arranque real, 10 nuevos de aplicación/puerto y 28 de matrices. Lint y formato de archivos del incremento correctos; formato global fallido en 24 archivos existentes que no se tocaron. Sin migraciones ni dependencias nuevas; base temporal retirada al finalizar.

Pendiente: revisión técnica humana. La aprobación de alcance de Edwin no sustituye revisión de otro integrante ni respuestas de Leslie/David. Sin integración de esta tarea. El catálogo es dependencia de FLEET-02; la consulta de asientos de buses reales será otro caso de uso. No marcar Integrada ni Cerrada por terminar la implementación.
