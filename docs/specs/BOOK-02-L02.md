# BOOK-02 / L-02: disponibilidad con fuentes reales

- **Planificación:** L-02; no es una spec aprobada ni un ID externo.
- **Spec existente:** [BOOK-02](BOOK-02.md).
- **Responsable:** Leslie Coello.
- **Revisor propuesto:** Pablo, conforme a la preferencia previa de Leslie; aceptación de este incremento pendiente. Coordinar contratos con los responsables indicados.
- **Estado:** Borrador; implementación de los nuevos incrementos no autorizada.
- **Base:** rama `feature/BOOK-03-resumen-creacion-dominio`, `c7ceed9`; remoto `origin/develop b60201e`, consultado el 1 de noviembre de 2026, sin integrar.
- **Autorización:** el usuario pidió preparar specs antes de implementar; no se infiere aprobación de este borrador.
- **Referencias:** [plan y evidencia](../reservas-plan-primera-entrega.md), [acuerdos vigentes](https://github.com/Pato77232/ProyectoBusesUTA/blob/b60201e/docs/acuerdos-primera-entrega.md), arquitectura y calidad del proyecto.

## 1. Objetivo

Continuar BOOK-02/T2a conectando el viaje fechado e inventario reales al cálculo existente, sin rehacer la política de solapamiento.

## 2. Reglas

RN-02/12/40. RESERVED y SOLD efectivos bloquean tramos superpuestos, incluida revisión del comprobante. Intervalos adyacentes reutilizan asiento.

## 3. Alcance

Contrato de catálogo, adaptador real y composición comprobada en incrementos separados. API y pantalla locales son evidencia previa; no activarlas como disponibilidad real antes de disponer del catálogo.

## 4. Flujo

Validar entrada → consultar catálogo público → validar identidad exacta del viaje, recorrido ordenado y posiciones → derivar cooperativa/asientos → consultar ocupaciones → calcular estados. Un fallo de proveedor se propaga; jamás significa inventario libre.

## 5. Datos y dependencias

Reutilizar [T2a](BOOK-02-T2a.md) y availability-ports.md. Ampliación de snapshot propuesta: identidad estable de viaje, hoja/asignación/bus/cooperativa, revisión de recorrido/inventario y condiciones de venta. David debe definir el contrato comercializable; route-sheets en develop devuelve router, no esa consulta. Fleet ya expone busQueries y seatLayoutQueries; su existencia no garantiza el snapshot histórico por hoja ni VIP/accesibilidad.

No admitir frecuencia como identidad sustituta del viaje; no aceptar cooperativeId, seatIds ni allocations del navegador. No consulta SQL de tablas ajenas.

## 6. Endpoints

GET /api/v1/bookings/availability ya existe localmente. No añadir otro endpoint ni presentarlo como productivo hasta conectar el proveedor y verificar servidor real. Mantener contrato de privacidad y errores.

## 7. Criterios de aceptación pendientes

- [ ] Viaje devuelto con otra identidad o recorrido/posición inválida se rechaza antes de leer ocupaciones.
- [ ] Asientos y cooperativa proceden del catálogo real.
- [ ] RESERVED/SOLD y revisión bloquean; adyacencia permite reutilización.
- [ ] Error/timeout del catálogo o lector produce error, nunca lista libre.
- [ ] Consulta sin datos personales y sin escrituras/expiración implícita.

## 8. Casos borde

Viaje no publicado o fuera de ventana conforme a reglas acordadas, asiento no ofrecido, inventario vacío, duplicados, recorrido cambiado, fallo técnico y mezcla de cooperativas. No decidir todavía límites comerciales inclusivos ni espacios accesibles como asientos normales.

## 9. Pruebas previstas

Conservar las 53 pruebas históricas T2a. Añadir contrato contra APIs reales y PostgreSQL: identidad/posiciones antes de lector, paradas repetidas identificadas por posición, adyacencia, superposición parcial, SOLD, revisión, fallo de cada proveedor y privacidad. Fixtures identificadas no acreditan la composición real.

## 10. Decisiones necesarias

David/Edwin/Leslie: identidad del viaje, recorrido/versionado, asientos ofrecidos, momento de congelación y regla de comercialización. Recomendación: puerto pequeño de lectura desde API pública de route-sheets, no nuevo módulo trips ni repositorio prestado. La firma interna findBookableById no obliga al proveedor a usar ese nombre. No interpretar la integración PR #33 como catálogo de viajes terminado.

## 11. Defecto inducido

No aplica. No introducir ni corregir incidentalmente defectos académicos; seguir errores-inducidos.md.

## 12. Diseño y usabilidad

Mantener get-seat-availability.use-case.js y puertos propios; adaptador en infraestructura y composición en index.js/server.js. Sin interfaz nueva hasta incremento 3; cualquier pantalla posterior se rige por L-06/DESIGN.md.

## 13. Incrementos y archivos previstos

1. Precisar availability-ports.md y contrato de proveedor; resultado: DTO y errores acordados.
2. Adaptador real y pruebas de contrato; reutilizar domain/availability-request.js y seat-availability.js.
3. Componer en bookings/index.js/server.js, verificar arranque, HTTP y luego selección visual de L-06.

Cada incremento necesita autorización y dependencias satisfechas. Lint, format:check, npm test desde backend con PostgreSQL aislado; arranque real al componer. No dependencias nuevas previstas.
## 14. Revisión y cierre

Revisión humana, autorización de incremento e integración pendientes. Ningún criterio futuro se marca aprobado por la existencia de este borrador. Evidencia documental de esta sesión en el plan; resultados de producto pendientes.


## Actualización de contrato — respuesta de David, 2 de noviembre de 2026

Fuente: respuesta de David transmitida por Leslie en este chat. David confirma viaje con identidad estable propia y propone routeSheets.tripQueries.findBookableById(tripId); sigue sin implementar. No sustituir tripId por frequencyId.

Condiciones comunicadas como acordadas por David: hoja/ciclo confirmado y publicado, frecuencia activa, bus asignado, máximo dos ciclos totales incluida la base, cierre de compra en el instante de embarque del punto seleccionado y disponibilidad por tramo a cargo de Bookings. Las condiciones no acreditan consulta productiva ya disponible.

Recorrido propuesto: puntos ordenados con posición, lugar y fechas/horas completas de llegada/salida donde correspondan; medianoche con fecha explícita. Búsqueda/cierre referidos al punto elegido. Falta cerrar DTO completo y errores.

Aspecto que debe resolverse antes de componer: findBookableById(tripId) no recibe posición ni tramo. Si admite venta en una parada después de salir del origen, la consulta no puede rechazar globalmente el viaje por la hora del origen. Propuesta: devolver condiciones/horarios por punto y validar el embarque elegido, o aceptar contexto de embarque en la consulta pública. Acordar con David; no cambiar una firma unilateralmente.

Inventario histórico asociado a hoja sigue pendiente con Edwin; busQueries no lo sustituye. Tarifario sí comprobado integrado en origin/develop 1fb0ade, PR #39: ver [actualización L-01](BOOK-05-L01.md). Leer precio publicado no equivale a validar identidad comercial de viaje ni asiento.

No se cambia el comportamiento de get-seat-availability ni se registra un adaptador ficticio. Pendientes contrato completo, proveedor real y evidencia de integración.

### Inventario FLEET-06 recibido — 2 de noviembre de 2026

Fuente: respuesta de Edwin reenviada por Leslie. Verificación independiente: commit 7d6353a incluido en origin/develop 7c150c7; rama publicada actualmente en 40adba1. PR #41 consultada; registrar estado remoto comprobado, no el «sin PR» del mensaje anterior.

API comprobada: fleet.seatQueries.listByBus({ busId, cooperativeId }), ambos UUID de contexto confiable, sin campos extra. Respuesta inmutable { busId, seats }; cada asiento incluye seatId UUID propio del bus, layoutSeatKey repetible entre buses, label, deck, row, column, category y offered. Orden: piso descendente y número de asiento. Hoy category solo NORMAL.

Adaptación propuesta para L-02: verificar busId de respuesta contra bus del viaje; validar DTO y unicidad de seatId; conservar orden y usar solo offered === true como inventario reservable. Guardar seatId, nunca layoutSeatKey como identidad. Offered false no significa RESERVED; Fleet no calcula ocupación. Un bus existente sin posiciones ofrecidas devuelve inventario sin oferta, no viaje inexistente ni asientos libres por sustitución.

Bus ausente o ajeno devuelve null; entrada inválida genera VALIDATION_ERROR antes de base; fallos técnicos se propagan. No convertir excepción en null o lista vacía. La cooperativa y el bus deben resolverse desde el viaje confiable.

Evaluación técnica: contrato suficiente para preparar un adaptador acotado de asientos NORMAL, pero no resuelve identidad/recorrido comercial del viaje ni configuración histórica por hoja. La estabilidad actual de seatId y ausencia de edición del bus no constituyen versionado por hoja. No se interpreta ningún asiento como VIP/accesible. Confirmación del contrato por Leslie, autorización del incremento y relación de programación siguen pendientes; esta nota no las inventa.

Pruebas previstas adicionales: dos buses con igual plantilla/clave y distintos seatId; offered false excluido sin confundir con ocupado; bus/tenant incorrectos, error del proveedor propagado y validación previa a ocupaciones. Se leyó código público, caso de uso, validador y SQL del proveedor; no se repitieron sus pruebas ni se integra código remoto en la rama de Leslie.
