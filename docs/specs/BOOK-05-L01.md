# BOOK-05 / L-01: cotización con política de hoja

- **Planificación:** L-01; no es una spec aprobada ni un ID externo.
- **Spec existente:** [BOOK-05](BOOK-05.md).
- **Responsable:** Leslie Coello.
- **Revisor propuesto:** Pablo, conforme a la preferencia previa de Leslie; aceptación de este incremento pendiente. Coordinar contratos con los responsables indicados.
- **Estado:** Borrador; implementación de los nuevos incrementos no autorizada.
- **Base:** rama `feature/BOOK-03-resumen-creacion-dominio`, `c7ceed9`; remoto `origin/develop b60201e`, consultado el 1 de noviembre de 2026, sin integrar.
- **Autorización:** el usuario pidió preparar specs antes de implementar; no se infiere aprobación de este borrador.
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
