# BOOK-05 / L-01: cotización con política de hoja

- **Planificación:** L-01; no es una spec aprobada ni un ID externo.
- **Spec existente:** [BOOK-05](BOOK-05.md).
- **Responsable:** Leslie Coello.
- **Revisor propuesto:** Pablo, conforme a la preferencia previa de Leslie; aceptación de este incremento pendiente. Coordinar contratos con los responsables indicados.
- **Estado:** cálculo puro configurable implementado y verificado localmente (§16); revisión humana pendiente. Conexión comercial y acreditación productiva pendientes.
- **Base histórica:** rama `feature/BOOK-03-resumen-creacion-dominio`, `c7ceed9`; remoto `origin/develop b60201e`, consultado el 1 de noviembre de 2026. Base vigente del siguiente incremento: §15.
- **Autorización:** preparación inicial documental; continuación y decisiones de Leslie permiten únicamente el cálculo puro de §16. No autoriza conectar compra ni acredita revisión humana del resultado.
- **Referencias:** [plan y evidencia](../reservas-plan-primera-entrega.md), [acuerdos vigentes](https://github.com/Pato77232/ProyectoBusesUTA/blob/b60201e/docs/acuerdos-primera-entrega.md), arquitectura y calidad del proyecto.

## 1. Objetivo

Cotizar cada pasajero con la tarifa explícita del par subida/bajada y los porcentajes congelados en su hoja. Sustituir el 50 % fijo como autoridad de la nueva política sin borrar evidencia de la política anterior.

## 2. Reglas

RN-02/12/43; USD, centavos enteros y mitad hacia arriba una vez al final por pasajero. VIP antes del beneficio. Menor de 18 y tercera edad desde 65 en la salida; discapacidad acreditada. Leslie confirma aplicar solo el mayor porcentaje elegible, sin acumulación.

## 3. Alcance

Adaptar cálculo y resumen por incrementos. No configurar tarifas en módulos ajenos, inventar acreditación ni activar compra mientras falten proveedores reales.

## 4. Flujo

Resolver viaje/hoja y revisión de política en servidor → obtener tarifa exacta del par y categoría real del asiento → resolver acreditación → calcular → devolver desglose y revisión para aceptación. BOOK-03 revalida antes de persistir. No sumar precios consecutivos para inventar una tarifa ausente ni usar 50 % como valor por defecto.

## 5. Datos propuestos

Contrato a cerrar con David/Edwin: viaje, hoja/asignación, revisión de política congelada, par de posiciones y tarifa en centavos; inventario con asiento/categoría/versionado; porcentajes VIP y de cada beneficio, con escala y límites explícitos. El comprador no aporta esos datos como autoridad.

Salida propuesta: moneda, referencia/revisión de política, base, porcentaje VIP, porcentaje y categoría del beneficio aplicado, importes exactos previos al redondeo y total final entero. Definir representación racional interna y cómo conciliar base + recargo - beneficio = total en el desglose entero, sin redondear la fórmula intermedia ni ocultar residuos. La regla de reparto del residuo requiere aprobación en el contrato.

## 6. Endpoints

Ningún endpoint nuevo en el primer incremento de cálculo. Reutilizar posteriormente POST /api/v1/bookings/summary, ampliando su contrato antes de conectarlo. Identidad/CSRF permanecen en backend.

## 7. Criterios de aceptación pendientes

- [ ] Dada una tarifa A→C diferente de A→B + B→C, se usa exclusivamente A→C.
- [ ] Dado un asiento VIP, el beneficio opera sobre el importe con recargo.
- [ ] Dados varios beneficios elegibles, solo se usa el mayor porcentaje; desempate documentado.
- [ ] Dadas dos hojas con porcentajes distintos, cada salida conserva los de su propia hoja; cambiar configuración no reescribe reservas previas.
- [ ] Un importe de centavo y un empate exacto de mitad redondean correctamente al final; el desglose se reconcilia.
- [ ] No acreditar beneficios por cédula válida o declaración del navegador.

## 8. Casos borde

Cumpleaños de 18/65 en la salida y cambio de día en embarque; 29 de febrero según contrato de fecha; tarifa/configuración ausente o malformada, desbordamiento, porcentajes fraccionarios, porcentajes en límites aún por acordar, dos categorías con porcentaje igual. Fallar explícitamente ante datos insuficientes.

## 9. Pruebas previstas

Nuevas pruebas del contrato configurado: tabla de importes exactos aprobados, centavo mínimo, mitad, VIP y mayor beneficio, edades inmediatamente antes/en/después de 18/65, hojas distintas y resumen alterado. Conservar pruebas históricas; no sustituyen las nuevas. Integración posterior con hoja real y revalidación de BOOK-03.

## 10. Decisiones necesarias antes del incremento de cálculo

- **Acordada por Leslie, 1 de noviembre, respuesta en este chat:** mayor beneficio sin acumular. No atribuir confirmación a Shirley/David.
- **Confirmado por Leslie, 2 de noviembre:** acreditar antes del total aceptado y pago. Una estimación previa no es resumen final. **Pendiente con Shirley:** quién verifica, evidencia, registro y tratamiento de denegación/corrección.
- **Contrato de David recibido y comprobado el 2 de noviembre:** unidad/límites de porcentajes, congelación al publicar, revisión y API de tarifa explícita definidos en la actualización inferior. Desempate confirmado por Leslie el 2 de noviembre: aplicar una vez y conservar todas las categorías empatadas en el máximo; aprobación de la implementación de L-01 pendiente.
- **Pendiente, Leslie/David/Edwin:** fecha de edad aplicable al embarque que cruza medianoche y categoría versionada del asiento. No inventar una API disponible.

## 11. Defecto inducido

No aplica. No introducir ni corregir incidentalmente defectos académicos; seguir errores-inducidos.md.

## 12. Diseño y usabilidad

Cálculo puro en domain; aplicación obtiene puertos confiables; infraestructura adapta solo APIs públicas. Sin interfaz nueva en el incremento 2. El resumen visual posterior se delimita en L-06 y aplica DESIGN.md; no afirmar QA visual aquí.

## 13. Incrementos y archivos previstos

1. Cerrar decisiones y especificar ejemplos monetarios; solo documentación de BOOK-05 y contratos. Resultado: tabla aprobada y acreditación definida.
2. Cálculo configurado con pruebas propias: domain/passenger-quote.js o servicio versionado adicional y tests/unit/bookings. Elegir compatibilidad sin reducir pruebas históricas.
3. Conectar a resumen/revisión: domain/booking-summary.js, application y adaptador real; pruebas de cambio de hoja y precio. Solo tras disponer del proveedor.

Antes de cada implementación autorizar el incremento en esta spec. Ejecutar lint, format:check y npm test desde backend, PostgreSQL aislado si interviene persistencia y arranque real si cambia composición. Sin nueva dependencia prevista.
## 14. Revisión y cierre

Revisión humana, autorización de incremento e integración pendientes. Ningún criterio futuro se marca aprobado por la existencia de este borrador. Evidencia documental de esta sesión en el plan; resultados de producto pendientes.


## Actualización de contrato — respuesta de David, 2 de noviembre de 2026

Fuente humana: Leslie pega en este chat la respuesta de David. No se atribuye aprobación de código a Leslie. Comprobación independiente: rama origin/feature/tarifario-hojas-ruta-spec en 43a0a30; commit incluido en origin/develop 1fb0ade mediante [PR #39](https://github.com/Pato77232/ProyectoBusesUTA/pull/39), merged según GitHub. Esta rama local sigue en c7ceed9; no se incorporó el código remoto.

### Contrato de tarifa confirmado por David y contrastado con código

- API pública: routeSheets.tariffQueries.findPublishedByRouteSheetId(routeSheetId, cooperativeId).
- Precio concreto: routeSheets.tariffQueries.findPrice({ routeSheetId, cooperativeId, frequencyId, fromPosition, toPosition }).
- Posiciones desde cero, hacia adelante; precio explícito por par, sin sumar tramos.
- findPrice devuelve routeSheetId, cooperativeId, busGroupId, frequencyId, posiciones, revision, currency USD, amountCents y policy.
- policy contiene vipSurchargeBps, minorDiscountBps, seniorDiscountBps, disabilityDiscountBps y discountStrategy MAX_ELIGIBLE. Cada porcentaje es entero entre 0 y 10000 bps: 100 equivale a 1 %, 125 a 1,25 %. Cero debe figurar explícitamente. Importes de tarifa positivos hasta 9 999 999 999 centavos, conforme al validador publicado; los límites de totales resultantes se definirán en el cálculo de Bookings.
- Congelación al publicar por COOPERATIVE_ADMIN, en la misma transacción que publica la hoja. revision identifica la versión comercial congelada; schemaVersion: 1 en el snapshot completo identifica el formato, no otra política.
- Null para copia publicada autorizada ausente, frecuencia o par ausentes; entrada inválida produce error y fallos técnicos/snapshot corrupto se propagan. No sustituir por cero ni 50 % ni tarifa derivada.
- El consumidor verifica el contexto de cooperativa desde el viaje y servidor. La consulta no autentica por sí sola peticiones del navegador ni prueba comercialización del viaje.
- Aplicar VIP antes del mayor beneficio acreditado coincide con lo confirmado por Leslie. Desempate propuesto por David y confirmado por Leslie el 2 de noviembre: aplicar una vez y conservar todas las categorías elegibles empatadas en el porcentaje máximo. No implementado en Bookings.

### Pendientes que permanecen

Acreditación y momento de revisión con Shirley; contrato real de viaje/asiento y fecha de edad ante cambio de día; representación exacta y conciliación del desglose. Las precisiones de porcentajes, unidad y congelación de §10 quedan resueltas por el contrato de David, sin reabrirlas como preguntas.

Ejemplo de cálculo para revisar, no prueba ejecutada ni aceptación monetaria: base 450 centavos, VIP 2500 bps, beneficio 5000 bps → importe exacto 281,25 centavos → total 281 centavos con mitad hacia arriba al final. Evitar convertir a punto flotante como autoridad y no redondear 562,5 antes de aplicar beneficio.

### Evidencia y límites

Se leyeron create-tariff-queries.js, validadores y ROUTE-SHEETS-05 §13 de la rama/remoto. David registra 110 pruebas dirigidas aprobadas; la misma entrega documenta fallos globales (pruebas antiguas incompatibles, busboy ausente, timeout de fotos), Node 22 frente a 24 requerido y arranque bloqueado en su entorno. Integrada no significa validación global aprobada. No se repitieron esas pruebas en esta sesión documental.

Siguiente incremento: completar acreditación/desempate/desglose y autorizar cálculo puro, sin esperar pantallas de otros módulos. Adaptador productivo y compra siguen sujetos al viaje real e inventario versionado.
## Confirmación de Leslie — beneficios empatados, 2 de noviembre de 2026

Respuesta humana en este chat: «Sí, conservar las categorías empatadas». Se aplica una sola vez el mayor porcentaje acreditado y se conservan en el desglose todas las categorías elegibles empatadas en ese máximo. No se elige una categoría arbitraria ni se acumulan descuentos. Esta confirmación cierra el desempate; no autoriza todavía implementación ni resuelve acreditación, representación exacta y conciliación del desglose.

Prueba prevista: dos o más categorías acreditadas con igual porcentaje máximo producen el mismo importe que un único beneficio y ambas categorías quedan identificadas; las categorías con porcentaje inferior no se presentan como empatadas en el máximo. El caso con cero explícito deberá distinguir elegibilidad de reducción monetaria sin inventar acreditación.
### Adjuntos de Shirley recibidos — 2 de noviembre de 2026

Se revisaron mensaje y PAGOS-01/02/CORR-01/CAJA-01 recibidos de Leslie. [Conciliación y propuestas pendientes](../reservas-contrato-pagos-revision.md). La rama de Shirley y sus cambios posteriores a 4e6bbf7 son locales según su reporte; no se verificó código ni se repitieron pruebas. No presentar versiones, contexto autorizado o APIs de Bookings como implementados. Acreditación previa al total aceptado y consecuencias de corrección son propuestas pendientes de respuesta humana; las ventanas 3/15 minutos y efectivo sin archivo ya constan en PR #35. No autoriza implementación.
### Acreditación: confirmación de Leslie, 2 de noviembre de 2026

Respuesta humana en este chat: «Sí, verificar antes del total aceptado». Se acepta la propuesta de Shirley de acreditar antes de que el comprador acepte el total y pague. Una estimación anterior no equivale a resumen final aceptado ni autoriza pago con beneficio sin verificar. Esta confirmación reemplaza el pendiente sobre el momento de acreditación; siguen pendientes autoridad verificadora, evidencia, registro y acceso privado. No autoriza una integración ficticia ni acredita implementación. Los demás acuerdos de versiones, correcciones y efectivo propuestos siguen pendientes.
## Tabla de cotización preparada — 2 de noviembre de 2026

[Ejemplos numéricos y casos previstos](../reservas-cotizacion-ejemplos.md). Preparación solicitada por Leslie; tabla todavía para revisión, no autoriza implementación. Incluye 24 casos monetarios exactos, seis fronteras calculadas de edad, siete escenarios adicionales de edad/acreditación, ocho de hoja/inventario, dos de compra con varios pasajeros y doce entradas inválidas/ausencia de datos. Los identificadores C/A/H/R/E solo etiquetan filas locales, no tickets externos.

Verificación aritmética de esta sesión: 24 resultados exactos/redondeados contrastados con enteros racionales y, de forma independiente, decimal de .NET; 23 totales además comparados con expectativas escritas antes del cálculo. Se verificaron seis edades y la suma de redondeos por pasajero. No es ejecución de código ni pruebas funcionales del módulo. Las pruebas históricas permanecen intactas.

Propuesta pendiente de desglose: conservar componentes exactos y ajuste explícito de redondeo junto al total entero, o acordar reparto del residuo si los componentes deben ser enteros. Resultado cero y techo de total requieren precisar el flujo comercial; no cambiar matemática para exigir comprobantes ficticios. Siguen pendientes acreditador/evidencia y fecha de edad ante medianoche. La tabla no habilita inventario VIP ni implementación de L-01.

## 15. Preparación después de PR #70 — 4 de noviembre de 2026

Leslie solicita continuar con el siguiente paso recomendado: completar esta propuesta antes de implementar la nueva cotización. PR #70 integrada en develop ae88e0c694bedcfa384386548d2ba40cd193669a, comprobado con GitHub y fetch. Rama nueva feature/BOOK-05-cotizacion-configurable desde ese commit; árbol inicial limpio. Consulta de PR abiertas sin resultados; no acredita acceso a trabajo local de otros integrantes.

La preparación documental no autoriza acreditaciones ficticias, cambios de negocio ni conexión de compra. Se conserva passenger-quote.js y sus pruebas históricas de 50 %, sin tratar ese porcentaje como autoridad de la política nueva. No migraciones ni dependencias nuevas; sin frontend en este incremento (DESIGN.md no aplica hasta la tarea de pantalla).

### Datos disponibles y brecha confirmada

findBookableForSegment ya entrega amountCents, currency, policy, boardingAt, relaciones/revisiones y seatIds del inventario congelado. El DTO de evaluate-commercial-trip.js no entrega las categorías de esos asientos. El snapshot interno conserva categorías, pero Bookings no puede leerlo importando internals ni consultar Fleet actual como sustituto histórico.

Propuesta a David, todavía no confirmada: ampliar aditivamente la consulta pública con seats, lista de {seatId, category} correspondiente exactamente al mismo snapshot/oferta de seatIds. Mantener inventorySnapshotId e inventoryRevision; definir validación de correspondencia única y categoría desconocida. No inferir NORMAL de un ID ni aceptar VIP del navegador. Este cambio pertenece al contrato y spec de Route Sheets; no se implementa aquí ni se le atribuye aceptación a David.

### Propuesta de desglose exacto

Conservar basePriceCents y totalPriceCents como enteros. Para los componentes exactos y ajuste, proponer racionales {numerator: texto entero, denominator: texto entero positivo}, sin BigInt en JSON ni decimales binarios. El ajuste puede ser negativo. Unidades: centavos; identidad: base + recargo - descuento + ajuste = total entero. No redondear cada componente ni repartir residuos sin acuerdo.

Ejemplos y representación candidatos: [tabla y propuesta de conciliación](../reservas-cotizacion-ejemplos.md). La representación es decisión técnica propuesta; aceptar esta documentación no significa aceptar el flujo comercial de total cero ni los límites de compra.

### Edad y acreditación: decisiones pendientes

Propuesta para confirmar con Leslie y coordinar con David: calcular edad en la fecha local del embarque elegido, obtenida del instante confiable y zona comercial explícita; no usar UTC por recorte, reloj del navegador ni salida del origen si el pasajero sube después. Mantener la convención histórica del 1 de marzo para nacidos el 29 de febrero en años no bisiestos solo si se confirma su aplicación nueva. No deducir una zona comercial de un offset de serialización UTC.

El acuerdo de primera entrega ya menciona revisión de documentos por oficinista antes de aprobar. Falta precisar cómo se produce y consulta esa acreditación antes del total aceptado/pago, sin usar una futura aprobación del comprobante como prueba previa circular. No se reabre el acuerdo de verificar antes de aceptar el total; concretar con Shirley/Pablo evidencias, autoridad verificada, registro/revisión, acceso, vigencia y revocación. El body o una cédula válida no acreditan beneficios.

Consultas de confirmación enviadas a Leslie mediante este chat: desglose, fecha/convención de edad y procedimiento de acreditación. Respuesta aún pendiente al preparar esta versión; no se registra aceptación por silencio.

### Incrementos siguientes y comprobación

1. Cerrar desglose/edad/acreditación y contrato público de categorías, con ejemplos y fuentes de decisión. Resultado actual: propuesta y brechas explícitas.
2. Después de cerrar los requisitos del cálculo y autorizar ese alcance: servicio puro nuevo con porcentajes configurados, exactitud/rangos, máximo/empates y pruebas propias; mantener evidencia y pruebas históricas. No conectarlo a compra mientras falten acreditación o categorías confiables.
3. Conectar resumen al viaje/tarifa/inventario/acreditación reales y después revalidación de creación en BOOK-03, con rechazo de cambios que requieran nueva aceptación. Cada conexión tendrá su alcance autorizado.

Verificación de esta preparación: 24 ejemplos monetarios contrastados con Fraction de Python, incluidos componentes exactos, mitad hacia arriba y conciliación con ajuste. No equivale a pruebas del producto. Sin cambios funcionales no se ejecutan de nuevo npm test, PostgreSQL, lint o arranque; los 2430 tests anteriores pertenecen exclusivamente a la conciliación de PR #70. [Evidencia actual](../evidence/BOOK-05-L01/2026-11-04-preparacion-cotizacion.md). Sin commit/push en esta preparación; revisión humana pendiente.

## 16. Decisiones confirmadas y alcance del cálculo puro — 4 de noviembre de 2026

Fuente: respuestas de Leslie en este chat. Confirma ambas reglas consultadas: desglose exacto con ajuste explícito; edad en fecha local del embarque elegido y 1 de marzo para nacidos el 29 de febrero en años no bisiestos. Leslie declara que decide el procedimiento y confirma después la propuesta concreta: oficinista de la cooperativa verifica documento de identidad/nacimiento para edad y documento acreditativo para discapacidad antes del total aceptado; registro de resultado, beneficio, referencia privada de evidencia, actor, fecha y versión. El comprador solo consulta resultados de sus pasajeros. Revisión del comprobante posterior e independiente. No se atribuye revisión individual de código a Shirley/Pablo.

La petición de continuar con lo pendiente, seguida de estas decisiones, permite ejecutar el incremento 2 de §15: solo cálculo puro con pruebas, sin habilitar resumen/compra ni implementar almacenamiento o pantallas de acreditación. La integración de acreditación requiere después su contrato técnico, acceso, vigencia/revocación y tratamiento de correcciones. Catálogo público de categorías y zona comercial siguen pendientes; no se simulan como disponibles.

### Contrato interno seleccionado

Archivo nuevo domain/configured-passenger-quote.js. Entrada cerrada {basePriceCents, seatCategory, policy, passenger, boardingDate}. Tarifa explícita única 1..9999999999 centavos, no lista de tramos. seatCategory NORMAL/VIP obtenida del snapshot confiable en la futura integración. policy contiene exactamente vipSurchargeBps, minorDiscountBps, seniorDiscountBps, disabilityDiscountBps (enteros 0..10000) y discountStrategy MAX_ELIGIBLE. passenger contiene birthDate acreditada y disabilityVerified booleano explícito. boardingDate es fecha calendario local de embarque resuelta por el servidor, no instante UTC ni fecha enviada como autoridad por navegador.

La función es matemática, no acredita identidades, no otorga permisos ni guarda reservas. Sin exportación por la API pública HTTP. Reutiliza únicamente ageOnDate del dominio histórico (no su fórmula de precio). Registra todas las categorías elegibles y las empatadas en el mayor bps; si el máximo explícito es cero conserva elegibles/empates con discountBps cero, sin presentar ahorro inexistente.

Salida USD: basePriceCents, vipSurchargeBps aplicable (cero para NORMAL), discountBps, eligibleCategories, appliedBenefitCategories, vipSurchargeExactCents, discountExactCents, totalExactCents, roundingAdjustmentCents y totalPriceCents. Componentes racionales reducidos con numerador/denominador de texto; total entero. Entrada y salida inmutables desde el consumidor: no mutar entrada, congelar salida/arrays/racionales. Validación falla con BookingValidationError; ausencia de porcentaje o acreditación no equivale a cero/false.

Usar BigInt para productos y redondear una sola vez al final por pasajero. El total matemático cero es válido en este cálculo; no habilita venta gratis ni exige comprobante ficticio. El techo matemático derivado (19999999998) cabe en entero seguro, no representa un límite comercial de compra aprobado. Política/hoja/revisiones serán responsabilidad del adaptador futuro; el cálculo no inventa referencias. Mantener passenger-quote.js, sus pruebas y evidencia intactos.

### Criterios y comprobación del incremento

- C01–C24: valores exactos y redondeados escritos previamente; mitad/adyacentes, VIP antes del beneficio, máximo/empates, ceros y productos mayores que MAX_SAFE_INTEGER.
- Edades antes/en/después de 18/65, cambio de fecha de embarque y 29 de febrero. Datos incompletos/imposibles, categorías desconocidas y política inválida se rechazan.
- Dos políticas distintas no se mezclan ni mutan; serialización JSON conserva exactitud. Sumar solo totales redondeados por pasajero en ejemplo R01, sin añadir creación de compra.
- Ejecutar desde backend lint, format:check, npm test con PostgreSQL aislado y formato de archivos propios. Sin cambios de composición no se exige un arranque nuevo separado; las integraciones conservan sus pruebas de arranque real.

Sin dependencias nuevas, migraciones, frontend o cambios en módulos ajenos. SOLID: cálculo puro de responsabilidad única; aplicación futura inyectará fuentes confiables y usará solo APIs públicas. Ningún cambio a precios de reservas persistidas. Sin commit/push hasta petición específica de Leslie. Revisión humana e integración pendientes.

### Resultado del cálculo puro

100 pruebas dirigidas aprobadas (68 nuevas + 32 históricas). npm test completo: 1910 unitarias y 588 integraciones aprobadas, 2498 pruebas en 144 suites, salida 0. Incluye arranque real existente; no se modificó composición. Lint y formato propio aprobados; format:check global conserva 17 archivos ajenos. Fotografías pasó sin alterar timeout; PostgreSQL temporal eliminado. Diff revisado, sin cambios en passenger-quote.js o pruebas históricas. Revisar evidencia enlazada; no se declara L-01 comercial cerrada ni integración de este incremento. Sin commit/push.

Guardado autorizado por Leslie el 4 de noviembre: commit atómico del cálculo puro, sus pruebas y documentación. Publicación no solicitada en esta confirmación; revisión humana y conexión comercial pendientes. Los resultados anteriores se conservan, sin cambios funcionales posteriores a la suite.
